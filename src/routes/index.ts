import { Router } from 'express';

import { healthController } from '../controllers/health.controller'; 
import { getDoctorsListController } from '../controllers/user.controller';
import { getDashboardController } from '../controllers/dashboard.controller';
import { authenticate, authorizeRoles } from '../middleware/auth.middleware';

import clinicRoutes from './clinic.routes';
import productRoutes from './product.routes';
import patientRoutes from './patient.routes';
import orderRoutes from './order.routes';
import userRoutes from './user.routes';
import adminRoutes from './admin.routes';
import authRoutes from './auth.routes';
import orderTechnicianGroupRoutes from './orderTechnicianGroup.routes';
import orderStatusRoutes from './orderStatus.routes';
 
const router = Router();
 
router.get('/health', healthController); 

// Dashboard (SUPER_ADMIN only)
router.get('/dashboard', authenticate, authorizeRoles('SUPER_ADMIN'), getDashboardController);

// Auth routes
router.use('/auth', authRoutes);

// Admin routes (employee-types, technician-groups)
router.use('/admin', adminRoutes);

// Order-Technician Group assignment routes
router.use('/order-technician-groups', orderTechnicianGroupRoutes);
router.use('/order-status', orderStatusRoutes);

// User routes
router.use('/users', userRoutes);

// Doctors (SUPER_ADMIN) - kept in main routes as requested
router.get('/doctors/list', authenticate, authorizeRoles('SUPER_ADMIN'), getDoctorsListController);

// Other entity routes
router.use('/clinics', clinicRoutes);
router.use('/products', productRoutes);
router.use('/patients', patientRoutes);
router.use('/orders', orderRoutes);
 
export default router;
