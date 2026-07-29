import { NextFunction, Request, Response } from 'express';

import type { AuthUser } from '../types/auth';

/** Blocks clinic portal until first-time password is set. */
export function requireClinicPortalReady(req: Request, res: Response, next: NextFunction) {
  const user = res.locals.user as AuthUser | undefined;
  if (user?.role === 'CLINIC' && user.mustChangePassword) {
    return res.status(403).json({
      message: 'Set your password to access the clinic portal.',
      code: 'PASSWORD_SETUP_REQUIRED',
    });
  }
  next();
}
