import { z } from 'zod';
import { isCancelledOrderStatus } from '../utils/orderStatus';
import { requiresEnterReason } from '../utils/orderProductFields';

// All available order statuses (department stages + lifecycle)
// Departments: MODEL, CAD, CAM, DMLS
const ORDER_STATUSES = [
  'NEW',
  'MODEL',       // department
  'THREE_D_MODEL',
  'QC',
  'CAD',         // department
  'CAM',         // department
  'DMLS',        // department
  'METAL',
  'CERAMIC',
  'ACRYLIC',
  'ADMIN_REVIEW',
  'DISPATCHED',
  'CANCELLED',
] as const;

// Helper to convert null to undefined for better error messages
const stringSchema = (message: string, maxLength?: number) => {
  let innerSchema = z.string().min(1, message);
  if (maxLength) {
    innerSchema = innerSchema.max(maxLength, `${message.replace(' is required', '')} too long`);
  }
  return z.preprocess(
    (val) => val === null ? undefined : val,
    innerSchema
  );
};

const orderProductBaseSchema = z.object({
  productId: stringSchema('Product ID is required'),
  workType: z.preprocess((val) => val === null ? undefined : val, z.string().max(255, 'Work type too long').optional()),
  workSpecification: z.preprocess((val) => val === null ? undefined : val, z.string().max(500, 'Work specification too long').optional()),
  shadeType: stringSchema('Shade type is required', 100),
  finishingInstructions: stringSchema('Finishing instructions are required', 500),
  componentDetails: z.preprocess(
    (val) => val === null ? undefined : val,
    z.string().min(1, 'Component details is required').max(500, 'Component details too long')
  ),
  incaseOfAllAbutments: stringSchema('In case of all abutments is required', 500),
  occlusalStaining: stringSchema('Occlusal staining is required', 100),
  ponticDesign: stringSchema('Pontic design is required', 100),
  repeatCorrections: stringSchema('Repeat corrections is required', 500),
  enterReason: z.preprocess(
    (val) => (val === null || val === undefined ? '' : val),
    z.string().max(500, 'Enter reason too long'),
  ),
  notes: z.preprocess(
    (val) => {
      if (val === null || val === undefined) return undefined;
      const trimmed = String(val).trim();
      return trimmed === '' ? undefined : trimmed;
    },
    z.string().max(2000, 'Notes too long').optional(),
  ),
  unitNumbers: z.preprocess((val) => val === null ? undefined : val, z.string().max(255, 'Unit numbers too long').optional()),
  // Line-level pricing (optional): when omitted, backend defaults from Product table.
  unitPrice: z.preprocess(
    (val) => (val === null || val === '' ? undefined : Number(val)),
    z.number().finite('Unit price must be a valid number').nonnegative('Unit price cannot be negative').optional()
  ),
  discountPercent: z.preprocess(
    (val) => (val === null || val === '' ? undefined : Number(val)),
    z
      .number()
      .finite('Discount percent must be a valid number')
      .min(0, 'Discount percent cannot be negative')
      .max(100, 'Discount percent cannot exceed 100')
      .optional()
  ),
  unitDiscounts: z
    .record(
      z.string(),
      z.number().min(0, 'Unit discount cannot be negative').max(100, 'Unit discount cannot exceed 100'),
    )
    .optional(),
});

function refineOrderProductReason(
  product: z.infer<typeof orderProductBaseSchema>,
  ctx: z.RefinementCtx,
): void {
  if (requiresEnterReason(product.repeatCorrections) && !String(product.enterReason ?? '').trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Enter reason is required when Repeat/Corrections is Repeat or Corrections',
      path: ['enterReason'],
    });
  }
}

const orderProductSchema = orderProductBaseSchema.superRefine(refineOrderProductReason);

// Schema for update - allows ID to reference existing orderProduct
const updateOrderProductSchema = orderProductBaseSchema
  .extend({
    id: z.string().optional(), // ID of existing orderProduct to update
  })
  .superRefine(refineOrderProductReason);

