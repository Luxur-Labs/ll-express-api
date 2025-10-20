import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);

  // Ensure some Employee Types and Technician Groups exist (best-effort)
  const [qc, tech, cadGroup] = await Promise.all([
    prisma.employeeType.upsert({ where: { name: 'QC' }, update: {}, create: { name: 'QC' } }),
    prisma.employeeType.upsert({ where: { name: 'TECHNICIAN' }, update: {}, create: { name: 'TECHNICIAN' } }),
    prisma.technicianGroup.upsert({ where: { name: 'CAD_TECHNICIAN' }, update: {}, create: { name: 'CAD_TECHNICIAN' } }),
  ]);

  // Doctor user
  await prisma.user.upsert({
    where: { email: 'doctor@example.com' },
    update: {},
    create: {
      email: 'doctor@example.com',
      name: 'Dr. Demo Doctor',
      passwordHash,
      role: 'DOCTOR',
      // For doctors we typically don't assign employee type/group, keep nulls
      employeeTypeId: null,
      technicianGroupId: null,
    }
  });

  // Employee user
  await prisma.user.upsert({
    where: { email: 'employee@example.com' },
    update: {},
    create: {
      email: 'employee@example.com',
      name: 'Demo Employee',
      passwordHash,
      role: 'EMPLOYEE',
      employeeTypeId: qc.id ?? tech.id,
      technicianGroupId: cadGroup.id,
    }
  });

  console.log('Created/verified demo users: doctor@example.com, employee@example.com (password: password123)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
