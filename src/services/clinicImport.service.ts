import { Prisma } from '@prisma/client';

import { prisma } from '../utils/prisma';
import { createUserStampFields, updateUserStampFields } from '../utils/userStamps';

import {
  ClinicImportField,
  ClinicImportMatchBy,
  parseClinicUploadBuffer,
  ClinicImportSheetRow,
  validateClinicImportHeaders,
} from './clinicImport.parser';
import { getNextOrganizationId, PendingBalanceLockedError } from './clinic.service';

export type { ClinicImportField, ClinicImportMatchBy };

export type ClinicImportDraft = {
  clinicId?: string;
  clinicName?: string;
  clientAddress?: string;
  contactNumber?: string;
  doctorName?: string;
  organizationId?: string;
  hasInvoices?: boolean;
  pendingBalance?: number;
};

export type ClinicImportRowResult = {
  rowIndex: number;
  clinicName?: string;
  status: 'CREATED' | 'UPDATED' | 'FAILED' | 'SKIPPED';
  message?: string;
  draft?: ClinicImportDraft;
};

export type ClinicImportResult = {
  parseInfo: {
    sheetName: string;
    headerRowIndex: number;
    headers: string[];
  };
  summary: {
    totalRows: number;
    created: number;
    updated: number;
    failed: number;
    skipped: number;
  };
  items: ClinicImportRowResult[];
};

export type ClinicImportOptions = {
  /** How to find an existing clinic in the database (name first, then phone when both enabled). */
  matchBy?: ClinicImportMatchBy[];
  /** Sheet columns to apply when updating an existing clinic. New clinics always use all present columns. */
  updateFields?: ClinicImportField[];
};

const DEFAULT_MATCH_BY: ClinicImportMatchBy[] = ['clinicName', 'contactNumber'];

type ClinicRef = {
  id: string;
  organizationId: string;
  hasInvoices: boolean;
  clinicName: string;
  contactNumber: string;
  clientAddress: string;
  doctorName: string;
  pendingBalance: Prisma.Decimal;
};

type ParsedRowData = {
  clinicName: string;
  clientAddress: string;
  contactNumber: string;
  doctorName: string;
  pendingBalance?: number;
  pendingBalanceInvalid?: boolean;
};

function trimVal(v?: string): string {
  return (v ?? '').trim();
}

function resolveOptions(options: ClinicImportOptions): Required<ClinicImportOptions> {
  const matchBy = options.matchBy?.length ? options.matchBy : DEFAULT_MATCH_BY;
  return {
    matchBy,
    updateFields: options.updateFields ?? [],
  };
}

/** Match clinics by last 10 digits (Indian mobile) or full digit string when shorter. */
export function normalizeClinicPhoneKey(contactNumber: string): string {
  const digits = contactNumber.replace(/\D/g, '');
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
}

function parsePendingBalance(raw?: string): number | undefined {
  if (raw === undefined || raw === null || !String(raw).trim()) return undefined;
  const n = Number(String(raw).replace(/[,₹\s]/g, ''));
  return Number.isFinite(n) ? n : undefined;
}

function parseRowData(row: ClinicImportSheetRow): ParsedRowData {
  const pendingBalance = parsePendingBalance(row.pendingBalance);
  return {
    clinicName: trimVal(row.clinicName),
    clientAddress: trimVal(row.clientAddress),
    contactNumber: trimVal(row.contactNumber),
    doctorName: trimVal(row.doctorName),
    pendingBalance,
    pendingBalanceInvalid:
      !!row.pendingBalance?.trim() && pendingBalance === undefined,
  };
}

function rowDraft(row: ClinicImportSheetRow, existing?: ClinicRef): ClinicImportDraft {
  return {
    clinicId: existing?.id,
    clinicName: trimVal(row.clinicName) || undefined,
    clientAddress: trimVal(row.clientAddress) || undefined,
    contactNumber: trimVal(row.contactNumber) || undefined,
    doctorName: trimVal(row.doctorName) || undefined,
    organizationId: existing?.organizationId,
    hasInvoices: existing?.hasInvoices,
    pendingBalance: parsePendingBalance(row.pendingBalance),
  };
}

