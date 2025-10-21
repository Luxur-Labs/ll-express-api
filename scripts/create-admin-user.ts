import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/utils/password';

const prisma = new PrismaClient();

async function createAdminUser() {
  try {
    // Hash the password using the project's utility
    const hashedPassword = await hashPassword('admin@123');

    // Create or update the admin user
    const adminUser = await prisma.user.upsert({
      where: { email: 'admin@example.com' },
      update: {
        passwordHash: hashedPassword,
        role: 'SUPER_ADMIN',
        name: 'System Administrator',
      },
      create: {
        email: 'admin@example.com',
        passwordHash: hashedPassword,
        role: 'SUPER_ADMIN',
        name: 'System Administrator',
        employeeTypeId: null,
        technicianGroupId: null,
        failedLoginAttempts: 0,
        accountLockedUntil: null,
        lastLoginAt: null,
        lastLoginIp: null,
        dateOfBirth: null,
        contact: null,
        document: null,
        profilePhoto: null,
      },
    });

    console.log('✅ Admin user created/updated successfully:');
    console.log(`   Email: ${adminUser.email}`);
    console.log(`   Role: ${adminUser.role}`);
    console.log(`   Name: ${adminUser.name}`);
    console.log(`   ID: ${adminUser.id}`);
    
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createAdminUser();
