import { Router } from 'express';

import { healthController } from '../controllers/health.controller'; 
import { getDoctorsListController } from '../controllers/user.controller';
import { getDashboardController, exportTodayOrdersReportController } from '../controllers/dashboard.controller';
import { authenticate, authorizeRoles } from '../middleware/auth.middleware';
import { ADMIN_ROLES } from '../config/permissions';

import clinicRoutes from './clinic.routes';
import productRoutes from './product.routes';
import patientRoutes from './patient.routes';
import orderRoutes from './order.routes';
import billingRoutes from './billing.routes';
import userRoutes from './user.routes';
import adminRoutes from './admin.routes';
import authRoutes from './auth.routes';
import orderTechnicianGroupRoutes from './orderTechnicianGroup.routes';
import orderStatusRoutes from './orderStatus.routes';
import auditLogRoutes from './auditLog.routes';
 
const router = Router();
 
const adminRoles = [...ADMIN_ROLES] as Parameters<typeof authorizeRoles>;

router.get('/health', healthController); 

// Dashboard — all admin profiles
router.get('/dashboard', authenticate, authorizeRoles(...adminRoles), getDashboardController);
router.get(
  '/dashboard/today-orders-report',
  authenticate,
  authorizeRoles(...adminRoles),
  exportTodayOrdersReportController,
);

// Auth routes
router.use('/auth', authRoutes);

// Admin routes (employee-types, technician-groups)
router.use('/admin', adminRoutes);

// Order-Technician Group assignment routes
router.use('/order-technician-groups', orderTechnicianGroupRoutes);
router.use('/order-status', orderStatusRoutes);

// User routes
router.use('/users', userRoutes);

// Doctors list — admin profiles (order forms)
router.get('/doctors/list', authenticate, authorizeRoles(...adminRoles), getDoctorsListController);

// Other entity routes
router.use('/clinics', clinicRoutes);
router.use('/products', productRoutes);
router.use('/patients', patientRoutes);
router.use('/orders', orderRoutes);
router.use('/audit-logs', auditLogRoutes);
router.use('/billing', billingRoutes);
 
export default router;
