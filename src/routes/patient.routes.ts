import { Router } from 'express';

import {
  createPatientController,
  getPatientByIdController,
  getAllPatientsController,
  updatePatientController,
  deletePatientController,
  getPatientsByGenderController,
  getPatientsByAgeRangeController,
  searchPatientsByNameController,
  getPatientsListController,
} from '../controllers/patient.controller';
import { authenticate, authorizePermissions, authorizeRoles } from '../middleware/auth.middleware';
import { ADMIN_ROLES } from '../config/permissions';
import { validate } from '../middleware/validate.middleware';
import { createPatientSchema, updatePatientSchema, ageRangeQuerySchema, searchByNameQuerySchema } from '../schemas/patient.schema';

const router = Router();

const adminRoles = [...ADMIN_ROLES] as Parameters<typeof authorizeRoles>;

router.use(authenticate);

router.get('/', authorizeRoles(...adminRoles), getAllPatientsController);
router.get('/list', authorizeRoles(...adminRoles), getPatientsListController);
router.get('/search', authorizeRoles(...adminRoles), validate(searchByNameQuerySchema), searchPatientsByNameController);
router.get('/gender/:gender', authorizeRoles(...adminRoles), getPatientsByGenderController);
router.get('/age-range', authorizeRoles(...adminRoles), validate(ageRangeQuerySchema), getPatientsByAgeRangeController);
router.get('/:id', authorizeRoles(...adminRoles), getPatientByIdController);

router.post('/', authorizePermissions('orders.create'), validate(createPatientSchema), createPatientController);
router.put('/:id', authorizePermissions('orders.update'), validate(updatePatientSchema), updatePatientController);
router.delete('/:id', authorizePermissions('orders.delete'), deletePatientController);

export default router;
