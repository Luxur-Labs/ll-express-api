import { Prisma, PrismaClient } from '@prisma/client';

import { CreateOrderData, CreatePatientData, OrderService, UpdateOrderData } from './order.service';
import {
  hasOrderIdMapping,
  looksLikeClinicSheetHeaders,
  parseUploadBuffer,
} from './orderImport.parser';
import { isCancelledOrderStatus } from '../utils/orderStatus';
import { normalizeProductCode, productCodeLookupKey } from '../utils/productCode.util';
import { normalizeToothNumberString } from '../utils/toothNumber.util';
import {
  OrderImportUpdateColumn,
  orderImportUpdateColumnLabels,
} from '../config/orderImportUpdateColumns';
const prisma = new PrismaClient();
const orderService = new OrderService();

const ORDER_STATUSES = [
  'NEW',
  'MODEL',
  'THREE_D_MODEL',
  'QC',
  'CAD',
  'CAM',
  'DMLS',
  'METAL',
  'CERAMIC',
  'ACRYLIC',
  'ADMIN_REVIEW',
  'DISPATCHED',
  'CANCELLED',
] as const;

export type OrderImportSheetRow = {
  rowIndex: number;
  orderId?: string;
  /** True when orderId was blank on the sheet and filled from the row above. */
  orderIdInherited?: boolean;
  receivedThrough?: string;
  date?: string;
  patientName?: string;
  patientAge?: number | string;
  patientGender?: string;
  newRepeatCorrection?: string;
  clinicName?: string;
  reference?: string;
  address?: string;
  expectedDate?: string;
  deliveryDate?: string;
  caseStatus?: string;
  shade?: string;
  column1?: string;
  productCode?: string;
  productDescription?: string;
  toothNumber?: string;
  units?: number | string;
  unitAmount?: number | string;
  discountPercent?: number | string;
  partner?: string;
  model3dCharges?: string;
  componentReduction?: string;
};

export type OrderImportProductDraft = {
  rowIndex: number;
  productCode?: string;
  productDescription?: string;
  shade?: string;
  toothNumber?: string;
  units?: number | string;
  unitAmount?: number | string;
  discountPercent?: number | string;
  newRepeatCorrection?: string;
  column1?: string;
  componentReduction?: string;
  productId?: string;
  errors: string[];
  missingFields: string[];
};

export type OrderImportReviewItem = {
  orderId: string;
  rowIndices: number[];
  data: {
    orderId: string;
    invoiceNumber: string;
    receivedThrough?: string;
    date?: string;
    patientName?: string;
    patientAge?: number | string;
    patientGender?: string;
    clinicName?: string;
    clinicId?: string;
    reference?: string;
    address?: string;
    expectedDate?: string;
    deliveryDate?: string;
    caseStatus?: string;
    partner?: string;
    products: OrderImportProductDraft[];
  };
  errors: string[];
  missingFields: string[];
  canImport: boolean;
  /** Same Order ID reused incorrectly across sheet rows. */
  duplicateOrder?: boolean;
  /** Existing order in DB — import will update Case Status only. */
  statusUpdateOnly?: boolean;
  /** Existing order in DB — import will update tooth numbers on product lines only. */
  toothNumberUpdateOnly?: boolean;
  /** Existing order in DB — import will update createdDate only (matched by Order ID). */
  createdDateUpdateOnly?: boolean;
  /** Existing order — update only these columns (matched by Order ID). */
  updateColumns?: OrderImportUpdateColumn[];
};

export type OrderImportValidateResult = {
  ready: OrderImportReviewItem[];
  needsReview: OrderImportReviewItem[];
  skipped: { orderId: string; reason: string; rowIndices: number[] }[];
  rowsWithoutOrderId: number[];
  totalRows: number;
};

export type OrderImportCommitItem = {
  orderId: string;
  invoiceNumber?: string;
  receivedThrough?: string;
  date?: string;
  patientName: string;
  patientAge?: number;
  patientGender?: string;
  clinicId: string;
  reference?: string;
  expectedDate: string;
  deliveryDate?: string;
  caseStatus?: string;
  partner?: string;
  statusUpdateOnly?: boolean;
  toothNumberUpdateOnly?: boolean;
  createdDateUpdateOnly?: boolean;
  updateColumns?: OrderImportUpdateColumn[];
  products: {
    productId: string;
    productCode?: string;
    shade?: string;
    toothNumber?: string;
    unitAmount?: number;
    discountPercent?: number;
    newRepeatCorrection?: string;
    column1?: string;
    componentReduction?: string;
  }[];
};

export type OrderImportCommitResult = {
  created: string[];
  failed: { orderId: string; message: string }[];
  batchId: string;
};

export type OrderImportCommitMeta = {
  fileName?: string;
  importedByEmail?: string;
  importedByUserId?: string;
  totalRows?: number;
};

export type OrderImportPreviewRow = {
  orderId: string;
  rowIndices: number[];
  patientName?: string;
  clinicName?: string;
  productCount: number;
  status: 'READY' | 'NEEDS_REVIEW' | 'SKIPPED' | 'MISSING_ORDER_ID' | 'DUPLICATE_ORDER' | 'STATUS_UPDATE' | 'TOOTH_NUMBER_UPDATE' | 'CREATED_DATE_UPDATE' | 'COLUMN_UPDATE';
  issues?: string;
  importable: boolean;
  fixDraft?: OrderImportReviewItem;
};

export type OrderImportSheetRowTrace = {
  rowIndex: number;
  orderId?: string;
  orderIdInherited?: boolean;
  patientName?: string;
  clinicName?: string;
  productCode?: string;
  status: 'READY' | 'NEEDS_REVIEW' | 'SKIPPED' | 'MISSING_ORDER_ID' | 'DUPLICATE_ORDER' | 'STATUS_UPDATE' | 'TOOTH_NUMBER_UPDATE' | 'CREATED_DATE_UPDATE' | 'COLUMN_UPDATE';
  issues?: string;
};

export type OrderImportPreviewResult = {
  parseInfo: {
    sheetName: string;
    headerRowIndex: number;
    headers: string[];
  };
  summary: {
    ready: number;
    needsReview: number;
    skipped: number;
    duplicateOrders: number;
    statusUpdates: number;
    toothNumberUpdates: number;
    createdDateUpdates: number;
    columnUpdates: number;
    missingOrderId: number;
    rowsWithoutOrderId: number;
    totalOrders: number;
    totalSheetRows: number;
    sheetRowsInOrders: number;
    multiLineOrders: number;
  };
  rows: OrderImportPreviewRow[];
  sheetRowTrace: OrderImportSheetRowTrace[];
  commitItems: OrderImportCommitItem[];
};

export type OrderImportFileResult = {
  batch: {
    id: string;
    fileName: string | null;
    importedByEmail: string | null;
    totalRows: number;
    ordersAttempted: number;
    createdCount: number;
    failedCount: number;
    createdAt: Date;
  };
  parseInfo: {
    sheetName: string;
    headerRowIndex: number;
    headers: string[];
  };
  summary: {
    ready: number;
    needsReview: number;
    skipped: number;
    rowsWithoutOrderId: number;
    created: number;
    failed: number;
  };
  items: Awaited<ReturnType<OrderImportService['listBatchItems']>>['items'];
  itemsPagination: { page: number; limit: number; total: number };
};

