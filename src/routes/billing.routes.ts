import { Router } from 'express';
import { authenticate, authorizePermissions, authorizeRoles } from '../middleware/auth.middleware';
import { ADMIN_ROLES } from '../config/permissions';
import {
  previewBillingInvoiceController,
  previewOrderInvoicePrintController,
  finalizeBillingInvoiceController,
  getBillingLedgerController,
  listBillingInvoicesController,
  listPendingInvoicesController,
  getBillingClinicSummaryController,
  getBillingAllClinicsSummaryController,
  getBillingClinicInvoiceCountsController,
  getBillingOverallSummaryController,
  getBillingInvoiceController,
  cancelBillingInvoiceController,
  patchBillingInvoicePaymentController,
  createRazorpayInvoiceOrderController,
  verifyRazorpayInvoicePaymentController,
  recordCashPaymentOnInvoiceController,
  suggestLinePaymentAmountController,
  listOpenInvoicesForClinicController,
  recordClinicMultiCashController,
  createRazorpayClinicOrderController,
  verifyRazorpayClinicPaymentController,
} from '../controllers/billing.controller';

const router = Router();

const adminRoles = [...ADMIN_ROLES] as Parameters<typeof authorizeRoles>;

router.use(authenticate);

// Preview & read — SUPER_ADMIN + FRONT_OFFICE
router.post('/invoices/preview', authorizePermissions('billing.preview'), previewBillingInvoiceController);
router.get('/orders/:orderId/invoice-print-preview', authorizePermissions('billing.preview'), previewOrderInvoicePrintController);
router.get('/invoices/:id', authorizePermissions('billing.view'), getBillingInvoiceController);
router.get('/clinics/:clinicId/invoices/counts', authorizePermissions('billing.view'), getBillingClinicInvoiceCountsController);
router.get('/clinics/:clinicId/invoices', authorizePermissions('billing.view'), listBillingInvoicesController);

// Full billing — SUPER_ADMIN only
router.post('/invoices', authorizePermissions('billing.manage'), finalizeBillingInvoiceController);
router.get('/invoices/pending', authorizePermissions('billing.manage'), listPendingInvoicesController);
router.post('/invoices/:id/cancel', authorizePermissions('billing.manage'), cancelBillingInvoiceController);
router.patch('/invoices/:id/payment', authorizePermissions('billing.payments'), patchBillingInvoicePaymentController);
router.post('/invoices/:id/payments/cash', authorizePermissions('billing.payments'), recordCashPaymentOnInvoiceController);
router.post('/invoices/:id/payments/line-amount', authorizePermissions('billing.payments'), suggestLinePaymentAmountController);
router.post('/invoices/:id/razorpay/order', authorizePermissions('billing.payments'), createRazorpayInvoiceOrderController);
router.post('/invoices/:id/razorpay/verify', authorizePermissions('billing.payments'), verifyRazorpayInvoicePaymentController);
router.get('/clinics/:clinicId/invoices/open', authorizePermissions('billing.manage'), listOpenInvoicesForClinicController);
router.post('/clinics/:clinicId/payments/cash', authorizePermissions('billing.payments'), recordClinicMultiCashController);
router.post('/clinics/:clinicId/razorpay/order', authorizePermissions('billing.payments'), createRazorpayClinicOrderController);
router.post('/clinics/:clinicId/razorpay/verify', authorizePermissions('billing.payments'), verifyRazorpayClinicPaymentController);
router.get('/summary', authorizePermissions('dashboard.billing'), getBillingOverallSummaryController);
router.get('/all/summary', authorizePermissions('billing.manage'), getBillingAllClinicsSummaryController);
router.get('/clinics/:clinicId/ledger', authorizePermissions('billing.manage'), getBillingLedgerController);
router.get('/clinics/:clinicId/summary', authorizePermissions('billing.manage'), getBillingClinicSummaryController);

export default router;
