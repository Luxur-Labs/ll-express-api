import { Router } from 'express';

import {
  createProductController,
  getProductByIdController,
  getAllProductsController,
  updateProductController,
  deleteProductController,
  getProductsByWorkTypeController,
  getProductsByPriceRangeController,
} from '../controllers/product.controller';
import { authenticate, authorizeRoles } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { createProductSchema, updateProductSchema, priceRangeQuerySchema } from '../schemas/product.schema';

const router = Router();

// All product routes require SUPER_ADMIN role
router.use(authenticate);
router.use(authorizeRoles('SUPER_ADMIN'));

// CRUD operations for products
router.post('/', validate(createProductSchema), createProductController);
router.get('/', getAllProductsController);
router.get('/work-type/:workType', getProductsByWorkTypeController);
router.get('/price-range', validate(priceRangeQuerySchema), getProductsByPriceRangeController);
router.get('/:id', getProductByIdController);
router.put('/:id', validate(updateProductSchema), updateProductController);
router.delete('/:id', deleteProductController);

export default router;
