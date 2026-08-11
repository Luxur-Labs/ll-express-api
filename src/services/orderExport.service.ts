import { Prisma, PrismaClient } from '@prisma/client';

import { ORDER_IMPORT_HEADERS } from '../config/importExportHeaders';
import { buildSpreadsheetBuffer, ExportFormat } from '../utils/spreadsheetExport.util';

const prisma = new PrismaClient();
const MAX_EXPORT_ROWS = 10000;

const orderExportInclude = {
  patient: true,
  clinic: true,
  orderProducts: {
    include: { product: true },
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.OrderInclude;

type ExportOrder = Prisma.OrderGetPayload<{ include: typeof orderExportInclude }>;
type ExportOrderProduct = ExportOrder['orderProducts'][number];

function formatSheetDate(d: Date | null | undefined): string {
  if (!d) return '';
  const day = d.getDate();
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatCaseStatus(status: string): string {
  return status
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function decimalToNumber(v: Prisma.Decimal | null | undefined): number | '' {
  if (v == null) return '';
  const n = Number(v.toString());
  return Number.isFinite(n) ? n : '';
}

function countToothUnits(unitNumbers: string | null | undefined): number | '' {
  if (!unitNumbers?.trim()) return '';
  const parts = unitNumbers.split(/[,;\s]+/).filter(Boolean);
  return parts.length || '';
}

/** Parse YYYY-MM-DD as local calendar start-of-day (avoids UTC shift). */
function parseYmdLocalStart(ymd: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd).trim());
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0);
  }
  const d = new Date(ymd);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Parse YYYY-MM-DD as local calendar end-of-day. */
function parseYmdLocalEnd(ymd: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd).trim());
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59, 999);
  }
  const d = new Date(ymd);
  d.setHours(23, 59, 59, 999);
  return d;
}

export interface OrderExportFilters {
  createdAtFrom?: string;
  createdAtTo?: string;
}

export class OrderExportService {
  async exportImportFormat(
    format: ExportFormat,
    filters: OrderExportFilters = {},
  ): Promise<Buffer> {
    const where: Prisma.OrderWhereInput = { isActive: true };
    if (filters.createdAtFrom || filters.createdAtTo) {
      where.createdAt = {};
      if (filters.createdAtFrom) {
        where.createdAt.gte = parseYmdLocalStart(filters.createdAtFrom);
      }
      if (filters.createdAtTo) {
        where.createdAt.lte = parseYmdLocalEnd(filters.createdAtTo);
      }
    }

    const orders = await prisma.order.findMany({
      where,
      include: orderExportInclude,
      orderBy: { createdAt: 'asc' },
      take: MAX_EXPORT_ROWS,
    });

    const rows: unknown[][] = [];

    for (const order of orders) {
      const products = order.orderProducts;
      if (!products.length) {
        rows.push(this.buildOrderRow(order, null, true));
        continue;
      }
      products.forEach((op, idx) => {
        rows.push(this.buildOrderRow(order, op, idx === 0));
      });
    }

    return buildSpreadsheetBuffer(ORDER_IMPORT_HEADERS, rows, format, 'Orders');
  }

  private buildOrderRow(order: ExportOrder, op: ExportOrderProduct | null, isFirstLine: boolean): unknown[] {
    const blank = '';
    const product = op?.product;

    return [
      isFirstLine ? order.invoiceNumber : blank,
      isFirstLine ? formatSheetDate(order.createdDate) : blank,
      isFirstLine ? order.patient.name : blank,
      isFirstLine ? order.patient.age : blank,
      isFirstLine ? order.patient.gender : blank,
      op?.repeatCorrections ?? (isFirstLine ? 'New' : blank),
      isFirstLine ? order.clinic.clinicName : blank,
      isFirstLine ? (order.referenceName ?? blank) : blank,
      isFirstLine ? order.clinic.clientAddress : blank,
      isFirstLine ? formatSheetDate(order.estimateDate) : blank,
      isFirstLine ? formatSheetDate(order.schedule) : blank,
      isFirstLine ? formatCaseStatus(order.status) : blank,
      op?.shadeType ?? blank,
      op?.workSpecification ?? blank,
      product?.code ?? blank,
      product?.name ?? blank,
      op?.unitNumbers ?? blank,
      countToothUnits(op?.unitNumbers),
      decimalToNumber(op?.unitPrice) || decimalToNumber(product?.price),
      decimalToNumber(op?.discountPercent) || decimalToNumber(product?.discount),
      isFirstLine ? order.partner : blank,
    ];
  }
}

export const orderExportService = new OrderExportService();
