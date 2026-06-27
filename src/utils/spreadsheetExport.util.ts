import { Response } from 'express';
import * as XLSX from 'xlsx';

export type ExportFormat = 'csv' | 'xlsx';

export function parseExportFormat(value: unknown, fallback: ExportFormat = 'xlsx'): ExportFormat {
  const s = String(value ?? '').toLowerCase();
  if (s === 'csv') return 'csv';
  if (s === 'xlsx') return 'xlsx';
  return fallback;
}

export function buildSpreadsheetBuffer(
  headers: readonly string[],
  rows: unknown[][],
  format: ExportFormat,
  sheetName = 'Sheet1',
): Buffer {
  const ws = XLSX.utils.aoa_to_sheet([Array.from(headers), ...rows]);
  if (format === 'csv') {
    return Buffer.from(XLSX.utils.sheet_to_csv(ws), 'utf8');
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

export function sendSpreadsheetExport(
  res: Response,
  buffer: Buffer,
  baseName: string,
  format: ExportFormat,
): void {
  const ext = format === 'csv' ? 'csv' : 'xlsx';
  const contentType =
    format === 'csv'
      ? 'text/csv; charset=utf-8'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${baseName}.${ext}"`);
  res.send(buffer);
}
