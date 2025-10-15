import { z } from 'zod';

export const createClinicSchema = z.object({
  body: z.object({
    clinicName: z.string().min(1, 'Clinic name is required').max(255, 'Clinic name too long'),
    organizationId: z.string().min(1, 'Organization ID is required'),
    clientAddress: z.string().min(1, 'Client address is required'),
    contactNumber: z.string().min(1, 'Contact number is required').max(20, 'Contact number too long'),
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
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});
