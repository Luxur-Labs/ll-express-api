import jwt, { JwtPayload, Secret, SignOptions } from 'jsonwebtoken';

import { env } from '../config/env';
import { AuthUser, Role, EmployeeType, TechnicianGroup } from '../types/auth';
import { prisma } from '../utils/prisma';
import { sendResetEmail } from '../utils/mailer';
import { betterAuthForgotPassword } from './betterauth.service';

export interface LoginPayload {
  id: string;
  email?: string;
  role: Role;
  employeeType?: EmployeeType | null;
  technicianGroup?: TechnicianGroup | null;
}

export function signToken(payload: LoginPayload) {
  const secret: Secret = env.JWT_SECRET;
  const options: SignOptions = { expiresIn: env.JWT_EXPIRES_IN as any };
  return jwt.sign(payload as unknown as JwtPayload, secret, options);
}

export function verifyToken(token: string): AuthUser {
  const secret: Secret = env.JWT_SECRET;
  const decoded = jwt.verify(token, secret) as JwtPayload;
  return decoded as AuthUser;
}

export async function forgotPasswordInitiate(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return; // no-op to avoid user enumeration

  if (user.role === 'SUPER_ADMIN') {
    // betterAuth flow
    await betterAuthForgotPassword(email);
    return;
  }

  // Gmail flow: generate reset link using base URL
  if (!env.RESET_PASSWORD_URL_BASE) return;
  const token = signToken({ id: user.id, role: user.role as any });
  const resetUrl = `${env.RESET_PASSWORD_URL_BASE}?token=${encodeURIComponent(token)}`;
  try {
    await sendResetEmail(email, resetUrl);
  } catch {
    // swallow email errors to avoid user enumeration
  }
}


