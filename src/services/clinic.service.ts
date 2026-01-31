import { prisma } from '../utils/prisma';

export interface CreateClinicData {
  clinicName: string;
  organizationId: string;
  clientAddress: string;
  contactNumber: string;
  doctorName?: string;
}

export interface UpdateClinicData {
  clinicName?: string;
  organizationId?: string;
  clientAddress?: string;
  contactNumber?: string;
  doctorName?: string;
}

export class ClinicService {
  async createClinic(data: CreateClinicData) {
    return await prisma.clinic.create({
      data,
    });
  }

  async getClinicById(id: string) {
    return await prisma.clinic.findFirst({
      where: { id, isActive: true },
    });
  }

  async getAllClinics() {
    return await prisma.clinic.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateClinic(id: string, data: UpdateClinicData) {
    return await prisma.clinic.update({
      where: { id },
      data,
    });
  }

  async getClinicsByOrganization(organizationId: string) {
    return await prisma.clinic.findMany({
      where: { organizationId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
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

    const clinics = await prisma.clinic.findMany({
      where,
      select: {
        id: true,
        clinicName: true,
        clientAddress: true,
        contactNumber: true,
        organizationId: true,
        doctorName: true,
      } as any,
      orderBy: { createdAt: 'desc' },
      skip,
      take: safeLimit,
    });

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
