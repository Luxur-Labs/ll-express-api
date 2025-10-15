import { Request, Response } from 'express';

import { createUser, deleteUser, listEmployees, listUsers, updateUser } from '../services/user.service';
import { Role } from '../types/auth';

export async function listUsersController(req: Request, res: Response) {
  const users = await listUsers();
  const result = users.map((u: any) => ({
    fullName: u.fullName ?? null,
    dateOfBirth: u.dateOfBirth ?? null,
    Contact: u.contact ?? null,
    UserType: u.employeeType?.name ?? null,
    email: u.email,
    profilePicture: u.profilePhoto ?? null,
    technicianGroup: u.technicianGroup?.name ?? null,
  }));
  return res.json({ users: result });
}

export async function listEmployeesController(req: Request, res: Response) {
  const { employeeTypeName } = req.query as Partial<{ employeeTypeName: string }>;
  const users = await listEmployees(employeeTypeName ? { employeeTypeName } : undefined);
  const result = users.map((u: any) => ({
    id: u.id,
    fullName: u.fullName ?? null,
    dateOfBirth: u.dateOfBirth ?? null,
    Contact: u.contact ?? null,
    UserType: u.employeeType?.name ?? null,
    email: u.email,
    profilePicture: u.profilePhoto ?? null,
    technicianGroup: u.technicianGroup?.name ?? null,
  }));
  return res.json({ users: result });
}

export async function createUserController(req: Request, res: Response) {
  const { email, password, role, employeeTypeName, technicianGroupName, fullName, dateOfBirth, contact } = req.body as Partial<{
    email: string;
    password: string;
    role: Role;
    employeeTypeName?: string | null;
    technicianGroupName?: string | null;
    fullName?: string | null;
    dateOfBirth?: string | null;
    contact?: string | null;
  }>;
  if (!email || !password || !role) return res.status(400).json({ message: 'email, password, role required' });

  const files = req.files as Record<string, Express.Multer.File[]> | undefined;
  const documentFile = files?.document?.[0];
  const profilePhotoFile = files?.profilePhoto?.[0];

  const user = await createUser({
    email,
    password,
    role,
    employeeTypeName: employeeTypeName ?? null,
    technicianGroupName: technicianGroupName ?? null,
    fullName: fullName ?? null,
    dateOfBirth: dateOfBirth ?? null,
    contact: contact ?? null,
    documentFile,
    profilePhotoFile,
    publicBaseUrl: `${req.protocol}://${req.get('host')}`,
  });
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


