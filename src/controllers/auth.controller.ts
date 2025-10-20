import { Request, Response } from 'express';

import { signToken, forgotPasswordInitiate } from '../services/auth.service';
import { 
  isAccountLocked, 
  recordFailedLogin, 
  recordSuccessfulLogin, 
  getClientIp,
  addRandomDelay
} from '../services/security.service';
import { EmployeeType, TechnicianGroup, Role as AuthRole } from '../types/auth';
import { verifyPassword } from '../utils/password';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';

export async function loginController(req: Request, res: Response) {
  const { email, password } = req.body as { email: string; password: string };
  const clientIp = getClientIp(req);

  try {
    // Check if account is locked
    const locked = await isAccountLocked(email);
    if (locked) {
      logger.warn({ email, ip: clientIp }, 'Login attempt on locked account');
      await addRandomDelay(); // Add delay to prevent timing attacks
      return res.status(423).json({ 
        message: 'Account is temporarily locked due to multiple failed login attempts. Please try again later.' 
      });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { employeeType: true, technicianGroup: true },
    });

    // Always add random delay to prevent timing attacks
    await addRandomDelay();

    if (!user) {
      // Don't reveal if user exists - but log the attempt
      logger.warn({ email, ip: clientIp }, 'Login attempt with non-existent email');
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      // Record failed login attempt
      await recordFailedLogin(email, clientIp);
      logger.warn({ email, ip: clientIp }, 'Failed login attempt - incorrect password');
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Successful login - record it
    await recordSuccessfulLogin(email, clientIp);

    const token = signToken({
      id: user.id,
      role: user.role as unknown as AuthRole,
      employeeType: (user.employeeType?.name as EmployeeType | undefined) ?? null,
      technicianGroup: (user.technicianGroup?.name as TechnicianGroup | undefined) ?? null,
    });

    return res.json({ 
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        employeeType: user.employeeType?.name,
        technicianGroup: user.technicianGroup?.name,
        lastLoginAt: user.lastLoginAt,
        name: (user as any).name ?? null,
        dateOfBirth: (user as any).dateOfBirth ?? null,
        contact: (user as any).contact ?? null,
        profilePhoto: (user as any).profilePhoto ?? null,
      }
    });
  } catch (error) {
    logger.error({ error, email, ip: clientIp }, 'Login error');
    return res.status(500).json({ message: 'An error occurred during login' });
  }
}

export function meController(req: Request, res: Response) {
  const user = res.locals.user;
  if (!user) return res.status(401).json({ message: 'Unauthorized' });
  return res.json({ user });
}

export function logoutController(req: Request, res: Response) {
  // Since JWT is stateless, logout is mainly client-side
  // But we can log the logout event for security purposes
  const user = res.locals.user;
  const clientIp = getClientIp(req);
  
  if (user) {
    logger.info({ 
      userId: user.id, 
      email: user.email, 
      ip: clientIp 
    }, 'User logout');
  }
  
  // Return success - client should remove token from storage
  return res.json({ 
    message: 'Logged out successfully',
    logoutAt: new Date().toISOString()
  });
}

export async function forgotPasswordController(req: Request, res: Response) {
  const { email } = req.body as Partial<{ email: string }>;
  if (!email) return res.status(400).json({ message: 'email is required' });
  await forgotPasswordInitiate(email);
  // Always return 202 to avoid user enumeration
  return res.status(202).json({ message: 'If the email exists, a reset message will be sent.' });
}


