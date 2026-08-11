import { z } from 'zod';
import { isCancelledOrderStatus } from '../utils/orderStatus';
import { ORDER_IMPORT_UPDATE_COLUMN_KEYS } from '../config/orderImportUpdateColumns';

function optionalNumber(min?: number, max?: number) {
  return z.preprocess(
    (val) => {
      if (val === null || val === undefined || val === '') return undefined;
      const n = Number(val);
      return Number.isFinite(n) ? n : undefined;
    },
    (() => {
      let schema = z.number();
      if (min !== undefined) schema = schema.min(min);
      if (max !== undefined) schema = schema.max(max);
      return schema.optional();
    })()
  );
}

function optionalInt(min: number, max: number) {
  return z.preprocess(
    (val) => {
      if (val === null || val === undefined || val === '') return undefined;
      const n = typeof val === 'string' ? parseInt(val, 10) : Number(val);
      return Number.isFinite(n) ? n : undefined;
    },
    z.number().int().min(min).max(max).optional()
  );
}

const importSheetRowSchema = z
  .object({
  rowIndex: z.number().int().nonnegative(),
  orderId: z.string().optional(),
  receivedThrough: z.string().optional(),
  date: z.string().optional(),
  patientName: z.string().optional(),
  patientAge: z.union([z.number(), z.string()]).optional(),
  patientGender: z.string().optional(),
  newRepeatCorrection: z.string().optional(),
  clinicName: z.string().optional(),
  reference: z.string().optional(),
  address: z.string().optional(),
  expectedDate: z.string().optional(),
  deliveryDate: z.string().optional(),
  caseStatus: z.string().optional(),
  shade: z.string().optional(),
  column1: z.string().optional(),
  productCode: z.string().optional(),
  productDescription: z.string().optional(),
  toothNumber: z.string().optional(),
  units: z.union([z.number(), z.string()]).optional(),
  unitAmount: z.union([z.number(), z.string()]).optional(),
  discountPercent: z.union([z.number(), z.string()]).optional(),
  partner: z.string().optional(),
  model3dCharges: z.string().optional(),
  componentReduction: z.string().optional(),
  })
  .strip();

const importCommitProductSchema = z.object({
  productId: z.string().min(1),
  productCode: z.string().optional(),
  shade: z.string().optional(),
  toothNumber: z.string().optional(),
  unitAmount: optionalNumber(0),
  discountPercent: optionalNumber(0, 100),
  newRepeatCorrection: z.string().optional(),
  column1: z.string().optional(),
  componentReduction: z.string().optional(),
});

