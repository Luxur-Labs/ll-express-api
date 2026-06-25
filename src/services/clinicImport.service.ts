import { prisma } from '../utils/prisma';
import { createUserStampFields, updateUserStampFields } from '../utils/userStamps';

import {
  hasClinicImportHeaders,
  parseClinicUploadBuffer,
  ClinicImportSheetRow,
} from './clinicImport.parser';
import { getNextOrganizationId } from './clinic.service';

export type ClinicImportDraft = {
  clinicId?: string;
  clinicName?: string;
  clientAddress?: string;
  contactNumber?: string;
  doctorName?: string;
  organizationId?: string;
  hasInvoices?: boolean;
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

function trimVal(v?: string): string {
  return (v ?? '').trim();
}

function rowDraft(row: ClinicImportSheetRow, existing?: {
  id: string;
  organizationId: string;
  hasInvoices: boolean;
}): ClinicImportDraft {
  return {
    clinicId: existing?.id,
    clinicName: trimVal(row.clinicName) || undefined,
    clientAddress: trimVal(row.clientAddress) || undefined,
    contactNumber: trimVal(row.contactNumber) || undefined,
    doctorName: trimVal(row.doctorName) || undefined,
    organizationId: existing?.organizationId,
    hasInvoices: existing?.hasInvoices,
  };
}

function validateRow(row: ClinicImportSheetRow): { ok: true; data: {
  clinicName: string;
  clientAddress: string;
  contactNumber: string;
  doctorName: string;
} } | { ok: false; message: string } {
  const clinicName = trimVal(row.clinicName);
  const clientAddress = trimVal(row.clientAddress);
  const contactNumber = trimVal(row.contactNumber);
  const doctorName = trimVal(row.doctorName);

  if (!clinicName) return { ok: false, message: 'Clinic name is required' };
  if (!clientAddress) return { ok: false, message: 'Address is required' };
  if (!contactNumber) return { ok: false, message: 'Doctor phone number is required' };
  if (contactNumber.length > 20) return { ok: false, message: 'Doctor phone number too long (max 20)' };
  if (!doctorName) return { ok: false, message: 'Doctor name is required' };

  return {
    ok: true,
    data: {
      clinicName,
      clientAddress,
      contactNumber,
      doctorName,
    },
  };
}

export class ClinicImportService {
  async importFromFile(buffer: Buffer, fileName: string, actorUserId?: string): Promise<ClinicImportResult> {
    const parsed = parseClinicUploadBuffer(buffer, fileName);

    if (!parsed.rows.length) {
      throw new Error('No clinic rows found. Ensure the sheet has a header row and data.');
    }
    if (!hasClinicImportHeaders(parsed.headers)) {
      throw new Error(
        `Worksheet "${parsed.sheetName}" must include Clinic Name, Address, and Doctor phone number columns. ` +
          `Found headers: ${parsed.headers.join(', ')}`
      );
    }

    const existing = await prisma.clinic.findMany({
      where: { isActive: true },
      select: {
        id: true,
        clinicName: true,
        organizationId: true,
        _count: { select: { billingInvoices: true } },
      },
    });
    const byName = new Map(
      existing.map((c) => [
        trimVal(c.clinicName).toLowerCase(),
        { id: c.id, organizationId: c.organizationId, hasInvoices: c._count.billingInvoices > 0 },
      ])
    );

    const items: ClinicImportRowResult[] = [];
    let created = 0;
    let updated = 0;
    let failed = 0;
    let skipped = 0;

    for (const row of parsed.rows) {
      const validated = validateRow(row);
      if (!validated.ok) {
        failed++;
        const existingClinic = row.clinicName
          ? byName.get(trimVal(row.clinicName).toLowerCase())
          : undefined;
        items.push({
          rowIndex: row.rowIndex,
          clinicName: row.clinicName,
          status: 'FAILED',
          message: validated.message,
          draft: rowDraft(row, existingClinic),
        });
        continue;
      }

      const { clinicName, clientAddress, contactNumber, doctorName } = validated.data;
      const existingClinic = byName.get(clinicName.toLowerCase());

      try {
        if (existingClinic) {
          await prisma.clinic.update({
            where: { id: existingClinic.id },
            data: {
              clinicName,
              clientAddress,
              contactNumber,
              doctorName,
              ...updateUserStampFields(actorUserId),
            },
          });
          updated++;
          items.push({ rowIndex: row.rowIndex, clinicName, status: 'UPDATED' });
        } else {
          const organizationId = await getNextOrganizationId();

          const createdClinic = await prisma.clinic.create({
            data: {
              clinicName,
              organizationId,
              clientAddress,
              contactNumber,
              doctorName,
              ...createUserStampFields(actorUserId),
            },
          });
          byName.set(clinicName.toLowerCase(), {
            id: createdClinic.id,
            organizationId: createdClinic.organizationId,
            hasInvoices: false,
          });
          created++;
          items.push({
            rowIndex: row.rowIndex,
            clinicName,
            status: 'CREATED',
            message: `Organization ID: ${organizationId}`,
          });
        }
      } catch (e: unknown) {
        failed++;
        const message = e instanceof Error ? e.message : 'Import failed';
        items.push({
          rowIndex: row.rowIndex,
          clinicName: row.clinicName,
          status: 'FAILED',
          message,
          draft: rowDraft(row, existingClinic),
        });
      }
    }

    if (!items.some((i) => i.status === 'CREATED' || i.status === 'UPDATED') && failed === 0) {
      skipped = parsed.rows.length;
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