function validateCreateRow(row: ClinicImportSheetRow): { ok: true; data: ParsedRowData } | { ok: false; message: string } {
  const data = parseRowData(row);

  if (!data.clinicName) return { ok: false, message: 'Clinic name is required for new clinics' };
  if (!data.contactNumber) return { ok: false, message: 'Doctor phone number is required for new clinics' };
  if (data.contactNumber.length > 20) return { ok: false, message: 'Doctor phone number too long (max 20)' };
  if (!data.doctorName) return { ok: false, message: 'Doctor name is required for new clinics' };
  if (data.pendingBalanceInvalid) {
    return { ok: false, message: 'Pending balance must be a valid number' };
  }

  return { ok: true, data };
}

function hasMatchKeys(row: ParsedRowData, matchBy: ClinicImportMatchBy[]): boolean {
  if (matchBy.includes('clinicName') && row.clinicName) return true;
  if (matchBy.includes('contactNumber') && normalizeClinicPhoneKey(row.contactNumber).length >= 10) {
    return true;
  }
  return false;
}

function buildClinicIndexes(clinics: Array<{
  id: string;
  clinicName: string;
  organizationId: string;
  contactNumber: string;
  clientAddress: string;
  doctorName: string | null;
  pendingBalance: Prisma.Decimal;
  _count: { billingInvoices: number };
}>) {
  const byName = new Map<string, ClinicRef>();
  const byPhone = new Map<string, ClinicRef>();

  for (const c of clinics) {
    const ref: ClinicRef = {
      id: c.id,
      organizationId: c.organizationId,
      hasInvoices: c._count.billingInvoices > 0,
      clinicName: c.clinicName,
      contactNumber: c.contactNumber,
      clientAddress: c.clientAddress,
      doctorName: c.doctorName ?? '',
      pendingBalance: c.pendingBalance,
    };
    byName.set(trimVal(c.clinicName).toLowerCase(), ref);
    const phoneKey = normalizeClinicPhoneKey(c.contactNumber);
    if (phoneKey.length >= 10 && !byPhone.has(phoneKey)) {
      byPhone.set(phoneKey, ref);
    }
  }

  return { byName, byPhone };
}

function registerClinicRef(
  ref: ClinicRef,
  byName: Map<string, ClinicRef>,
  byPhone: Map<string, ClinicRef>,
) {
  byName.set(trimVal(ref.clinicName).toLowerCase(), ref);
  const phoneKey = normalizeClinicPhoneKey(ref.contactNumber);
  if (phoneKey.length >= 10) {
    byPhone.set(phoneKey, ref);
  }
}

function findExistingClinic(
  clinicName: string,
  contactNumber: string,
  byName: Map<string, ClinicRef>,
  byPhone: Map<string, ClinicRef>,
  matchBy: ClinicImportMatchBy[],
): { clinic: ClinicRef; matchedBy: 'name' | 'phone' } | undefined {
  if (matchBy.includes('clinicName') && clinicName) {
    const byNameHit = byName.get(clinicName.toLowerCase());
    if (byNameHit) return { clinic: byNameHit, matchedBy: 'name' };
  }

  if (matchBy.includes('contactNumber') && contactNumber) {
    const phoneKey = normalizeClinicPhoneKey(contactNumber);
    if (phoneKey.length >= 10) {
      const byPhoneHit = byPhone.get(phoneKey);
      if (byPhoneHit) return { clinic: byPhoneHit, matchedBy: 'phone' };
    }
  }

  return undefined;
}

function decimalsEqual(a: Prisma.Decimal, b: number): boolean {
  return a.equals(new Prisma.Decimal(b));
}

