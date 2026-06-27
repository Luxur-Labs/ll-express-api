/**
 * Upsert a SUPER_ADMIN user.
 *
 * Env: EMAIL, PASSWORD, ENV_FILE (.env.prod on server)
 * Default: admin@example.com / admin@123
 *
 * Local:  EMAIL=admin@luxur.com PASSWORD='...' npm run prisma:seed:admin
 * EC2:    EMAIL=admin@luxur.com PASSWORD='...' ./scripts/run-on-server.sh admin
 * EC2:    docker compose exec api npm run prisma:seed:admin  (with EMAIL/PASSWORD -e)
 */
import * as fs from 'fs';
import * as path from 'path';

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';

function loadEnv(): void {
  const envFile =
    process.env.ENV_FILE ||
    (fs.existsSync(path.resolve(process.cwd(), '.env.prod')) ? '.env.prod' : '.env');
  const resolved = path.resolve(process.cwd(), envFile);
  if (fs.existsSync(resolved)) {
    dotenv.config({ path: resolved });
  }
}

async function main(): Promise<void> {
  loadEnv();

  const email = process.env.EMAIL || 'admin@luxur.com';
  const password = process.env.PASSWORD || 'admin123';
  const rounds = Number(process.env.BCRYPT_SALT_ROUNDS || 10);
  const passwordHash = await bcrypt.hash(password, rounds);
  const prisma = new PrismaClient();

  try {
    const adminUser = await prisma.user.upsert({
      where: { email },
      update: {
        passwordHash,
        role: 'SUPER_ADMIN',
        name: 'System Administrator',
        isActive: true,
      },
      create: {
        email,
        passwordHash,
        role: 'SUPER_ADMIN',
        name: 'System Administrator',
        isActive: true,
      },
    });

    console.log('Admin user created/updated:');
    console.log(`  email: ${adminUser.email}`);
    console.log(`  role:  ${adminUser.role}`);
    console.log(`  id:    ${adminUser.id}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
