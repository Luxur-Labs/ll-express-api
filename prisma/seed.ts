import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

// No need to import Role type; use string literal values for seeding

const prisma = new PrismaClient();

async function main() {
  const [qc, , cad] = await Promise.all([
    prisma.employeeType.upsert({ where: { name: 'QC' }, update: {}, create: { name: 'QC' } }),
    prisma.employeeType.upsert({ where: { name: 'TECHNICIAN' }, update: {}, create: { name: 'TECHNICIAN' } }),
    prisma.technicianGroup.upsert({ where: { name: 'CAD_TECHNICIAN' }, update: {}, create: { name: 'CAD_TECHNICIAN' } }),
    prisma.technicianGroup.upsert({ where: { name: 'CAM_TECHNICIAN' }, update: {}, create: { name: 'CAM_TECHNICIAN' } }),
  ]);

  const adminEmail = 'admin@example.com';
  const passwordHash = await bcrypt.hash('admin123', 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash,
      role: 'SUPER_ADMIN',
      employeeTypeId: qc.id,
      technicianGroupId: cad.id,
    }
  });
}

main().finally(async () => {
  await prisma.$disconnect();
});


