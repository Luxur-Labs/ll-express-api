import { Router } from 'express';
 
import { addEmployeeTypeController, addTechnicianGroupController, listTypesController } from '../controllers/admin.controller';
import { loginController, meController, forgotPasswordController } from '../controllers/auth.controller';
import { validate } from '../middleware/validate.middleware';
import { loginSchema, forgotPasswordSchema } from '../schemas/auth.schema';
import { healthController } from '../controllers/health.controller'; 
import { listUsersController, createUserController, updateUserController, deleteUserController } from '../controllers/user.controller';
import { authenticate, authorizeRoles } from '../middleware/auth.middleware';
import { authRateLimiter, speedLimiter, forgotPasswordRateLimiter } from '../middleware/rateLimiter.middleware';
 
const router = Router(); 
 
router.get('/health', healthController); 

// Auth routes with rate limiting
router.post('/auth/login', authRateLimiter, speedLimiter, validate(loginSchema), loginController);
router.post('/auth/forgot-password', forgotPasswordRateLimiter, validate(forgotPasswordSchema), forgotPasswordController);
router.get('/auth/me', authenticate, meController);

// Admin: only Super Admin may manage sub types
router.get('/admin/types', authenticate, authorizeRoles('SUPER_ADMIN'), listTypesController);
router.post('/admin/employee-types', authenticate, authorizeRoles('SUPER_ADMIN'), addEmployeeTypeController);
router.post('/admin/technician-groups', authenticate, authorizeRoles('SUPER_ADMIN'), addTechnicianGroupController);

// Users (SUPER_ADMIN)
router.get('/users', authenticate, authorizeRoles('SUPER_ADMIN'), listUsersController);
router.post('/users', authenticate, authorizeRoles('SUPER_ADMIN'), createUserController);
router.put('/users/:id', authenticate, authorizeRoles('SUPER_ADMIN'), updateUserController);
router.delete('/users/:id', authenticate, authorizeRoles('SUPER_ADMIN'), deleteUserController);
 
export default router;
