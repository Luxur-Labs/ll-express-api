import { Prisma } from '@prisma/client';

import { countToothUnits, expandToothNumbers } from './toothNumber.util';

export function countOrderLineUnits(unitNumbers?: string | null): number {
  return countToothUnits(unitNumbers);
}

function toNumber(d: Prisma.Decimal | number | null | undefined): number {
  if (d === null || d === undefined) return 0;
  return typeof d === 'number' ? d : d.toNumber();
}

export function roundOrderMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export function parseUnitDiscountsMap(raw: unknown): Record<string, number> {
  if (raw === null || raw === undefined) return {};
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return {};
    try {
      return normalizeUnitDiscountsMap(JSON.parse(trimmed) as Record<string, unknown>);
    } catch {
      return {};
    }
  }
  if (typeof raw === 'object') {
    return normalizeUnitDiscountsMap(raw as Record<string, unknown>);
  }
  return {};
}

function normalizeUnitDiscountsMap(obj: Record<string, unknown>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(obj)) {
    const n = Number(value);
    if (Number.isFinite(n) && n >= 0 && n <= 100) {
      out[String(key).trim()] = n;
    }
  }
  return out;
}

export type OrderProductForSales = {
  unitNumbers?: string | null;
  unitPrice?: Prisma.Decimal | number | null;
  discountPercent?: Prisma.Decimal | number | null;
  unitDiscounts?: unknown;
  product?: {
    price: Prisma.Decimal | number;
    discount: Prisma.Decimal | number;
  } | null;
};

export function resolveProductDiscountPercent(op: OrderProductForSales): number {
  if (op.discountPercent !== null && op.discountPercent !== undefined) {
    return toNumber(op.discountPercent);
  }
  return toNumber(op.product?.discount);
}

export type OrderProductLineBilling = {
  units: number;
  rate: number;
  gross: number;
  productDiscountPercent: number;
  productDiscountAmount: number;
  unitDiscountAmount: number;
  totalDiscountAmount: number;
  lineTotal: number;
  unitDiscounts: Record<string, number>;
};

/** Product discount % on each unit; additional % per tooth from unitDiscounts map. */
export function computeOrderProductLineBilling(op: OrderProductForSales): OrderProductLineBilling {
  const teeth = expandToothNumbers(op.unitNumbers || '');
  const units = teeth.length;
  const rate = op.unitPrice != null ? toNumber(op.unitPrice) : toNumber(op.product?.price);
  const productDiscountPercent = resolveProductDiscountPercent(op);
  const unitDiscountMap = parseUnitDiscountsMap(op.unitDiscounts);

  let gross = 0;
  let productDiscountAmount = 0;
  let unitDiscountAmount = 0;

  for (const tooth of teeth) {
    const unitGross = rate;
    gross += unitGross;
    productDiscountAmount += (unitGross * productDiscountPercent) / 100;
    const unitDiscPct = unitDiscountMap[String(tooth)] ?? 0;
    unitDiscountAmount += (unitGross * unitDiscPct) / 100;
  }

  gross = roundOrderMoney(gross);
  productDiscountAmount = roundOrderMoney(productDiscountAmount);
  unitDiscountAmount = roundOrderMoney(unitDiscountAmount);
  const totalDiscountAmount = roundOrderMoney(productDiscountAmount + unitDiscountAmount);
  const lineTotal = roundOrderMoney(gross - totalDiscountAmount);

  return {
    units,
    rate,
    gross,
    productDiscountPercent,
    productDiscountAmount,
    unitDiscountAmount,
    totalDiscountAmount,
    lineTotal,
    unitDiscounts: unitDiscountMap,
  };
}

export function computeOrderProductLineTotal(op: OrderProductForSales): number {
  return computeOrderProductLineBilling(op).lineTotal;
}

export type OrderForSales = {
  orderProducts?: OrderProductForSales[];
};

export function sumOrdersSales(orders: OrderForSales[]): number {
  return roundOrderMoney(
    orders.reduce((sum, order) => {
      const orderTotal = (order.orderProducts || []).reduce(
        (lineSum, op) => lineSum + computeOrderProductLineTotal(op),
        0,
      );
      return sum + orderTotal;
    }, 0),
  );
}

export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfToday(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

export function formatYmd(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
