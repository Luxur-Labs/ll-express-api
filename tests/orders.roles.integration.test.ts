import request from 'supertest';
import { Prisma } from '@prisma/client';

import { app } from './setup';
import { prisma } from '../src/utils/prisma';
import { buildCreateOrderBody, buildOrderProductLine } from './helpers/orderFixtures';
import { createRoleTestUser, deleteTestUsers, signRoleToken } from './helpers/authFixtures';

describe('Orders API by role', () => {
  let clinicId = '';
  let productId = '';
  const userEmails: string[] = [];
  const orderIds: string[] = [];

  let superAdminToken = '';
  let labManagerToken = '';
  let frontOfficeToken = '';
  let frontOfficeUserId = '';
  let secondFrontOfficeToken = '';

  beforeAll(async () => {
    const clinic = await prisma.clinic.create({
      data: {
        clinicName: `Role Order Clinic ${Date.now()}`,
        organizationId: `ORG-ROLE-${Date.now()}`,
        clientAddress: '1 Role Test Street',
        contactNumber: '9000000099',
        doctorName: 'Dr Role Test',
      },
    });
    clinicId = clinic.id;

    const product = await prisma.product.create({
      data: {
        name: 'Role Test Crown',
        code: `ROLE-PROD-${Date.now()}`,
        price: new Prisma.Decimal(1500),
        discount: new Prisma.Decimal(0),
      },
    });
    productId = product.id;

    const superAdmin = await createRoleTestUser('SUPER_ADMIN', 'orders-role');
    superAdminToken = superAdmin.token;
    userEmails.push(superAdmin.email);

    const labManager = await createRoleTestUser('LAB_MANAGER', 'orders-role');
    labManagerToken = labManager.token;
    userEmails.push(labManager.email);

    const frontOffice = await createRoleTestUser('FRONT_OFFICE', 'orders-role');
    frontOfficeToken = frontOffice.token;
    frontOfficeUserId = frontOffice.user.id;
    userEmails.push(frontOffice.email);

    const secondFrontOffice = await createRoleTestUser('FRONT_OFFICE', 'orders-role-other');
    secondFrontOfficeToken = secondFrontOffice.token;
    userEmails.push(secondFrontOffice.email);
  });

  afterAll(async () => {
    for (const orderId of orderIds) {
      await prisma.orderProduct.deleteMany({ where: { orderId } });
      await prisma.orderTransition.deleteMany({ where: { orderId } });
      await prisma.order.deleteMany({ where: { id: orderId } });
    }
    if (productId) await prisma.product.deleteMany({ where: { id: productId } });
    if (clinicId) await prisma.clinic.deleteMany({ where: { id: clinicId } });
    await deleteTestUsers(userEmails);
  });

  async function findOrderByPatientName(patientName: string) {
    return prisma.order.findFirst({
      where: { clinicId, patient: { name: patientName } },
      orderBy: { createdAt: 'desc' },
      include: { orderProducts: true },
    });
  }

  async function createOrderAs(token: string, patientSuffix: string, notes?: string) {
    const body = buildCreateOrderBody({
      clinicId,
      productId,
      overrides: {
        patient: {
          name: `Role Patient ${patientSuffix}`,
          age: 30,
          gender: 'Female',
          contactNumber: '9876500000',
        },
        orderProducts: [
          buildOrderProductLine({
            productId,
            repeatCorrections: 'New',
            enterReason: '',
            unitNumbers: '24',
            unitPrice: 1500,
            discountPercent: 0,
            unitDiscounts: undefined,
            ...(notes !== undefined ? { notes } : {}),
          }),
        ],
      },
    });

    const res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${token}`)
      .send(body);

    const created = await findOrderByPatientName(body.patient.name);
    if (created) orderIds.push(created.id);

    return { res, body, created };
  }

  describe('POST /orders (create)', () => {
    it.each([
      ['SUPER_ADMIN', () => superAdminToken],
      ['LAB_MANAGER', () => labManagerToken],
      ['FRONT_OFFICE', () => frontOfficeToken],
    ] as const)('%s can create orders', async (_role, getToken) => {
      const { res, created } = await createOrderAs(getToken(), _role);
      expect(res.status).toBe(201);
      expect(created).toBeTruthy();
      expect(created!.orderProducts.length).toBe(1);
    });

    it('FRONT_OFFICE can create order with optional line notes', async () => {
      const { res, created } = await createOrderAs(
        frontOfficeToken,
        'FO-notes',
        'Shade match requested',
      );
      expect(res.status).toBe(201);
      expect(created?.orderProducts[0].notes).toBe('Shade match requested');
    });

    it('DOCTOR token is forbidden from creating orders', async () => {
      const doctor = await prisma.user.create({
        data: {
          email: `doctor-role-${Date.now()}@example.com`,
          passwordHash: 'unused',
          role: 'DOCTOR',
          isActive: true,
          tokenVersion: 0,
        },
      });
      userEmails.push(doctor.email);

      const token = signRoleToken(doctor.id, doctor.email, 'DOCTOR');
      const body = buildCreateOrderBody({ clinicId, productId });
      body.patient.name = `Doctor Blocked ${Date.now()}`;

      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${token}`)
        .send(body);

      expect(res.status).toBe(403);
    });
  });

  function buildUpdateLine(
    orderProductId: string,
    overrides: Record<string, unknown> = {},
  ) {
    return buildOrderProductLine({
      id: orderProductId,
      productId,
      repeatCorrections: 'New',
      enterReason: '',
      unitNumbers: '24',
      unitPrice: 1500,
      discountPercent: 0,
      ...overrides,
    });
  }

  describe('PUT /orders/:id (update)', () => {
    let sharedOrderId = '';
    let sharedOrderProductId = '';

    beforeAll(async () => {
      const { created } = await createOrderAs(superAdminToken, 'shared-update');
      expect(created).toBeTruthy();
      sharedOrderId = created!.id;
      sharedOrderProductId = created!.orderProducts[0].id;
    });

    it('SUPER_ADMIN can update any order and line notes', async () => {
      const res = await request(app)
        .put(`/api/v1/orders/${sharedOrderId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          enterRemark: 'Updated by super admin',
          orderProducts: [
            buildUpdateLine(sharedOrderProductId, {
              shadeType: 'A2',
              notes: 'Super admin line note',
            }),
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.enterRemark).toBe('Updated by super admin');
      expect(res.body.orderProducts[0].shadeType).toBe('A2');
      expect(res.body.orderProducts[0].notes).toBe('Super admin line note');
    });

    it('LAB_MANAGER can update any order', async () => {
      const res = await request(app)
        .put(`/api/v1/orders/${sharedOrderId}`)
        .set('Authorization', `Bearer ${labManagerToken}`)
        .send({
          scanningMode: 'Digital',
          orderProducts: [
            buildUpdateLine(sharedOrderProductId, {
              shadeType: 'B1',
              notes: 'Lab manager note',
            }),
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.scanningMode).toBe('Digital');
      expect(res.body.orderProducts[0].notes).toBe('Lab manager note');
    });

    it('FRONT_OFFICE can update only orders they created', async () => {
      const { created } = await createOrderAs(frontOfficeToken, 'FO-own');
      expect(created).toBeTruthy();
      const orderId = created!.id;
      const orderProductId = created!.orderProducts[0].id;

      const ownRes = await request(app)
        .put(`/api/v1/orders/${orderId}`)
        .set('Authorization', `Bearer ${frontOfficeToken}`)
        .send({
          enterRemark: 'FO own update',
          orderProducts: [
            buildUpdateLine(orderProductId, {
              shadeType: 'A3',
              notes: 'Front office own note',
            }),
          ],
        });

      expect(ownRes.status).toBe(200);
      expect(ownRes.body.enterRemark).toBe('FO own update');
      expect(ownRes.body.orderProducts[0].notes).toBe('Front office own note');

      const row = await prisma.order.findUnique({
        where: { id: orderId },
        select: { createdById: true },
      });
      expect(row?.createdById).toBe(frontOfficeUserId);
    });

    it('FRONT_OFFICE cannot update orders created by another user', async () => {
      const res = await request(app)
        .put(`/api/v1/orders/${sharedOrderId}`)
        .set('Authorization', `Bearer ${frontOfficeToken}`)
        .send({ enterRemark: 'Should fail' });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('only update orders you created');
    });

    it('second FRONT_OFFICE user cannot update first FRONT_OFFICE user order', async () => {
      const { created } = await createOrderAs(frontOfficeToken, 'FO-protected');
      expect(created).toBeTruthy();

      const res = await request(app)
        .put(`/api/v1/orders/${created!.id}`)
        .set('Authorization', `Bearer ${secondFrontOfficeToken}`)
        .send({ enterRemark: 'Cross-user update' });

      expect(res.status).toBe(403);
    });

    it('DOCTOR token is forbidden from updating orders', async () => {
      const doctor = await prisma.user.create({
        data: {
          email: `doctor-update-${Date.now()}@example.com`,
          passwordHash: 'unused',
          role: 'DOCTOR',
          isActive: true,
          tokenVersion: 0,
        },
      });
      userEmails.push(doctor.email);

      const token = signRoleToken(doctor.id, doctor.email, 'DOCTOR');
      const res = await request(app)
        .put(`/api/v1/orders/${sharedOrderId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ enterRemark: 'Doctor update attempt' });

      expect(res.status).toBe(403);
    });
  });
});
