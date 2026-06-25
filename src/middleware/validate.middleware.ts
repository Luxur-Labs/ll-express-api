import type { ZodTypeAny } from 'zod';
import { Request, Response, NextFunction } from 'express';

export const validate = (schema: ZodTypeAny) => (req: Request, res: Response, next: NextFunction) => {
  const result = schema.safeParse({ body: req.body, query: req.query, params: req.params });
  if (!result.success) {
    const details = result.error.issues.map((issue) => {
      const path = issue.path.filter((p) => p !== 'body').join('.');
      return path ? `${path}: ${issue.message}` : issue.message;
    });
    return res.status(400).json({
      message: details[0] || 'validation_error',
      errors: result.error.flatten().fieldErrors,
      details,
    });
  }
  const data = result.data as { body?: unknown; query?: unknown; params?: unknown };
  if (data.body) req.body = data.body as any;
  next();
};
