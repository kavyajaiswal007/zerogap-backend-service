import morgan from 'morgan';
import { logger } from '../utils/logger.util.js';

export const httpLogger = morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim()),
  },
});
