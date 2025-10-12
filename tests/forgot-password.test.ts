import request from 'supertest';
import { app } from './setup';
import { prisma } from '../src/utils/prisma';
import bcrypt from 'bcryptjs';

// Mock BetterAuth client
jest.mock('../src/services/betterauth.service', () => ({
  betterAuthForgotPassword: jest.fn(async () => {}),
}));

describe('Forgot Password', () => {
  beforeAll(async () => {
    const passwordHash = await bcrypt.hash('admin123', 10);
    await prisma.user.upsert({
      where: { email: 'admin@example.com' },
      update: {},
      create: { email: 'admin@example.com', passwordHash, role: 'SUPER_ADMIN' },
    });
  });

  it('POST /auth/forgot-password returns 202 for existing email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'admin@example.com' });
    expect(res.status).toBe(202);
  });

  it('POST /auth/forgot-password returns 202 for unknown email (no enumeration)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'unknown@example.com' });
    expect(res.status).toBe(202);
  });
});
