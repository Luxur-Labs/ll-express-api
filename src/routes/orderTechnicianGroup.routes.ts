import { Router } from 'express';
import { authenticate, authorizePermissions, authorizeRoles } from '../middleware/auth.middleware';
import { ADMIN_ROLES } from '../config/permissions';
import {
  assignOrderToTechnicianGroupController,
  getOrderAssignmentsController,
  getTechnicianGroupOrdersController,
  updateAssignmentController,
  removeAssignmentController,
  removeAllOrderAssignmentsController,
  getAssignmentStatsController,
} from '../controllers/orderTechnicianGroup.controller';

const router = Router();

const adminRoles = [...ADMIN_ROLES] as Parameters<typeof authorizeRoles>;

router.use(authenticate);

router.post('/assign', authorizePermissions('orders.assign'), assignOrderToTechnicianGroupController);
router.get('/order/:orderId', authorizeRoles(...adminRoles), getOrderAssignmentsController);
router.get('/technician-group/:technicianGroupId/orders', authorizeRoles(...adminRoles), getTechnicianGroupOrdersController);
router.put('/assignment/:assignmentId', authorizePermissions('orders.assign'), updateAssignmentController);
router.delete('/assignment/:assignmentId', authorizePermissions('orders.assign'), removeAssignmentController);
router.delete('/order/:orderId/all', authorizePermissions('orders.assign'), removeAllOrderAssignmentsController);
router.get('/stats', authorizeRoles('SUPER_ADMIN', 'LAB_MANAGER'), getAssignmentStatsController);

export default router;
