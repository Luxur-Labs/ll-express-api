import { Router } from 'express';
import { authenticate, authorizeRoles } from '../middleware/auth.middleware';
import {
  previewBillingInvoiceController,
  previewOrderInvoicePrintController,
  finalizeBillingInvoiceController,
  getBillingLedgerController,
  listBillingInvoicesController,
  listPendingInvoicesController,
  getBillingClinicSummaryController,
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

router.use(authenticate);
router.use(authorizeRoles('SUPER_ADMIN'));

router.post('/invoices/preview', previewBillingInvoiceController);
router.get('/orders/:orderId/invoice-print-preview', previewOrderInvoicePrintController);
router.post('/invoices', finalizeBillingInvoiceController);
router.get('/invoices/pending', listPendingInvoicesController);
router.get('/invoices/:id', getBillingInvoiceController);
router.post('/invoices/:id/cancel', cancelBillingInvoiceController);
router.patch('/invoices/:id/payment', patchBillingInvoicePaymentController);
router.post('/invoices/:id/payments/cash', recordCashPaymentOnInvoiceController);
router.post('/invoices/:id/payments/line-amount', suggestLinePaymentAmountController);
router.post('/invoices/:id/razorpay/order', createRazorpayInvoiceOrderController);
router.post('/invoices/:id/razorpay/verify', verifyRazorpayInvoicePaymentController);
router.get('/clinics/:clinicId/invoices/open', listOpenInvoicesForClinicController);
router.post('/clinics/:clinicId/payments/cash', recordClinicMultiCashController);
router.post('/clinics/:clinicId/razorpay/order', createRazorpayClinicOrderController);
router.post('/clinics/:clinicId/razorpay/verify', verifyRazorpayClinicPaymentController);
router.get('/summary', getBillingOverallSummaryController);
router.get('/clinics/:clinicId/invoices/counts', getBillingClinicInvoiceCountsController);
router.get('/clinics/:clinicId/invoices', listBillingInvoicesController);
router.get('/clinics/:clinicId/ledger', getBillingLedgerController);
router.get('/clinics/:clinicId/summary', getBillingClinicSummaryController);

export default router;
