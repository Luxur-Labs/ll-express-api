import { Router } from 'express';

import {
  createClinicController,
  getClinicByIdController,
  getAllClinicsController,
  updateClinicController,
  deleteClinicController,
  getClinicsByOrganizationController,
} from '../controllers/clinic.controller';
import { authenticate, authorizeRoles } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { createClinicSchema, updateClinicSchema } from '../schemas/clinic.schema';

const router = Router();

// All clinic routes require SUPER_ADMIN role
router.use(authenticate);
router.use(authorizeRoles('SUPER_ADMIN'));

// CRUD operations for clinics
router.post('/', validate(createClinicSchema), createClinicController);
router.get('/', getAllClinicsController);
router.get('/organization/:organizationId', getClinicsByOrganizationController);
router.get('/:id', getClinicByIdController);
router.put('/:id', validate(updateClinicSchema), updateClinicController);
router.delete('/:id', deleteClinicController);

export default router;
