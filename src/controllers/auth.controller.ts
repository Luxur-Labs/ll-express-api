import { Request, Response } from 'express';

import { signToken, forgotPasswordInitiate } from '../services/auth.service';
import { EmployeeType, TechnicianGroup, Role as AuthRole } from '../types/auth';
import { verifyPassword } from '../utils/password';
import { prisma } from '../utils/prisma';

export async function loginController(req: Request, res: Response) {
  const { email, password } = req.body as { email: string; password: string };

  const user = await prisma.user.findUnique({
    where: { email },
    include: { employeeType: true, technicianGroup: true },
  });
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

  const token = signToken({
    id: user.id,
    role: user.role as unknown as AuthRole,
    employeeType: (user.employeeType?.name as EmployeeType | undefined) ?? null,
    technicianGroup: (user.technicianGroup?.name as TechnicianGroup | undefined) ?? null,
  });
  return res.json({ token });
}

export function meController(req: Request, res: Response) {
  const user = res.locals.user;
  if (!user) return res.status(401).json({ message: 'Unauthorized' });
  return res.json({ user });
}

export async function forgotPasswordController(req: Request, res: Response) {
  const { email } = req.body as Partial<{ email: string }>;
  if (!email) return res.status(400).json({ message: 'email is required' });
  await forgotPasswordInitiate(email);
  // Always return 202 to avoid user enumeration
  return res.status(202).json({ message: 'If the email exists, a reset message will be sent.' });
}


