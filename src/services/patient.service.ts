import { prisma } from '../utils/prisma';

export interface CreatePatientData {
  name: string;
  age: number;
  gender: string;
  contactNumber: string;
}

export interface UpdatePatientData {
  name?: string;
  age?: number;
  gender?: string;
  contactNumber?: string;
}

export class PatientService {
  async createPatient(data: CreatePatientData) {
    return await prisma.patient.create({
      data,
    });
  }

  async getPatientById(id: string) {
    return await prisma.patient.findUnique({
      where: { id },
    });
  }

  async getAllPatients() {
    return await prisma.patient.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async updatePatient(id: string, data: UpdatePatientData) {
    return await prisma.patient.update({
      where: { id },
      data,
    });
  }

  async deletePatient(id: string) {
    return await prisma.patient.delete({
      where: { id },
    });
  }

  async getPatientsByGender(gender: string) {
    return await prisma.patient.findMany({
      where: { gender },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPatientsByAgeRange(minAge: number, maxAge: number) {
    return await prisma.patient.findMany({
      where: {
        age: {
          gte: minAge,
          lte: maxAge,
        },
      },
      orderBy: { age: 'asc' },
    });
  }

  async searchPatientsByName(name: string) {
    return await prisma.patient.findMany({
      where: {
        name: {
          contains: name,
          mode: 'insensitive',
        },
      },
      orderBy: { name: 'asc' },
    });
  }
}
