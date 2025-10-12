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
