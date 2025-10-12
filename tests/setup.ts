import { createApp } from '../src/app/app';
import { prisma } from '../src/utils/prisma';

export const app = createApp();

export async function resetDb() {
  await prisma.user.deleteMany();
  await prisma.employeeType.deleteMany();
  await prisma.technicianGroup.deleteMany();
}

export async function closeDb() {
  await prisma.$disconnect();
}
