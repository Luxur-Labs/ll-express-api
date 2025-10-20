import { z } from 'zod';

export const createPatientSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').max(255, 'Name too long'),
    age: z.number().int('Age must be an integer').min(0, 'Age cannot be negative').max(150, 'Age cannot exceed 150'),
    gender: z.string().min(1, 'Gender is required').max(50, 'Gender too long'),
    contactNumber: z.string().max(20, 'Contact number too long').optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const updatePatientSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').max(255, 'Name too long').optional(),
    age: z.number().int('Age must be an integer').min(0, 'Age cannot be negative').max(150, 'Age cannot exceed 150').optional(),
    gender: z.string().min(1, 'Gender is required').max(50, 'Gender too long').optional(),
    contactNumber: z.string().min(1, 'Contact number is required').max(20, 'Contact number too long').optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const ageRangeQuerySchema = z.object({
  body: z.object({}).optional(),
  query: z.object({
    minAge: z.string().regex(/^\d+$/, 'Invalid minAge format'),
    maxAge: z.string().regex(/^\d+$/, 'Invalid maxAge format'),
  }),
  params: z.object({}).optional(),
});

export const searchByNameQuerySchema = z.object({
  body: z.object({}).optional(),
  query: z.object({
    name: z.string().min(1, 'Name search parameter is required'),
  }),
  params: z.object({}).optional(),
});
