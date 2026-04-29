import { app } from './app.js';
import { env } from './config/env.js';
import { ensureRedisConnection } from './config/redis.js';
import { logger } from './utils/logger.util.js';
import { scheduleJobScraping } from './queues/jobScraping.queue.js';
import { AchievementsService } from './modules/achievements/achievements.service.js';
import './queues/skillAnalysis.queue.js';
import './queues/resumeGeneration.queue.js';

const port = Number(env.PORT);

async function bootstrap() {
  await ensureRedisConnection();
  await AchievementsService.ensureSeeded();
  await scheduleJobScraping();

  app.listen(port, () => {
    logger.info(`ZeroGap backend listening on port ${port}`);
  });
}

bootstrap().catch((error) => {
  logger.error({ message: 'Failed to bootstrap application', error });
  process.exit(1);
});
