import { NextFunction, Request, Response } from 'express';

import { verifyToken } from '../services/auth.service';
import { Role, EmployeeType, TechnicianGroup, AuthUser } from '../types/auth';
import { hasAnyPermission, Permission } from '../config/permissions';
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
      select: { isActive: true },
    });
    if (!dbUser || dbUser.isActive === false) {
      return res.status(403).json({
        message: 'This account has been revoked. Contact your administrator.',
        code: 'ACCOUNT_REVOKED',
      });
    }

    res.locals.user = user;

    if (user.mustChangePassword) {
      const relativePath = req.path;
      const allowed =
        (req.method === 'POST' && relativePath === '/change-password') ||
        (req.method === 'POST' && relativePath === '/logout');
      if (!allowed) {
        return res.status(403).json({
          message: 'You must change your password before continuing.',
          code: 'PASSWORD_CHANGE_REQUIRED',
        });
      }
    }

    next();
  } catch {
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


