import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import request from 'supertest';

import { app } from './setup';
import { prisma } from '../src/utils/prisma';
import { buildCreateOrderBody } from './helpers/orderFixtures';

async function getAdminToken() {
  const login = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'dash-metrics@example.com', password: 'admin123' });
  return login.body.token as string;
}

describe('Dashboard metrics', () => {
  let clinicId = '';
  let productId = '';

  beforeAll(async () => {
    const passwordHash = await bcrypt.hash('admin123', 10);
    await prisma.user.upsert({
      where: { email: 'dash-metrics@example.com' },
      update: {},
      create: { email: 'dash-metrics@example.com', passwordHash, role: 'SUPER_ADMIN' },
    });

    const clinic = await prisma.clinic.create({
      data: {
        clinicName: `Dash Clinic ${Date.now()}`,
        organizationId: `DASH-${Date.now()}`,
        clientAddress: '1 Test Street',
        contactNumber: '9000000099',
        doctorName: 'Dr Dash',
      },
    });
    clinicId = clinic.id;

    const product = await prisma.product.create({
      data: {
        name: 'Dash Product',
        code: `DASH-${Date.now()}`,
        price: new Prisma.Decimal(1000),
        discount: new Prisma.Decimal(0),
      },
    });
    productId = product.id;
  });

  afterAll(async () => {
    await prisma.orderProduct.deleteMany({ where: { order: { clinicId } } });
    await prisma.orderTransition.deleteMany({ where: { order: { clinicId } } });
    await prisma.order.deleteMany({ where: { clinicId } });
    await prisma.product.deleteMany({ where: { id: productId } });
    await prisma.clinic.deleteMany({ where: { id: clinicId } });
    await prisma.user.deleteMany({ where: { email: 'dash-metrics@example.com' } });
  });

  it('GET /dashboard includes repeat and corrections order counts', async () => {
    const token = await getAdminToken();

    const repeatBody = buildCreateOrderBody({ clinicId, productId });
    repeatBody.orderProducts[0].repeatCorrections = 'Repeat';
    repeatBody.orderProducts[0].enterReason = 'Fitting Issue';
    await request(app).post('/api/v1/orders').set('Authorization', `Bearer ${token}`).send(repeatBody);

    const correctionBody = buildCreateOrderBody({ clinicId, productId });
    correctionBody.patient.name = `Correction Patient ${Date.now()}`;
    correctionBody.orderProducts[0].repeatCorrections = 'Corrections';
    correctionBody.orderProducts[0].enterReason = 'Shade Mismatch';
    await request(app).post('/api/v1/orders').set('Authorization', `Bearer ${token}`).send(correctionBody);

    const res = await request(app)
      .get('/api/v1/dashboard')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.orders.repeatCount).toBeGreaterThanOrEqual(1);
    expect(res.body.data.orders.correctionsCount).toBeGreaterThanOrEqual(1);
  });
});
