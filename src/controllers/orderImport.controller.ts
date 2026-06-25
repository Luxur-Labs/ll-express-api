import { Request, Response } from 'express';

import { orderImportService, OrderImportCommitItem } from '../services/orderImport.service';
import type { AuthUser } from '../types/auth';
import { prisma } from '../utils/prisma';

async function resolveImportedByEmail(user?: AuthUser): Promise<string | undefined> {
  if (user?.email) return user.email;
  if (!user?.id) return undefined;
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { email: true },
  });
  return dbUser?.email;
}

export async function validateOrderImportController(req: Request, res: Response) {
  try {
    const { rows } = req.body;
    const result = await orderImportService.validateRows(rows);
    return res.status(200).json({ data: result });
  } catch (error: unknown) {
    console.error('Order import validate error:', error);
    return res.status(500).json({ message: 'Failed to validate import rows' });
  }
}

export async function commitOrderImportController(req: Request, res: Response) {
  try {
    const { orders, fileName, totalRows } = req.body;
    const user = res.locals.user as AuthUser | undefined;
    const importedByEmail = await resolveImportedByEmail(user);
    const result = await orderImportService.commitOrders(orders, {
      fileName,
      totalRows,
      importedByEmail,
      importedByUserId: user?.id,
    });
    return res.status(200).json({
      message: `Imported ${result.created.length} order(s)`,
      data: result,
    });
  } catch (error: unknown) {
    console.error('Order import commit error:', error);
    return res.status(500).json({ message: 'Failed to import orders' });
  }
}

export async function previewOrderImportFileController(req: Request, res: Response) {
  try {
    const file = req.file;
    if (!file?.buffer?.length) {
      return res.status(400).json({ message: 'No file uploaded. Send the spreadsheet as multipart field "file".' });
    }

    const result = await orderImportService.previewFromFile(file.buffer, file.originalname);
    return res.status(200).json({ data: result });
  } catch (error: unknown) {
    console.error('Order import preview error:', error);
    const message = error instanceof Error ? error.message : 'Failed to preview file';
    return res.status(400).json({ message });
  }
}

export async function uploadOrderImportFileController(req: Request, res: Response) {
  try {
    const file = req.file;
    if (!file?.buffer?.length) {
      return res.status(400).json({ message: 'No file uploaded. Send the spreadsheet as multipart field "file".' });
    }

    const user = res.locals.user as AuthUser | undefined;
    const importedByEmail = await resolveImportedByEmail(user);
    const page = Number(req.query.page) || 0;
    const limit = Number(req.query.limit) || 20;

    const result = await orderImportService.importFromFile(
      file.buffer,
      file.originalname,
      { fileName: file.originalname, importedByEmail, importedByUserId: user?.id },
      page,
      limit
    );

    return res.status(200).json({
      message: `Imported ${result.summary.created} order(s) from ${file.originalname}`,
      data: result,
    });
  } catch (error: unknown) {
    console.error('Order import file error:', error);
    const message = error instanceof Error ? error.message : 'Failed to import file';
    return res.status(400).json({ message });
  }
}

export async function listOrderImportBatchItemsController(req: Request, res: Response) {
  try {
    const batchId = req.params.batchId;
    const page = Number(req.query.page) || 0;
    const limit = Number(req.query.limit) || 20;
    const result = await orderImportService.listBatchItems(batchId, page, limit);
    return res.status(200).json({ data: result });
  } catch (error: unknown) {
    console.error('Order import batch items error:', error);
    return res.status(500).json({ message: 'Failed to load import batch items' });
  }
}

export async function retryOrderImportItemController(req: Request, res: Response) {
  try {
    const itemId = req.params.itemId;
    const { order } = req.body as { order: OrderImportCommitItem };
    const result = await orderImportService.retryBatchItem(itemId, order);
    return res.status(200).json({
      message: `Order ${result.orderId} imported successfully`,
      data: result,
    });
  } catch (error: unknown) {
    console.error('Order import retry error:', error);
    const message = error instanceof Error ? error.message : 'Failed to retry import';
    return res.status(400).json({ message });
  }
}

export async function listOrderImportHistoryController(req: Request, res: Response) {
  try {
    const page = Number(req.query.page) || 0;
    const limit = Number(req.query.limit) || 20;
    const result = await orderImportService.listImportHistory(page, limit);
    return res.status(200).json({ data: result });
  } catch (error: unknown) {
    console.error('Order import history error:', error);
    return res.status(500).json({ message: 'Failed to load import history' });
  }
}
