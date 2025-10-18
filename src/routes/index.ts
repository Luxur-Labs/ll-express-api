import { Router } from 'express';
 
import { addEmployeeTypeController, addTechnicianGroupController, listEmployeeTypesController, listTechnicianGroupsController } from '../controllers/admin.controller';
import { loginController, meController, forgotPasswordController, logoutController } from '../controllers/auth.controller';
import { healthController } from '../controllers/health.controller'; 
import { listUsersController, listEmployeesController, createUserController, updateUserController, deleteUserController, getDoctorsListController } from '../controllers/user.controller';
import multer from 'multer';
import { authenticate, authorizeRoles } from '../middleware/auth.middleware';
import { authRateLimiter, speedLimiter, forgotPasswordRateLimiter } from '../middleware/rateLimiter.middleware';
import { validate } from '../middleware/validate.middleware';
import { loginSchema, forgotPasswordSchema } from '../schemas/auth.schema';

import clinicRoutes from './clinic.routes';
import productRoutes from './product.routes';
import patientRoutes from './patient.routes';
import orderRoutes from './order.routes';
 
const router = Router(); 
const upload = multer();
 
router.get('/health', healthController); 

// Auth routes with rate limiting
router.post('/auth/login', authRateLimiter, speedLimiter, validate(loginSchema), loginController);
router.post('/auth/logout', authenticate, logoutController);
router.post('/auth/forgot-password', forgotPasswordRateLimiter, validate(forgotPasswordSchema), forgotPasswordController);
router.get('/auth/me', authenticate, meController);

// Admin: only Super Admin may manage sub types
// Removed combined types endpoint in favor of dedicated endpoints below
router.get('/admin/employee-types', authenticate, authorizeRoles('SUPER_ADMIN'), listEmployeeTypesController);
router.get('/admin/technician-groups', authenticate, authorizeRoles('SUPER_ADMIN'), listTechnicianGroupsController);
router.post('/admin/employee-types', authenticate, authorizeRoles('SUPER_ADMIN'), addEmployeeTypeController);
router.post('/admin/technician-groups', authenticate, authorizeRoles('SUPER_ADMIN'), addTechnicianGroupController);

// Users (SUPER_ADMIN)
router.get('/users', authenticate, authorizeRoles('SUPER_ADMIN'), listUsersController);
router.get('/users/employees', authenticate, authorizeRoles('SUPER_ADMIN'), listEmployeesController);
router.post(
  '/users',
  authenticate,
  authorizeRoles('SUPER_ADMIN'),
  upload.fields([
    { name: 'document', maxCount: 1 },
    { name: 'profilePhoto', maxCount: 1 },
  ]),
  createUserController
);
router.put('/users/:id', authenticate, authorizeRoles('SUPER_ADMIN'), updateUserController);
router.delete('/users/:id', authenticate, authorizeRoles('SUPER_ADMIN'), deleteUserController);

// Doctors (SUPER_ADMIN)
router.get('/doctors/list', authenticate, authorizeRoles('SUPER_ADMIN'), getDoctorsListController);

// Clinics (SUPER_ADMIN)
router.use('/clinics', clinicRoutes);

// Products (SUPER_ADMIN)
router.use('/products', productRoutes);

// Patients (SUPER_ADMIN)
router.use('/patients', patientRoutes);

// Orders (SUPER_ADMIN)
router.use('/orders', orderRoutes);
 
export default router;
