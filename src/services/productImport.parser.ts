import * as XLSX from 'xlsx';
import { normalizeProductCode } from '../utils/productCode.util';

const HEADER_ALIASES: Record<string, string> = {
  'product code': 'code',
  productcode: 'code',
  code: 'code',
  product: 'name',
  'product name': 'name',
  productname: 'name',
  name: 'name',
  'on paper rate': 'onPaperRate',
  onpaperrate: 'onPaperRate',
  'price on paper': 'onPaperRate',
  priceonpaper: 'onPaperRate',
  'on-paper rate': 'onPaperRate',
  'paper rate': 'onPaperRate',
  discount: 'discount',
  'discount %': 'discount',
  'discount percent': 'discount',
  discountpercent: 'discount',
  'final price': 'price',
  finalprice: 'price',
  price: 'price',
  'suggested price': 'price',
};

const MAX_DATA_ROWS = 5000;

export type ProductImportSheetRow = {
  rowIndex: number;
  code?: string;
  name?: string;
  onPaperRate?: number | string;
  discount?: number | string;
  price?: number | string;
};

export type ProductImportParseResult = {
  rows: ProductImportSheetRow[];
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

function resolveFieldKey(header: string): string {
  const norm = normalizeHeader(header);
  if (!norm) return '';
  if (HEADER_ALIASES[norm]) return HEADER_ALIASES[norm];
  const compact = norm.replace(/\s/g, '');
  if (HEADER_ALIASES[compact]) return HEADER_ALIASES[compact];
  return '';
}

function scoreHeaderRow(headers: string[]): number {
  let score = 0;
  for (const h of headers) {
    const key = resolveFieldKey(h);
    if (key === 'code') score += 5;
    if (key === 'name') score += 4;
    if (key === 'price') score += 4;
    if (key === 'onPaperRate') score += 3;
    if (key === 'discount') score += 2;
  }
  return score;
}

function parseNumber(v: unknown): number | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  const n = Number(String(v).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : undefined;
}

function mapRawRow(raw: Record<string, unknown>, rowIndex: number): ProductImportSheetRow {
  const row: ProductImportSheetRow = { rowIndex };
  for (const [header, val] of Object.entries(raw)) {
    const key = resolveFieldKey(header);
    if (!key) continue;
    if (key === 'onPaperRate' || key === 'discount' || key === 'price') {
      const n = parseNumber(val);
      if (n !== undefined) (row as Record<string, unknown>)[key] = n;
    } else if (key === 'code' || key === 'name') {
      const s = key === 'code'
        ? normalizeProductCode(val)
        : String(val ?? '').trim();
      if (s) (row as Record<string, unknown>)[key] = s;
    }
  }
  return row;
}

function readRowHeaders(sheet: XLSX.WorkSheet, rowIndex: number): string[] {
  const ref = sheet['!ref'];
  if (!ref) return [];
  const range = XLSX.utils.decode_range(ref);
  const headers: string[] = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = sheet[XLSX.utils.encode_cell({ r: rowIndex, c })];
    headers.push(cell?.v != null ? String(cell.v).trim() : '');
  }
  while (headers.length > 0 && !headers[headers.length - 1]) headers.pop();
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
    const score = scoreHeaderRow(readRowHeaders(sheet, r));
    if (score > bestScore) {
      bestScore = score;
      bestRow = r;
    }
  }
  return bestRow;
}

function parseWorksheet(sheet: XLSX.WorkSheet, sheetName: string): ProductImportParseResult {
  const headerRowIndex = findHeaderRowIndex(sheet);
  const headers = readRowHeaders(sheet, headerRowIndex).filter((h) => h.length > 0);

  const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    range: headerRowIndex,
    defval: '',
    raw: false,
  });

  const rows = jsonRows
    .slice(0, MAX_DATA_ROWS)
    .map((raw, idx) => mapRawRow(raw, headerRowIndex + idx + 2))
    .filter((row) => !!(row.code || row.name || row.price != null));

  return {
    rows,
    headers,
    headerRowIndex: headerRowIndex + 1,
    sheetName,
  };
}

export function hasProductImportHeaders(headers: string[]): boolean {
  const keys = new Set(headers.map((h) => resolveFieldKey(h)).filter(Boolean));
  return keys.has('code') && keys.has('name') && keys.has('price');
}

export function parseProductUploadBuffer(buffer: Buffer, fileName: string): ProductImportParseResult {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.csv') || lower.endsWith('.txt') || lower.endsWith('.tsv')) {
    const text = buffer.toString('utf8');
    const wb = XLSX.read(text, { type: 'string' });
    const sheetName = wb.SheetNames[0] ?? 'Sheet1';
    const sheet = wb.Sheets[sheetName];
    if (!sheet) {
      return { rows: [], headers: [], headerRowIndex: 0, sheetName };
    }
    return parseWorksheet(sheet, sheetName);
  }

  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  if (!wb.SheetNames.length) {
    return { rows: [], headers: [], headerRowIndex: 0, sheetName: '' };
  }

  const scored = wb.SheetNames.map((name) => {
    const sheet = wb.Sheets[name];
    const headerRowIndex = findHeaderRowIndex(sheet);
    const headers = readRowHeaders(sheet, headerRowIndex);
    return { name, score: scoreHeaderRow(headers) };
  });
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  const sheet = wb.Sheets[best.name];
  return parseWorksheet(sheet, best.name);
}
