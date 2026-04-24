import { prisma } from '../utils/prisma';
import { Prisma } from '@prisma/client';

export class PendingBalanceLockedError extends Error {
  constructor() {
    super(
      'Pending balance cannot be changed after an invoice has been generated for this clinic.',
    );
    this.name = 'PendingBalanceLockedError';
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
  organizationId: string;
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
  async createClinic(data: CreateClinicData) {
    const createData: any = { ...data };
    if (data.pendingBalance !== undefined && data.pendingBalance !== null) {
      createData.pendingBalance = new Prisma.Decimal(Number(data.pendingBalance) || 0);
    }
    const created = await prisma.clinic.create({
      data: createData,
    });
    return { ...created, hasInvoices: false as const };
  }

  async getClinicById(id: string) {
    const row = await prisma.clinic.findFirst({
      where: { id, isActive: true },
      include: {
        _count: { select: { billingInvoices: true } },
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
      },
    });
    return rows.map((row) => withHasInvoices(row));
  }

  async updateClinic(id: string, data: UpdateClinicData) {
    if (data.pendingBalance !== undefined && data.pendingBalance !== null) {
      const invoiceCount = await prisma.billingInvoice.count({ where: { clinicId: id } });
      if (invoiceCount > 0) {
        throw new PendingBalanceLockedError();
      }
    }
    const updateData: any = { ...data };
    if (data.pendingBalance !== undefined && data.pendingBalance !== null) {
      updateData.pendingBalance = new Prisma.Decimal(Number(data.pendingBalance) || 0);
    }
    const updated = await prisma.clinic.update({
      where: { id },
      data: updateData,
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
  async deleteClinic(id: string) {
    return await prisma.clinic.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
