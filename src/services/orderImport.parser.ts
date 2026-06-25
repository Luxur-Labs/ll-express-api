import * as XLSX from 'xlsx';

import type { OrderImportSheetRow } from './orderImport.service';

const HEADER_ALIASES: Record<string, string> = {
  'recived through': 'receivedThrough',
  'received through': 'receivedThrough',
  receivedthrough: 'receivedThrough',
  date: 'date',
  'order id': 'orderId',
  orderid: 'orderId',
  'order no': 'orderId',
  'order no.': 'orderId',
  'order number': 'orderId',
  'invoice no': 'orderId',
  'invoice no.': 'orderId',
  'invoice number': 'orderId',
  invoice: 'orderId',
  'case no': 'orderId',
  'case no.': 'orderId',
  'patient name': 'patientName',
  patientname: 'patientName',
  'new/repeat/correction': 'newRepeatCorrection',
  'new repeat correction': 'newRepeatCorrection',
  newrepeatcorrection: 'newRepeatCorrection',
  'clinic name': 'clinicName',
  clinicname: 'clinicName',
  reference: 'reference',
  address: 'address',
  clientaddress: 'address',
  'expected date': 'expectedDate',
  expecteddate: 'expectedDate',
  'delivery date': 'deliveryDate',
  deliverydate: 'deliveryDate',
  'case status': 'caseStatus',
  casestatus: 'caseStatus',
  shade: 'shade',
  'column 1': 'column1',
  column1: 'column1',
  'product code': 'productCode',
  productcode: 'productCode',
  'product description': 'productDescription',
  productdescription: 'productDescription',
  'tooth number': 'toothNumber',
  toothnumber: 'toothNumber',
  units: 'units',
  'unit amount including gst': 'unitAmount',
  'unit amount': 'unitAmount',
  unitamountincludinggst: 'unitAmount',
  unitamount: 'unitAmount',
  discounted: 'discounted',
  'discount percentage': 'discountPercent',
  discountpercentage: 'discountPercent',
  'amount after discount': 'amountAfterDiscount',
  '3d model charges': 'model3dCharges',
  'amount redused for components': 'componentReduction',
  'amount reduced for components': 'componentReduction',
  'total amount': 'totalAmount',
  'expected delivery': 'expectedDelivery',
  'on time / delayed': 'onTimeDelayed',
  'patient age': 'patientAge',
  patientage: 'patientAge',
  'patient gender': 'patientGender',
  patientgender: 'patientGender',
  partner: 'partner',
};

const MAX_HEADER_COLUMNS = 64;
const MAX_DATA_ROWS = 10000;

export type ParseSheetResult = {
  rows: OrderImportSheetRow[];
  headers: string[];
  headerRowIndex: number;
  sheetName: string;
};

