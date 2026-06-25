import { Router } from 'express';
import multer from 'multer';

import {
  createClinicController,
  getClinicByIdController,
  getAllClinicsController,
  updateClinicController,
  deleteClinicController,
  getClinicsByOrganizationController,
  getClinicsListController,
  importClinicsFileController,
} from '../controllers/clinic.controller';
import { authenticate, authorizePermissions, authorizeRoles } from '../middleware/auth.middleware';
import { ADMIN_ROLES } from '../config/permissions';
import { validate } from '../middleware/validate.middleware';
import { createClinicSchema, updateClinicSchema } from '../schemas/clinic.schema';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const adminRoles = [...ADMIN_ROLES] as Parameters<typeof authorizeRoles>;

router.use(authenticate);

router.post('/import/file', authorizePermissions('clinics.import'), upload.single('file'), importClinicsFileController);

router.get('/', authorizeRoles(...adminRoles), getAllClinicsController);
router.get('/list', authorizeRoles(...adminRoles), getClinicsListController);
router.get('/organization/:organizationId', authorizeRoles(...adminRoles), getClinicsByOrganizationController);
router.get('/:id', authorizeRoles(...adminRoles), getClinicByIdController);

router.post('/', authorizePermissions('clinics.manage'), validate(createClinicSchema), createClinicController);
router.put('/:id', authorizePermissions('clinics.manage'), validate(updateClinicSchema), updateClinicController);
router.delete('/:id', authorizePermissions('clinics.manage'), deleteClinicController);

export default router;
