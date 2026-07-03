import { AuthUser, Role } from '../types/auth';

export type AdminRole = 'SUPER_ADMIN' | 'LAB_MANAGER' | 'FRONT_OFFICE';

export type Permission =
  | 'dashboard.view'
  | 'dashboard.billing'
  | 'orders.view'
  | 'orders.create'
  | 'orders.update'
  | 'orders.delete'
  | 'orders.assign'
  | 'orders.status.production'
  | 'orders.status.basic'
  | 'orders.import'
  | 'clinics.view'
  | 'clinics.manage'
  | 'clinics.import'
  | 'products.view'
  | 'products.manage'
  | 'products.import'
  | 'billing.view'
  | 'billing.preview'
  | 'billing.manage'
  | 'billing.payments'
  | 'data.import'
  | 'users.manage';

export const ADMIN_ROLES: AdminRole[] = ['SUPER_ADMIN', 'LAB_MANAGER', 'FRONT_OFFICE'];

/** Roles that may be created via User Management (not SUPER_ADMIN). */
export const CREATABLE_USER_ROLES = ['LAB_MANAGER', 'FRONT_OFFICE'] as const;

/** Doctor and employee portal logins are disabled. */
export const LOGIN_DISABLED_ROLES = ['DOCTOR', 'EMPLOYEE'] as const;

export const PRODUCTION_ORDER_STATUSES = [
  'MODEL',
  'THREE_D_MODEL',
  'QC',
  'CAD',
  'CAM',
  'DMLS',
  'METAL',
  'CERAMIC',
  'ACRYLIC',
] as const;

export const FRONT_OFFICE_ALLOWED_STATUSES = ['DISPATCHED', 'CANCELLED', 'ADMIN_REVIEW'] as const;

const ROLE_PERMISSIONS: Record<AdminRole, Permission[]> = {
  SUPER_ADMIN: [
    'dashboard.view',
    'dashboard.billing',
    'orders.view',
    'orders.create',
    'orders.update',
    'orders.delete',
    'orders.assign',
    'orders.status.production',
    'orders.status.basic',
    'orders.import',
    'clinics.view',
    'clinics.manage',
    'clinics.import',
    'products.view',
    'products.manage',
    'products.import',
    'billing.view',
    'billing.preview',
    'billing.manage',
    'billing.payments',
    'data.import',
    'users.manage',
  ],
  LAB_MANAGER: [
    'dashboard.view',
    'orders.view',
    'orders.create',
    'orders.update',
    'orders.assign',
    'orders.status.production',
    'orders.status.basic',
    'clinics.view',
    'products.view',
  ],
  FRONT_OFFICE: [
    'dashboard.view',
    'orders.view',
    'orders.create',
    'orders.status.basic',
    'clinics.view',
    'products.view',
    'billing.view',
    'billing.preview',
  ],
};

export function isAdminRole(role: Role): role is AdminRole {
  return ADMIN_ROLES.includes(role as AdminRole);
}

export function hasPermission(role: Role, permission: Permission): boolean {
  if (role === 'SUPER_ADMIN') return true;
  if (!isAdminRole(role)) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function hasAnyPermission(role: Role, permissions: Permission[]): boolean {
  return permissions.some((p) => hasPermission(role, p));
}

export function canChangeOrderStatus(role: Role, newStatus: string): boolean {
  if (role === 'SUPER_ADMIN' || role === 'LAB_MANAGER') return true;
  if (role === 'FRONT_OFFICE') {
    return (FRONT_OFFICE_ALLOWED_STATUSES as readonly string[]).includes(newStatus);
  }
  return false;
}

/** Full update access, or Front Office may update only orders they created. */
export function canUpdateOrder(
  user: AuthUser,
  order: { createdById?: string | null },
): boolean {
  if (hasPermission(user.role, 'orders.update')) return true;
  if (user.role === 'FRONT_OFFICE' && order.createdById && order.createdById === user.id) {
    return true;
  }
  return false;
}

export function getUserFromLocals(locals: { user?: AuthUser }): AuthUser | undefined {
  return locals.user;
}
