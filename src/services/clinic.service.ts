import { prisma } from '../utils/prisma';
import { Prisma } from '@prisma/client';
import { createUserStampFields, updateUserStampFields, userStampInclude } from '../utils/userStamps';

export class PendingBalanceLockedError extends Error {
  constructor() {
    super(
      'Pending balance cannot be changed after an invoice has been generated for this clinic.',
    );
    this.name = 'PendingBalanceLockedError';
  }
}

export class OrganizationIdConflictError extends Error {
  constructor(requested: string, existing: string) {
    super(
      `Organization number ${requested} is already used by ${existing}. Choose the next available number.`,
    );
    this.name = 'OrganizationIdConflictError';
  }
}

export class OrganizationIdFormatError extends Error {
  constructor() {
    super('Organization ID must look like ORG-1 (ORG- prefix with a numeric suffix, no leading zeros).');
    this.name = 'OrganizationIdFormatError';
  }
}

function withHasInvoices<T extends { _count: { billingInvoices: number } }>(
  row: T,
): Omit<T, '_count'> & { hasInvoices: boolean } {
  const { _count, ...rest } = row;
  return { ...(rest as Omit<T, '_count'>), hasInvoices: _count.billingInvoices > 0 };
}

export interface CreateClinicData {
  clinicName: string;
  clientAddress: string;
  contactNumber: string;
  doctorName?: string;
  pendingBalance?: number;
}

export interface UpdateClinicData {
  clinicName?: string;
  organizationId?: string;
  clientAddress?: string;
  contactNumber?: string;
  doctorName?: string;
  pendingBalance?: number;
}

export class ClinicService {
  async createClinic(data: CreateClinicData, actorUserId?: string) {
    const organizationId = await getNextOrganizationId();
    await assertOrganizationNumberAvailable(organizationId);
    const createData: any = { ...data, organizationId, ...createUserStampFields(actorUserId) };
    if (data.pendingBalance !== undefined && data.pendingBalance !== null) {
      createData.pendingBalance = new Prisma.Decimal(Number(data.pendingBalance) || 0);
    }
    const created = await prisma.clinic.create({
      data: createData,
      include: userStampInclude,
    });
    return { ...created, hasInvoices: false as const };
  }

  async getClinicById(id: string) {
    const row = await prisma.clinic.findFirst({
      where: { id, isActive: true },
      include: {
        _count: { select: { billingInvoices: true } },
        ...userStampInclude,
      },
    });
    if (!row) return null;
    return withHasInvoices(row);
  }

