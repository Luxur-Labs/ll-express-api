import { env } from '../config/env';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 30;
const lockoutDisabled = env.NODE_ENV === 'development';

/**
 * Check if account is currently locked
 */
export async function isAccountLocked(email: string): Promise<boolean> {
  if (lockoutDisabled) return false;

  const user = await prisma.user.findUnique({
    where: { email },
    select: { accountLockedUntil: true },
  });

  if (!user || !user.accountLockedUntil) return false;

  const now = new Date();
  if (user.accountLockedUntil > now) {
    return true; // Still locked
  }

  // Lock expired, reset it
  await prisma.user.update({
    where: { email },
    data: {
      accountLockedUntil: null,
      failedLoginAttempts: 0,
    },
  });

  return false;
}

/**
 * Record a failed login attempt
 */
export async function recordFailedLogin(email: string, ip: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, failedLoginAttempts: true },
  });

  if (!user) return; // Don't reveal if user exists

  const newFailedAttempts = user.failedLoginAttempts + 1;
  const shouldLock = !lockoutDisabled && newFailedAttempts >= MAX_FAILED_ATTEMPTS;

  const updateData: any = {
    failedLoginAttempts: newFailedAttempts,
  };

  if (shouldLock) {
    const lockUntil = new Date();
    lockUntil.setMinutes(lockUntil.getMinutes() + LOCKOUT_DURATION_MINUTES);
    updateData.accountLockedUntil = lockUntil;

    logger.warn(
      {
        email,
        ip,
        attempts: newFailedAttempts,
        lockUntil,
      },
      'Account locked due to too many failed login attempts'
    );
  }

  await prisma.user.update({
    where: { email },
    data: updateData,
  });
}

/**
 * Record a successful login
 */
export async function recordSuccessfulLogin(email: string, ip: string): Promise<void> {
  await prisma.user.update({
    where: { email },
    data: {
      failedLoginAttempts: 0,
      accountLockedUntil: null,
      lastLoginAt: new Date(),
      lastLoginIp: ip,
    },
  });

  logger.info({ email, ip }, 'Successful login');
}

/**
 * Get client IP address from request
 */
export function getClientIp(req: any): string {
  return (
    req.headers['x-forwarded-for']?.split(',')[0] ||
    req.headers['x-real-ip'] ||
    req.socket.remoteAddress ||
    req.connection.remoteAddress ||
    'unknown'
  );
}

/**
 * Add a small random delay to prevent timing attacks
 */
export function addRandomDelay(): Promise<void> {
  const delay = Math.floor(Math.random() * 100) + 50; // 50-150ms random delay
  return new Promise((resolve) => setTimeout(resolve, delay));
}