function buildUpdatePatch(
  data: ParsedRowData,
  existing: ClinicRef,
  updateFields: ClinicImportField[],
): { patch: Prisma.ClinicUpdateInput; changedLabels: string[]; error?: string } {
  const patch: Prisma.ClinicUpdateInput = {};
  const changedLabels: string[] = [];

  if (data.pendingBalanceInvalid) {
    return { patch, changedLabels, error: 'Pending balance must be a valid number' };
  }

  if (updateFields.includes('clinicName') && data.clinicName && data.clinicName !== existing.clinicName) {
    patch.clinicName = data.clinicName;
    changedLabels.push('clinic name');
  }
  if (updateFields.includes('clientAddress') && data.clientAddress && data.clientAddress !== existing.clientAddress) {
    patch.clientAddress = data.clientAddress;
    changedLabels.push('address');
  }
  if (updateFields.includes('contactNumber') && data.contactNumber) {
    if (data.contactNumber.length > 20) {
      return { patch, changedLabels, error: 'Doctor phone number too long (max 20)' };
    }
    if (data.contactNumber !== existing.contactNumber) {
      patch.contactNumber = data.contactNumber;
      changedLabels.push('phone');
    }
  }
  if (updateFields.includes('doctorName') && data.doctorName && data.doctorName !== existing.doctorName) {
    patch.doctorName = data.doctorName;
    changedLabels.push('doctor name');
  }
  if (
    updateFields.includes('pendingBalance') &&
    data.pendingBalance !== undefined &&
    !decimalsEqual(existing.pendingBalance, data.pendingBalance)
  ) {
    patch.pendingBalance = new Prisma.Decimal(data.pendingBalance);
    changedLabels.push('pending balance');
  }

  return { patch, changedLabels };
}

