import { Router } from 'express';
import { authenticate, authorizePermissions, authorizeRoles } from '../middleware/auth.middleware';
import { ADMIN_ROLES } from '../config/permissions';
import {
  updateOrderStatusController,
  createOrderTransitionController,
  getOrderWithStatusController,
  getOrdersByStatusController,
  getStatusInfoController
} from '../controllers/orderStatus.controller';

const router = Router();
const adminRoles = [...ADMIN_ROLES] as Parameters<typeof authorizeRoles>;

router.use(authenticate);

router.get(
  '/info',
  authorizeRoles(...adminRoles),
  authorizePermissions('orders.view'),
  getStatusInfoController,
);

router.get(
  '/orders',
  authorizeRoles(...adminRoles),
  authorizePermissions('orders.view'),
  getOrdersByStatusController,
);

router.get(
  '/orders/:orderId',
  authorizeRoles(...adminRoles),
  authorizePermissions('orders.view'),
  getOrderWithStatusController,
);

router.put(
  '/orders/:orderId/status',
  authorizeRoles(...adminRoles),
  updateOrderStatusController,
);

router.post(
  '/orders/:orderId/transition',
  authorizeRoles(...adminRoles),
  authorizePermissions('orders.status.production'),
  createOrderTransitionController,
);

export default router;