  async getAllClinics() {
    const rows = await prisma.clinic.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { billingInvoices: true } },
        ...userStampInclude,
      },
    });
    return rows.map((row) => withHasInvoices(row));
  }

  async updateClinic(id: string, data: UpdateClinicData, actorUserId?: string) {
    if (data.pendingBalance !== undefined && data.pendingBalance !== null) {
      const invoiceCount = await prisma.billingInvoice.count({ where: { clinicId: id } });
      if (invoiceCount > 0) {
        throw new PendingBalanceLockedError();
      }
    }
    const updateData: any = { ...data, ...updateUserStampFields(actorUserId) };
    if (data.organizationId !== undefined) {
      const normalized = normalizeOrganizationId(String(data.organizationId));
      await assertOrganizationNumberAvailable(normalized, id);
      updateData.organizationId = normalized;
    }
    if (data.pendingBalance !== undefined && data.pendingBalance !== null) {
      updateData.pendingBalance = new Prisma.Decimal(Number(data.pendingBalance) || 0);
    }
    const updated = await prisma.clinic.update({
      where: { id },
      data: updateData,
      include: userStampInclude,
    });
    const invoiceCount = await prisma.billingInvoice.count({ where: { clinicId: id } });
    return { ...updated, hasInvoices: invoiceCount > 0 };
  }

  async getClinicsByOrganization(organizationId: string) {
    const rows = await prisma.clinic.findMany({
      where: { organizationId, isActive: true },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { billingInvoices: true } },
        ...userStampInclude,
      },
    });
    return rows.map((row) => withHasInvoices(row));
  }

  async getClinicsList(page: number = 0, limit: number = 50, search?: string) {
    const safeLimit = Math.max(1, limit);
    const safePage = Math.max(0, page);
    const where: any = { isActive: true };

    if (search && search.trim()) {
      const term = search.trim();
      where.OR = [
        { clinicName: { contains: term, mode: 'insensitive' } },
        { organizationId: { contains: term, mode: 'insensitive' } },
        { contactNumber: { contains: term, mode: 'insensitive' } },
        { doctorName: { contains: term, mode: 'insensitive' } },
      ];
    }

    const total = await prisma.clinic.count({ where });
    const skip = safePage * safeLimit;

    if (skip >= total) {
      return {
        data: [],
        pagination: {
          page: safePage,
          limit: safeLimit,
          total,
        },
      };
    }

    const clinicRows = await prisma.clinic.findMany({
      where,
      select: {
        id: true,
        clinicName: true,
        clientAddress: true,
        contactNumber: true,
        organizationId: true,
        doctorName: true,
        pendingBalance: true,
        createdAt: true,
        updatedAt: true,
        createdBy: userStampInclude.createdBy,
        updatedBy: userStampInclude.updatedBy,
        _count: { select: { billingInvoices: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: safeLimit,
    });

    const clinics = clinicRows.map((row) => withHasInvoices(row));

    return {
      data: clinics,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
      },
    };
  }

  /**
   * Soft delete a clinic (set isActive to false)
   */
  async deleteClinic(id: string, actorUserId?: string) {
    return await prisma.clinic.update({
      where: { id },
      data: { isActive: false, ...updateUserStampFields(actorUserId) },
    });
  }
}

function parseOrgNumber(orgId: string): number | null {
  const match = /^ORG-(\d+)$/i.exec(orgId.trim());
  return match ? parseInt(match[1], 10) : null;
}

/** Canonical format: ORG-1, ORG-571, etc. (no leading zeros). */
export function formatOrganizationId(n: number): string {
  if (!Number.isFinite(n) || n < 1) {
    throw new OrganizationIdFormatError();
  }
  return `ORG-${n}`;
}

export function normalizeOrganizationId(orgId: string): string {
  const n = parseOrgNumber(orgId);
  if (n === null) {
    throw new OrganizationIdFormatError();
  }
  return formatOrganizationId(n);
}

async function loadUsedOrganizationNumbers(excludeClinicId?: string): Promise<Set<number>> {
  const clinics = await prisma.clinic.findMany({
    where: excludeClinicId ? { id: { not: excludeClinicId } } : undefined,
    select: { organizationId: true },
  });
  const used = new Set<number>();
  for (const c of clinics) {
    const n = parseOrgNumber(c.organizationId);
    if (n !== null && n > 0) used.add(n);
  }
  return used;
}

export async function assertOrganizationNumberAvailable(
  orgId: string,
  excludeClinicId?: string,
): Promise<void> {
  const requested = normalizeOrganizationId(orgId);
  const n = parseOrgNumber(requested);
  if (n === null) throw new OrganizationIdFormatError();

  const rows = await prisma.clinic.findMany({
    where: excludeClinicId ? { id: { not: excludeClinicId } } : undefined,
    select: { organizationId: true },
  });
  for (const row of rows) {
    const existingNum = parseOrgNumber(row.organizationId);
    if (existingNum === n) {
      throw new OrganizationIdConflictError(requested, row.organizationId);
    }
  }
}

export async function getNextOrganizationId(): Promise<string> {
  const usedNumbers = await loadUsedOrganizationNumbers();
  let candidate = usedNumbers.size > 0 ? Math.max(...usedNumbers) + 1 : 1;
  while (usedNumbers.has(candidate)) {
    candidate += 1;
  }
  return formatOrganizationId(candidate);
}