const fileSchema = z.object({
  fileName: z.string().min(1, 'File name is required').max(255, 'File name too long'),
  fileSize: z.number().positive('File size must be positive').optional(),
  fileType: z.string().max(100, 'File type too long').optional(),
  fileExtension: z.string().max(20, 'File extension too long').optional(),
  s3Key: z.string().min(1, 'S3 key is required').max(500, 'S3 key too long'),
  fileCategory: z.string().max(50, 'File category too long').optional(),
  fileDescription: z.string().max(1000, 'File description too long').optional(),
  uploadedBy: z.string().optional(),
});

// Schema for update - allows ID to reference existing file
const updateFileSchema = fileSchema.extend({
  id: z.string().optional(), // ID of existing file to update
});

const patientDataSchema = z.object({
  name: stringSchema('Patient name is required', 255),
  age: z.preprocess(
    (val) => {
      if (val === null || val === undefined || val === '') return undefined;
      return typeof val === 'string' ? parseInt(val, 10) : val;
    },
    z.number().int('Age must be an integer').min(0, 'Age cannot be negative').max(150, 'Age cannot exceed 150').optional()
  ),
  gender: z.preprocess(
    (val) => (val === null || val === undefined ? undefined : val),
    z.string().max(50, 'Gender too long').optional()
  ),
  contactNumber: z.preprocess((val) => val === null ? undefined : val, z.string().max(20, 'Contact number too long').optional()),
});

