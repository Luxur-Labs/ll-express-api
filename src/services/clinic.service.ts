import { prisma } from '../utils/prisma';

export interface CreateClinicData {
  clinicName: string;
  organizationId: string;
  clientAddress: string;
  contactNumber: string;
}

export interface UpdateClinicData {
  clinicName?: string;
  organizationId?: string;
  clientAddress?: string;
  contactNumber?: string;
}

export class ClinicService {
  async createClinic(data: CreateClinicData) {
    return await prisma.clinic.create({
      data,
    });
  }

  async getClinicById(id: string) {
    return await prisma.clinic.findUnique({
      where: { id },
    });
  }

  async getAllClinics() {
    return await prisma.clinic.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateClinic(id: string, data: UpdateClinicData) {
    return await prisma.clinic.update({
      where: { id },
      data,
    });
  }

  async deleteClinic(id: string) {
    return await prisma.clinic.delete({
      where: { id },
    });
  }

  async getClinicsByOrganization(organizationId: string) {
    return await prisma.clinic.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getClinicsList() {
    return await prisma.clinic.findMany({
      select: {
        id: true,
        clinicName: true,
        clientAddress: true,
        contactNumber: true,
        organizationId: true,
      },
      orderBy: { clinicName: 'asc' },
    });
  }
}
