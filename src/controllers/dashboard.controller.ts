import { Request, Response } from 'express';

import { DashboardService } from '../services/dashboard.service';
import { orderExportService } from '../services/orderExport.service';
import { formatYmd } from '../utils/orderSales.util';
import { sendSpreadsheetExport } from '../utils/spreadsheetExport.util';

const dashboardService = new DashboardService();

export async function getDashboardController(req: Request, res: Response) {
  try {
    const metrics = await dashboardService.getDashboardMetrics();
    return res.json({ 
      success: true,
      data: metrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching dashboard metrics:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
}

export async function getSalesSummaryController(req: Request, res: Response) {
  try {
    const from = typeof req.query.from === 'string' ? req.query.from : undefined;
    const to = typeof req.query.to === 'string' ? req.query.to : undefined;
    const data = await dashboardService.getSalesSummary({ from, to });
    return res.json({ success: true, data });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error?.message || 'Failed to load sales summary',
    });
  }
}

/** @deprecated Prefer exportOrdersReportController with from/to; kept for older clients. */
export async function exportTodayOrdersReportController(req: Request, res: Response) {
  return exportOrdersReportController(req, res);
}

/**
 * Sales/orders Excel export for a createdAt date range (inclusive YYYY-MM-DD).
 * Defaults to today when from/to are omitted.
 */
export async function exportOrdersReportController(req: Request, res: Response) {
  try {
    const today = formatYmd(new Date());
    const fromRaw = typeof req.query.from === 'string' ? req.query.from.trim() : '';
    const toRaw = typeof req.query.to === 'string' ? req.query.to.trim() : '';
    const from = fromRaw || toRaw || today;
    const to = toRaw || fromRaw || today;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return res.status(400).json({
        success: false,
        message: 'from/to must be YYYY-MM-DD',
      });
    }
    if (from > to) {
      return res.status(400).json({
        success: false,
        message: 'from date must be on or before to date',
      });
    }

    const buffer = await orderExportService.exportImportFormat('xlsx', {
      createdAtFrom: from,
      createdAtTo: to,
    });
    const filename =
      from === to ? `orders_${from}` : `orders_${from}_to_${to}`;
    sendSpreadsheetExport(res, buffer, filename, 'xlsx');
  } catch (error) {
    console.error('Orders report export error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate orders report',
    });
  }
}
