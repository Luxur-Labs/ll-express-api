import { prisma } from '../utils/prisma';
import { createUserStampFields, updateUserStampFields, userStampInclude } from '../utils/userStamps';

export interface CreatePatientData {
  name: string;
  age: number;
  gender: string;
  contactNumber?: string;
}

export interface UpdatePatientData {
  name?: string;
  age?: number;
  gender?: string;
  contactNumber?: string;
}

export class PatientService {
  async createPatient(data: CreatePatientData, actorUserId?: string) {
    return await prisma.patient.create({
      data: { ...data, ...createUserStampFields(actorUserId) },
      include: userStampInclude,
    });
  }

  async getPatientById(id: string) {
    return await prisma.patient.findUnique({
      where: { id },
      include: userStampInclude,
    });
  }

  async getAllPatients() {
    return await prisma.patient.findMany({
      orderBy: { createdAt: 'desc' },
      include: userStampInclude,
    });
  }

  async updatePatient(id: string, data: UpdatePatientData, actorUserId?: string) {
    return await prisma.patient.update({
      where: { id },
      data: { ...data, ...updateUserStampFields(actorUserId) },
      include: userStampInclude,
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

  async getPatientsList() {
    return await prisma.patient.findMany({
      select: {
        id: true,
        name: true,
        age: true,
        gender: true,
      },
      orderBy: { name: 'asc' },
    });
  }
}
