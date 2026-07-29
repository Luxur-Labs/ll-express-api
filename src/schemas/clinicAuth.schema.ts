import { z } from 'zod';

const contactNumberSchema = z
  .string()
  .min(8, 'Phone number is required')
  .max(20, 'Phone number too long');

const otpCodeSchema = z.string().regex(/^\d{6}$/, 'Enter the 6-digit code from WhatsApp');

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password too long');

export const clinicAccountStatusSchema = z.object({
  query: z.object({
    contactNumber: contactNumberSchema,
  }),
});

export const clinicRequestOtpSchema = z.object({
  body: z.object({
    contactNumber: contactNumberSchema,
    purpose: z.enum(['login', 'reset']).optional().default('login'),
  }),
});

export const clinicVerifyOtpSchema = z.object({
  body: z.object({
    contactNumber: contactNumberSchema,
    code: otpCodeSchema,
  }),
});

export const clinicPasswordLoginSchema = z.object({
  body: z.object({
    contactNumber: contactNumberSchema,
    password: z.string().min(1, 'Password is required'),
  }),
});

export const clinicSetPasswordSchema = z.object({
  body: z
    .object({
      newPassword: passwordSchema,
      confirmPassword: z.string().min(1, 'Confirm password is required'),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: 'Passwords do not match',
      path: ['confirmPassword'],
    }),
});

export const clinicResetPasswordSchema = z.object({
  body: z
    .object({
      contactNumber: contactNumberSchema,
      code: otpCodeSchema,
      currentPassword: z.string().min(1, 'Current password is required'),
      newPassword: passwordSchema,
      confirmPassword: z.string().min(1, 'Confirm password is required'),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: 'Passwords do not match',
      path: ['confirmPassword'],
    }),
});
