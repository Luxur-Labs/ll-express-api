import { Request, Response } from 'express';

import { createUser, revokeUser, listEmployees, listUsers, updateUser, getDoctorsList } from '../services/user.service';
import { CREATABLE_USER_ROLES } from '../config/permissions';
import { Role } from '../types/auth';

const CREATABLE_ROLES = new Set<Role>(CREATABLE_USER_ROLES);

export async function listUsersController(req: Request, res: Response) {
  const users = await listUsers();
  const result = users.map((u: any) => ({
    id: u.id,
    name: u.name ?? null,
    role: u.role,
    dateOfBirth: u.dateOfBirth ?? null,
    Contact: u.contact ?? null,
    contact: u.contact ?? null,
    UserType: u.employeeType?.name ?? null,
    employeeType: u.employeeType?.name ?? null,
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
    name: u.name ?? null,
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
  const { email, password, role, employeeTypeName, technicianGroupName, name, dateOfBirth, contact, mustChangePassword } = req.body as Partial<{
    email: string;
    password: string;
    role: Role;
    employeeTypeName?: string | null;
    technicianGroupName?: string | null;
    name?: string | null;
    dateOfBirth?: string | null;
    contact?: string | null;
    mustChangePassword?: boolean | string;
  }>;
  if (!email || !password || !role) return res.status(400).json({ message: 'email, password, role required' });
  if (!CREATABLE_ROLES.has(role)) {
    return res.status(400).json({
      message: 'Invalid role. Only Lab Manager and Front Office accounts can be created.',
    });
  }

  const files = req.files as Record<string, Express.Multer.File[]> | undefined;
  const documentFile = files?.document?.[0];
  const profilePhotoFile = files?.profilePhoto?.[0];

  const user = await createUser({
    email,
    password,
    role,
    employeeTypeName: employeeTypeName ?? null,
    technicianGroupName: technicianGroupName ?? null,
    name: name ?? null,
    dateOfBirth: dateOfBirth ?? null,
    contact: contact ?? null,
    documentFile,
    profilePhotoFile,
    publicBaseUrl: `${req.protocol}://${req.get('host')}`,
    mustChangePassword: mustChangePassword === true || mustChangePassword === 'true',
  });
  return res.status(201).json({ user });
}

export async function updateUserController(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  const { email, password, role, employeeTypeName, technicianGroupName, name, dateOfBirth, contact, mustChangePassword } = req.body as Partial<{
    email: string;
    password: string;
    role: Role;
    employeeTypeName?: string | null;
    technicianGroupName?: string | null;
    name?: string | null;
    dateOfBirth?: string | null;
    contact?: string | null;
    mustChangePassword?: boolean | string;
  }>;

  if (role && !CREATABLE_ROLES.has(role)) {
    return res.status(400).json({
      message: 'Invalid role. Only Lab Manager and Front Office accounts are supported.',
    });
  }

  const user = await updateUser(id, {
    email,
    password,
    role,
    employeeTypeName: employeeTypeName ?? undefined,
    technicianGroupName: technicianGroupName ?? undefined,
    name: name ?? undefined,
    dateOfBirth: dateOfBirth ?? undefined,
    contact: contact ?? undefined,
    ...(mustChangePassword !== undefined
      ? { mustChangePassword: mustChangePassword === true || mustChangePassword === 'true' }
      : {}),
  });
  return res.json({ user });
}

export async function deleteUserController(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  try {
    await revokeUser(id);
    return res.json({ message: 'User access revoked. The account can no longer log in.' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to revoke user';
    if (message === 'User not found') {
      return res.status(404).json({ message });
    }
    if (message === 'Super Admin accounts cannot be revoked') {
      return res.status(403).json({ message });
    }
    return res.status(500).json({ message });
  }
}

export async function getDoctorsListController(req: Request, res: Response) {
  try {
    const doctors = await getDoctorsList();
    return res.json(doctors);
  } catch (error) {
    console.error('Error fetching doctors list:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}


