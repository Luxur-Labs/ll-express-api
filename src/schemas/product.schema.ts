import { z } from 'zod';

export const createProductSchema = z.object({
  body: z.object({
    workType: z.string().min(1, 'Work type is required').max(255, 'Work type too long'),
    product: z.string().min(1, 'Product name is required').max(255, 'Product name too long'),
    warranty: z.string().min(1, 'Warranty is required').max(255, 'Warranty description too long'),
    price: z.number().min(0, 'Price must be a positive number').max(999999.99, 'Price too high'),
    discount: z.number().min(0, 'Discount cannot be negative').max(100, 'Discount cannot exceed 100%').optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const updateProductSchema = z.object({
  body: z.object({
    workType: z.string().min(1, 'Work type is required').max(255, 'Work type too long').optional(),
    product: z.string().min(1, 'Product name is required').max(255, 'Product name too long').optional(),
    warranty: z.string().min(1, 'Warranty is required').max(255, 'Warranty description too long').optional(),
    price: z.number().min(0, 'Price must be a positive number').max(999999.99, 'Price too high').optional(),
    discount: z.number().min(0, 'Discount cannot be negative').max(100, 'Discount cannot exceed 100%').optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const priceRangeQuerySchema = z.object({
  body: z.object({}).optional(),
  query: z.object({
    minPrice: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid minPrice format'),
    maxPrice: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid maxPrice format'),
  }),
  params: z.object({}).optional(),
});
