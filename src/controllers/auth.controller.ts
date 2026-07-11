import { Request, Response } from 'express';

import { signToken, forgotPasswordInitiate } from '../services/auth.service';
import { createRefreshToken, revokeRefreshToken, rotateRefreshToken } from '../services/refreshToken.service';
import { invalidateUserSessions } from '../services/session.service';
import { 
  isAccountLocked, 
  recordFailedLogin, 
  recordSuccessfulLogin, 
  getClientIp,
  addRandomDelay
} from '../services/security.service';
import { EmployeeType, TechnicianGroup, Role as AuthRole } from '../types/auth';
import { LOGIN_DISABLED_ROLES } from '../config/permissions';
import { hashPassword, verifyPassword } from '../utils/password';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';

type UserWithRelations = Awaited<ReturnType<typeof loadUserForAuth>>;

async function loadUserForAuth(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: { employeeType: true, technicianGroup: true },
  });
}

function formatAuthUser(user: NonNullable<UserWithRelations>) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    employeeType: user.employeeType?.name,
    technicianGroup: user.technicianGroup?.name,
    lastLoginAt: user.lastLoginAt,
    mustChangePassword: user.mustChangePassword === true,
    name: user.name ?? null,
    dateOfBirth: user.dateOfBirth ?? null,
    contact: user.contact ?? null,
    profilePhoto: user.profilePhoto ?? null,
  };
}

function signAccessToken(user: NonNullable<UserWithRelations>) {
  return signToken({
    id: user.id,
    email: user.email,
    role: user.role as unknown as AuthRole,
    employeeType: (user.employeeType?.name as EmployeeType | undefined) ?? null,
    technicianGroup: (user.technicianGroup?.name as TechnicianGroup | undefined) ?? null,
    mustChangePassword: user.mustChangePassword === true,
    tokenVersion: user.tokenVersion,
  });
}

async function issueAuthTokens(user: NonNullable<UserWithRelations>, req: Request) {
  const accessToken = signAccessToken(user);
  const refreshToken = await createRefreshToken({
    userId: user.id,
    ipAddress: getClientIp(req),
    userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
  });

  return {
    token: accessToken,
    accessToken,
    refreshToken,
    user: formatAuthUser(user),
  };
}

export async function loginController(req: Request, res: Response) {
  const { email, password } = req.body as { email: string; password: string };
  const clientIp = getClientIp(req);

  try {
    const locked = await isAccountLocked(email);
    if (locked) {
      logger.warn({ email, ip: clientIp }, 'Login attempt on locked account');
      await addRandomDelay();
      return res.status(423).json({ 
        message: 'Account is temporarily locked due to multiple failed login attempts. Please try again later.' 
      });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { employeeType: true, technicianGroup: true },
    });

    await addRandomDelay();

    if (!user) {
      logger.warn({ email, ip: clientIp }, 'Login attempt with non-existent email');
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      await recordFailedLogin(email, clientIp);
      logger.warn({ email, ip: clientIp }, 'Failed login attempt - incorrect password');
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    await recordSuccessfulLogin(email, clientIp);

    if (user.role === 'DOCTOR' || user.role === 'EMPLOYEE') {
      logger.warn({ email, ip: clientIp, role: user.role }, 'Login blocked for disabled role');
      return res.status(403).json({
        message: 'This account type is no longer supported. Contact your administrator.',
      });
    }

    if (user.isActive === false) {
      logger.warn({ email, ip: clientIp }, 'Login blocked for revoked account');
      return res.status(403).json({
        message: 'This account has been revoked. Contact your administrator.',
      });
    }

    return res.json(await issueAuthTokens(user, req));
  } catch (error) {
    logger.error({ error, email, ip: clientIp }, 'Login error');
    return res.status(500).json({ message: 'An error occurred during login' });
  }
}

export async function refreshController(req: Request, res: Response) {
  const { refreshToken } = req.body as { refreshToken?: string };
  if (!refreshToken) {
    return res.status(400).json({ message: 'refreshToken is required' });
  }

  const rotated = await rotateRefreshToken(refreshToken, {
    ipAddress: getClientIp(req),
    userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
  });

  if (!rotated) {
    return res.status(401).json({
      message: 'Invalid or expired refresh token',
      code: 'REFRESH_TOKEN_INVALID',
    });
  }

  const user = await loadUserForAuth(rotated.userId);
  if (!user || user.isActive === false) {
    return res.status(403).json({
      message: 'This account has been revoked. Contact your administrator.',
      code: 'ACCOUNT_REVOKED',
    });
  }

  if ((LOGIN_DISABLED_ROLES as readonly string[]).includes(user.role)) {
    return res.status(403).json({
      message: 'This account type is no longer supported. Contact your administrator.',
      code: 'ROLE_LOGIN_DISABLED',
    });
  }

  const accessToken = signAccessToken(user);
  return res.json({
    token: accessToken,
    accessToken,
    refreshToken: rotated.newRefreshToken,
    user: formatAuthUser(user),
  });
}

export function meController(req: Request, res: Response) {
  const user = res.locals.user;
  if (!user) return res.status(401).json({ message: 'Unauthorized' });
  return res.json({ user });
}

export async function logoutController(req: Request, res: Response) {
  const user = res.locals.user;
  const clientIp = getClientIp(req);
  const { refreshToken } = (req.body ?? {}) as { refreshToken?: string };

  if (refreshToken) {
    await revokeRefreshToken(refreshToken);
  }
  
  if (user) {
    logger.info({ 
      userId: user.id, 
      email: user.email, 
      ip: clientIp 
    }, 'User logout');
  }
  
  return res.json({ 
    message: 'Logged out successfully',
    logoutAt: new Date().toISOString()
  });
}

export async function forgotPasswordController(req: Request, res: Response) {
  const { email } = req.body as Partial<{ email: string }>;
  if (!email) return res.status(400).json({ message: 'email is required' });
  await forgotPasswordInitiate(email);
  return res.status(202).json({ message: 'If the email exists, a reset message will be sent.' });
}

export async function changePasswordController(req: Request, res: Response) {
  const authUser = res.locals.user;
  if (!authUser) return res.status(401).json({ message: 'Unauthorized' });

  const { currentPassword, newPassword } = req.body as {
    currentPassword: string;
    newPassword: string;
  };

  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
    include: { employeeType: true, technicianGroup: true },
  });
  if (!user) return res.status(404).json({ message: 'User not found' });

  const ok = await verifyPassword(currentPassword, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ message: 'Current password is incorrect' });
  }

  if (currentPassword === newPassword) {
    return res.status(400).json({ message: 'New password must be different from the current password' });
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, mustChangePassword: false },
  });

  await invalidateUserSessions(user.id);
  const refreshedUser = await loadUserForAuth(user.id);
  if (!refreshedUser) return res.status(404).json({ message: 'User not found' });

  const tokens = await issueAuthTokens(refreshedUser, req);

  return res.json({
    message: 'Password changed successfully',
    ...tokens,
  });
}
