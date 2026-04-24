import type { RequestHandler } from 'express';

/** Pass-through placeholders (IP / auth rate limiting disabled). */
export const globalRateLimiter: RequestHandler = (_req, _res, next) => next();
export const authRateLimiter: RequestHandler = (_req, _res, next) => next();
export const speedLimiter: RequestHandler = (_req, _res, next) => next();
export const forgotPasswordRateLimiter: RequestHandler = (_req, _res, next) => next();
