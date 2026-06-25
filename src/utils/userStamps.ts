/** Prisma include for createdBy / updatedBy user relations. */
export const userStampInclude = {
  createdBy: { select: { id: true, name: true, email: true } },
  updatedBy: { select: { id: true, name: true, email: true } },
} as const;

export function createUserStampFields(actorUserId?: string) {
  return actorUserId
    ? { createdById: actorUserId, updatedById: actorUserId }
    : {};
}

export function updateUserStampFields(actorUserId?: string) {
  return actorUserId ? { updatedById: actorUserId } : {};
}
