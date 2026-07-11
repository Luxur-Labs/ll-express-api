import * as XLSX from 'xlsx';
import { Prisma } from '@prisma/client';

import { productImportService } from '../src/services/productImport.service';
import { prisma } from '../src/utils/prisma';

function buildProductCsv(rows: string[][]): Buffer {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(sheet);
  return Buffer.from(csv, 'utf8');
}

describe('Product import', () => {
  const prefix = `PI-${Date.now()}`;

  afterAll(async () => {
    await prisma.product.deleteMany({
      where: { code: { startsWith: prefix } },
    });
  });

  it('strips spaces from codes and upserts without duplicates', async () => {
    const buffer = buildProductCsv([
      ['Product Code', 'Product', 'Final Price', 'Discount'],
      [`${prefix} A 1`, 'Crown A', '1000', '5'],
      [`${prefix}A1`, 'Crown A Updated', '1100', '10'],
    ]);

    const result = await productImportService.importFromFile(buffer, 'products.csv');

    expect(result.summary.created).toBe(1);
    expect(result.summary.updated).toBe(1);
    expect(result.summary.failed).toBe(0);

    const products = await prisma.product.findMany({
      where: { code: { startsWith: prefix.replace(/\s/g, '') } },
    });
    expect(products).toHaveLength(1);
    expect(products[0].code).toBe(`${prefix}A1`);
    expect(Number(products[0].price)).toBe(1100);
    expect(Number(products[0].discount)).toBe(10);
  });

  it('updates existing product when sheet code differs only by spaces', async () => {
    const existingCode = `${prefix}XY`;
    const spacedCode = `${prefix} X Y`;

    await prisma.product.create({
      data: {
        name: 'Legacy Bridge',
        code: spacedCode.replace(/\s/g, ''),
        price: new Prisma.Decimal(500),
        discount: new Prisma.Decimal(0),
      },
    });

    const buffer = buildProductCsv([
      ['Product Code', 'Product', 'Final Price'],
      [spacedCode, 'Legacy Bridge Updated', '650'],
    ]);

    const result = await productImportService.importFromFile(buffer, 'products.csv');

    expect(result.summary.created).toBe(0);
    expect(result.summary.updated).toBe(1);

    const products = await prisma.product.findMany({
      where: { code: existingCode },
    });
    expect(products).toHaveLength(1);
    expect(products[0].name).toBe('Legacy Bridge Updated');
    expect(Number(products[0].price)).toBe(650);
  });
});
