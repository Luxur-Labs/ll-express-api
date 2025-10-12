import pino from 'pino';
 
import { env } from '../config/env'; 
 
const isProd = env.NODE_ENV === 'production'; 
 
export const logger = pino({ 
  level: env.LOG_LEVEL, 
  transport: isProd ? undefined : { 
    target: 'pino-pretty', 
    options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' } 
  } 
});
