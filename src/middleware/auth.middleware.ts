import { NextFunction, Request, Response } from 'express';

import { verifyToken } from '../services/auth.service';
import { Role, EmployeeType, TechnicianGroup, AuthUser } from '../types/auth';

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Missing or invalid Authorization header' });
  }
  const token = authHeader.substring('Bearer '.length);
  try {
    const user = verifyToken(token);
    res.locals.user = user;
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


