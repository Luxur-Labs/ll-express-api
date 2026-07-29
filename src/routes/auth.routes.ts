import { Router } from 'express';

import { loginController, meController, forgotPasswordController, logoutController, changePasswordController, refreshController } from '../controllers/auth.controller';
import {
  clinicAccountStatusController,
  clinicPasswordLoginController,
  clinicRequestOtpController,
  clinicResetPasswordController,
  clinicSetPasswordController,
  clinicVerifyOtpController,
} from '../controllers/clinicAuth.controller';
import { authenticate } from '../middleware/auth.middleware';
import {
  authRateLimiter,
  speedLimiter,
  forgotPasswordRateLimiter,
} from '../middleware/rateLimiter.middleware';
import { validate } from '../middleware/validate.middleware';
import { loginSchema, forgotPasswordSchema, changePasswordSchema, refreshTokenSchema, logoutSchema } from '../schemas/auth.schema';
import {
  clinicAccountStatusSchema,
  clinicPasswordLoginSchema,
  clinicRequestOtpSchema,
  clinicResetPasswordSchema,
  clinicSetPasswordSchema,
  clinicVerifyOtpSchema,
} from '../schemas/clinicAuth.schema';

const router = Router();

router.post('/login', authRateLimiter, speedLimiter, validate(loginSchema), loginController);
router.get(
  '/clinic/account-status',
  validate(clinicAccountStatusSchema),
  clinicAccountStatusController,
);
router.post(
  '/clinic/request-otp',
  forgotPasswordRateLimiter,
  validate(clinicRequestOtpSchema),
  clinicRequestOtpController,
);
router.post(
  '/clinic/verify-otp',
  authRateLimiter,
  validate(clinicVerifyOtpSchema),
  clinicVerifyOtpController,
);
router.post(
  '/clinic/login',
  authRateLimiter,
  validate(clinicPasswordLoginSchema),
  clinicPasswordLoginController,
);
router.post(
  '/clinic/set-password',
  authenticate,
  validate(clinicSetPasswordSchema),
  clinicSetPasswordController,
);
router.post(
  '/clinic/reset-password',
  authRateLimiter,
  validate(clinicResetPasswordSchema),
  clinicResetPasswordController,
);
router.post('/refresh', authRateLimiter, validate(refreshTokenSchema), refreshController);
router.post('/logout', authenticate, validate(logoutSchema), logoutController);
router.post(
  '/change-password',
  authenticate,
  validate(changePasswordSchema),
  changePasswordController
);
router.post(
  '/forgot-password',
  forgotPasswordRateLimiter,
  validate(forgotPasswordSchema),
  forgotPasswordController
);
router.get('/me', authenticate, meController);

export default router;
