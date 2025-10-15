import cors from 'cors'; 
import express from 'express'; 
import helmet from 'helmet';
import path from 'path';
 
import { errorHandler } from '../middleware/error.middleware'; 
import { notFound } from '../middleware/notFound.middleware'; 
import { requestLogger } from '../middleware/requestLogger.middleware'; 
import { globalRateLimiter } from '../middleware/rateLimiter.middleware';
import router from '../routes'; 
 
export function createApp() { 
  const app = express(); 
  app.disable('x-powered-by'); 
  
  // Security headers
  app.use(helmet()); 
  
  // CORS configuration
  app.use(cors()); 
  
  // Trust proxy (important for rate limiting behind reverse proxy)
  app.set('trust proxy', 1);
  
  // Global rate limiter (applies to all routes)
  app.use(globalRateLimiter);
  
  // Body parsing
  app.use(express.json()); 
  // Static serving for uploaded assets (local CDN simulation)
  app.use('/static', express.static(path.resolve('uploads')));
  
  // Request logging
  app.use(requestLogger); 
 
  // API routes
  app.use('/api/v1', router); 
 
  // Error handling
  app.use(notFound); 
  app.use(errorHandler); 
 
  return app; 
}
