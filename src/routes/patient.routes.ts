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
import { authenticate, authorizeRoles } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { createPatientSchema, updatePatientSchema, ageRangeQuerySchema, searchByNameQuerySchema } from '../schemas/patient.schema';

const router = Router();

// All patient routes require SUPER_ADMIN role
router.use(authenticate);
router.use(authorizeRoles('SUPER_ADMIN'));

// CRUD operations for patients
router.post('/', validate(createPatientSchema), createPatientController);
router.get('/', getAllPatientsController);
router.get('/list', getPatientsListController);
router.get('/search', validate(searchByNameQuerySchema), searchPatientsByNameController);
router.get('/gender/:gender', getPatientsByGenderController);
router.get('/age-range', validate(ageRangeQuerySchema), getPatientsByAgeRangeController);
router.get('/:id', getPatientByIdController);
router.put('/:id', validate(updatePatientSchema), updatePatientController);
router.delete('/:id', deletePatientController);

export default router;