function resolvePatientAge(value: unknown): number {
  if (value === null || value === undefined || trimVal(value) === '') return 0;
  const n = parseInt(String(value), 10);
  return Number.isFinite(n) ? n : 0;
}

function resolvePatientGender(value: unknown): string {
  return trimVal(value);
}

function resolveShade(v: unknown): string {
  const s = trimVal(v);
  return s || '-';
}

function parseOptionalNumber(v: unknown): number | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function reviewItemToCommit(item: OrderImportReviewItem): OrderImportCommitItem {
  if (item.updateColumns?.length) {
    return {
      orderId: item.orderId,
      updateColumns: item.updateColumns,
      createdDateUpdateOnly:
        item.updateColumns.length === 1 && item.updateColumns[0] === 'createdDate',
      date: item.data.date,
      expectedDate: item.data.expectedDate || new Date().toISOString(),
      deliveryDate: item.data.deliveryDate,
      caseStatus: item.data.caseStatus,
      partner: item.data.partner,
      reference: item.data.reference,
      patientName: item.data.patientName || '—',
      patientAge: resolvePatientAge(item.data.patientAge),
      patientGender: resolvePatientGender(item.data.patientGender),
      clinicId: item.data.clinicId || 'column-update',
      products: item.updateColumns.includes('toothNumber')
        ? item.data.products
            .filter((p) => !!p.productId && !!p.toothNumber)
            .map((p) => ({
              productId: p.productId!,
              productCode: p.productCode,
              toothNumber: p.toothNumber,
            }))
        : [],
    };
  }

  if (item.createdDateUpdateOnly) {
    return {
      orderId: item.orderId,
      createdDateUpdateOnly: true,
      updateColumns: ['createdDate'],
      date: item.data.date,
      patientName: item.data.patientName || '—',
      clinicId: item.data.clinicId || 'created-date-update',
      expectedDate: new Date().toISOString(),
      products: [],
    };
  }

  if (item.toothNumberUpdateOnly) {
    return {
      orderId: item.orderId,
      toothNumberUpdateOnly: true,
      patientName: '—',
      clinicId: 'tooth-update',
      expectedDate: new Date().toISOString(),
      products: item.data.products
        .filter((p) => !!p.productId && !!p.toothNumber)
        .map((p) => ({
          productId: p.productId!,
          productCode: p.productCode,
          toothNumber: p.toothNumber,
        })),
    };
  }

  if (item.statusUpdateOnly) {
    return {
      orderId: item.orderId,
      caseStatus: item.data.caseStatus,
      statusUpdateOnly: true,
      patientName: item.data.patientName || '—',
      clinicId: item.data.clinicId || 'status-update',
      expectedDate: new Date().toISOString(),
      products: [],
    };
  }

  const expected = item.data.expectedDate;
  const expectedIso = parseDateToIso(expected) ?? expected!;
  const deliveryIso = item.data.deliveryDate ? parseDateToIso(item.data.deliveryDate) : undefined;

  return {
    orderId: item.orderId,
    invoiceNumber: item.data.invoiceNumber || item.orderId,
    receivedThrough: item.data.receivedThrough,
    date: item.data.date,
    patientName: item.data.patientName!,
    patientAge: resolvePatientAge(item.data.patientAge),
    patientGender: resolvePatientGender(item.data.patientGender),
    clinicId: item.data.clinicId!,
    reference: item.data.reference,
    expectedDate: expectedIso,
    deliveryDate: deliveryIso,
    caseStatus: item.data.caseStatus,
    partner: item.data.partner,
    products: item.data.products
      .filter((p) => !!p.productId)
      .map((p) => ({
      productId: p.productId!,
      productCode: p.productCode,
      shade: resolveShade(p.shade),
      toothNumber: p.toothNumber,
      unitAmount: parseOptionalNumber(p.unitAmount),
      discountPercent: parseOptionalNumber(p.discountPercent),
      newRepeatCorrection: p.newRepeatCorrection,
      column1: p.column1,
      componentReduction: p.componentReduction,
    })),
  };
}

function trimVal(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function parseToothNumberField(raw: unknown): string | undefined {
  const trimmed = trimVal(raw);
  if (!trimmed) return undefined;
  const normalized = normalizeToothNumberString(trimmed);
  return normalized || undefined;
}

function rowHasProductLineData(row: OrderImportSheetRow): boolean {
  return !!(
    trimVal(row.productCode) ||
    trimVal(row.shade) ||
    trimVal(row.productDescription) ||
    trimVal(row.toothNumber)
  );
}

type ProductCatalogRow = { id: string; code: string | null; name: string };

function buildProductDraftsFromGroupRows(
  groupRows: OrderImportSheetRow[],
  productByCode: Map<string, ProductCatalogRow>,
  opts: {
    isCancelled: boolean;
    header?: OrderImportSheetRow;
    forToothUpdate?: boolean;
  },
): OrderImportProductDraft[] {
  const header = opts.header ?? groupRows[0];
  const rows = opts.forToothUpdate
    ? groupRows.filter((r) => trimVal(r.toothNumber))
    : groupRows.filter((r) => rowHasProductLineData(r));

  return rows.map((row) => {
    const pErrors: string[] = [];
    const pMissing: string[] = [];
    const code = normalizeProductCode(row.productCode);
    const shade = trimVal(row.shade);
    let productId: string | undefined;

    if (opts.forToothUpdate) {
      if (!code) pMissing.push('productCode');
      else {
        const prod = productByCode.get(productCodeLookupKey(code));
        if (!prod) pErrors.push(`Product code not found: "${code}"`);
        else productId = prod.id;
      }
    } else if (!opts.isCancelled) {
      if (!code) pMissing.push('productCode');
      else {
        const prod = productByCode.get(productCodeLookupKey(code));
        if (!prod) pErrors.push(`Product code not found: "${code}"`);
        else productId = prod.id;
      }
    } else if (code) {
      const prod = productByCode.get(productCodeLookupKey(code));
      if (prod) productId = prod.id;
    }

    const repeat = normalizeRepeatCorrection(row.newRepeatCorrection ?? header.newRepeatCorrection);
    if (!opts.forToothUpdate && !opts.isCancelled && repeat !== 'New' && !trimVal(row.newRepeatCorrection ?? header.newRepeatCorrection)) {
      pMissing.push('newRepeatCorrection');
    }

    const rawTooth = trimVal(row.toothNumber);
    let toothNumber = rawTooth ? parseToothNumberField(rawTooth) : undefined;
    if (rawTooth && !toothNumber) {
      pErrors.push(`Could not parse tooth numbers: "${rawTooth}"`);
      toothNumber = undefined;
    }

    return {
      rowIndex: row.rowIndex,
      productCode: code || undefined,
      productDescription: trimVal(row.productDescription) || undefined,
      shade: shade || undefined,
      toothNumber,
      units: row.units,
      unitAmount: row.unitAmount,
      discountPercent: row.discountPercent,
      newRepeatCorrection: repeat,
      column1: trimVal(row.column1) || undefined,
      componentReduction: trimVal(row.componentReduction) || undefined,
      productId,
      errors: pErrors,
      missingFields: pMissing,
    };
  });
}

function orderRowSegments(rowIndices: number[]): number[][] {
  const sorted = [...new Set(rowIndices)].sort((a, b) => a - b);
  if (!sorted.length) return [];
  const segments: number[][] = [];
  let segment = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1] + 1) {
      segment.push(sorted[i]);
    } else {
      segments.push(segment);
      segment = [sorted[i]];
    }
  }
  segments.push(segment);
  return segments;
}

