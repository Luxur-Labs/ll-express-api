import { z } from 'zod';

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('invalid email format').transform(s => s.trim().toLowerCase()),
    password: z.string().min(1, 'password is required'),
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email('invalid email format').transform(s => s.trim().toLowerCase()),
  }),
});

export const updateUserSchema = z.object({
  body: z.object({
    email: z.string().email('invalid email format').transform(s => s.trim().toLowerCase()).optional(),
    password: z.string().min(1, 'password is required').optional(),
    role: z.enum(['SUPER_ADMIN', 'DOCTOR', 'EMPLOYEE']).optional(),
    employeeTypeName: z.string().nullable().optional(),
    technicianGroupName: z.string().nullable().optional(),
    name: z.string().max(255, 'Name too long').optional().transform(val => val === '' ? null : val),
    dateOfBirth: z.string().optional().transform(val => val === '' ? null : val), // Allow any string format, will be converted to Date in service
    contact: z.string().max(255, 'Contact too long').optional().transform(val => val === '' ? null : val),
  }),
  query: z.object({}).optional(),
  params: z.object({
    id: z.string().uuid('Invalid user ID format'),
  }),
});