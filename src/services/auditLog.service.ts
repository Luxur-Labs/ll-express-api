import { AuditAction, Prisma } from '@prisma/client';

import { AuditLogInput, AuditLogListFilters } from '../types/audit';
import { diffSnapshots } from '../utils/auditSnapshot.util';
import { logger } from '../utils/logger';
import { prisma } from '../utils/prisma';

async function resolveActor(actorUserId?: string) {
  if (!actorUserId) return { userId: null, userEmail: null, userName: null };
  const user = await prisma.user.findUnique({
    where: { id: actorUserId },
    select: { id: true, email: true, name: true },
  });
  return {
    userId: user?.id ?? actorUserId,
    userEmail: user?.email ?? null,
    userName: user?.name ?? null,
  };
}

function buildChangesPayload(input: AuditLogInput): Record<string, unknown> | undefined {
  if (input.action === 'CREATE' && input.after) {
    return { after: input.after };
  }
  if (input.action === 'DELETE' && input.before) {
    return { before: input.before };
  }
  if (input.action === 'STATUS_CHANGE' && input.before && input.after) {
    return {
      status: {
        old: input.before['status'] ?? null,
        new: input.after['status'] ?? null,
      },
      ...(input.metadata?.remarks ? { remarks: input.metadata.remarks } : {}),
    };
  }
  if (input.before && input.after) {
    const fieldChanges = diffSnapshots(input.before, input.after);
    if (Object.keys(fieldChanges).length === 0) return undefined;
    return { fields: fieldChanges };
  }
  return undefined;
}

export async function writeAuditLog(input: AuditLogInput): Promise<void> {
  try {
    const actor = await resolveActor(input.actorUserId);
    const changes = buildChangesPayload(input);

    await prisma.auditLog.create({
      data: {
        userId: actor.userId,
        userEmail: actor.userEmail,
        userName: actor.userName,
        action: input.action as AuditAction,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        entityLabel: input.entityLabel ?? null,
        changes: (changes ?? undefined) as Prisma.InputJsonValue | undefined,
        metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        ipAddress: input.ipAddress ?? null,
      },
    });
  } catch (error) {
    logger.error({ error, input }, 'Failed to write audit log');
  }
}

export async function listAuditLogs(filters: AuditLogListFilters = {}) {
  const page = Math.max(0, filters.page ?? 0);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 50));
  const where: Record<string, unknown> = {};

  if (filters.entityType) where.entityType = filters.entityType;
  if (filters.entityId) where.entityId = filters.entityId;
  if (filters.userId) where.userId = filters.userId;
  if (filters.action) where.action = filters.action;
  if (filters.from || filters.to) {
    where.createdAt = {
      ...(filters.from ? { gte: new Date(filters.from) } : {}),
      ...(filters.to ? { lte: new Date(filters.to) } : {}),
    };
  }

  const [total, data] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: page * limit,
      take: limit,
    }),
  ]);

  return {
    data,
    pagination: { page, limit, total },
  };
}
