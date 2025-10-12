import request from 'supertest';
import { app } from './setup';
import { prisma } from '../src/utils/prisma';
import bcrypt from 'bcryptjs';

describe('Health and Auth', () => {
  beforeAll(async () => {
    // seed minimal admin
    const passwordHash = await bcrypt.hash('admin123', 10);
    await prisma.employeeType.upsert({ where: { name: 'QC' }, update: {}, create: { name: 'QC' } });
    await prisma.technicianGroup.upsert({ where: { name: 'CAD_TECHNICIAN' }, update: {}, create: { name: 'CAD_TECHNICIAN' } });
    await prisma.user.upsert({
      where: { email: 'admin@example.com' },
      update: {},
      create: {
        email: 'admin@example.com',
        passwordHash,
        role: 'SUPER_ADMIN',
      },
    });
  });

  it('GET /health returns ok', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('POST /auth/login returns token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@example.com', password: 'admin123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });

  it('GET /auth/me returns user with token', async () => {
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@example.com', password: 'admin123' });
    const token = login.body.token as string;
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBeTruthy();
  });
});
