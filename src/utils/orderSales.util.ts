import { Prisma } from '@prisma/client';

import { countToothUnits } from './toothNumber.util';

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

export type OrderProductForSales = {
  unitNumbers?: string | null;
  unitPrice?: Prisma.Decimal | null;
  discountPercent?: Prisma.Decimal | null;
  product?: {
    price: Prisma.Decimal;
    discount: Prisma.Decimal;
  } | null;
};

export function computeOrderProductLineTotal(op: OrderProductForSales): number {
  const unit = countOrderLineUnits(op.unitNumbers);
  const rate = op.unitPrice != null ? toNumber(op.unitPrice) : toNumber(op.product?.price);
  const discountPct =
    op.discountPercent != null ? toNumber(op.discountPercent) : toNumber(op.product?.discount);
  const gross = unit * rate;
  const discountAmt = roundOrderMoney((gross * discountPct) / 100);
  return roundOrderMoney(gross - discountAmt);
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
