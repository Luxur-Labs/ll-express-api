import { Prisma } from '@prisma/client';

/** Normalize Prisma/Decimal values for JSON audit storage. */
export function serializeAuditValue(value: unknown): unknown {
  if (value === undefined) return null;
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Prisma.Decimal) return value.toString();
  if (Array.isArray(value)) return value.map(serializeAuditValue);
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k === 'passwordHash') continue;
      out[k] = serializeAuditValue(v);
    }
    return out;
  }
  return value;
}

export function snapshotRecord(
  record: Record<string, unknown>,
  fields: string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    if (field in record) {
      out[field] = serializeAuditValue(record[field]);
    }
  }
  return out;
}

export function diffSnapshots(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): Record<string, { old: unknown; new: unknown }> {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changes: Record<string, { old: unknown; new: unknown }> = {};
  for (const key of keys) {
    const oldVal = JSON.stringify(before[key] ?? null);
    const newVal = JSON.stringify(after[key] ?? null);
    if (oldVal !== newVal) {
      changes[key] = { old: before[key] ?? null, new: after[key] ?? null };
    }
  }
  return changes;
}

export const CLINIC_AUDIT_FIELDS = [
  'id',
  'clinicName',
  'organizationId',
  'clientAddress',
  'contactNumber',
  'doctorName',
  'pendingBalance',
  'isActive',
] as const;

export const PRODUCT_AUDIT_FIELDS = [
  'id',
  'name',
  'code',
  'warranty',
  'onPaperRate',
  'price',
  'discount',
] as const;

export const ORDER_AUDIT_FIELDS = [
  'id',
  'invoiceNumber',
  'patientId',
  'doctorId',
  'doctorName',
  'clinicId',
  'referredDoctorId',
  'referenceName',
  'partner',
  'scanningMode',
  'schedule',
  'enterRemark',
  'estimateDate',
  'dateOfApproach',
  'status',
  'applicationStatus',
] as const;

export function clinicSnapshot(clinic: Record<string, unknown>) {
  return snapshotRecord(clinic, [...CLINIC_AUDIT_FIELDS]);
}

export function productSnapshot(product: Record<string, unknown>) {
  return snapshotRecord(product, [...PRODUCT_AUDIT_FIELDS]);
}

export function orderSnapshot(order: Record<string, unknown>) {
  const base = snapshotRecord(order, [...ORDER_AUDIT_FIELDS]);
  const products = order['orderProducts'];
  if (Array.isArray(products)) {
    base.orderProductCount = products.length;
    base.orderProducts = products.map((op: Record<string, unknown>) => ({
      id: op['id'],
      productId: op['productId'],
      productCode: (op['product'] as Record<string, unknown> | undefined)?.['code'] ?? op['productCode'],
      shadeType: op['shadeType'],
      unitNumbers: op['unitNumbers'],
      unitPrice: serializeAuditValue(op['unitPrice']),
      discountPercent: serializeAuditValue(op['discountPercent']),
    }));
  }
  return base;
}
