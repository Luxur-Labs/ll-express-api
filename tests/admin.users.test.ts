import request from 'supertest';
import { app } from './setup';
import { prisma } from '../src/utils/prisma';
import bcrypt from 'bcryptjs';

async function getAdminToken() {
  const login = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'admin@example.com', password: 'admin123' });
  return login.body.token as string;
}

describe('Admin and Users', () => {
  beforeAll(async () => {
    const passwordHash = await bcrypt.hash('admin123', 10);
    await prisma.employeeType.upsert({ where: { name: 'QC' }, update: {}, create: { name: 'QC' } });
    await prisma.technicianGroup.upsert({ where: { name: 'CAD_TECHNICIAN' }, update: {}, create: { name: 'CAD_TECHNICIAN' } });
    await prisma.user.upsert({
      where: { email: 'admin@example.com' },
      update: {},
      create: { email: 'admin@example.com', passwordHash, role: 'SUPER_ADMIN' },
    });
  });

  it('GET /admin/employee-types returns types', async () => {
    const token = await getAdminToken();
    const res = await request(app)
      .get('/api/v1/admin/employee-types')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.employeeTypes)).toBe(true);
  });

  it('Users CRUD works', async () => {
    const token = await getAdminToken();
    const email = `user-${Date.now()}@example.com`;

    const createRes = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ email, password: 'pass123', role: 'FRONT_OFFICE' });
    expect(createRes.status).toBe(201);

    const listRes = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${token}`);
    expect(listRes.status).toBe(200);

    const id = createRes.body.user.id as string;

    const updateRes = await request(app)
      .put(`/api/v1/users/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'LAB_MANAGER' });
    expect(updateRes.status).toBe(200);

    const deleteRes = await request(app)
      .delete(`/api/v1/users/${id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.message).toContain('revoked');
  });

  it('revoking a user invalidates their active session', async () => {
    const adminToken = await getAdminToken();
    const passwordHash = await bcrypt.hash('revokepass', 10);
    const email = `revoke-me-${Date.now()}@example.com`;

    const created = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: 'FRONT_OFFICE',
        isActive: true,
        tokenVersion: 0,
      },
    });

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'revokepass' });
    expect(login.status).toBe(200);
    const userToken = login.body.token as string;

    const revoke = await request(app)
      .delete(`/api/v1/users/${created.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(revoke.status).toBe(200);

    const me = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${userToken}`);
    expect(me.status).toBe(403);
    expect(me.body.code).toBe('ACCOUNT_REVOKED');

    await prisma.refreshToken.deleteMany({ where: { userId: created.id } });
    await prisma.user.delete({ where: { id: created.id } });
  });

  it('admin password reset invalidates user sessions', async () => {
    const adminToken = await getAdminToken();
    const passwordHash = await bcrypt.hash('resetpass', 10);
    const email = `reset-me-${Date.now()}@example.com`;

    const created = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: 'LAB_MANAGER',
        isActive: true,
        tokenVersion: 0,
      },
    });

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'resetpass' });
    const oldToken = login.body.token as string;

    const update = await request(app)
      .put(`/api/v1/users/${created.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ password: 'newresetpass' });
    expect(update.status).toBe(200);

    const me = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${oldToken}`);
    expect(me.status).toBe(401);
    expect(me.body.code).toBe('SESSION_INVALIDATED');

    await prisma.refreshToken.deleteMany({ where: { userId: created.id } });
    await prisma.user.delete({ where: { id: created.id } });
  });
});
