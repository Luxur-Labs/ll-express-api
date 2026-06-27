import { PrismaClient } from '@prisma/client';

import { PRODUCT_IMPORT_HEADERS } from '../config/importExportHeaders';
import { buildSpreadsheetBuffer, ExportFormat } from '../utils/spreadsheetExport.util';
import { ACTIVE_ENTITY_FILTER } from '../utils/softDelete.util';

const prisma = new PrismaClient();

function decimalToNumber(v: { toString(): string } | null | undefined): number | '' {
  if (v == null) return '';
  const n = Number(v.toString());
  return Number.isFinite(n) ? n : '';
}

export class ProductExportService {
  async exportImportFormat(format: ExportFormat): Promise<Buffer> {
    const products = await prisma.product.findMany({
      where: ACTIVE_ENTITY_FILTER,
      orderBy: [{ code: 'asc' }, { name: 'asc' }],
    });

    const rows = products.map((p) => [
      p.code ?? '',
      p.name,
      decimalToNumber(p.onPaperRate),
      decimalToNumber(p.discount),
      decimalToNumber(p.price),
    ]);

    return buildSpreadsheetBuffer(PRODUCT_IMPORT_HEADERS, rows, format, 'Products');
  }
}

export const productExportService = new ProductExportService();
