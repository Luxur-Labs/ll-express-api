import { Request, Response } from 'express';

import { EmployeeType, TechnicianGroup } from '../types/auth';
import { prisma } from '../utils/prisma';

export async function listTypesController(req: Request, res: Response) {
  const [employeeTypes, technicianGroups] = await Promise.all([
    prisma.employeeType.findMany({ select: { name: true } }),
    prisma.technicianGroup.findMany({ select: { name: true } }),
  ]);
  return res.json({
    employeeTypes: employeeTypes.map((e: { name: string }) => e.name),
    technicianGroups: technicianGroups.map((g: { name: string }) => g.name)
  });
}

export async function addEmployeeTypeController(req: Request, res: Response) {
  const { type } = req.body as { type?: EmployeeType };
  if (!type) return res.status(400).json({ message: 'type is required' });
  await prisma.employeeType.upsert({ where: { name: type }, update: {}, create: { name: type } });
  const employeeTypes = await prisma.employeeType.findMany({ select: { name: true } });
  return res.status(201).json({ employeeTypes: employeeTypes.map((e: { name: string }) => e.name) });
}

export async function addTechnicianGroupController(req: Request, res: Response) {
  const { group } = req.body as { group?: TechnicianGroup };
  if (!group) return res.status(400).json({ message: 'group is required' });
  await prisma.technicianGroup.upsert({ where: { name: group }, update: {}, create: { name: group } });
  const technicianGroups = await prisma.technicianGroup.findMany({ select: { name: true } });
  return res.status(201).json({ technicianGroups: technicianGroups.map((g: { name: string }) => g.name) });
}


