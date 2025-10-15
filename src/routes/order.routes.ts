import { Router } from 'express';

import {
  createOrderController,
  getOrderByIdController,
  getOrderByInvoiceNumberController,
  getAllOrdersController,
  updateOrderController,
  deleteOrderController,
  getOrdersByPatientController,
  getOrdersByDoctorController,
  getOrdersByClinicController,
  getOrdersByPartnerController,
  getOrdersByScanningModeController,
  getOrdersByDateRangeController,
} from '../controllers/order.controller';
import { authenticate, authorizeRoles } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { createOrderSchema, updateOrderSchema, dateRangeQuerySchema } from '../schemas/order.schema';

const router = Router();

// All order routes require SUPER_ADMIN role
router.use(authenticate);
router.use(authorizeRoles('SUPER_ADMIN'));

// CRUD operations for orders
router.post('/', validate(createOrderSchema), createOrderController);
router.get('/', getAllOrdersController);
router.get('/invoice/:invoiceNumber', getOrderByInvoiceNumberController);
router.get('/patient/:patientId', getOrdersByPatientController);
router.get('/doctor/:doctorId', getOrdersByDoctorController);
router.get('/clinic/:clinicId', getOrdersByClinicController);
router.get('/partner/:partner', getOrdersByPartnerController);
router.get('/scanning-mode/:scanningMode', getOrdersByScanningModeController);
router.get('/date-range', validate(dateRangeQuerySchema), getOrdersByDateRangeController);
router.get('/:id', getOrderByIdController);
router.put('/:id', validate(updateOrderSchema), updateOrderController);
router.delete('/:id', deleteOrderController);

export default router;
