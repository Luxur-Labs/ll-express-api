import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const [qc, cadTechnician] = await Promise.all([
    prisma.employeeType.upsert({ where: { name: 'QC' }, update: {}, create: { name: 'QC' } }),
    prisma.technicianGroup.upsert({ where: { name: 'CAD_TECHNICIAN' }, update: {}, create: { name: 'CAD_TECHNICIAN' } }),
  ]);

  await Promise.all([
    prisma.employeeType.upsert({ where: { name: 'TECHNICIAN' }, update: {}, create: { name: 'TECHNICIAN' } }),
    prisma.employeeType.upsert({ where: { name: 'DISPATCHER' }, update: {}, create: { name: 'DISPATCHER' } }),
    prisma.technicianGroup.upsert({ where: { name: 'CAM_TECHNICIAN' }, update: {}, create: { name: 'CAM_TECHNICIAN' } }),
  ]);

  const adminEmail = 'admin@example.com';
  const passwordHash = await bcrypt.hash('admin123', 10);

  const superAdminUser = {
    passwordHash,
    role: 'SUPER_ADMIN' as const,
    employeeTypeId: qc.id,
    technicianGroupId: cadTechnician.id,
  };

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      ...superAdminUser,
    },
  });

  await prisma.user.upsert({
    where: { email: 'admin@luxur.com' },
    update: { passwordHash: superAdminUser.passwordHash },
    create: {
      email: 'admin@luxur.com',
      ...superAdminUser,
    },
  });

  console.log('✅ Seeded admin users and reference data (no clinics or products)');
}

main().finally(async () => {
  await prisma.$disconnect();
});
