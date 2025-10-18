import { z } from 'zod';

const orderProductSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  workType: z.string().min(1, 'Work type is required').max(255, 'Work type too long'),
  workSpecification: z.string().min(1, 'Work specification is required').max(500, 'Work specification too long'),
  shadeType: z.string().min(1, 'Shade type is required').max(100, 'Shade type too long'),
  finishingInstructions: z.string().min(1, 'Finishing instructions are required').max(500, 'Finishing instructions too long'),
  componentDetails: z.string().min(1, 'Component details are required').max(500, 'Component details too long'),
  incaseOfAllAbutments: z.string().min(1, 'In case of all abutments is required').max(500, 'In case of all abutments too long'),
  occlusalStaining: z.string().min(1, 'Occlusal staining is required').max(100, 'Occlusal staining too long'),
  ponticDesign: z.string().min(1, 'Pontic design is required').max(100, 'Pontic design too long'),
  repeatCorrections: z.string().min(1, 'Repeat corrections is required').max(500, 'Repeat corrections too long'),
  enterReason: z.string().min(1, 'Enter reason is required').max(500, 'Enter reason too long'),
  unitNumbers: z.string().max(255, 'Unit numbers too long').optional(),
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

export const createOrderSchema = z.object({
  body: z.object({
    invoiceNumber: z.string().min(1, 'Invoice number is required').max(255, 'Invoice number too long'),
    patientId: z.string().min(1, 'Patient ID is required'),
    doctorId: z.string().min(1, 'Doctor ID is required'),
    clinicId: z.string().min(1, 'Clinic ID is required'),
    referredDoctorId: z.string().optional(),
    partner: z.string().min(1, 'Partner is required').max(255, 'Partner name too long'),
    scanningMode: z.string().min(1, 'Scanning mode is required').max(255, 'Scanning mode too long'),
    schedule: z.string().datetime('Invalid schedule date format'),
    enterRemark: z.string().min(1, 'Enter remark is required'),
    estimateDate: z.string().datetime('Invalid estimate date format'),
    dateOfApproach: z.string().datetime('Invalid date of approach format'),
    orderProducts: z.array(orderProductSchema).min(1, 'At least one order product is required'),
    files: z.array(fileSchema).optional(),
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
