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

export interface OrderExportFilters {
  createdAtFrom?: string;
  createdAtTo?: string;
}

export class OrderExportService {
  async exportImportFormat(
    format: ExportFormat,
    filters: OrderExportFilters = {},
  ): Promise<Buffer> {
    const where: Prisma.OrderWhereInput = {};
    if (filters.createdAtFrom || filters.createdAtTo) {
      where.createdAt = {};
      if (filters.createdAtFrom) {
        where.createdAt.gte = new Date(filters.createdAtFrom);
      }
      if (filters.createdAtTo) {
        const end = new Date(filters.createdAtTo);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
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
      isFirstLine ? formatSheetDate(order.createdAt) : blank,
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
