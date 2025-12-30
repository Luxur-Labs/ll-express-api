import { Router } from 'express';
import { authenticate, authorizeRoles } from '../middleware/auth.middleware';
import { getOrderTransitionsController, getOrderTimelineController } from '../controllers/orderTransition.controller';

const router = Router();

// Apply authentication and authorization to all routes
router.use(authenticate);
router.use(authorizeRoles('SUPER_ADMIN', 'DOCTOR', 'EMPLOYEE'));

// Get transitions for a specific order
router.get('/order/:orderId', getOrderTransitionsController);

// Get order timeline (transitions + order creation)
router.get('/timeline/:orderId', getOrderTimelineController);

export default router;

