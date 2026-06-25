import { Response } from 'express';

import { AuthUser } from '../types/auth';

export function getActorUserId(res: Response): string | undefined {
  return (res.locals.user as AuthUser | undefined)?.id;
}
