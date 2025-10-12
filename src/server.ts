import http from 'http';
 
import { createApp } from './app/app'; 
import { env } from './config/env'; 
import { logger } from './utils/logger'; 
 
const app = createApp(); 
const server = http.createServer(app); 
 
server.listen(env.PORT, () =>
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'Server listening')
);