export const createOrderSchema = z.object({
  body: z
    .object({
    invoiceNumber: z.preprocess(
      (val) => (val === null || val === undefined || val === '' ? undefined : val),
      z.string().max(255, 'Invoice number too long').optional()
    ),
    patient: patientDataSchema, // Changed from patientId to patient object
    doctorId: z.preprocess((val) => val === null ? undefined : val, z.string().optional()),
    clinicId: stringSchema('Clinic ID is required'),
    referredDoctorId: z.preprocess((val) => val === null ? undefined : val, z.string().optional()),
    referenceName: z.preprocess((val) => val === null ? undefined : val, z.string().max(255, 'Reference name too long').optional()),
    partner: stringSchema('Partner is required', 255),
    estimateDate: z.preprocess((val) => val === null ? undefined : val, z.string().datetime('Invalid estimate date format')),
    scanningMode: z.preprocess((val) => val === null ? undefined : val, z.string().max(255, 'Scanning mode too long').optional()),
    schedule: z.preprocess((val) => val === null || val === '' ? undefined : val, z.string().datetime('Invalid schedule date format').optional()),
    enterRemark: z.preprocess((val) => val === null ? undefined : val, z.string().optional()),
    dateOfApproach: z.preprocess((val) => val === null || val === '' ? undefined : val, z.string().optional()),
    orderProducts: z.preprocess(
      (val) => (val === null || val === undefined ? [] : val),
      z.array(orderProductSchema)
    ),
    files: z.array(fileSchema).optional(),
    status: z.enum(ORDER_STATUSES).optional(),
  })
    .superRefine((body, ctx) => {
      if (isCancelledOrderStatus(body.status)) return;
      if (!body.orderProducts.length) {
        ctx.addIssue({
          code: 'custom',
          message: 'At least one order product is required',
          path: ['orderProducts'],
        });
      }
    }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const updateOrderSchema = z.object({
  body: z.object({
    invoiceNumber: z.preprocess(
      (val) => (val === null || val === undefined || val === '' ? undefined : val),
      z.string().max(255, 'Invoice number too long').optional()
    ),
    patientId: z.preprocess((val) => val === null ? undefined : val, z.string().optional()),
    patient: patientDataSchema.optional(), // Support updating patient info directly
    doctorId: z.preprocess((val) => val === null ? undefined : val, z.string().optional()),
    clinicId: z.preprocess((val) => val === null ? undefined : val, z.string().optional()),
    referredDoctorId: z.preprocess((val) => val === null ? undefined : val, z.string().optional()),
    referenceName: z.preprocess((val) => val === null ? undefined : val, z.string().max(255, 'Reference name too long').optional()),
    partner: z.preprocess((val) => val === null ? undefined : val, z.string().max(255, 'Partner name too long').optional()),
    scanningMode: z.preprocess((val) => val === null ? undefined : val, z.string().max(255, 'Scanning mode too long').optional()),
    schedule: z.preprocess((val) => val === null || val === '' ? undefined : val, z.string().optional()),
    enterRemark: z.preprocess((val) => val === null ? undefined : val, z.string().optional()),
    estimateDate: z.preprocess((val) => val === null ? undefined : val, z.string().datetime('Invalid estimate date format').optional()),
    dateOfApproach: z.preprocess((val) => val === null || val === '' ? undefined : val, z.string().optional()),
    status: z.enum(ORDER_STATUSES).optional(),
    orderProducts: z.array(updateOrderProductSchema).optional(), // Support updating order products with IDs
    files: z.array(updateFileSchema).optional(), // Support updating files with IDs
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const dateRangeQuerySchema = z.object({
  body: z.object({}).optional(),
  query: z.object({
    startDate: z.string().datetime('Invalid start date format'),
    endDate: z.string().datetime('Invalid end date format'),
  }),
  params: z.object({}).optional(),
});

export const updateOrderStatusSchema = z.object({
  body: z.object({
    status: z.enum(ORDER_STATUSES, {
      message: `Invalid status. Valid values: ${ORDER_STATUSES.join(', ')}`
    }),
    remarks: z.string().max(1000, 'Remarks too long').optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

/** Standalone activity note (no status change), stored as a same-state transition. */
export const addOrderActivityNoteSchema = z.object({
  body: z.object({
    note: z.string().min(1, 'Note is required').max(2000, 'Note too long'),
  }),
  query: z.object({}).optional(),
  params: z.object({
    id: z.string().min(1, 'Order ID is required'),
  }),
});

export const ordersListQuerySchema = z.object({
  body: z.object({}).optional(),
  query: z.object({
    // Pagination
    page: z.string().regex(/^\d+$/, 'Page must be a positive integer').optional(),
    limit: z.string().regex(/^\d+$/, 'Limit must be a positive integer').optional(),
    
    // Search (searches across invoiceNumber, patient name, doctor name, clinic name)
    search: z.string().max(255, 'Search term too long').optional(),
    
    // Invoice number filter (exact or partial match)
    invoiceNumber: z.string().max(255, 'Invoice number too long').optional(),
    
    // Order ID filter
    orderId: z.string().max(255, 'Order ID too long').optional(),
    
    // Status filter (single or comma-separated multiple)
    status: z.string().optional(),
    
    // ID filters
    patientId: z.string().uuid('Invalid patient ID format').optional(),
    doctorId: z.string().uuid('Invalid doctor ID format').optional(),
    clinicId: z.string().uuid('Invalid clinic ID format').optional(),
    referredDoctorId: z.string().uuid('Invalid referred doctor ID format').optional(),
    
    // Product code filter
    productCode: z.string().max(255, 'Product code too long').optional(),

    // Order line type: New, Repeat, or Corrections (matches OrderProduct.repeatCorrections)
    repeatCorrections: z.enum(['New', 'Repeat', 'Corrections']).optional(),
    
    // Name filters (searches by name, case-insensitive partial match)
    patientName: z.string().max(255, 'Patient name too long').optional(),
    doctorName: z.string().max(255, 'Doctor name too long').optional(),
    clinicName: z.string().max(255, 'Clinic name too long').optional(),
    
    // Other filters
    partner: z.string().max(255, 'Partner name too long').optional(),
    scanningMode: z.string().max(255, 'Scanning mode too long').optional(),
    
    // Date range filters (ISO 8601 datetime strings)
    scheduleFrom: z.string().datetime('Invalid scheduleFrom date format').optional(),
    scheduleTo: z.string().datetime('Invalid scheduleTo date format').optional(),
    estimateDateFrom: z.string().datetime('Invalid estimateDateFrom date format').optional(),
    estimateDateTo: z.string().datetime('Invalid estimateDateTo date format').optional(),
    dateOfApproachFrom: z.string().datetime('Invalid dateOfApproachFrom date format').optional(),
    dateOfApproachTo: z.string().datetime('Invalid dateOfApproachTo date format').optional(),
    createdAtFrom: z.string().datetime('Invalid createdAtFrom date format').optional(),
    createdAtTo: z.string().datetime('Invalid createdAtTo date format').optional(),
    
    // Sorting
    sortBy: z.enum(['createdAt', 'schedule', 'estimateDate', 'dateOfApproach', 'invoiceNumber', 'status']).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  }),
  params: z.object({}).optional(),
});
