import { prisma } from '../utils/prisma';
import { createUserStampFields, updateUserStampFields } from '../utils/userStamps';

import {
  hasProductImportHeaders,
  parseProductUploadBuffer,
  ProductImportSheetRow,
} from './productImport.parser';

export type ProductImportRowResult = {
  rowIndex: number;
  code?: string;
  name?: string;
  status: 'CREATED' | 'UPDATED' | 'FAILED' | 'SKIPPED';
  message?: string;
};

export type ProductImportResult = {
  parseInfo: {
    sheetName: string;
    headerRowIndex: number;
    headers: string[];
  };
  summary: {
    totalRows: number;
    created: number;
    updated: number;
    failed: number;
    skipped: number;
  };
  items: ProductImportRowResult[];
};

function trimCode(v?: string): string {
  return (v ?? '').trim();
}

function validateRow(row: ProductImportSheetRow): { ok: true; data: {
  code: string;
  name: string;
  onPaperRate?: number;
  price: number;
  discount: number;
} } | { ok: false; message: string } {
  const code = trimCode(row.code);
  const name = trimCode(row.name);
  const price = row.price != null ? Number(row.price) : NaN;
  const discount = row.discount != null ? Number(row.discount) : 0;
  const onPaperRate = row.onPaperRate != null ? Number(row.onPaperRate) : undefined;

  if (!code) return { ok: false, message: 'Product code is required' };
  if (!name) return { ok: false, message: 'Product name is required' };
  if (!Number.isFinite(price) || price < 0) return { ok: false, message: 'Final price is required' };
  if (!Number.isFinite(discount) || discount < 0 || discount > 100) {
    return { ok: false, message: 'Discount must be between 0 and 100' };
  }
  if (onPaperRate !== undefined && (!Number.isFinite(onPaperRate) || onPaperRate < 0)) {
    return { ok: false, message: 'On paper rate must be a positive number' };
  }

  return {
    ok: true,
    data: {
      code,
      name,
      onPaperRate,
      price,
      discount,
    },
  };
}

export class ProductImportService {
  async importFromFile(buffer: Buffer, fileName: string, actorUserId?: string): Promise<ProductImportResult> {
    const parsed = parseProductUploadBuffer(buffer, fileName);

    if (!parsed.rows.length) {
      throw new Error('No product rows found. Ensure the sheet has a header row and data.');
    }
    if (!hasProductImportHeaders(parsed.headers)) {
      throw new Error(
        `Worksheet "${parsed.sheetName}" must include Product Code, Product, and Final Price columns. ` +
          `Found headers: ${parsed.headers.join(', ')}`
      );
    }

    const existing = await prisma.product.findMany({
      select: { id: true, code: true },
    });
    const byCode = new Map(
      existing
        .filter((p) => p.code)
        .map((p) => [trimCode(p.code!).toLowerCase(), p.id])
    );

    const items: ProductImportRowResult[] = [];
    let created = 0;
    let updated = 0;
    let failed = 0;
    let skipped = 0;

    for (const row of parsed.rows) {
      const validated = validateRow(row);
      if (!validated.ok) {
        failed++;
        items.push({
          rowIndex: row.rowIndex,
          code: row.code,
          name: row.name,
          status: 'FAILED',
          message: validated.message,
        });
        continue;
      }

      const { code, name, onPaperRate, price, discount } = validated.data;
      const existingId = byCode.get(code.toLowerCase());

      try {
        if (existingId) {
          await prisma.product.update({
            where: { id: existingId },
            data: {
              name,
              code,
              onPaperRate: onPaperRate ?? null,
              price,
              discount,
              ...updateUserStampFields(actorUserId),
            },
          });
          updated++;
          items.push({ rowIndex: row.rowIndex, code, name, status: 'UPDATED' });
        } else {
          const createdProduct = await prisma.product.create({
            data: {
              name,
              code,
              onPaperRate: onPaperRate ?? null,
              price,
              discount,
              ...createUserStampFields(actorUserId),
            },
          });
          byCode.set(code.toLowerCase(), createdProduct.id);
          created++;
          items.push({ rowIndex: row.rowIndex, code, name, status: 'CREATED' });
        }
      } catch (e: unknown) {
        failed++;
        const message = e instanceof Error ? e.message : 'Import failed';
        items.push({ rowIndex: row.rowIndex, code, name, status: 'FAILED', message });
      }
    }

    if (!items.some((i) => i.status === 'CREATED' || i.status === 'UPDATED') && failed === 0) {
      skipped = parsed.rows.length;
    }

    return {
      parseInfo: {
        sheetName: parsed.sheetName,
        headerRowIndex: parsed.headerRowIndex,
        headers: parsed.headers,
      },
      summary: {
        totalRows: parsed.rows.length,
        created,
        updated,
        failed,
        skipped,
      },
      items,
    };
  }
}

export const productImportService = new ProductImportService();
