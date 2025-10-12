import cors from 'cors'; 
import express from 'express'; 
import helmet from 'helmet';
 
import { errorHandler } from '../middleware/error.middleware'; 
import { notFound } from '../middleware/notFound.middleware'; 
import { requestLogger } from '../middleware/requestLogger.middleware'; 
import router from '../routes'; 
 
export function createApp() { 
  const app = express(); 
  app.disable('x-powered-by'); 
  app.use(helmet()); 
  app.use(cors()); 
  app.use(express.json()); 
  app.use(requestLogger); 
 
  app.use('/api/v1', router); 
 
  app.use(notFound); 
  app.use(errorHandler); 
 
  return app; 
}
