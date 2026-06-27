import { Router } from 'express';
import multer from 'multer';

import {
  createProductController,
  getProductByIdController,
  getAllProductsController,
  updateProductController,
  deleteProductController,
  getProductsByPriceRangeController,
  getProductsListController,
  importProductsFileController,
  exportProductsController,
} from '../controllers/product.controller';
import { authenticate, authorizePermissions, authorizeRoles } from '../middleware/auth.middleware';
import { ADMIN_ROLES } from '../config/permissions';
import { validate } from '../middleware/validate.middleware';
import { createProductSchema, updateProductSchema, priceRangeQuerySchema } from '../schemas/product.schema';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const adminRoles = [...ADMIN_ROLES] as Parameters<typeof authorizeRoles>;

router.use(authenticate);

router.post('/import/file', authorizePermissions('products.import'), upload.single('file'), importProductsFileController);
router.get('/export', authorizePermissions('products.import'), exportProductsController);

router.get('/', authorizeRoles(...adminRoles), getAllProductsController);
router.get('/list', authorizeRoles(...adminRoles), getProductsListController);
router.get('/price-range', authorizeRoles(...adminRoles), validate(priceRangeQuerySchema), getProductsByPriceRangeController);
router.get('/:id', authorizeRoles(...adminRoles), getProductByIdController);

router.post('/', authorizePermissions('products.manage'), validate(createProductSchema), createProductController);
router.put('/:id', authorizePermissions('products.manage'), validate(updateProductSchema), updateProductController);
router.delete('/:id', authorizePermissions('products.manage'), deleteProductController);

export default router;
