import cors from 'cors'; 
import express from 'express'; 
import helmet from 'helmet';
import path from 'path';
 
import { env } from '../config/env';
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
  const allowedOrigins = env.CORS_ORIGIN?.split(',').map((s) => s.trim()).filter(Boolean);
  if (allowedOrigins?.length) {
    app.use(cors({ origin: allowedOrigins, credentials: true }));
  } else if (env.NODE_ENV !== 'production') {
    app.use(cors());
  } else {
    app.use(cors({ origin: false }));
  }
  
  app.set('trust proxy', 1);

  app.use(globalRateLimiter);

  // Body parsing (import endpoints may send large row batches)
  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ extended: true, limit: '15mb' }));
  // Static serving for uploaded assets (local dev only — disable in production)
  if (env.ENABLE_LOCAL_STATIC) {
    app.use('/static', express.static(path.resolve('uploads')));
  }
  
  // Request logging
  app.use(requestLogger); 
 
  // API routes
  app.use('/api/v1', router); 
 
  // Error handling
  app.use(notFound); 
  app.use(errorHandler); 
 
  return app; 
}
