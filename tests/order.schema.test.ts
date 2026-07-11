import { createOrderSchema, updateOrderSchema, updateOrderStatusSchema } from '../src/schemas/order.schema';

function validProduct(overrides: Record<string, unknown> = {}) {
  return {
    productId: '11111111-1111-1111-1111-111111111111',
    shadeType: 'A1',
    finishingInstructions: 'Polish',
    componentDetails: 'Ti',
    incaseOfAllAbutments: 'Separate',
    occlusalStaining: 'Light',
    ponticDesign: 'Ovate',
    repeatCorrections: 'New',
    enterReason: 'Test',
    unitNumbers: '24,32',
    unitPrice: 1000,
    discountPercent: 10,
    unitDiscounts: { '24': 10, '32': 20 },
    ...overrides,
  };
}

function validCreateBody(overrides: Record<string, unknown> = {}) {
  return {
    patient: { name: 'Jane Doe', age: 30, gender: 'Female', contactNumber: '9999999999' },
    clinicId: '22222222-2222-2222-2222-222222222222',
    doctorId: '33333333-3333-3333-3333-333333333333',
    referenceName: 'Dr Smith',
    partner: 'Luxur',
    estimateDate: '2026-06-15T10:00:00.000Z',
    orderProducts: [validProduct()],
    ...overrides,
  };
}

describe('order.schema', () => {
  describe('createOrderSchema', () => {
    it('accepts a full valid create payload with all order product fields', () => {
      const result = createOrderSchema.safeParse({ body: validCreateBody() });
      expect(result.success).toBe(true);
    });

    it('allows New order products without enterReason', () => {
      const result = createOrderSchema.safeParse({
        body: validCreateBody({
          orderProducts: [validProduct({ repeatCorrections: 'New', enterReason: '' })],
        }),
      });
      expect(result.success).toBe(true);
    });

    it('requires enterReason for Repeat order products', () => {
      const result = createOrderSchema.safeParse({
        body: validCreateBody({
          orderProducts: [validProduct({ repeatCorrections: 'Repeat', enterReason: '' })],
        }),
      });
      expect(result.success).toBe(false);
    });

    it('requires patient name, clinic, partner, estimateDate, and order products', () => {
      const missing = createOrderSchema.safeParse({
        body: {
          patient: { name: '' },
          clinicId: '',
          partner: '',
          estimateDate: 'bad-date',
          orderProducts: [],
        },
      });
      expect(missing.success).toBe(false);
    });

    it('accepts optional product notes', () => {
      const result = createOrderSchema.safeParse({
        body: validCreateBody({
          orderProducts: [validProduct({ notes: 'Shade match upper centrals' })],
        }),
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.orderProducts[0].notes).toBe('Shade match upper centrals');
      }
    });

    it('rejects product notes longer than 2000 characters', () => {
      const result = createOrderSchema.safeParse({
        body: validCreateBody({
          orderProducts: [validProduct({ notes: 'x'.repeat(2001) })],
        }),
      });
      expect(result.success).toBe(false);
    });

    it('allows cancelled orders without products', () => {
      const result = createOrderSchema.safeParse({
        body: {
          ...validCreateBody({ orderProducts: [], status: 'CANCELLED' }),
        },
      });
      expect(result.success).toBe(true);
    });

    it('validates unitDiscounts percentages', () => {
      const bad = createOrderSchema.safeParse({
        body: validCreateBody({
          orderProducts: [validProduct({ unitDiscounts: { '24': 150 } })],
        }),
      });
      expect(bad.success).toBe(false);
    });

    it('validates discountPercent range', () => {
      const bad = createOrderSchema.safeParse({
        body: validCreateBody({
          orderProducts: [validProduct({ discountPercent: 101 })],
        }),
      });
      expect(bad.success).toBe(false);
    });

    it('accepts all production statuses including QC and THREE_D_MODEL', () => {
      for (const status of ['QC', 'THREE_D_MODEL', 'MODEL', 'DISPATCHED'] as const) {
        const result = createOrderSchema.safeParse({
          body: validCreateBody({ status }),
        });
        expect(result.success).toBe(true);
      }
    });

    it('accepts optional header fields on create', () => {
      const result = createOrderSchema.safeParse({
        body: validCreateBody({
          scanningMode: 'Digital',
          schedule: '2026-06-20T10:00:00.000Z',
          enterRemark: 'Rush',
          dateOfApproach: '2026-06-10T10:00:00.000Z',
        }),
      });
      expect(result.success).toBe(true);
    });

    it('accepts optional file attachments', () => {
      const result = createOrderSchema.safeParse({
        body: validCreateBody({
          files: [
            {
              fileName: 'scan.stl',
              s3Key: 'orders/scan.stl',
              fileSize: 1024,
              fileType: 'model/stl',
            },
          ],
        }),
      });
      expect(result.success).toBe(true);
    });
  });

  describe('updateOrderSchema', () => {
    it('accepts partial header updates and order product ids', () => {
      const result = updateOrderSchema.safeParse({
        body: {
          scanningMode: 'Digital',
          schedule: '2026-06-20T10:00:00.000Z',
          enterRemark: 'Updated remark',
          dateOfApproach: '2026-06-10T10:00:00.000Z',
          orderProducts: [
            validProduct({
              id: '44444444-4444-4444-4444-444444444444',
              notes: 'Update schema line note',
            }),
          ],
        },
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.orderProducts?.[0]?.notes).toBe('Update schema line note');
      }
    });

    it('accepts patient patch on update', () => {
      const result = updateOrderSchema.safeParse({
        body: {
          patient: { name: 'Updated Name', age: 40, gender: 'Male' },
        },
      });
      expect(result.success).toBe(true);
    });
  });

  describe('updateOrderStatusSchema', () => {
    it('accepts status transitions with optional remarks', () => {
      const result = updateOrderStatusSchema.safeParse({
        body: { status: 'QC', remarks: 'Ready for QC' },
      });
      expect(result.success).toBe(true);
    });

    it('rejects unknown statuses', () => {
      const result = updateOrderStatusSchema.safeParse({
        body: { status: 'INVALID' },
      });
      expect(result.success).toBe(false);
    });
  });
});
