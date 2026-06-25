import { Router } from 'express';

import { 
  addEmployeeTypeController, 
  addTechnicianGroupController, 
  listEmployeeTypesController, 
  listTechnicianGroupsController, 
  updateTechnicianGroupController, 
  deleteTechnicianGroupController 
} from '../controllers/admin.controller';
import multer from 'multer';
import { authenticate, authorizeRoles } from '../middleware/auth.middleware';
import { ADMIN_ROLES } from '../config/permissions';
import { validate } from '../middleware/validate.middleware';
import { 
  updateTechnicianGroupSchema, 
  deleteTechnicianGroupSchema 
} from '../schemas/auth.schema';

const router = Router();
const upload = multer();

const adminRoles = [...ADMIN_ROLES] as Parameters<typeof authorizeRoles>;

// Employee Types (SUPER_ADMIN)
router.get('/employee-types', authenticate, authorizeRoles('SUPER_ADMIN'), listEmployeeTypesController);
router.post('/employee-types', authenticate, authorizeRoles('SUPER_ADMIN'), addEmployeeTypeController);

// Technician Groups — read for ops leads, manage for SUPER_ADMIN
router.get('/technician-groups', authenticate, authorizeRoles(...adminRoles), listTechnicianGroupsController);
router.post('/technician-groups', authenticate, authorizeRoles('SUPER_ADMIN'), addTechnicianGroupController);
router.put('/technician-groups/:id', authenticate, authorizeRoles('SUPER_ADMIN'), upload.none(), validate(updateTechnicianGroupSchema), updateTechnicianGroupController);
router.delete('/technician-groups/:id', authenticate, authorizeRoles('SUPER_ADMIN'), validate(deleteTechnicianGroupSchema), deleteTechnicianGroupController);

export default router;
