import 'dotenv/config'; 
import { z } from 'zod'; 
 
const envSchema = z.object({ 
  NODE_ENV: z.enum(['development','test','production']).default('development'), 
  PORT: z.coerce.number().int().positive().default(3000), 
  LOG_LEVEL: z.enum(['fatal','error','warn','info','debug','trace','silent']).default('info'), 
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('1h'),
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().positive().default(10),
  // Email/reset configuration
  EMAIL_FROM: z.string().email().optional(),
  GMAIL_USER: z.string().optional(),
  GMAIL_APP_PASSWORD: z.string().optional(),
  RESET_PASSWORD_URL_BASE: z.string().url().optional(),
  // Optional custom SMTP (takes precedence over Gmail if set)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_SECURE: z.coerce.boolean().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  // betterAuth integration (stub)
  BETTERAUTH_BASE_URL: z.string().url().optional(),
  BETTERAUTH_API_TOKEN: z.string().optional(),
  BETTERAUTH_FORGOT_PATH: z.string().default('/api/auth/forgot-password'),
  // AWS S3 configuration
  AWS_REGION: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  S3_BUCKET_NAME: z.string().optional(),
  S3_PUBLIC_URL: z.string().url().optional(),
}); 
 
const parsed = envSchema.safeParse(process.env); 
if (!parsed.success) { 
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors); 
  process.exit(1); 
} 
 
export const env = parsed.data;
