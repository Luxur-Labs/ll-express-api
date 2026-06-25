import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEMO_USERS = [
  { email: 'labmanager@luxur.com', password: 'lab123', role: 'LAB_MANAGER' as const, name: 'Lab Manager' },
  { email: 'frontoffice@luxur.com', password: 'front123', role: 'FRONT_OFFICE' as const, name: 'Front Office' },
];

async function main() {
  for (const u of DEMO_USERS) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    await prisma.user.upsert({
      where: { email: u.email },
      update: { passwordHash, role: u.role, name: u.name },
      create: { email: u.email, passwordHash, role: u.role, name: u.name },
    });
    console.log(`OK: ${u.email} (${u.role}) / ${u.password}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
