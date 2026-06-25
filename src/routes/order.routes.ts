import { Router } from 'express';
import multer from 'multer';

import {
  createOrderController,
  getOrderByIdController,
  getOrderByInvoiceNumberController,
  getAllOrdersController,
  getOrdersListController,
  updateOrderController,
  updateOrderStatusController,
  addOrderActivityNoteController,
  deleteOrderController,
  getOrdersByPatientController,
  getOrdersByDoctorController,
  getOrdersByClinicController,
  getOrdersByPartnerController,
  getOrdersByScanningModeController,
  getOrdersByDateRangeController,
} from '../controllers/order.controller';
import { authenticate, authorizePermissions, authorizeRoles } from '../middleware/auth.middleware';
import { ADMIN_ROLES } from '../config/permissions';
import { validate } from '../middleware/validate.middleware';
import {
  createOrderSchema,
  updateOrderSchema,
  updateOrderStatusSchema,
  addOrderActivityNoteSchema,
  dateRangeQuerySchema,
  ordersListQuerySchema,
} from '../schemas/order.schema';
import {
  validateOrderImportController,
  commitOrderImportController,
  listOrderImportHistoryController,
  uploadOrderImportFileController,
  previewOrderImportFileController,
  listOrderImportBatchItemsController,
  retryOrderImportItemController,
} from '../controllers/orderImport.controller';
import {
  validateOrderImportSchema,
  commitOrderImportSchema,
  listOrderImportHistorySchema,
  listOrderImportBatchItemsSchema,
  retryOrderImportItemSchema,
} from '../schemas/orderImport.schema';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

const adminRoles = [...ADMIN_ROLES] as Parameters<typeof authorizeRoles>;

router.use(authenticate);

// Import — SUPER_ADMIN only
router.post('/import/preview', authorizePermissions('orders.import'), upload.single('file'), previewOrderImportFileController);
router.post('/import/file', authorizePermissions('orders.import'), upload.single('file'), uploadOrderImportFileController);
router.get('/import/batches/:batchId/items', authorizePermissions('orders.import'), validate(listOrderImportBatchItemsSchema), listOrderImportBatchItemsController);
router.post('/import/items/:itemId/retry', authorizePermissions('orders.import'), validate(retryOrderImportItemSchema), retryOrderImportItemController);
router.post('/import/validate', authorizePermissions('orders.import'), validate(validateOrderImportSchema), validateOrderImportController);
router.post('/import', authorizePermissions('orders.import'), validate(commitOrderImportSchema), commitOrderImportController);
router.get('/import/history', authorizePermissions('orders.import'), validate(listOrderImportHistorySchema), listOrderImportHistoryController);

// Read
router.get('/', authorizeRoles(...adminRoles), getAllOrdersController);
router.get('/list', authorizeRoles(...adminRoles), validate(ordersListQuerySchema), getOrdersListController);
router.get('/invoice/:invoiceNumber', authorizeRoles(...adminRoles), getOrderByInvoiceNumberController);
router.get('/patient/:patientId', authorizeRoles(...adminRoles), getOrdersByPatientController);
router.get('/doctor/:doctorId', authorizeRoles(...adminRoles), getOrdersByDoctorController);
router.get('/clinic/:clinicId', authorizeRoles(...adminRoles), getOrdersByClinicController);
router.get('/partner/:partner', authorizeRoles(...adminRoles), getOrdersByPartnerController);
router.get('/scanning-mode/:scanningMode', authorizeRoles(...adminRoles), getOrdersByScanningModeController);
router.get('/date-range', authorizeRoles(...adminRoles), validate(dateRangeQuerySchema), getOrdersByDateRangeController);
router.get('/:id', authorizeRoles(...adminRoles), getOrderByIdController);

// Create
router.post('/', authorizePermissions('orders.create'), validate(createOrderSchema), createOrderController);
router.post('/:id/activity-notes', authorizePermissions('orders.update'), validate(addOrderActivityNoteSchema), addOrderActivityNoteController);

// Update
router.put('/:id', authorizePermissions('orders.update'), validate(updateOrderSchema), updateOrderController);
router.patch('/:id/status', authorizeRoles(...adminRoles), validate(updateOrderStatusSchema), updateOrderStatusController);

// Delete — SUPER_ADMIN only
router.delete('/:id', authorizePermissions('orders.delete'), deleteOrderController);

export default router;
