/** Default filter for entities that support soft delete via isActive. */
export const ACTIVE_ENTITY_FILTER = { isActive: true } as const;

export function withActiveOnly<T extends Record<string, unknown>>(where: T = {} as T): T & { isActive: true } {
  return { ...where, isActive: true };
}
