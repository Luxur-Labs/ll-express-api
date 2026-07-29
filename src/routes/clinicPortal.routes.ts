import { Router } from 'express';

import { authenticate, authorizeRoles } from '../middleware/auth.middleware';
import { requireClinicPortalReady } from '../middleware/clinicPortal.middleware';
import {
  clinicPortalCreateRazorpayOrderController,
  clinicPortalInvoiceCountsController,
  clinicPortalInvoicesController,
  clinicPortalMeController,
  clinicPortalOpenInvoicesController,
  clinicPortalOrdersController,
  clinicPortalPaymentOptionsController,
  clinicPortalVerifyRazorpayController,
} from '../controllers/clinicPortal.controller';

const router = Router();

router.use(authenticate, authorizeRoles('CLINIC'), requireClinicPortalReady);

router.get('/me', clinicPortalMeController);
router.get('/invoices/counts', clinicPortalInvoiceCountsController);
router.get('/invoices', clinicPortalInvoicesController);
router.get('/orders', clinicPortalOrdersController);
router.get('/payments/options', clinicPortalPaymentOptionsController);
router.get('/payments/open-invoices', clinicPortalOpenInvoicesController);
router.post('/payments/razorpay/order', clinicPortalCreateRazorpayOrderController);
router.post('/payments/razorpay/verify', clinicPortalVerifyRazorpayController);

export default router;
