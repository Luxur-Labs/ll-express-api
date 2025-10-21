import { Request, Response } from 'express';

import { DashboardService } from '../services/dashboard.service';

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
