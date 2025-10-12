import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';

// Global rate limiter - applies to all routes
export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Strict rate limiter for auth endpoints (login, forgot-password)
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login attempts per windowMs
  message: 'Too many login attempts from this IP, please try again after 15 minutes.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false, // Count all requests
});

// Speed limiter - slows down repeated requests (instead of blocking)
export const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 3, // Allow 3 requests per 15 minutes at full speed
  delayMs: () => 500, // Add 500ms delay per request above delayAfter
  maxDelayMs: 5000, // Maximum delay of 5 seconds
});

// Aggressive rate limiter for password reset (prevent enumeration attacks)
export const forgotPasswordRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 forgot password requests per hour
  message: 'Too many password reset attempts, please try again after an hour.',
  standardHeaders: true,
  legacyHeaders: false,
});

