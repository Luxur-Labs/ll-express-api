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

  it('GET /admin/types returns types', async () => {
    const token = await getAdminToken();
    const res = await request(app)
      .get('/api/v1/admin/types')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.employeeTypes)).toBe(true);
  });

  it('Users CRUD works', async () => {
    const token = await getAdminToken();

    const createRes = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'user1@example.com', password: 'pass123', role: 'EMPLOYEE', employeeTypeName: 'TECHNICIAN', technicianGroupName: 'CAM_TECHNICIAN' });
    expect(createRes.status).toBe(201);

    const listRes = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${token}`);
    expect(listRes.status).toBe(200);

    const id = createRes.body.user.id as string;

    const updateRes = await request(app)
      .put(`/api/v1/users/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'DOCTOR' });
    expect(updateRes.status).toBe(200);

    const deleteRes = await request(app)
      .delete(`/api/v1/users/${id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deleteRes.status).toBe(204);
  });
});
