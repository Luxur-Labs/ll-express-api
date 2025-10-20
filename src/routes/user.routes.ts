import { Router } from 'express';

import { 
  listUsersController, 
  listEmployeesController, 
  createUserController, 
  updateUserController, 
  deleteUserController
} from '../controllers/user.controller';
import multer from 'multer';
import { authenticate, authorizeRoles } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { updateUserSchema } from '../schemas/auth.schema';

const router = Router();
const upload = multer();

// Users (SUPER_ADMIN)
router.get('/', authenticate, authorizeRoles('SUPER_ADMIN'), listUsersController);
router.get('/employees', authenticate, authorizeRoles('SUPER_ADMIN'), listEmployeesController);
router.post(
  '/',
  authenticate,
  authorizeRoles('SUPER_ADMIN'),
  upload.fields([
    { name: 'document', maxCount: 1 },
    { name: 'profilePhoto', maxCount: 1 },
  ]),
  createUserController
);
router.put('/:id', authenticate, authorizeRoles('SUPER_ADMIN'), upload.none(), validate(updateUserSchema), updateUserController);
router.delete('/:id', authenticate, authorizeRoles('SUPER_ADMIN'), deleteUserController);

export default router;
