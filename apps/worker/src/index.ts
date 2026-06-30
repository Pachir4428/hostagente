import Queue from 'bull';
import { createLogger, transports, format } from 'winston';
import { messageWorker } from './workers/messageWorker';
import { paymentWorker } from './workers/paymentWorker';

const logger = createLogger({
  level: 'info',
  format: format.combine(format.timestamp(), format.json()),
  transports: [new transports.Console()],
});

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

function createQueue(name: string) {
  return new Queue(name, REDIS_URL, {
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 50,
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    },
  });
}

const messageQueue = createQueue('message-processing');
const paymentQueue = createQueue('payment-confirmation');
const botStatusQueue = createQueue('bot-status-sync');
const notificationQueue = createQueue('notification');

messageQueue.process(async (job) => {
  logger.info('Processing message job', { id: job.id, data: job.data });
  return messageWorker(job.data);
});

paymentQueue.process(async (job) => {
  logger.info('Processing payment job', { id: job.id, data: job.data });
  return paymentWorker(job.data);
});

botStatusQueue.process(async (job) => {
  logger.info('Processing bot status sync', { id: job.id, data: job.data });
  return { synced: true, botId: job.data.botId };
});

notificationQueue.process(async (job) => {
  logger.info('Processing notification', { id: job.id, data: job.data });
  return { sent: true };
});

messageQueue.on('failed', (job, err) => logger.error('Message job failed', { id: job.id, err: err.message }));
paymentQueue.on('failed', (job, err) => logger.error('Payment job failed', { id: job.id, err: err.message }));

logger.info('Worker started, listening for jobs...', { redis: REDIS_URL });

process.on('SIGTERM', async () => {
  logger.info('Shutting down worker...');
  await Promise.all([
    messageQueue.close(),
    paymentQueue.close(),
    botStatusQueue.close(),
    notificationQueue.close(),
  ]);
  process.exit(0);
});
