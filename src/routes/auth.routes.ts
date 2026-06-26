import { Router } from 'express';

import { loginController, meController, forgotPasswordController, logoutController, changePasswordController } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
import {
  authRateLimiter,
  speedLimiter,
  forgotPasswordRateLimiter,
} from '../middleware/rateLimiter.middleware';
import { validate } from '../middleware/validate.middleware';
import { loginSchema, forgotPasswordSchema, changePasswordSchema } from '../schemas/auth.schema';

const router = Router();

router.post('/login', authRateLimiter, speedLimiter, validate(loginSchema), loginController);
router.post('/logout', authenticate, logoutController);
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
