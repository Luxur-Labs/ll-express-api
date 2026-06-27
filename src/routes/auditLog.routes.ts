import { Router } from 'express';

import { listAuditLogsController } from '../controllers/auditLog.controller';
import { authenticate, authorizeRoles } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);
router.get('/', authorizeRoles('SUPER_ADMIN'), listAuditLogsController);

export default router;
