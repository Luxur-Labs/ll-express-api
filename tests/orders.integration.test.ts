import request from 'supertest';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';

import { app } from './setup';
import { prisma } from '../src/utils/prisma';
import { buildCreateOrderBody } from './helpers/orderFixtures';
import { computeOrderProductLineBilling } from '../src/utils/orderSales.util';

async function getAdminToken() {
  const login = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'orders-test@example.com', password: 'admin123' });
  return login.body.token as string;
}

describe('Orders API flow', () => {
  let token = '';
  let clinicId = '';
  let productId = '';
  let orderId = '';
  let orderProductId = '';

  beforeAll(async () => {
    const passwordHash = await bcrypt.hash('admin123', 10);
    await prisma.user.upsert({
      where: { email: 'orders-test@example.com' },
      update: {},
      create: { email: 'orders-test@example.com', passwordHash, role: 'SUPER_ADMIN' },
    });

    const clinic = await prisma.clinic.create({
      data: {
        clinicName: `Order Test Clinic ${Date.now()}`,
        organizationId: `ORG-TEST-${Date.now()}`,
        clientAddress: '1 Test Street',
        contactNumber: '9000000001',
        doctorName: 'Dr Test',
      },
    });
    clinicId = clinic.id;

    const product = await prisma.product.create({
      data: {
        name: 'Test Crown',
        code: `PROD-${Date.now()}`,
        price: new Prisma.Decimal(1200),
        discount: new Prisma.Decimal(5),
      },
    });
    productId = product.id;

    token = await getAdminToken();
  });

  afterAll(async () => {
    if (orderId) {
      await prisma.orderProduct.deleteMany({ where: { orderId } });
      await prisma.orderTransition.deleteMany({ where: { orderId } });
      await prisma.order.deleteMany({ where: { id: orderId } });
    }
    if (productId) await prisma.product.deleteMany({ where: { id: productId } });
    if (clinicId) await prisma.clinic.deleteMany({ where: { id: clinicId } });
    await prisma.user.deleteMany({ where: { email: 'orders-test@example.com' } });
  });

  it('POST /orders creates order with all header and line fields', async () => {
    const body = buildCreateOrderBody({
      clinicId,
      productId,
      overrides: {
        orderProducts: [
          {
            productId,
            shadeType: 'A1',
            finishingInstructions: 'High polish',
            componentDetails: 'Ti base',
            incaseOfAllAbutments: 'Separate',
            occlusalStaining: 'Light',
            ponticDesign: 'Ovate',
            repeatCorrections: 'New',
            enterReason: '',
            workType: 'Crown',
            workSpecification: 'Full contour',
            unitNumbers: '24,32',
            unitPrice: 1000,
            discountPercent: 10,
            unitDiscounts: { '24': 10, '32': 20 },
            notes: 'Integration test line note',
          },
        ],
      },
    });
    const res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${token}`)
      .send(body);

    expect(res.status).toBe(201);
    expect(res.body.message).toContain('Created');

    const created = await prisma.order.findFirst({
      where: { clinicId, patient: { name: body.patient.name } },
      orderBy: { createdAt: 'desc' },
      include: {
        patient: true,
        orderProducts: { include: { product: true } },
      },
    });
    expect(created).toBeTruthy();
    orderId = created!.id;

    expect(created!.referenceName).toBe(body.referenceName);
    expect(created!.partner).toBe(body.partner);
    expect(created!.scanningMode).toBe(body.scanningMode);
    expect(created!.enterRemark).toBe(body.enterRemark);
    expect(created!.orderProducts.length).toBe(1);

    const line = created!.orderProducts[0];
    orderProductId = line.id;

    expect(line.shadeType).toBe('A1');
    expect(line.workType).toBe('Crown');
    expect(line.unitNumbers).toContain('24');
    expect(line.unitDiscounts).toEqual({ '24': 10, '32': 20 });
    expect(line.notes).toBe('Integration test line note');

    const billing = computeOrderProductLineBilling({
      unitNumbers: line.unitNumbers,
      unitPrice: Number(line.unitPrice),
      discountPercent: Number(line.discountPercent),
      unitDiscounts: line.unitDiscounts,
      product: { price: 1200, discount: 5 },
    });
    expect(billing.lineTotal).toBeGreaterThan(0);
  });

  it('POST /orders accepts New products without enterReason', async () => {
    const body = buildCreateOrderBody({ clinicId, productId });
    body.patient.name = `New Product Patient ${Date.now()}`;
    body.orderProducts[0].repeatCorrections = 'New';
    body.orderProducts[0].enterReason = '';

    const res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${token}`)
      .send(body);

    expect(res.status).toBe(201);

    const created = await prisma.order.findFirst({
      where: { clinicId, patient: { name: body.patient.name } },
      orderBy: { createdAt: 'desc' },
      include: { orderProducts: true },
    });
    expect(created?.orderProducts[0].repeatCorrections).toBe('New');
    expect(created?.orderProducts[0].enterReason).toBe('');

    if (created) {
      await prisma.orderProduct.deleteMany({ where: { orderId: created.id } });
      await prisma.orderTransition.deleteMany({ where: { orderId: created.id } });
      await prisma.order.deleteMany({ where: { id: created.id } });
    }
  });

  it('GET /orders/:id returns persisted order with billing fields', async () => {
    const res = await request(app)
      .get(`/api/v1/orders/${orderId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(orderId);
    expect(res.body.orderProducts[0].unitDiscounts).toEqual({ '24': 10, '32': 20 });
    expect(res.body.orderProducts[0].lineTotal).toBeTruthy();
  });

  it('PUT /orders/:id updates header fields and product line', async () => {
    const res = await request(app)
      .put(`/api/v1/orders/${orderId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        referenceName: 'Updated Ref',
        scanningMode: 'Physical',
        enterRemark: 'Updated remark',
        schedule: '2026-06-25T10:00:00.000Z',
        patient: { name: 'Updated Patient', age: 36, gender: 'Female' },
        orderProducts: [
          {
            id: orderProductId,
            productId,
            shadeType: 'B2',
            finishingInstructions: 'Updated finish',
            componentDetails: 'Updated comp',
            incaseOfAllAbutments: 'Separate',
            occlusalStaining: 'Medium',
            ponticDesign: 'Modified ridge lap',
            repeatCorrections: 'Repeat',
            enterReason: 'Repeat case',
            notes: 'Updated line note',
            workType: 'Bridge',
            workSpecification: 'Updated spec',
            unitNumbers: '14,23',
            unitPrice: 1100,
            discountPercent: 8,
            unitDiscounts: { '14': 50, '23': 20 },
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.referenceName).toBe('Updated Ref');
    expect(res.body.scanningMode).toBe('Physical');
    expect(res.body.patient.name).toBe('Updated Patient');
    const line = res.body.orderProducts[0];
    expect(line.shadeType).toBe('B2');
    expect(line.repeatCorrections).toBe('Repeat');
    expect(line.notes).toBe('Updated line note');
    expect(line.unitDiscounts).toEqual({ '14': 50, '23': 20 });
  });

  it('PATCH /orders/:id/status moves order through QC', async () => {
    const res = await request(app)
      .patch(`/api/v1/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'QC', remarks: 'QC check' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('QC');
  });

  it('GET /orders/list filters by status and clinic', async () => {
    const res = await request(app)
      .get('/api/v1/orders/list')
      .query({ status: 'QC', clinicId, limit: '10', page: '0' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const ids = (res.body.data?.orders ?? []).map((o: { id: string }) => o.id);
    expect(ids).toContain(orderId);
  });

  it('DELETE /orders/:id soft-deletes for SUPER_ADMIN', async () => {
    const res = await request(app)
      .delete(`/api/v1/orders/${orderId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(204);

    const row = await prisma.order.findUnique({
      where: { id: orderId },
      select: { isActive: true },
    });
    expect(row?.isActive).toBe(false);

    const list = await request(app)
      .get('/api/v1/orders/list')
      .query({ orderId, limit: '10', page: '0' })
      .set('Authorization', `Bearer ${token}`);
    const ids = (list.body.data?.orders ?? []).map((o: { id: string }) => o.id);
    expect(ids).not.toContain(orderId);

    const getOne = await request(app)
      .get(`/api/v1/orders/${orderId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(getOne.status).toBe(404);
  });

  it('DELETE /orders/:id is forbidden for LAB_MANAGER', async () => {
    const passwordHash = await bcrypt.hash('manager123', 10);
    const email = `lab-manager-delete-${Date.now()}@example.com`;
    await prisma.user.create({
      data: { email, passwordHash, role: 'LAB_MANAGER' },
    });
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'manager123' });
    const managerToken = login.body.token as string;

    const body = buildCreateOrderBody({ clinicId, productId });
    await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${token}`)
      .send(body);
    const created = await prisma.order.findFirst({
      where: { clinicId, patient: { name: body.patient.name } },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    expect(created).toBeTruthy();
    const tempOrderId = created!.id;

    const res = await request(app)
      .delete(`/api/v1/orders/${tempOrderId}`)
      .set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(403);

    await prisma.orderProduct.deleteMany({ where: { orderId: tempOrderId } });
    await prisma.orderTransition.deleteMany({ where: { orderId: tempOrderId } });
    await prisma.order.deleteMany({ where: { id: tempOrderId } });
    await prisma.user.delete({ where: { email } });
  });

  it('POST /orders/import/preview parses uploaded spreadsheet', async () => {
    const csv = [
      'Order id,Patient Name,Clinic Name,Expected Date,Case Status,Shade,Product Code,Tooth number,Partner',
      'ODPREVIEW1,Preview Patient,Any Clinic,2026-06-15T10:00:00.000Z,NEW,A1,CODE1,24,Luxur',
    ].join('\n');

    const res = await request(app)
      .post('/api/v1/orders/import/preview')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from(csv, 'utf8'), 'preview.csv');

    expect(res.status).toBe(200);
    expect(res.body.data.parseInfo.headers.length).toBeGreaterThan(0);
    expect(res.body.data.summary.totalSheetRows).toBeGreaterThan(0);
    expect(res.body.data.rows.length).toBeGreaterThan(0);
    expect(res.body.data.rows[0].orderId).toBe('ODPREVIEW1');
  });
});
