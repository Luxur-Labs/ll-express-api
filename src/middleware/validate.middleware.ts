import type { ZodTypeAny } from 'zod';
import { Request, Response, NextFunction } from 'express';

export const validate = (schema: ZodTypeAny) => (req: Request, res: Response, next: NextFunction) => {
  const result = schema.safeParse({ body: req.body, query: req.query, params: req.params });
  if (!result.success) {
    return res.status(400).json({ message: 'validation_error', errors: result.error.flatten().fieldErrors });
  }
  const data = result.data as { body?: unknown; query?: unknown; params?: unknown };
  if (data.body) req.body = data.body as any;
  if (data.query) req.query = data.query as any;
  if (data.params) req.params = data.params as any;
  next();
};
