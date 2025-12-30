import { z } from 'zod';

// All available order statuses
const ORDER_STATUSES = [
  'NEW',
  'IN_PROGRESS',
  'UNCLAIMED',
  'DELAYED',
  'COMPLETED',
  'READY_FOR_DISPATCH',
  'DISPATCH_INITIATED',
  'DISPATCH_PARTNER_BOOKED',
  'ORDER_SHIPPED',
  'ORDER_DELIVERED'
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

const orderProductSchema = z.object({
  productId: stringSchema('Product ID is required'),
  workType: stringSchema('Work type is required', 255),
  workSpecification: stringSchema('Work specification is required', 500),
  shadeType: stringSchema('Shade type is required', 100),
  finishingInstructions: stringSchema('Finishing instructions are required', 500),
  componentDetails: z.preprocess(
    (val) => val === null ? undefined : val,
    z.string().max(500, 'Component details too long')
  ),
  incaseOfAllAbutments: stringSchema('In case of all abutments is required', 500),
  occlusalStaining: stringSchema('Occlusal staining is required', 100),
  ponticDesign: stringSchema('Pontic design is required', 100),
  repeatCorrections: stringSchema('Repeat corrections is required', 500),
  enterReason: stringSchema('Enter reason is required', 500),
  unitNumbers: z.preprocess((val) => val === null ? undefined : val, z.string().max(255, 'Unit numbers too long').optional()),
});

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

const patientDataSchema = z.object({
  name: stringSchema('Patient name is required', 255),
  age: z.preprocess(
    (val) => val === null ? undefined : (typeof val === 'string' ? parseInt(val, 10) : val),
    z.number().int('Age must be an integer').min(0, 'Age cannot be negative').max(150, 'Age cannot exceed 150')
  ),
  gender: stringSchema('Gender is required', 50),
  contactNumber: z.preprocess((val) => val === null ? undefined : val, z.string().max(20, 'Contact number too long').optional()),
});

export const createOrderSchema = z.object({
  body: z.object({
    invoiceNumber: stringSchema('Invoice number is required', 255),
    patient: patientDataSchema, // Changed from patientId to patient object
    doctorId: stringSchema('Doctor ID is required'),
    clinicId: stringSchema('Clinic ID is required'),
    referredDoctorId: z.preprocess((val) => val === null ? undefined : val, z.string().optional()),
    partner: stringSchema('Partner is required', 255),
    estimateDate: z.preprocess((val) => val === null ? undefined : val, z.string().datetime('Invalid estimate date format')),
    orderProducts: z.array(orderProductSchema).min(1, 'At least one order product is required'),
    files: z.array(fileSchema).optional(),
    status: z.enum(ORDER_STATUSES).optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const updateOrderSchema = z.object({
  body: z.object({
    invoiceNumber: z.string().min(1, 'Invoice number is required').max(255, 'Invoice number too long').optional(),
    patientId: z.string().min(1, 'Patient ID is required').optional(),
    doctorId: z.string().min(1, 'Doctor ID is required').optional(),
    clinicId: z.string().min(1, 'Clinic ID is required').optional(),
    referredDoctorId: z.string().optional(),
    partner: z.string().min(1, 'Partner is required').max(255, 'Partner name too long').optional(),
    scanningMode: z.string().min(1, 'Scanning mode is required').max(255, 'Scanning mode too long').optional(),
    schedule: z.string().datetime('Invalid schedule date format').optional(),
    enterRemark: z.string().min(1, 'Enter remark is required').optional(),
    estimateDate: z.string().datetime('Invalid estimate date format').optional(),
    dateOfApproach: z.string().datetime('Invalid date of approach format').optional(),
    status: z.enum(ORDER_STATUSES).optional(),
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
    
    // Status filter (single or comma-separated multiple)
    status: z.string().optional(),
    
    // ID filters
    patientId: z.string().uuid('Invalid patient ID format').optional(),
    doctorId: z.string().uuid('Invalid doctor ID format').optional(),
    clinicId: z.string().uuid('Invalid clinic ID format').optional(),
    referredDoctorId: z.string().uuid('Invalid referred doctor ID format').optional(),
    
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
