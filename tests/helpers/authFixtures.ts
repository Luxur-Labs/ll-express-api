import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import { app } from '../setup';
import { prisma } from '../../src/utils/prisma';
import { env } from '../../src/config/env';
import type { Role } from '../../src/types/auth';

const DEFAULT_PASSWORD = 'role-test-pass123';

export async function createRoleTestUser(role: Role, label: string) {
  const email = `${label}-${role.toLowerCase()}-${Date.now()}@example.com`;
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role,
      isActive: true,
      tokenVersion: 0,
      name: `${role} Test User`,
    },
  });

  const login = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password: DEFAULT_PASSWORD });

  if (login.status !== 200) {
    throw new Error(`Login failed for ${role} (${email}): ${login.status} ${JSON.stringify(login.body)}`);
  }

  return {
    user,
    email,
    password: DEFAULT_PASSWORD,
    token: login.body.token as string,
  };
}

/** Token for roles that cannot log in (DOCTOR, EMPLOYEE). */
export function signRoleToken(userId: string, email: string, role: Role): string {
  return jwt.sign({ id: userId, email, role, tokenVersion: 0 }, env.JWT_SECRET, {
    expiresIn: '1h',
  });
}

export async function deleteTestUsers(emails: string[]) {
  if (emails.length === 0) return;
  await prisma.refreshToken.deleteMany({ where: { user: { email: { in: emails } } } });
  await prisma.user.deleteMany({ where: { email: { in: emails } } });
}
