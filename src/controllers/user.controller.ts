import { Request, Response } from 'express';

import { createUser, deleteUser, listUsers, updateUser } from '../services/user.service';
import { Role } from '../types/auth';

export async function listUsersController(req: Request, res: Response) {
  const users = await listUsers();
  return res.json({ users });
}

export async function createUserController(req: Request, res: Response) {
  const { email, password, role, employeeTypeName, technicianGroupName } = req.body as Partial<{ email: string; password: string; role: Role; employeeTypeName?: string | null; technicianGroupName?: string | null }>;
  if (!email || !password || !role) return res.status(400).json({ message: 'email, password, role required' });
  const user = await createUser({ email, password, role, employeeTypeName: employeeTypeName ?? null, technicianGroupName: technicianGroupName ?? null });
  return res.status(201).json({ user });
}

export async function updateUserController(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  const user = await updateUser(id, req.body);
  return res.json({ user });
}

export async function deleteUserController(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  await deleteUser(id);
  return res.status(204).send();
}