const importCommitOrderSchema = z
  .object({
  orderId: z.string().min(1),
  invoiceNumber: z.string().optional(),
  receivedThrough: z.string().optional(),
  date: z.string().optional(),
  patientName: z.string().optional(),
  patientAge: optionalInt(0, 150),
  patientGender: z.string().optional(),
  clinicId: z.string().optional(),
  reference: z.string().optional(),
  expectedDate: z.string().optional(),
  deliveryDate: z.string().optional(),
  caseStatus: z.string().optional(),
  partner: z.string().optional(),
  statusUpdateOnly: z.boolean().optional(),
  toothNumberUpdateOnly: z.boolean().optional(),
  createdDateUpdateOnly: z.boolean().optional(),
  updateColumns: z.array(z.enum(ORDER_IMPORT_UPDATE_COLUMN_KEYS)).optional(),
  products: z.preprocess(
    (val) => (val === null || val === undefined ? [] : val),
    z.array(importCommitProductSchema)
  ),
})
  .superRefine((order, ctx) => {
    if (order.updateColumns?.length) {
      const selected = new Set(order.updateColumns);
      if (selected.has('createdDate') && !trimImportVal(order.date)) {
        ctx.addIssue({ code: 'custom', message: 'Date is required', path: ['date'] });
      }
      if (selected.has('estimateDate') && !trimImportVal(order.expectedDate)) {
        ctx.addIssue({ code: 'custom', message: 'Expected Date is required', path: ['expectedDate'] });
      }
      if (selected.has('schedule') && !trimImportVal(order.deliveryDate)) {
        ctx.addIssue({ code: 'custom', message: 'Delivery Date is required', path: ['deliveryDate'] });
      }
      if (selected.has('status') && !trimImportVal(order.caseStatus)) {
        ctx.addIssue({ code: 'custom', message: 'Case Status is required', path: ['caseStatus'] });
      }
      if (selected.has('partner') && !trimImportVal(order.partner)) {
        ctx.addIssue({ code: 'custom', message: 'Partner is required', path: ['partner'] });
      }
      if (selected.has('patientName') && !trimImportVal(order.patientName)) {
        ctx.addIssue({ code: 'custom', message: 'Patient Name is required', path: ['patientName'] });
      }
      if (selected.has('toothNumber') && order.products.length === 0) {
        ctx.addIssue({
          code: 'custom',
          message: 'At least one product line with tooth numbers is required',
          path: ['products'],
        });
      }
      return;
    }

    if (order.createdDateUpdateOnly) {
      if (!trimImportVal(order.date)) {
        ctx.addIssue({
          code: 'custom',
          message: 'Date is required to update created date',
          path: ['date'],
        });
      }
      return;
    }

    if (order.toothNumberUpdateOnly) {
      if (order.products.length === 0) {
        ctx.addIssue({
          code: 'custom',
          message: 'At least one product line with tooth numbers is required',
          path: ['products'],
        });
      }
      order.products.forEach((p, i) => {
        if (!p.productId) {
          ctx.addIssue({
            code: 'custom',
            message: 'Product ID is required',
            path: ['products', i, 'productId'],
          });
        }
        if (!trimImportVal(p.toothNumber)) {
          ctx.addIssue({
            code: 'custom',
            message: 'Tooth number is required',
            path: ['products', i, 'toothNumber'],
          });
        }
      });
      return;
    }

    if (order.statusUpdateOnly) {
      if (!trimImportVal(order.caseStatus)) {
        ctx.addIssue({
          code: 'custom',
          message: 'Case Status is required for status update',
          path: ['caseStatus'],
        });
      }
      return;
    }

    if (!trimImportVal(order.patientName)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Patient name is required',
        path: ['patientName'],
      });
    }
    if (!trimImportVal(order.clinicId)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Clinic ID is required',
        path: ['clinicId'],
      });
    }
    if (!trimImportVal(order.expectedDate)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Expected date is required',
        path: ['expectedDate'],
      });
    }

    if (isCancelledOrderStatus(order.caseStatus)) return;
    if (order.products.length === 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'At least one product is required',
        path: ['products'],
      });
      return;
    }
    order.products.forEach((p, i) => {
      if (!p.productId) {
        ctx.addIssue({
          code: 'custom',
          message: 'Product ID is required',
          path: ['products', i, 'productId'],
        });
      }
    });
  });

function trimImportVal(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

export const validateOrderImportSchema = z.object({
  body: z.object({
    rows: z.array(importSheetRowSchema).min(1, 'At least one row is required').max(10000, 'Too many rows (max 10000 per upload)'),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const commitOrderImportSchema = z.object({
  body: z.object({
    orders: z.array(importCommitOrderSchema).min(1, 'At least one order is required'),
    fileName: z.string().max(255).optional(),
    totalRows: z.number().int().nonnegative().optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const retryOrderImportItemSchema = z.object({
  body: z.object({
    order: importCommitOrderSchema,
  }),
  query: z.object({}).optional(),
  params: z.object({
    itemId: z.string().min(1),
  }),
});

export const listOrderImportHistorySchema = z.object({
  body: z.object({}).optional(),
  query: z.object({
    page: z.string().regex(/^\d+$/).optional(),
    limit: z.string().regex(/^\d+$/).optional(),
  }).optional(),
  params: z.object({}).optional(),
});

export const listOrderImportBatchItemsSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({
    page: z.string().regex(/^\d+$/).optional(),
    limit: z.string().regex(/^\d+$/).optional(),
  }).optional(),
  params: z.object({
    batchId: z.string().min(1),
  }),
});
