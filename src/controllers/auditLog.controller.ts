import { Request, Response } from 'express';

import { listAuditLogs } from '../services/auditLog.service';
import { AuditActionType } from '../types/audit';

export async function listAuditLogsController(req: Request, res: Response) {
  try {
    const {
      page,
      limit,
      entityType,
      entityId,
      userId,
      action,
      from,
      to,
    } = req.query as Record<string, string | undefined>;

    const result = await listAuditLogs({
      page: page ? parseInt(page, 10) : 0,
      limit: limit ? parseInt(limit, 10) : 50,
      entityType,
      entityId,
      userId,
      action: action as AuditActionType | undefined,
      from,
      to,
    });

    return res.json(result);
  } catch (error) {
    console.error('Error listing audit logs:', error);
    return res.status(500).json({ message: 'Failed to load audit logs' });
  }
}
