import { Role } from '../types/auth';
import { uploadToCdn } from '../utils/cdn';

import { hashPassword } from '../utils/password';
import { prisma } from '../utils/prisma';
import { Prisma } from '@prisma/client';
import type { Role as PrismaRole } from '@prisma/client';

// Updated to support soft delete with deletedAt and deletedBy fields

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({ 
    where: { email }, 
    include: { employeeType: true, technicianGroup: true } 
  });
}

export async function listUsers() {
  const where = ({ deletedAt: null } as Prisma.UserWhereInput);
  return prisma.user.findMany({ 
    where,
    include: { employeeType: true, technicianGroup: true } 
  });
}

export async function listEmployees(filter?: { employeeTypeName?: string }) {
  const where = ({ role: 'EMPLOYEE', deletedAt: null } as Prisma.UserWhereInput);
  if (filter?.employeeTypeName) {
    where.employeeType = { is: { name: filter.employeeTypeName } };
  }
  return prisma.user.findMany({ where, include: { employeeType: true, technicianGroup: true } });
}

export async function createUser(input: {
  email: string;
  password: string;
  role: Role;
  employeeTypeName?: string | null;
  technicianGroupName?: string | null;
  name?: string | null;
  dateOfBirth?: string | null; // ISO string expected from client
  contact?: string | null;
  documentFile?: Express.Multer.File | undefined;
  profilePhotoFile?: Express.Multer.File | undefined;
  publicBaseUrl?: string | undefined;
}) {
  const passwordHash = await hashPassword(input.password);

  const [employeeType, technicianGroup] = await Promise.all([
    input.employeeTypeName
      ? prisma.employeeType.upsert({ where: { name: input.employeeTypeName }, update: {}, create: { name: input.employeeTypeName } })
      : Promise.resolve(null),
    // IMPORTANT: Do NOT create a technician group by default; only link if it already exists
    input.technicianGroupName
      ? prisma.technicianGroup.findUnique({ where: { name: input.technicianGroupName } })
      : Promise.resolve(null),
  ]);

  // Upload files to CDN (local simulation). Optional.
  let documentUrl: string | null = null;
  let profilePhotoUrl: string | null = null;
  if (input.documentFile) {
    documentUrl = await uploadToCdn({
      buffer: input.documentFile.buffer,
      mimetype: input.documentFile.mimetype,
      originalname: input.documentFile.originalname,
    });
  }
  if (input.profilePhotoFile) {
    profilePhotoUrl = await uploadToCdn({
      buffer: input.profilePhotoFile.buffer,
      mimetype: input.profilePhotoFile.mimetype,
      originalname: input.profilePhotoFile.originalname,
    });
  }

  // Prefix with absolute base URL if provided
  if (input.publicBaseUrl) {
    if (documentUrl && documentUrl.startsWith('/')) documentUrl = `${input.publicBaseUrl}${documentUrl}`;
    if (profilePhotoUrl && profilePhotoUrl.startsWith('/')) profilePhotoUrl = `${input.publicBaseUrl}${profilePhotoUrl}`;
  }

  const data: Prisma.UserUncheckedCreateInput = {
    email: input.email,
    passwordHash,
    role: input.role as PrismaRole,
    employeeTypeId: employeeType?.id ?? null,
    // Only set technicianGroupId if an existing group was found and explicitly provided
    ...(technicianGroup?.id ? { technicianGroupId: technicianGroup.id } : {}),
    name: input.name ?? null,
    dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
    contact: input.contact ?? null,
    document: documentUrl,
    profilePhoto: profilePhotoUrl,
  };

  return prisma.user.create({ data });
}

export async function updateUser(id: string, input: Partial<{ 
  email: string; 
  password: string; 
  role: Role; 
  employeeTypeName: string | null; 
  technicianGroupName: string | null;
  name: string | null;
  dateOfBirth: string | null;
  contact: string | null;
}>) {
  const data: Prisma.UserUpdateInput = {};
  if (input.email) data.email = input.email;
  if (input.role) data.role = input.role as PrismaRole;
  if (typeof input.password === 'string') {
    data.passwordHash = await hashPassword(input.password);
  }
  if (input.name !== undefined) data.name = input.name;
  if (input.dateOfBirth !== undefined) {
    data.dateOfBirth = input.dateOfBirth ? new Date(input.dateOfBirth) : null;
  }
  if (input.contact !== undefined) data.contact = input.contact;
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

export async function deleteUser(id: string, deletedBy: string) {
  const data = ({
    deletedAt: new Date(),
    deletedBy,
  } as Prisma.UserUpdateInput);
  return prisma.user.update({ 
    where: { id }, 
    data
  });
}

export async function getDoctorsList(searchQuery?: string) {
  const whereClause = ({ role: 'DOCTOR', deletedAt: null } as Prisma.UserWhereInput);
  
  if (searchQuery && searchQuery.trim()) {
    whereClause.name = {
      contains: searchQuery.trim(),
      mode: 'insensitive'
    };
  }

  const doctors = await prisma.user.findMany({
    where: whereClause,
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });

  return doctors.map((d) => ({ id: d.id, name: d.name ?? '' }));
}


