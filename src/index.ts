import { createApp } from './app/app'; 
import { env } from './config/env'; 
import { logger } from './utils/logger'; 
 
const app = createApp(); 
app.listen(env.PORT, () =>
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'App listening')
);