/** Detect invalid reuse of the same Order ID across sheet rows. */
function validateSameOrderRowErrors(groupRows: OrderImportSheetRow[]): string[] {
  const errors: string[] = [];
  const rowIndices = groupRows.map((r) => r.rowIndex);

  const segments = orderRowSegments(rowIndices);
  if (segments.length > 1) {
    const desc = segments
      .map((segment) =>
        segment.length === 1
          ? `row ${segment[0]}`
          : `rows ${segment[0]}-${segment[segment.length - 1]}`,
      )
      .join(' and ');
    errors.push(
      `Order ID reused in separate sheet blocks (${desc}). Use one consecutive block per order, or assign a unique Order ID to each.`,
    );
  }

  const explicitRows = groupRows.filter((r) => !r.orderIdInherited && trimVal(r.orderId));
  if (explicitRows.length > 1) {
    errors.push(
      `Order ID repeated on rows ${explicitRows.map((r) => r.rowIndex).join(', ')}. Only the first product line should have an Order ID; leave it blank on additional lines.`,
    );
  }

  const headerChecks: Array<[keyof OrderImportSheetRow, string]> = [
    ['patientName', 'Patient name'],
    ['clinicName', 'Clinic name'],
    ['expectedDate', 'Expected date'],
    ['reference', 'Reference'],
  ];
  const primary = groupRows[0];
  for (let i = 1; i < groupRows.length; i++) {
    const row = groupRows[i];
    for (const [field, label] of headerChecks) {
      const a = trimVal(primary[field]);
      const b = trimVal(row[field]);
      if (a && b && a.toLowerCase() !== b.toLowerCase()) {
        errors.push(
          `Row ${row.rowIndex}: ${label} "${b}" conflicts with row ${primary.rowIndex} "${a}" for the same Order ID.`,
        );
      }
    }
  }

  return errors;
}

