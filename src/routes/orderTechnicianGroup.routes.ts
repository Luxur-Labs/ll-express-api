import { Router } from 'express';
import { authenticate, authorizeRoles } from '../middleware/auth.middleware';
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

// All routes require authentication and SUPER_ADMIN role
router.use(authenticate);
router.use(authorizeRoles('SUPER_ADMIN'));

// Assign order to technician group
router.post('/assign', assignOrderToTechnicianGroupController);

// Get assignments for a specific order
router.get('/order/:orderId', getOrderAssignmentsController);

// Get orders assigned to a specific technician group
router.get('/technician-group/:technicianGroupId/orders', getTechnicianGroupOrdersController);

// Update an assignment
router.put('/assignment/:assignmentId', updateAssignmentController);

// Remove a specific assignment
router.delete('/assignment/:assignmentId', removeAssignmentController);

// Remove all assignments for an order
router.delete('/order/:orderId/all', removeAllOrderAssignmentsController);

// Get assignment statistics
router.get('/stats', getAssignmentStatsController);

export default router;

