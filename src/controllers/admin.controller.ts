import { Request, Response } from 'express';

import { EmployeeType, TechnicianGroup } from '../types/auth';
import { prisma } from '../utils/prisma';

// Combined list endpoint removed; use listEmployeeTypesController and listTechnicianGroupsController

export async function listEmployeeTypesController(req: Request, res: Response) {
  const employeeTypes = await prisma.employeeType.findMany({ select: { name: true } });
  return res.json({ employeeTypes: employeeTypes.map((e: { name: string }) => e.name) });
}

export async function listTechnicianGroupsController(req: Request, res: Response) {
  const groups = await prisma.technicianGroup.findMany({
    include: {
      leader: { include: { employeeType: true, technicianGroup: true } },
      members: { include: { employeeType: true, technicianGroup: true } },
    }
  });

  const toEmployeeShape = (u: any) => ({
    fullName: u?.fullName ?? null,
    dateOfBirth: u?.dateOfBirth ?? null,
    Contact: u?.contact ?? null,
    UserType: u?.employeeType?.name ?? null,
    email: u?.email ?? null,
    profilePicture: u?.profilePhoto ?? null,
    technicianGroup: u?.technicianGroup?.name ?? null,
  });

  const result = groups.map((g: any) => ({
    name: g.name,
    description: (g as any).description ?? null,
    leader: g.leader ? toEmployeeShape(g.leader) : null,
    members: Array.isArray(g.members) ? g.members.map(toEmployeeShape) : [],
  }));

  return res.json({ technicianGroups: result });
}

export async function addEmployeeTypeController(req: Request, res: Response) {
  const { type } = req.body as { type?: EmployeeType };
  if (!type) return res.status(400).json({ message: 'type is required' });
  await prisma.employeeType.upsert({ where: { name: type }, update: {}, create: { name: type } });
  const employeeTypes = await prisma.employeeType.findMany({ select: { name: true } });
  return res.status(201).json({ employeeTypes: employeeTypes.map((e: { name: string }) => e.name) });
}

export async function addTechnicianGroupController(req: Request, res: Response) {
  const { group, description, leaderId, memberIds } = req.body as { group?: TechnicianGroup; description?: string | null; leaderId?: string | null; memberIds?: string[] };
  if (!group) return res.status(400).json({ message: 'group is required' });

  // Validate leader if provided
  if (leaderId) {
    const leader = await prisma.user.findUnique({ where: { id: leaderId } });
    if (!leader) return res.status(400).json({ message: 'leaderId is invalid' });
  }

  const upserted = await prisma.technicianGroup.upsert({
    where: { name: group },
    update: ({ description: description ?? null, name: group, leaderId: leaderId ?? null } as any),
    create: ({ name: group, description: description ?? null, leaderId: leaderId ?? null } as any),
  });

  // Optionally set members
  if (Array.isArray(memberIds)) {
    // Remove users no longer in the list
    await prisma.user.updateMany({
      where: {
        technicianGroupId: upserted.id,
        id: { notIn: memberIds.length ? memberIds : ['__none__'] },
      },
      data: { technicianGroupId: null },
    });
    // Assign provided members to this group
    if (memberIds.length) {
      await prisma.user.updateMany({
        where: { id: { in: memberIds } },
        data: { technicianGroupId: upserted.id },
      });
    }
  }
  // Return the created/updated group with full details
  const updatedGroup = await prisma.technicianGroup.findUnique({
    where: { id: upserted.id },
    include: {
      leader: { include: { employeeType: true, technicianGroup: true } },
      members: { include: { employeeType: true, technicianGroup: true } },
    }
  });

  const toEmployeeShape = (u: any) => ({
    id: u?.id,
    fullName: u?.fullName ?? null,
    dateOfBirth: u?.dateOfBirth ?? null,
    Contact: u?.contact ?? null,
    UserType: u?.employeeType?.name ?? null,
    email: u?.email ?? null,
    profilePicture: u?.profilePhoto ?? null,
    technicianGroup: u?.technicianGroup?.name ?? null,
  });

  const result = {
    name: updatedGroup?.name,
    description: (updatedGroup as any)?.description ?? null,
    leader: updatedGroup?.leader ? toEmployeeShape(updatedGroup.leader) : null,
    members: Array.isArray(updatedGroup?.members) ? updatedGroup.members.map(toEmployeeShape) : [],
  };

  return res.status(201).json({ technicianGroup: result });
}