function parseNumber(v: unknown): number | undefined {
  const s = trimVal(v).replace(/,/g, '');
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

function parseDateToIso(v: unknown): string | undefined {
  const s = trimVal(v);
  if (!s) return undefined;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  }
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (dmy) {
    const day = parseInt(dmy[1], 10);
    const month = parseInt(dmy[2], 10) - 1;
    let year = parseInt(dmy[3], 10);
    if (year < 100) year += 2000;
    const d = new Date(year, month, day);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

function normalizeRepeatCorrection(v: unknown): string {
  const s = trimVal(v).toLowerCase();
  if (!s || s === 'clear' || s === 'new') return 'New';
  if (s === 'repeat') return 'Repeat';
  if (s === 'correction' || s === 'corrections') return 'Corrections';
  return trimVal(v) || 'New';
}

function normalizeStatus(v: unknown): string {
  const s = trimVal(v).toUpperCase().replace(/\s+/g, '_');
  if (!s) return 'NEW';
  const aliases: Record<string, string> = {
    CANCEL: 'CANCELLED',
    DISPATCH: 'DISPATCHED',
    ADMIN: 'ADMIN_REVIEW',
    'ADMIN_REVIEW': 'ADMIN_REVIEW',
    '3D_MODEL': 'THREE_D_MODEL',
    '3D': 'THREE_D_MODEL',
  };
  if (aliases[s]) return aliases[s];
  const match = ORDER_STATUSES.find((st) => st === s);
  return match ?? 'NEW';
}

function resolveRawCaseStatus(groupRows: OrderImportSheetRow[]): string {
  for (const row of groupRows) {
    const s = trimVal(row.caseStatus);
    if (s) return s;
  }
  return '';
}

function defaultEnterReason(repeat: string): string {
  return '';
}

function productDefaults(repeat: string, column1: string, componentReduction: string) {
  const details = trimVal(componentReduction) || trimVal(column1) || '-';
  return {
    finishingInstructions: trimVal(column1) || '-',
    componentDetails: details,
    incaseOfAllAbutments: 'Separate',
    occlusalStaining: '-',
    ponticDesign: '-',
    repeatCorrections: repeat,
    enterReason: defaultEnterReason(repeat),
  };
}

type SheetRowTraceStatus = OrderImportSheetRowTrace['status'];

function buildSheetRowTrace(
  parsedRows: OrderImportSheetRow[],
  validation: OrderImportValidateResult,
): OrderImportSheetRowTrace[] {
  const metaByRow = new Map<
    number,
    { status: SheetRowTraceStatus; issues?: string; orderId?: string }
  >();

  const register = (
    rowIndices: number[],
    status: SheetRowTraceStatus,
    orderId: string,
    issues?: string,
  ) => {
    for (const rowIndex of rowIndices) {
      metaByRow.set(rowIndex, { status, issues, orderId });
    }
  };

  for (const item of validation.ready) {
    const status = item.updateColumns?.length
      ? item.updateColumns.length === 1 && item.updateColumns[0] === 'createdDate'
        ? 'CREATED_DATE_UPDATE'
        : 'COLUMN_UPDATE'
      : item.createdDateUpdateOnly
        ? 'CREATED_DATE_UPDATE'
        : item.toothNumberUpdateOnly
          ? 'TOOTH_NUMBER_UPDATE'
          : item.statusUpdateOnly
            ? 'STATUS_UPDATE'
            : 'READY';
    register(item.rowIndices, status, item.orderId);
  }
  for (const item of validation.needsReview) {
    const status = item.duplicateOrder ? 'DUPLICATE_ORDER' : 'NEEDS_REVIEW';
    const issues = [
      ...item.errors,
      ...item.missingFields.map((f) => `Missing: ${f}`),
    ].join('; ');
    register(item.rowIndices, status, item.orderId, issues || 'Missing required fields');
  }
  for (const skip of validation.skipped) {
    register(skip.rowIndices, 'SKIPPED', skip.orderId, skip.reason);
  }
  for (const rowIndex of validation.rowsWithoutOrderId) {
    metaByRow.set(rowIndex, {
      status: 'MISSING_ORDER_ID',
      issues: `Missing Order ID (sheet row ${rowIndex})`,
    });
  }

  return parsedRows.map((row) => {
    const meta = metaByRow.get(row.rowIndex);
    return {
      rowIndex: row.rowIndex,
      orderId: trimVal(row.orderId) || meta?.orderId,
      orderIdInherited: row.orderIdInherited,
      patientName: trimVal(row.patientName) || undefined,
      clinicName: trimVal(row.clinicName) || undefined,
      productCode: trimVal(row.productCode) || undefined,
      status: meta?.status ?? 'NEEDS_REVIEW',
      issues: meta?.issues,
    };
  });
}

export type OrderImportValidateOptions = {
  /** Match by Order ID and update createdDate only. Does not create orders. */
  createdDateOnly?: boolean;
  /** Match by Order ID and update only these columns. Does not create orders. */
  updateColumns?: OrderImportUpdateColumn[];
};

function resolveUpdateColumns(options: OrderImportValidateOptions): OrderImportUpdateColumn[] {
  if (options.updateColumns?.length) return options.updateColumns;
  if (options.createdDateOnly) return ['createdDate'];
  return [];
}

export class OrderImportService {
  async validateRows(
    rows: OrderImportSheetRow[],
    options: OrderImportValidateOptions = {},
  ): Promise<OrderImportValidateResult> {
    const clinics = await prisma.clinic.findMany({
      select: { id: true, clinicName: true, clientAddress: true },
    });
    const clinicByName = new Map(
      clinics.map((c) => [c.clinicName.trim().toLowerCase(), c])
    );

    const products = await prisma.product.findMany({
      select: { id: true, code: true, name: true },
      orderBy: { updatedAt: 'desc' },
    });
    const productByCode = new Map<string, ProductCatalogRow>();
    for (const p of products) {
      if (!p.code) continue;
      const key = productCodeLookupKey(p.code);
      if (!key || productByCode.has(key)) continue;
      productByCode.set(key, p);
    }

    const existingOrderIds = [...new Set(rows.map((r) => trimVal(r.orderId)).filter(Boolean))];
    const existingOrders =
      existingOrderIds.length > 0
        ? await prisma.order.findMany({
            where: { id: { in: existingOrderIds } },
            select: { id: true },
          })
        : [];
    const existingIds = new Set(existingOrders.map((o) => o.id));

    const byOrderId = new Map<string, OrderImportSheetRow[]>();
    const rowsWithoutOrderId: number[] = [];
    for (const row of rows) {
      const oid = trimVal(row.orderId);
      if (!oid) {
        rowsWithoutOrderId.push(row.rowIndex);
        continue;
      }
      const list = byOrderId.get(oid) ?? [];
      list.push(row);
      byOrderId.set(oid, list);
    }

    const ready: OrderImportReviewItem[] = [];
    const needsReview: OrderImportReviewItem[] = [];
    const skipped: OrderImportValidateResult['skipped'] = [];

    for (const [orderId, groupRows] of byOrderId) {
      const rowIndices = groupRows.map((r) => r.rowIndex);
      const orderExistsInSystem = existingIds.has(orderId);
      const rowErrors = validateSameOrderRowErrors(groupRows);
      const rawCaseStatus = resolveRawCaseStatus(groupRows);
      const caseStatus = normalizeStatus(rawCaseStatus);

      const updateColumns = resolveUpdateColumns(options);
      if (updateColumns.length) {
        const header = groupRows[0];
        const errors = [...rowErrors];
        const missingFields: string[] = [];
        const selected = new Set(updateColumns);

        if (!orderExistsInSystem) {
          errors.push(
            `Order ID "${orderId}" was not found. Column update only changes existing orders.`,
          );
        }

        const dateRaw =
          trimVal(header.date) || trimVal(groupRows.find((r) => trimVal(r.date))?.date);
        const dateIso = parseDateToIso(dateRaw);
        if (selected.has('createdDate')) {
          if (!dateRaw) missingFields.push('date');
          else if (!dateIso) errors.push(`Invalid Date "${dateRaw}".`);
        }

        const expectedRaw =
          trimVal(header.expectedDate) ||
          trimVal(groupRows.find((r) => trimVal(r.expectedDate))?.expectedDate);
        const expectedIso = parseDateToIso(expectedRaw);
        if (selected.has('estimateDate')) {
          if (!expectedRaw) missingFields.push('expectedDate');
          else if (!expectedIso) errors.push(`Invalid Expected Date "${expectedRaw}".`);
        }

        const deliveryRaw =
          trimVal(header.deliveryDate) ||
          trimVal(groupRows.find((r) => trimVal(r.deliveryDate))?.deliveryDate);
        const deliveryIso = parseDateToIso(deliveryRaw);
        if (selected.has('schedule')) {
          if (!deliveryRaw) missingFields.push('deliveryDate');
          else if (!deliveryIso) errors.push(`Invalid Delivery Date "${deliveryRaw}".`);
        }

        if (selected.has('status')) {
          if (!rawCaseStatus) missingFields.push('caseStatus');
          else if (caseStatus === 'NEW') {
            errors.push(`Unrecognized Case Status "${rawCaseStatus}".`);
          }
        }

        if (selected.has('partner') && !trimVal(header.partner)) {
          missingFields.push('partner');
        }
        if (selected.has('reference') && !trimVal(header.reference)) {
          missingFields.push('reference');
        }
        if (selected.has('patientName') && !trimVal(header.patientName)) {
          missingFields.push('patientName');
        }
        if (selected.has('patientGender') && !trimVal(header.patientGender)) {
          missingFields.push('patientGender');
        }
        if (selected.has('patientAge')) {
          const ageRaw = header.patientAge;
          if (ageRaw === undefined || ageRaw === null || trimVal(ageRaw) === '') {
            missingFields.push('patientAge');
          } else if (!Number.isFinite(parseInt(String(ageRaw), 10))) {
            errors.push('Invalid patient age');
          }
        }

        let productDrafts: OrderImportProductDraft[] = [];
        if (selected.has('toothNumber')) {
          productDrafts = buildProductDraftsFromGroupRows(groupRows, productByCode, {
            isCancelled: false,
            forToothUpdate: true,
          });
          const toothProducts = productDrafts.filter((p) => p.toothNumber && p.productId);
          if (!toothProducts.length) {
            missingFields.push('toothNumber');
          }
          errors.push(
            ...productDrafts.flatMap((p) => p.errors.map((e) => `Row ${p.rowIndex}: ${e}`)),
          );
          missingFields.push(
            ...productDrafts.flatMap((p) =>
              p.missingFields.map((f) => `Row ${p.rowIndex}: ${f}`),
            ),
          );
        }

        const item: OrderImportReviewItem = {
          orderId,
          rowIndices,
          updateColumns,
          createdDateUpdateOnly: updateColumns.length === 1 && updateColumns[0] === 'createdDate',
          data: {
            orderId,
            invoiceNumber: orderId,
            date: dateIso ?? (dateRaw || undefined),
            expectedDate: expectedIso ?? (expectedRaw || undefined),
            deliveryDate: deliveryIso ?? (deliveryRaw || undefined),
            caseStatus,
            partner: trimVal(header.partner) || undefined,
            reference: trimVal(header.reference) || undefined,
            patientName: trimVal(header.patientName) || undefined,
            patientAge: header.patientAge,
            patientGender: trimVal(header.patientGender) || undefined,
            products: productDrafts,
          },
          errors,
          missingFields,
          canImport: false,
          duplicateOrder: rowErrors.length > 0,
        };
        item.canImport =
          item.errors.length === 0 &&
          item.missingFields.length === 0 &&
          orderExistsInSystem;

        if (item.canImport) {
          ready.push(item);
        } else {
          needsReview.push(item);
        }
        continue;
      }

      if (orderExistsInSystem) {
        const errors = [...rowErrors];
        const productDrafts = buildProductDraftsFromGroupRows(groupRows, productByCode, {
          isCancelled: false,
          forToothUpdate: true,
        });
        const toothProducts = productDrafts.filter((p) => p.toothNumber && p.productId);
        const hasToothUpdates = toothProducts.length > 0;

        if (hasToothUpdates) {
          const item: OrderImportReviewItem = {
            orderId,
            rowIndices,
            toothNumberUpdateOnly: true,
            data: {
              orderId,
              invoiceNumber: orderId,
              products: productDrafts,
            },
            errors: [
              ...errors,
              ...productDrafts.flatMap((p) => p.errors.map((e) => `Row ${p.rowIndex}: ${e}`)),
            ],
            missingFields: productDrafts.flatMap((p) =>
              p.missingFields.map((f) => `Row ${p.rowIndex}: ${f}`),
            ),
            canImport: false,
            duplicateOrder: rowErrors.length > 0,
          };

          item.canImport =
            !item.duplicateOrder &&
            item.errors.length === 0 &&
            item.missingFields.length === 0 &&
            toothProducts.length > 0;

          if (item.canImport) {
            ready.push(item);
          } else {
            needsReview.push(item);
          }
          continue;
        }

        if (!rawCaseStatus) {
          errors.push(
            'Order already exists. Import only updates Case Status — set a status on the sheet (e.g. Dispatched).',
          );
        } else if (caseStatus === 'NEW') {
          errors.push(
            `Unrecognized Case Status "${rawCaseStatus}". Use a valid value such as Dispatched, Cancelled, or a department stage.`,
          );
        }

        const item: OrderImportReviewItem = {
          orderId,
          rowIndices,
          statusUpdateOnly: true,
          data: {
            orderId,
            invoiceNumber: orderId,
            caseStatus,
            products: [],
          },
          errors,
          missingFields: [],
          canImport: false,
          duplicateOrder: rowErrors.length > 0,
        };

        item.canImport =
          item.errors.length === 0 && !!rawCaseStatus && caseStatus !== 'NEW';

        if (item.canImport) {
          ready.push(item);
        } else {
          needsReview.push(item);
        }
        continue;
      }

      const header = groupRows[0];
      const errors: string[] = [...rowErrors];
      const missingFields: string[] = [];
      const duplicateOrder = rowErrors.length > 0;

      const patientName = trimVal(header.patientName);
      if (!patientName) missingFields.push('patientName');

      let patientAge: number | undefined;
      const ageRaw = header.patientAge;
      if (ageRaw !== undefined && ageRaw !== null && trimVal(ageRaw) !== '') {
        patientAge = parseInt(String(ageRaw), 10);
        if (!Number.isFinite(patientAge)) {
          errors.push('Invalid patient age');
          patientAge = undefined;
        }
      }

      const patientGender = trimVal(header.patientGender) || undefined;

      const clinicName = trimVal(header.clinicName);
      let clinicId: string | undefined;
      if (!clinicName) {
        missingFields.push('clinicName');
      } else {
        const clinic = clinicByName.get(clinicName.toLowerCase());
        if (!clinic) {
          errors.push(`Clinic not found: "${clinicName}"`);
        } else {
          clinicId = clinic.id;
        }
      }

      const expectedIso =
        parseDateToIso(header.expectedDate) ??
        parseDateToIso(header.date) ??
        parseDateToIso(groupRows.find((r) => r.expectedDate)?.expectedDate);
      if (!expectedIso) missingFields.push('expectedDate');

      const deliveryIso = parseDateToIso(header.deliveryDate);
      const isCancelled = isCancelledOrderStatus(caseStatus);

      const productDrafts = buildProductDraftsFromGroupRows(groupRows, productByCode, {
        isCancelled,
        header,
      });

      if (productDrafts.length === 0 && !isCancelled) {
        errors.push('No product lines for this order');
      }

      const item: OrderImportReviewItem = {
        orderId,
        rowIndices,
        data: {
          orderId,
          invoiceNumber: orderId,
          receivedThrough: trimVal(header.receivedThrough) || undefined,
          date: trimVal(header.date) || undefined,
          patientName: patientName || undefined,
          patientAge: patientAge ?? header.patientAge,
          patientGender: patientGender || undefined,
          clinicName: clinicName || undefined,
          clinicId,
          reference: trimVal(header.reference) || undefined,
          address: trimVal(header.address) || undefined,
          expectedDate: expectedIso ?? (trimVal(header.expectedDate) || undefined),
          deliveryDate: deliveryIso ?? (trimVal(header.deliveryDate) || undefined),
          caseStatus,
          partner: trimVal(header.partner) || 'Luxur',
          products: productDrafts,
        },
        errors: [
          ...errors,
          ...productDrafts.flatMap((p) =>
            p.errors.map((e) => `Row ${p.rowIndex}: ${e}`)
          ),
        ],
        missingFields: [
          ...missingFields,
          ...productDrafts.flatMap((p) =>
            p.missingFields.map((f) => `Row ${p.rowIndex}: ${f}`)
          ),
        ],
        canImport: false,
        duplicateOrder,
      };

      item.canImport =
        !duplicateOrder &&
        item.errors.length === 0 &&
        item.missingFields.length === 0 &&
        !!clinicId &&
        !!expectedIso &&
        (isCancelled || productDrafts.every((p) => !!p.productId));

      if (item.canImport) {
        ready.push(item);
      } else {
        needsReview.push(item);
      }
    }

    return { ready, needsReview, skipped, rowsWithoutOrderId, totalRows: rows.length };
  }

  async commitOrders(
    orders: OrderImportCommitItem[],
    meta?: OrderImportCommitMeta
  ): Promise<OrderImportCommitResult> {
    const batch = await prisma.orderImportBatch.create({
      data: {
        fileName: meta?.fileName ?? null,
        importedByEmail: meta?.importedByEmail ?? null,
        totalRows: meta?.totalRows ?? 0,
        ordersAttempted: orders.length,
        createdCount: 0,
        failedCount: 0,
      },
    });

    const { created, failed } = await this.commitOrderList(orders, batch.id, meta?.importedByUserId);

    await prisma.orderImportBatch.update({
      where: { id: batch.id },
      data: {
        createdCount: created.length,
        failedCount: failed.length,
      },
    });

    return { created, failed, batchId: batch.id };
  }

  private async applyImportCommit(
    order: OrderImportCommitItem,
    actorUserId?: string,
  ): Promise<
    | 'CREATED'
    | 'STATUS_UPDATED'
    | 'TOOTH_NUMBERS_UPDATED'
    | 'CREATED_DATE_UPDATED'
    | 'COLUMNS_UPDATED'
  > {
    const updateColumns = order.updateColumns?.length
      ? order.updateColumns
      : order.createdDateUpdateOnly
        ? (['createdDate'] as OrderImportUpdateColumn[])
        : [];
    if (updateColumns.length) {
      await this.updateOrderColumnsFromImport(order, updateColumns, actorUserId);
      return updateColumns.length === 1 && updateColumns[0] === 'createdDate'
        ? 'CREATED_DATE_UPDATED'
        : 'COLUMNS_UPDATED';
    }

    if (order.createdDateUpdateOnly) {
      await this.updateOrderCreatedDateFromImport(order, actorUserId);
      return 'CREATED_DATE_UPDATED';
    }

    if (order.toothNumberUpdateOnly) {
      await this.updateOrderToothNumbersFromImport(order);
      return 'TOOTH_NUMBERS_UPDATED';
    }

    if (order.statusUpdateOnly) {
      const status = normalizeStatus(order.caseStatus) as CreateOrderData['status'];
      if (!order.caseStatus || !status || status === 'NEW') {
        throw new Error('Valid Case Status is required to update an existing order');
      }
      await orderService.updateOrder(
        trimVal(order.orderId),
        { status },
        actorUserId,
        `Status updated to ${status} via import`,
      );
      return 'STATUS_UPDATED';
    }

    await this.createOrderFromCommit(order, actorUserId);
    return 'CREATED';
  }

  private async updateOrderColumnsFromImport(
    order: OrderImportCommitItem,
    columns: OrderImportUpdateColumn[],
    actorUserId?: string,
  ): Promise<void> {
    const orderId = trimVal(order.orderId);
    if (!orderId) throw new Error('Order ID is required to update columns');

    const existing = await prisma.order.findUnique({
      where: { id: orderId },
      include: { patient: true },
    });
    if (!existing) {
      throw new Error(`Order ID "${orderId}" was not found`);
    }

    const selected = new Set(columns);
    const updateData: UpdateOrderData = {};

    if (selected.has('createdDate')) {
      const dateIso = parseDateToIso(order.date) ?? (trimVal(order.date) || undefined);
      if (!dateIso) throw new Error('A valid Date is required');
      updateData.createdDate = new Date(dateIso);
    }
    if (selected.has('estimateDate')) {
      const iso = parseDateToIso(order.expectedDate) ?? (trimVal(order.expectedDate) || undefined);
      if (!iso) throw new Error('A valid Expected Date is required');
      updateData.estimateDate = new Date(iso);
    }
    if (selected.has('schedule')) {
      const iso = parseDateToIso(order.deliveryDate) ?? (trimVal(order.deliveryDate) || undefined);
      if (!iso) throw new Error('A valid Delivery Date is required');
      updateData.schedule = new Date(iso);
    }
    if (selected.has('status')) {
      const status = normalizeStatus(order.caseStatus) as UpdateOrderData['status'];
      if (!order.caseStatus || !status || status === 'NEW') {
        throw new Error('Valid Case Status is required');
      }
      updateData.status = status;
    }
    if (selected.has('partner')) {
      const partner = trimVal(order.partner);
      if (!partner) throw new Error('Partner is required');
      updateData.partner = partner;
    }
    if (selected.has('reference')) {
      updateData.referenceName = trimVal(order.reference) || undefined;
    }

    const wantsPatient =
      selected.has('patientName') || selected.has('patientAge') || selected.has('patientGender');
    if (wantsPatient) {
      const patient: CreatePatientData = {
        name: selected.has('patientName')
          ? trimVal(order.patientName)
          : existing.patient.name,
        age: selected.has('patientAge')
          ? resolvePatientAge(order.patientAge)
          : existing.patient.age,
        gender: selected.has('patientGender')
          ? resolvePatientGender(order.patientGender)
          : existing.patient.gender,
      };
      if (selected.has('patientName') && !patient.name) {
        throw new Error('Patient Name is required');
      }
      updateData.patient = patient;
    }

    if (Object.keys(updateData).length) {
      await orderService.updateOrder(
        orderId,
        updateData,
        actorUserId,
        `Updated ${orderImportUpdateColumnLabels(columns)} via import`,
      );
    }

    if (selected.has('toothNumber')) {
      await this.updateOrderToothNumbersFromImport(order);
    }
  }

  private async updateOrderCreatedDateFromImport(
    order: OrderImportCommitItem,
    actorUserId?: string,
  ): Promise<void> {
    const orderId = trimVal(order.orderId);
    const dateIso = parseDateToIso(order.date) ?? (trimVal(order.date) || undefined);
    if (!orderId) {
      throw new Error('Order ID is required to update created date');
    }
    if (!dateIso) {
      throw new Error('A valid Date is required to update created date');
    }

    const existing = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true },
    });
    if (!existing) {
      throw new Error(`Order ID "${orderId}" was not found`);
    }

    await orderService.updateOrder(
      orderId,
      { createdDate: new Date(dateIso) },
      actorUserId,
      'Created date updated via import',
    );
  }

  private async updateOrderToothNumbersFromImport(order: OrderImportCommitItem): Promise<void> {
    const orderId = trimVal(order.orderId);
    const existing = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        orderProducts: {
          orderBy: { createdAt: 'asc' },
          include: { product: { select: { code: true } } },
        },
      },
    });
    if (!existing) {
      throw new Error('Order not found');
    }

    const queuesByCode = new Map<string, typeof existing.orderProducts>();
    for (const op of existing.orderProducts) {
      const code = productCodeLookupKey(op.product.code);
      if (!code) continue;
      if (!queuesByCode.has(code)) queuesByCode.set(code, []);
      queuesByCode.get(code)!.push(op);
    }
    const unmatchedByPosition = [...existing.orderProducts];
    let updated = 0;

    for (const importLine of order.products) {
      if (!importLine.toothNumber) continue;

      const code = productCodeLookupKey(importLine.productCode);
      let target = code ? queuesByCode.get(code)?.shift() : undefined;
      if (!target && unmatchedByPosition.length > 0) {
        target = unmatchedByPosition.shift();
      }
      if (!target) {
        throw new Error(
          `No matching product line on order ${orderId} for code "${importLine.productCode ?? '?'}"`,
        );
      }

      await prisma.orderProduct.update({
        where: { id: target.id },
        data: { unitNumbers: importLine.toothNumber },
      });
      updated++;
    }

    if (updated === 0) {
      throw new Error('No tooth numbers were updated');
    }
  }

  private async createOrderFromCommit(order: OrderImportCommitItem, actorUserId?: string): Promise<void> {
    const status = normalizeStatus(order.caseStatus) as CreateOrderData['status'];
    const isCancelled = isCancelledOrderStatus(status);

    const orderProducts = (order.products ?? [])
      .filter((p) => p.productId)
      .map((p) => {
      const repeat = normalizeRepeatCorrection(p.newRepeatCorrection);
      const defaults = productDefaults(repeat, p.column1 ?? '', p.componentReduction ?? '');
      if (repeat !== 'New' && !defaults.enterReason) {
        defaults.enterReason = 'Imported correction';
      }
      return {
        productId: p.productId!,
        shadeType: resolveShade(p.shade),
        unitNumbers: p.toothNumber
          ? normalizeToothNumberString(p.toothNumber)
          : p.toothNumber,
        unitPrice: p.unitAmount,
        discountPercent: p.discountPercent,
        workSpecification: p.column1,
        ...defaults,
      };
    });

    if (!isCancelled && orderProducts.length === 0) {
      throw new Error('Order must have at least one product');
    }

    const payload: CreateOrderData = {
      id: trimVal(order.orderId),
      invoiceNumber: trimVal(order.invoiceNumber) || trimVal(order.orderId),
      patient: {
        name: order.patientName,
        age: order.patientAge ?? 0,
        gender: order.patientGender?.trim() || '',
      },
      clinicId: order.clinicId,
      referenceName: order.reference,
      partner: order.partner?.trim() || 'Luxur',
      createdDate: order.date
        ? new Date(parseDateToIso(order.date) ?? order.date)
        : new Date(),
      estimateDate: new Date(order.expectedDate),
      scanningMode: order.receivedThrough,
      schedule: order.deliveryDate ? new Date(order.deliveryDate) : undefined,
      dateOfApproach: order.date ? new Date(parseDateToIso(order.date) ?? order.date) : undefined,
      status,
      orderProducts,
    };

    await orderService.createOrder(payload, actorUserId);
  }

  private async commitOrderList(
    orders: OrderImportCommitItem[],
    batchId: string,
    actorUserId?: string
  ): Promise<{ created: string[]; failed: { orderId: string; message: string }[] }> {
    const created: string[] = [];
    const failed: { orderId: string; message: string }[] = [];

    const clinicIds = [...new Set(orders.map((o) => o.clinicId))];
    const clinics =
      clinicIds.length > 0
        ? await prisma.clinic.findMany({
            where: { id: { in: clinicIds } },
            select: { id: true, clinicName: true },
          })
        : [];
    const clinicNameById = new Map(clinics.map((c) => [c.id, c.clinicName]));

    const COMMIT_CHUNK = 20;
    for (let offset = 0; offset < orders.length; offset += COMMIT_CHUNK) {
      const chunk = orders.slice(offset, offset + COMMIT_CHUNK);
      for (const order of chunk) {
        const clinicName = clinicNameById.get(order.clinicId) ?? null;
        try {
          const result = await this.applyImportCommit(order, actorUserId);
          created.push(order.orderId);
          await prisma.orderImportBatchItem.create({
            data: {
              batchId,
              orderId: order.orderId,
              status:
                result === 'STATUS_UPDATED'
                  ? 'STATUS_UPDATED'
                  : result === 'TOOTH_NUMBERS_UPDATED'
                    ? 'TOOTH_NUMBERS_UPDATED'
                    : result === 'CREATED_DATE_UPDATED'
                      ? 'CREATED_DATE_UPDATED'
                      : result === 'COLUMNS_UPDATED'
                        ? 'COLUMNS_UPDATED'
                        : 'CREATED',
              patientName: order.patientName,
              clinicName,
              productCount: order.products.length,
            },
          });
        } catch (e: unknown) {
          const message = e instanceof Error ? e.message : 'Import failed';
          failed.push({ orderId: order.orderId, message });
          await prisma.orderImportBatchItem.create({
            data: {
              batchId,
              orderId: order.orderId,
              status: 'FAILED',
              patientName: order.patientName,
              clinicName,
              productCount: order.products.length,
              errorMessage: message,
              draftJson: order as object,
            },
          });
        }
      }
    }

    return { created, failed };
  }

  private parseAndValidate(buffer: Buffer, fileName: string) {
    const parsed = parseUploadBuffer(buffer, fileName);

    if (!parsed.rows.length) {
      throw new Error('No data rows found. Ensure the sheet has a header row and order data.');
    }
    if (looksLikeClinicSheetHeaders(parsed.headers)) {
      throw new Error(
        `Worksheet "${parsed.sheetName}" looks like clinic data (Doctor Name, Clinic Name, etc.). ` +
          'Import clinics from Data Import, or use a sheet with Order id, Patient Name, Product Code, and Shade columns.'
      );
    }
    if (!hasOrderIdMapping(parsed.headers)) {
      throw new Error(
        `No "Order id" column found on worksheet "${parsed.sheetName}". ` +
          `Headers: ${parsed.headers.join(', ')}`
      );
    }

    return { parsed };
  }

  async previewFromFile(
    buffer: Buffer,
    fileName: string,
    options: OrderImportValidateOptions = {},
  ): Promise<OrderImportPreviewResult> {
    const { parsed } = this.parseAndValidate(buffer, fileName);
    const validation = await this.validateRows(parsed.rows, options);
    const parsedByIndex = new Map(parsed.rows.map((r) => [r.rowIndex, r]));

    const rows: OrderImportPreviewRow[] = [];
    const commitItems: OrderImportCommitItem[] = [];

    for (const item of validation.ready) {
      commitItems.push(reviewItemToCommit(item));
      const previewStatus = item.updateColumns?.length
        ? item.updateColumns.length === 1 && item.updateColumns[0] === 'createdDate'
          ? 'CREATED_DATE_UPDATE'
          : 'COLUMN_UPDATE'
        : item.createdDateUpdateOnly
          ? 'CREATED_DATE_UPDATE'
          : item.toothNumberUpdateOnly
            ? 'TOOTH_NUMBER_UPDATE'
            : item.statusUpdateOnly
              ? 'STATUS_UPDATE'
              : 'READY';
      const toothLineCount = item.data.products.filter((p) => p.toothNumber).length;
      const isColumnUpdate = !!item.updateColumns?.length || !!item.createdDateUpdateOnly;
      rows.push({
        orderId: item.orderId,
        rowIndices: item.rowIndices,
        patientName: item.data.patientName,
        clinicName: item.data.clinicName,
        productCount: item.toothNumberUpdateOnly
          ? toothLineCount
          : item.statusUpdateOnly || isColumnUpdate
            ? item.updateColumns?.includes('toothNumber')
              ? toothLineCount
              : 0
            : item.data.products.length,
        status: previewStatus,
        issues: item.updateColumns?.length
          ? `Update ${orderImportUpdateColumnLabels(item.updateColumns)}`
          : item.createdDateUpdateOnly
            ? `Update created date to ${item.data.date}`
            : item.toothNumberUpdateOnly
              ? `Update tooth numbers on ${toothLineCount} product line(s)`
              : item.statusUpdateOnly
                ? `Update status to ${item.data.caseStatus}`
                : undefined,
        importable: true,
      });
    }

    for (const item of validation.needsReview) {
      const issues = [
        ...item.errors,
        ...item.missingFields.map((f) => `Missing: ${f}`),
      ].join('; ');
      const status = item.duplicateOrder ? 'DUPLICATE_ORDER' : 'NEEDS_REVIEW';
      rows.push({
        orderId: item.orderId,
        rowIndices: item.rowIndices,
        patientName: item.data.patientName,
        clinicName: item.data.clinicName,
        productCount: item.data.products.length,
        status,
        issues: issues || 'Missing required fields',
        importable: false,
        fixDraft: item,
      });
    }

    for (const skip of validation.skipped) {
      rows.push({
        orderId: skip.orderId,
        rowIndices: skip.rowIndices,
        productCount: skip.rowIndices.length,
        status: 'SKIPPED',
        issues: skip.reason,
        importable: false,
      });
    }

    for (const rowIndex of validation.rowsWithoutOrderId) {
      const src = parsedByIndex.get(rowIndex);
      rows.push({
        orderId: `__ROW_${rowIndex}__`,
        rowIndices: [rowIndex],
        patientName: trimVal(src?.patientName) || undefined,
        clinicName: trimVal(src?.clinicName) || undefined,
        productCount: 1,
        status: 'MISSING_ORDER_ID',
        issues: `Missing Order ID (sheet row ${rowIndex})`,
        importable: false,
      });
    }

    const sheetRowsInOrders = validation.ready
      .concat(validation.needsReview)
      .reduce((sum, item) => sum + item.rowIndices.length, 0)
      + validation.skipped.reduce((sum, skip) => sum + skip.rowIndices.length, 0);
    const multiLineOrders = rows.filter(
      (row) => row.status !== 'MISSING_ORDER_ID' && row.rowIndices.length > 1,
    ).length;
    const orderCount =
      validation.ready.length + validation.needsReview.length + validation.skipped.length;
    const missingOrderId = validation.rowsWithoutOrderId.length;
    const duplicateOrders = validation.needsReview.filter((item) => item.duplicateOrder).length;
    const statusUpdates = validation.ready.filter((item) => item.statusUpdateOnly).length;
    const toothNumberUpdates = validation.ready.filter((item) => item.toothNumberUpdateOnly).length;
    const createdDateUpdates = validation.ready.filter((item) => item.createdDateUpdateOnly).length;
    const columnUpdates = validation.ready.filter((item) => !!item.updateColumns?.length).length;
    const sheetRowTrace = buildSheetRowTrace(parsed.rows, validation);

    return {
      parseInfo: {
        sheetName: parsed.sheetName,
        headerRowIndex: parsed.headerRowIndex,
        headers: parsed.headers,
      },
      summary: {
        ready: validation.ready.filter(
          (item) =>
            !item.statusUpdateOnly &&
            !item.toothNumberUpdateOnly &&
            !item.createdDateUpdateOnly &&
            !item.updateColumns?.length,
        ).length,
        needsReview: validation.needsReview.length - duplicateOrders,
        skipped: validation.skipped.length,
        duplicateOrders,
        statusUpdates,
        toothNumberUpdates,
        createdDateUpdates,
        columnUpdates,
        missingOrderId,
        rowsWithoutOrderId: missingOrderId,
        totalOrders: orderCount,
        totalSheetRows: parsed.rows.length,
        sheetRowsInOrders,
        multiLineOrders,
      },
      rows,
      sheetRowTrace,
      commitItems,
    };
  }

  async importFromFile(
    buffer: Buffer,
    fileName: string,
    meta: OrderImportCommitMeta,
    itemsPage = 0,
    itemsLimit = 20,
    options: OrderImportValidateOptions = {},
  ): Promise<OrderImportFileResult> {
    const { parsed } = this.parseAndValidate(buffer, fileName);
    const validation = await this.validateRows(parsed.rows, options);
    const ordersToCreate = validation.ready.map(reviewItemToCommit);

    const batch = await prisma.orderImportBatch.create({
      data: {
        fileName: meta.fileName ?? fileName,
        importedByEmail: meta.importedByEmail ?? null,
        totalRows: parsed.rows.length,
        ordersAttempted:
          ordersToCreate.length + validation.needsReview.length + validation.skipped.length,
        createdCount: 0,
        failedCount: 0,
      },
    });

    const { created, failed } = await this.commitOrderList(ordersToCreate, batch.id, meta.importedByUserId);

    for (const item of validation.needsReview) {
      await prisma.orderImportBatchItem.create({
        data: {
          batchId: batch.id,
          orderId: item.orderId,
          status: item.duplicateOrder ? 'DUPLICATE_ORDER' : 'NEEDS_REVIEW',
          patientName: item.data.patientName ?? null,
          clinicName: item.data.clinicName ?? null,
          productCount: item.data.products.length,
          errorMessage:
            [...item.errors, ...item.missingFields.map((f) => `Missing: ${f}`)].join('; ') ||
            'Missing required fields',
          draftJson: item as object,
        },
      });
    }

    for (const skip of validation.skipped) {
      await prisma.orderImportBatchItem.create({
        data: {
          batchId: batch.id,
          orderId: skip.orderId,
          status: 'SKIPPED',
          productCount: skip.rowIndices.length,
          errorMessage: skip.reason,
        },
      });
    }

    const needsReviewCount = validation.needsReview.length;
    const skippedCount = validation.skipped.length;
    const failedCount = failed.length + needsReviewCount + skippedCount;

    await prisma.orderImportBatch.update({
      where: { id: batch.id },
      data: {
        createdCount: created.length,
        failedCount,
      },
    });

    const itemsResult = await this.listBatchItems(batch.id, itemsPage, itemsLimit);
    const updatedBatch = await prisma.orderImportBatch.findUniqueOrThrow({ where: { id: batch.id } });

    return {
      batch: updatedBatch,
      parseInfo: {
        sheetName: parsed.sheetName,
        headerRowIndex: parsed.headerRowIndex,
        headers: parsed.headers,
      },
      summary: {
        ready: validation.ready.length,
        needsReview: needsReviewCount,
        skipped: skippedCount,
        rowsWithoutOrderId: validation.rowsWithoutOrderId.length,
        created: created.length,
        failed: failedCount,
      },
      items: itemsResult.items,
      itemsPagination: itemsResult.pagination,
    };
  }

  async listBatchItems(batchId: string, page = 0, limit = 20) {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const skip = Math.max(page, 0) * safeLimit;
    const [items, total] = await Promise.all([
      prisma.orderImportBatchItem.findMany({
        where: { batchId },
        orderBy: { createdAt: 'asc' },
        skip,
        take: safeLimit,
      }),
      prisma.orderImportBatchItem.count({ where: { batchId } }),
    ]);
    return {
      items,
      pagination: { page, limit: safeLimit, total },
    };
  }

  async listImportHistory(page = 0, limit = 20) {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const skip = Math.max(page, 0) * safeLimit;
    const [batches, total] = await Promise.all([
      prisma.orderImportBatch.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: safeLimit,
      }),
      prisma.orderImportBatch.count(),
    ]);
    return {
      batches,
      pagination: { page, limit: safeLimit, total },
    };
  }

  async retryBatchItem(itemId: string, order: OrderImportCommitItem) {
    const item = await prisma.orderImportBatchItem.findUnique({
      where: { id: itemId },
      include: { batch: true },
    });
    if (!item) {
      throw new Error('Import item not found');
    }
    if (item.status === 'CREATED') {
      throw new Error('Order was already imported successfully');
    }
    if (item.status === 'SKIPPED') {
      throw new Error('Skipped orders cannot be retried. Fix the sheet and re-import with a new order ID.');
    }

    const clinic = await prisma.clinic.findUnique({
      where: { id: order.clinicId },
      select: { clinicName: true },
    });
    const clinicName = clinic?.clinicName ?? null;
    const previousStatus = item.status;

    try {
      await this.createOrderFromCommit(order);
      await prisma.orderImportBatchItem.update({
        where: { id: itemId },
        data: {
          status: 'CREATED',
          errorMessage: null,
          patientName: order.patientName,
          clinicName,
          productCount: order.products.length,
          draftJson: Prisma.JsonNull,
        },
      });
      if (previousStatus !== 'CREATED') {
        await prisma.orderImportBatch.update({
          where: { id: item.batchId },
          data: {
            createdCount: { increment: 1 },
            failedCount: { decrement: 1 },
          },
        });
      }
      return { orderId: order.orderId, status: 'CREATED' as const };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Import failed';
      await prisma.orderImportBatchItem.update({
        where: { id: itemId },
        data: {
          errorMessage: message,
          draftJson: order as object,
          patientName: order.patientName,
          clinicName,
          productCount: order.products.length,
        },
      });
      throw new Error(message);
    }
  }
}

export const orderImportService = new OrderImportService();
