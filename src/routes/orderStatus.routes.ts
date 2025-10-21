import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
  updateOrderStatusController,
  createOrderTransitionController,
  getOrderWithStatusController,
  getOrdersByStatusController,
  getStatusInfoController
} from '../controllers/orderStatus.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route GET /api/v1/order-status/info
 * @desc Get available statuses and transitions
 * @access Private
 */
router.get('/info', getStatusInfoController);

/**
 * @route GET /api/v1/order-status/orders
 * @desc Get orders filtered by application status
 * @access Private
 */
router.get('/orders', getOrdersByStatusController);

/**
 * @route GET /api/v1/order-status/orders/:orderId
 * @desc Get order with both application status and transition history
 * @access Private
 */
router.get('/orders/:orderId', getOrderWithStatusController);

/**
 * @route PUT /api/v1/order-status/orders/:orderId/status
 * @desc Update order status (application level)
 * @access Private
 */
router.put('/orders/:orderId/status', updateOrderStatusController);

/**
 * @route POST /api/v1/order-status/orders/:orderId/transition
 * @desc Create order transition (database level)
 * @access Private
 */
router.post('/orders/:orderId/transition', createOrderTransitionController);

export default router;