function normalizeHeader(h: string): string {
  return h
    .replace(/^\ufeff/, '')
    .replace(/\u00a0/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/[.:;#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function lookupAlias(norm: string): string | undefined {
  if (HEADER_ALIASES[norm]) return HEADER_ALIASES[norm];
  const compact = norm.replace(/\s/g, '');
  if (HEADER_ALIASES[compact]) return HEADER_ALIASES[compact];
  return undefined;
}

export function resolveFieldKey(header: string): string {
  const norm = normalizeHeader(header);
  if (!norm) return '';
  const alias = lookupAlias(norm);
  if (alias) return alias;
  if (/^order\s*id$|^order\s*no$|^order\s*number$|^invoice(\s*no)?$|^case\s*no$/i.test(norm)) {
    return 'orderId';
  }
  return norm;
}

function scoreHeaderRow(headers: string[]): number {
  let score = 0;
  if (looksLikeClinicSheetHeaders(headers)) score -= 50;
  for (const h of headers) {
    const norm = normalizeHeader(h);
    if (!norm) continue;
    if (lookupAlias(norm)) score += 2;
    if (resolveFieldKey(h) === 'orderId') score += 8;
    if (/patient\s*name|clinic\s*name|product\s*code|expected\s*date|shade/i.test(norm)) score += 3;
  }
  return score;
}

export function looksLikeClinicSheetHeaders(headers: string[]): boolean {
  const norms = headers.map((h) => normalizeHeader(h));
  const hasOrg = norms.some((n) => n === 'organizationid' || n === 'organization id');
  const hasDoctor = norms.some((n) => n === 'doctorname' || n === 'doctor name');
  const hasOrderId = hasOrderIdMapping(headers);
  return (hasOrg || hasDoctor) && !hasOrderId;
}

export function hasOrderIdMapping(headers: string[]): boolean {
  return headers.some((h) => resolveFieldKey(h) === 'orderId');
}

function coerceCellValue(key: string, val: unknown): string | number | undefined {
  if (val === null || val === undefined) return undefined;
  if (typeof val === 'number') {
    if (key === 'orderId') return String(val);
    if (key === 'patientAge' || key === 'units' || key === 'unitAmount' || key === 'discountPercent') {
      return val;
    }
    return String(val);
  }
  const s = String(val).trim();
  if (!s) return undefined;
  if (key === 'patientAge' || key === 'units' || key === 'unitAmount' || key === 'discountPercent') {
    const n = Number(s.replace(/,/g, ''));
    return Number.isFinite(n) ? n : s;
  }
  return s;
}

function mapRawRow(raw: Record<string, unknown>, rowIndex: number): OrderImportSheetRow {
  const row: OrderImportSheetRow = { rowIndex };
  for (const [header, val] of Object.entries(raw)) {
    const key = resolveFieldKey(header);
    if (!key) continue;
    const coerced = coerceCellValue(key, val);
    if (coerced !== undefined) {
      (row as Record<string, unknown>)[key] = coerced;
    }
  }
  return row;
}

function trimCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function rowHasProductLineData(row: OrderImportSheetRow): boolean {
  return !!(
    trimCell(row.productCode) ||
    trimCell(row.shade) ||
    trimCell(row.productDescription) ||
    trimCell(row.toothNumber)
  );
}

/** Excel sheets often put Order ID and Case Status only on the first line of a multi-product order. */
export function forwardFillOrderIds(rows: OrderImportSheetRow[]): OrderImportSheetRow[] {
  let lastOrderId = '';
  let lastCaseStatus = '';
  return rows.map((row) => {
    let next = { ...row };
    const oid = trimCell(row.orderId);
    if (oid) {
      lastOrderId = oid;
    } else if (lastOrderId && rowHasProductLineData(row)) {
      next = { ...next, orderId: lastOrderId, orderIdInherited: true };
    }

    const caseStatus = trimCell(row.caseStatus);
    if (caseStatus) {
      lastCaseStatus = caseStatus;
    } else if (lastCaseStatus && trimCell(next.orderId)) {
      next = { ...next, caseStatus: lastCaseStatus };
    }

    return next;
  });
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

function detectDelimiter(firstLine: string): string {
  const tabs = (firstLine.match(/\t/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  return tabs > commas ? '\t' : ',';
}

function splitLine(line: string, delimiter: string): string[] {
  if (delimiter === ',') return parseCsvLine(line);
  return line.split('\t').map((c) => c.trim());
}

function findBestHeaderLineIndex(lines: string[], delimiter: string, maxScan = 8): number {
  let bestIdx = 0;
  let bestScore = 0;
  const limit = Math.min(lines.length, maxScan);
  for (let i = 0; i < limit; i++) {
    const headers = splitLine(lines[i], delimiter);
    const score = scoreHeaderRow(headers);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function parseSheetText(text: string): ParseSheetResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return { rows: [], headers: [], headerRowIndex: 0, sheetName: 'Sheet1' };
  }

  const delimiter = detectDelimiter(lines[0]);
  const headerRowIndex = findBestHeaderLineIndex(lines, delimiter);
  const headers = splitLine(lines[headerRowIndex], delimiter).filter((h) => h.trim().length > 0);
  const fieldKeys = splitLine(lines[headerRowIndex], delimiter).map((h) => resolveFieldKey(h));

  const rows: OrderImportSheetRow[] = [];
  const dataLines = lines.slice(headerRowIndex + 1, headerRowIndex + 1 + MAX_DATA_ROWS);
  for (let i = 0; i < dataLines.length; i++) {
    const lineIndex = headerRowIndex + 1 + i;
    const cells = splitLine(dataLines[i], delimiter);
    if (cells.every((c) => !c.trim())) continue;

    const raw: Record<string, unknown> = {};
    fieldKeys.forEach((key, idx) => {
      if (!key) return;
      raw[key] = cells[idx]?.trim() ?? '';
    });
    rows.push(mapRawRow(raw, lineIndex + 1));
  }

  return {
    rows,
    headers,
    headerRowIndex: headerRowIndex + 1,
    sheetName: 'Sheet1',
  };
}

function readRowHeaders(sheet: XLSX.WorkSheet, rowIndex: number): string[] {
  const ref = sheet['!ref'];
  if (!ref) return [];
  const range = XLSX.utils.decode_range(ref);
  const maxCol = Math.min(range.e.c, range.s.c + MAX_HEADER_COLUMNS - 1);
  const headers: string[] = [];
  for (let c = range.s.c; c <= maxCol; c++) {
    const cell = sheet[XLSX.utils.encode_cell({ r: rowIndex, c })];
    const val = cell != null && cell.v != null ? String(cell.v).trim() : '';
    headers.push(val);
  }
  while (headers.length > 0 && !headers[headers.length - 1]) {
    headers.pop();
  }
  return headers;
}

function findHeaderRowIndex(sheet: XLSX.WorkSheet, maxScan = 10): number {
  const ref = sheet['!ref'];
  if (!ref) return 0;
  const range = XLSX.utils.decode_range(ref);
  let bestRow = range.s.r;
  let bestScore = 0;
  const last = Math.min(range.s.r + maxScan - 1, range.e.r);
  for (let r = range.s.r; r <= last; r++) {
    const headers = readRowHeaders(sheet, r);
    const score = scoreHeaderRow(headers);
    if (score > bestScore) {
      bestScore = score;
      bestRow = r;
    }
  }
  return bestRow;
}

function parseWorksheet(sheet: XLSX.WorkSheet, sheetName: string, knownHeaderRowIndex?: number): ParseSheetResult {
  const headerRowIndex = knownHeaderRowIndex ?? findHeaderRowIndex(sheet);
  const headers = readRowHeaders(sheet, headerRowIndex).filter((h) => h.length > 0);

  const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    range: headerRowIndex,
    defval: '',
    raw: false,
  });

  const rows = jsonRows
    .slice(0, MAX_DATA_ROWS)
    .map((raw, idx) => mapRawRow(raw, headerRowIndex + idx + 2))
    .filter((row) =>
      Object.keys(row).some((k) => k !== 'rowIndex' && (row as Record<string, unknown>)[k] !== undefined && (row as Record<string, unknown>)[k] !== '')
    );

  return {
    rows,
    headers,
    headerRowIndex: headerRowIndex + 1,
    sheetName,
  };
}

function parseXlsxBuffer(buffer: Buffer): ParseSheetResult {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true, cellStyles: false, sheetStubs: false });
  if (!wb.SheetNames.length) {
    return { rows: [], headers: [], headerRowIndex: 0, sheetName: '' };
  }

  const scored = wb.SheetNames.map((name) => {
    const sheet = wb.Sheets[name];
    const headerRowIndex = findHeaderRowIndex(sheet);
    const headers = readRowHeaders(sheet, headerRowIndex).filter((h) => h.length > 0);
    return { name, score: scoreHeaderRow(headers), headerRowIndex, headers };
  });

  const best = scored.reduce((a, b) => (b.score > a.score ? b : a));
  return parseWorksheet(wb.Sheets[best.name], best.name, best.headerRowIndex);
}

export function parseUploadBuffer(buffer: Buffer, fileName: string): ParseSheetResult {
  const lower = fileName.toLowerCase();
  const parsed =
    lower.endsWith('.xlsx') || lower.endsWith('.xls')
      ? parseXlsxBuffer(buffer)
      : parseSheetText(buffer.toString('utf8'));
  return { ...parsed, rows: forwardFillOrderIds(parsed.rows) };
}
