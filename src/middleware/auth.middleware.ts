import { NextFunction, Request, Response } from 'express';

import { verifyToken } from '../services/auth.service';
import { Role, EmployeeType, TechnicianGroup, AuthUser } from '../types/auth';
import { hasAnyPermission, Permission, LOGIN_DISABLED_ROLES } from '../config/permissions';
import { prisma } from '../utils/prisma';

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  let token: string | undefined;
  
  // Check for Authorization header first (Bearer token)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.substring('Bearer '.length);
  }
  // Check for custom token header
  else if (req.headers.token && typeof req.headers.token === 'string') {
    token = req.headers.token;
  }
  
  if (!token) {
    return res.status(401).json({ message: 'Missing or invalid token' });
  }
  
  try {
    const user = verifyToken(token);
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { isActive: true, tokenVersion: true },
    });
    if (!dbUser || dbUser.isActive === false) {
      return res.status(403).json({
        message: 'This account has been revoked. Contact your administrator.',
        code: 'ACCOUNT_REVOKED',
      });
    }

    const tokenVersion = user.tokenVersion ?? 0;
    if (tokenVersion !== dbUser.tokenVersion) {
      return res.status(401).json({
        message: 'Your session is no longer valid. Please sign in again.',
        code: 'SESSION_INVALIDATED',
      });
    }

    if ((LOGIN_DISABLED_ROLES as readonly string[]).includes(user.role)) {
      return res.status(403).json({
        message: 'This account type is no longer supported. Contact your administrator.',
        code: 'ROLE_LOGIN_DISABLED',
      });
    }

    res.locals.user = user;

    if (user.mustChangePassword) {
      const relativePath = req.path;
      const allowed =
        (req.method === 'POST' && relativePath === '/change-password') ||
        (req.method === 'POST' && relativePath === '/clinic/set-password') ||
        (req.method === 'POST' && relativePath === '/logout');
      if (!allowed) {
        return res.status(403).json({
          message: 'You must change your password before continuing.',
          code: 'PASSWORD_CHANGE_REQUIRED',
        });
      }
    }

    next();
  } catch (err) {
    if (err instanceof Error && err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ message: 'Invalid token' });
  }
}

export function authorizeRoles(...allowed: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = res.locals.user as AuthUser | undefined;
    if (!user) return res.status(401).json({ message: 'Unauthorized' });
    if (!allowed.includes(user.role)) return res.status(403).json({ message: 'Forbidden' });
    next();
  };
}

export function authorizePermissions(...permissions: Permission[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = res.locals.user as AuthUser | undefined;
    if (!user) return res.status(401).json({ message: 'Unauthorized' });
    if (!hasAnyPermission(user.role, permissions)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    next();
  };
}

/** Allows orders.update, or Front Office (ownership verified in controller). */
export function authorizeOrderUpdate(req: Request, res: Response, next: NextFunction) {
  const user = res.locals.user as AuthUser | undefined;
  if (!user) return res.status(401).json({ message: 'Unauthorized' });
  if (hasAnyPermission(user.role, ['orders.update'])) return next();
  if (user.role === 'FRONT_OFFICE') return next();
  return res.status(403).json({ message: 'Forbidden' });
}

export function authorizeEmployeeTypes(...types: EmployeeType[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = res.locals.user as AuthUser | undefined;
    if (!user) return res.status(401).json({ message: 'Unauthorized' });
    if (!user.employeeType || !types.includes(user.employeeType)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    next();
  };
}

export function authorizeTechnicianGroups(...groups: TechnicianGroup[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = res.locals.user as AuthUser | undefined;
    if (!user) return res.status(401).json({ message: 'Unauthorized' });
    if (!user.technicianGroup || !groups.includes(user.technicianGroup)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    next();
  };
}


