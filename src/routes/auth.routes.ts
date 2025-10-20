import { Router } from 'express';

import { loginController, meController, forgotPasswordController, logoutController } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authRateLimiter, speedLimiter, forgotPasswordRateLimiter } from '../middleware/rateLimiter.middleware';
import { validate } from '../middleware/validate.middleware';
import { loginSchema, forgotPasswordSchema } from '../schemas/auth.schema';

const router = Router();

// Auth routes with rate limiting
router.post('/login', authRateLimiter, speedLimiter, validate(loginSchema), loginController);
router.post('/logout', authenticate, logoutController);
router.post('/forgot-password', forgotPasswordRateLimiter, validate(forgotPasswordSchema), forgotPasswordController);
router.get('/me', authenticate, meController);

export default router;
