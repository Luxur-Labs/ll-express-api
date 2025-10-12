import { Role } from '../types/auth';

import { hashPassword } from '../utils/password';
import { prisma } from '../utils/prisma';

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email }, include: { employeeType: true, technicianGroup: true } });
}

export async function listUsers() {
  return prisma.user.findMany({ include: { employeeType: true, technicianGroup: true } });
}

export async function createUser(input: {
  email: string;
  password: string;
  role: Role;
  employeeTypeName?: string | null;
  technicianGroupName?: string | null;
}) {
  const passwordHash = await hashPassword(input.password);

  const [employeeType, technicianGroup] = await Promise.all([
    input.employeeTypeName ? prisma.employeeType.upsert({ where: { name: input.employeeTypeName }, update: {}, create: { name: input.employeeTypeName } }) : Promise.resolve(null),
    input.technicianGroupName ? prisma.technicianGroup.upsert({ where: { name: input.technicianGroupName }, update: {}, create: { name: input.technicianGroupName } }) : Promise.resolve(null),
  ]);

  return prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      role: input.role,
      employeeTypeId: employeeType?.id ?? null,
      technicianGroupId: technicianGroup?.id ?? null,
    }
  });
}

export async function updateUser(id: string, input: Partial<{ email: string; password: string; role: Role; employeeTypeName: string | null; technicianGroupName: string | null }>) {
  const data: Record<string, unknown> = {};
  if (input.email) data.email = input.email;
  if (input.role) data.role = input.role;
  if (typeof input.password === 'string') {
    data.passwordHash = await hashPassword(input.password);
  }
  if (input.employeeTypeName !== undefined) {
    if (input.employeeTypeName === null) {
      data.employeeType = { disconnect: true };
    } else {
      data.employeeType = { connectOrCreate: { where: { name: input.employeeTypeName }, create: { name: input.employeeTypeName } } };
    }
  }
  if (input.technicianGroupName !== undefined) {
    if (input.technicianGroupName === null) {
      data.technicianGroup = { disconnect: true };
    } else {
      data.technicianGroup = { connectOrCreate: { where: { name: input.technicianGroupName }, create: { name: input.technicianGroupName } } };
    }
  }

  return prisma.user.update({ where: { id }, data });
}

export async function deleteUser(id: string) {
  return prisma.user.delete({ where: { id } });
}


