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
    role: z.enum(['SUPER_ADMIN', 'LAB_MANAGER', 'FRONT_OFFICE', 'DOCTOR', 'EMPLOYEE']).optional(),
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

export const updateTechnicianGroupSchema = z.object({
  body: z.object({
    group: z.string().optional(),
    description: z.string().nullable().optional(),
    leaderId: z.string().uuid('Invalid leader ID format').nullable().optional(),
    memberIds: z.array(z.string().uuid('Invalid member ID format')).optional(),
  }),
  params: z.object({
    id: z.string().uuid('Invalid technician group ID format'),
  }),
});

export const deleteTechnicianGroupSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid technician group ID format'),
  }),
});