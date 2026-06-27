export type AuditEntityType = 'Clinic' | 'Product' | 'Order';

export type AuditActionType = 'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS_CHANGE';

export interface AuditLogInput {
  actorUserId?: string;
  action: AuditActionType;
  entityType: AuditEntityType;
  entityId?: string;
  entityLabel?: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

export interface AuditLogListFilters {
  page?: number;
  limit?: number;
  entityType?: string;
  entityId?: string;
  userId?: string;
  action?: AuditActionType;
  from?: string;
  to?: string;
}
