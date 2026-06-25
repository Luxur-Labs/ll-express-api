import { z } from 'zod';

export const createClinicSchema = z.object({
  body: z.object({
    clinicName: z.string().min(1, 'Clinic name is required').max(255, 'Clinic name too long'),
    clientAddress: z.string().min(1, 'Client address is required'),
    contactNumber: z.string().min(1, 'Contact number is required').max(20, 'Contact number too long'),
    doctorName: z.string().max(255, 'Doctor name too long').optional(),
    pendingBalance: z.preprocess(
      (val) => (val === null || val === '' || val === undefined ? undefined : Number(val)),
      z.number().finite('Pending balance must be a valid number').optional()
    ),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const updateClinicSchema = z.object({
  body: z.object({
    clinicName: z.string().min(1, 'Clinic name is required').max(255, 'Clinic name too long').optional(),
    organizationId: z.string().min(1, 'Organization ID is required').optional(),
    clientAddress: z.string().min(1, 'Client address is required').optional(),
    contactNumber: z.string().min(1, 'Contact number is required').max(20, 'Contact number too long').optional(),
    doctorName: z.string().max(255, 'Doctor name too long').optional(),
    pendingBalance: z.preprocess(
      (val) => (val === null || val === '' || val === undefined ? undefined : Number(val)),
      z.number().finite('Pending balance must be a valid number').optional()
    ),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});
