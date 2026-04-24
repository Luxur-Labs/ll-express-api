import { Router } from 'express';
import { authenticate, authorizeRoles } from '../middleware/auth.middleware';
import {
  previewBillingInvoiceController,
  finalizeBillingInvoiceController,
  getBillingLedgerController,
  listBillingInvoicesController,
  listPendingInvoicesController,
  getBillingClinicSummaryController,
  getBillingOverallSummaryController,
  getBillingInvoiceController,
  cancelBillingInvoiceController,
  patchBillingInvoicePaymentController,
  createRazorpayInvoiceOrderController,
  verifyRazorpayInvoicePaymentController,
} from '../controllers/billing.controller';

const router = Router();

router.use(authenticate);
router.use(authorizeRoles('SUPER_ADMIN'));

router.post('/invoices/preview', previewBillingInvoiceController);
router.post('/invoices', finalizeBillingInvoiceController);
router.get('/invoices/pending', listPendingInvoicesController);
router.get('/invoices/:id', getBillingInvoiceController);
router.post('/invoices/:id/cancel', cancelBillingInvoiceController);
router.patch('/invoices/:id/payment', patchBillingInvoicePaymentController);
router.post('/invoices/:id/razorpay/order', createRazorpayInvoiceOrderController);
router.post('/invoices/:id/razorpay/verify', verifyRazorpayInvoicePaymentController);
router.get('/summary', getBillingOverallSummaryController);
router.get('/clinics/:clinicId/invoices', listBillingInvoicesController);
router.get('/clinics/:clinicId/ledger', getBillingLedgerController);
router.get('/clinics/:clinicId/summary', getBillingClinicSummaryController);

export default router;
