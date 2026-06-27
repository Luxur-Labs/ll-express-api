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

export async function exportTodayOrdersReportController(_req: Request, res: Response) {
  try {
    const today = formatYmd(new Date());
    const buffer = await orderExportService.exportImportFormat('xlsx', {
      createdAtFrom: today,
      createdAtTo: today,
    });
    sendSpreadsheetExport(res, buffer, `orders_today_${today}`, 'xlsx');
  } catch (error) {
    console.error('Today orders report export error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate today orders report',
    });
  }
}
