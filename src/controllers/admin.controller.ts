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
    id: u?.id,
    name: u?.name ?? null,
    dateOfBirth: u?.dateOfBirth ?? null,
    Contact: u?.contact ?? null,
    UserType: u?.employeeType?.name ?? null,
    email: u?.email ?? null,
    profilePicture: u?.profilePhoto ?? null,
    technicianGroup: u?.technicianGroup?.name ?? null,
  });

  const result = groups.map((g: any) => ({
    id: g.id,
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
    const leader = await prisma.user.findUnique({ 
      where: { id: leaderId, deletedAt: null } 
    });
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
    name: u?.name ?? null,
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

export async function updateTechnicianGroupController(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  const { group, description, leaderId, memberIds } = req.body as { 
    group?: TechnicianGroup; 
    description?: string | null; 
    leaderId?: string | null; 
    memberIds?: string[] 
  };

  // Get current group to check existing leader
  const currentGroup = await prisma.technicianGroup.findUnique({
    where: { id },
    include: { leader: true }
  });

  if (!currentGroup) {
    return res.status(404).json({ message: 'Technician group not found' });
  }

  // Validate leader if provided
  if (leaderId) {
    const leader = await prisma.user.findUnique({ 
      where: { id: leaderId, deletedAt: null } 
    });
    if (!leader) return res.status(400).json({ message: 'leaderId is invalid' });
  }

  // Check if current leader is being removed from members
  let finalLeaderId = leaderId;
  let finalMemberIds = memberIds;
  
  if (Array.isArray(memberIds) && currentGroup.leaderId) {
    const isCurrentLeaderInMembers = memberIds.includes(currentGroup.leaderId);
    if (!isCurrentLeaderInMembers) {
      // Current leader is being removed from members, so remove them as leader too
      finalLeaderId = null;
    }
  }
  
  // Vice versa: Check if leader is being removed (leaderId is null or different)
  if (leaderId === null || (leaderId && leaderId !== currentGroup.leaderId)) {
    if (Array.isArray(memberIds) && currentGroup.leaderId) {
      // Remove the old leader from members list if they're still in it
      finalMemberIds = memberIds.filter(id => id !== currentGroup.leaderId);
    }
  }
  
  // Ensure new leader is added to members list
  if (leaderId && Array.isArray(finalMemberIds)) {
    if (!finalMemberIds.includes(leaderId)) {
      finalMemberIds = [...finalMemberIds, leaderId];
    }
  }

  // Update the technician group
  const updated = await prisma.technicianGroup.update({
    where: { id },
    data: {
      ...(group && { name: group }),
      description: description ?? null,
      leaderId: finalLeaderId ?? null,
    },
  });

  // Optionally set members
  if (Array.isArray(finalMemberIds)) {
    // Remove users no longer in the list
    await prisma.user.updateMany({
      where: {
        technicianGroupId: updated.id,
        id: { notIn: finalMemberIds.length ? finalMemberIds : ['__none__'] },
      },
      data: { technicianGroupId: null },
    });
    // Assign provided members to this group
    if (finalMemberIds.length) {
      await prisma.user.updateMany({
        where: { id: { in: finalMemberIds } },
        data: { technicianGroupId: updated.id },
      });
    }
  }

  // Return the updated group with full details
  const updatedGroup = await prisma.technicianGroup.findUnique({
    where: { id: updated.id },
    include: {
      leader: { include: { employeeType: true, technicianGroup: true } },
      members: { include: { employeeType: true, technicianGroup: true } },
    }
  });

  const toEmployeeShape = (u: any) => ({
    id: u?.id,
    name: u?.name ?? null,
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

  return res.json({ technicianGroup: result });
}

export async function deleteTechnicianGroupController(req: Request, res: Response) {
  const { id } = req.params as { id: string };

  // First, remove all users from this group
  await prisma.user.updateMany({
    where: { technicianGroupId: id },
    data: { technicianGroupId: null },
  });

  // Then delete the group
  await prisma.technicianGroup.delete({
    where: { id },
  });

  return res.status(204).send();
}