export class ClinicImportService {
  async importFromFile(
    buffer: Buffer,
    fileName: string,
    actorUserId?: string,
    options: ClinicImportOptions = {},
  ): Promise<ClinicImportResult> {
    const resolved = resolveOptions(options);
    const parsed = parseClinicUploadBuffer(buffer, fileName);

    if (!parsed.rows.length) {
      throw new Error('No clinic rows found. Ensure the sheet has a header row and data.');
    }

    const headerError = validateClinicImportHeaders(parsed.headers, resolved.matchBy);
    if (headerError) {
      throw new Error(headerError);
    }

    const existing = await prisma.clinic.findMany({
      where: { isActive: true },
      select: {
        id: true,
        clinicName: true,
        organizationId: true,
        contactNumber: true,
        clientAddress: true,
        doctorName: true,
        pendingBalance: true,
        _count: { select: { billingInvoices: true } },
      },
    });
    const { byName, byPhone } = buildClinicIndexes(existing);

    const items: ClinicImportRowResult[] = [];
    let created = 0;
    let updated = 0;
    let failed = 0;
    let skipped = 0;

    for (const row of parsed.rows) {
      const data = parseRowData(row);
      const lookup = hasMatchKeys(data, resolved.matchBy)
        ? findExistingClinic(data.clinicName, data.contactNumber, byName, byPhone, resolved.matchBy)
        : undefined;

      if (lookup) {
        const existingClinic = lookup.clinic;
        const displayName = data.clinicName || existingClinic.clinicName;

        if (!resolved.updateFields.length) {
          skipped++;
          items.push({
            rowIndex: row.rowIndex,
            clinicName: displayName,
            status: 'SKIPPED',
            message: 'Clinic exists — select columns to update under import options',
          });
          continue;
        }

        const { patch, changedLabels, error } = buildUpdatePatch(data, existingClinic, resolved.updateFields);
        if (error) {
          failed++;
          items.push({
            rowIndex: row.rowIndex,
            clinicName: displayName,
            status: 'FAILED',
            message: error,
            draft: rowDraft(row, existingClinic),
          });
          continue;
        }

        if (!Object.keys(patch).length) {
          skipped++;
          const matchNote = lookup.matchedBy === 'phone' ? 'Matched by mobile number' : 'Matched by clinic name';
          items.push({
            rowIndex: row.rowIndex,
            clinicName: displayName,
            status: 'SKIPPED',
            message: `${matchNote}; no changes in selected columns`,
          });
          continue;
        }

        if (patch.pendingBalance !== undefined && existingClinic.hasInvoices) {
          failed++;
          items.push({
            rowIndex: row.rowIndex,
            clinicName: displayName,
            status: 'FAILED',
            message: new PendingBalanceLockedError().message,
            draft: rowDraft(row, existingClinic),
          });
          continue;
        }

        try {
          const updateData: Prisma.ClinicUpdateInput = {
            ...patch,
            ...updateUserStampFields(actorUserId),
          };

          await prisma.clinic.update({
            where: { id: existingClinic.id },
            data: updateData,
          });

          const nextClinicName =
            typeof patch.clinicName === 'string' ? patch.clinicName : existingClinic.clinicName;
          const nextContact =
            typeof patch.contactNumber === 'string' ? patch.contactNumber : existingClinic.contactNumber;

          const ref: ClinicRef = {
            id: existingClinic.id,
            organizationId: existingClinic.organizationId,
            hasInvoices: existingClinic.hasInvoices,
            clinicName: nextClinicName,
            contactNumber: nextContact,
            clientAddress:
              typeof patch.clientAddress === 'string' ? patch.clientAddress : existingClinic.clientAddress,
            doctorName: typeof patch.doctorName === 'string' ? patch.doctorName : existingClinic.doctorName,
            pendingBalance:
              patch.pendingBalance instanceof Prisma.Decimal
                ? patch.pendingBalance
                : existingClinic.pendingBalance,
          };

          const oldPhoneKey = normalizeClinicPhoneKey(existingClinic.contactNumber);
          const newPhoneKey = normalizeClinicPhoneKey(nextContact);
          if (oldPhoneKey.length >= 10 && oldPhoneKey !== newPhoneKey && byPhone.get(oldPhoneKey)?.id === existingClinic.id) {
            byPhone.delete(oldPhoneKey);
          }
          registerClinicRef(ref, byName, byPhone);

          updated++;
          const matchNote = lookup.matchedBy === 'phone' ? 'Matched by mobile number' : undefined;
          const changeNote = `Updated: ${changedLabels.join(', ')}`;
          items.push({
            rowIndex: row.rowIndex,
            clinicName: displayName,
            status: 'UPDATED',
            message: [matchNote, changeNote].filter(Boolean).join('. '),
          });
        } catch (e: unknown) {
          failed++;
          const message = e instanceof Error ? e.message : 'Import failed';
          items.push({
            rowIndex: row.rowIndex,
            clinicName: displayName,
            status: 'FAILED',
            message,
            draft: rowDraft(row, existingClinic),
          });
        }
        continue;
      }

      const validated = validateCreateRow(row);
      if (!validated.ok) {
        failed++;
        items.push({
          rowIndex: row.rowIndex,
          clinicName: row.clinicName,
          status: 'FAILED',
          message: validated.message,
          draft: rowDraft(row),
        });
        continue;
      }

      const createData = validated.data;
      try {
        const organizationId = await getNextOrganizationId();

        const prismaCreate: Prisma.ClinicCreateInput = {
          clinicName: createData.clinicName,
          organizationId,
          clientAddress: createData.clientAddress,
          contactNumber: createData.contactNumber,
          doctorName: createData.doctorName,
          ...createUserStampFields(actorUserId),
        };
        if (createData.pendingBalance !== undefined) {
          prismaCreate.pendingBalance = new Prisma.Decimal(createData.pendingBalance);
        }

        const createdClinic = await prisma.clinic.create({ data: prismaCreate });

        registerClinicRef(
          {
            id: createdClinic.id,
            organizationId: createdClinic.organizationId,
            hasInvoices: false,
            clinicName: createData.clinicName,
            contactNumber: createData.contactNumber,
            clientAddress: createData.clientAddress,
            doctorName: createData.doctorName,
            pendingBalance:
              createData.pendingBalance !== undefined
                ? new Prisma.Decimal(createData.pendingBalance)
                : new Prisma.Decimal(0),
          },
          byName,
          byPhone,
        );
        created++;
        items.push({
          rowIndex: row.rowIndex,
          clinicName: createData.clinicName,
          status: 'CREATED',
          message: `Organization ID: ${organizationId}${
            createData.pendingBalance !== undefined ? '; pending balance set' : ''
          }`,
        });
      } catch (e: unknown) {
        failed++;
        const message = e instanceof Error ? e.message : 'Import failed';
        items.push({
          rowIndex: row.rowIndex,
          clinicName: row.clinicName,
          status: 'FAILED',
          message,
          draft: rowDraft(row),
        });
      }
    }

    return {
      parseInfo: {
        sheetName: parsed.sheetName,
        headerRowIndex: parsed.headerRowIndex,
        headers: parsed.headers,
      },
      summary: {
        totalRows: parsed.rows.length,
        created,
        updated,
        failed,
        skipped,
      },
      items,
    };
  }
}

export const clinicImportService = new ClinicImportService();
