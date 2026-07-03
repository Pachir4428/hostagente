import Queue from 'bull';
import { createLogger, transports, format } from 'winston';
import { transactionWorker } from './workers/transactionWorker';

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

const transactionQueue = createQueue('transaction-processing');
const notificationQueue = createQueue('notification');

transactionQueue.process(async (job) => {
  logger.info('Processing transaction job', { id: job.id, data: job.data });
  return transactionWorker(job.data);
});

notificationQueue.process(async (job) => {
  logger.info('Processing notification', { id: job.id, data: job.data });
  return { sent: true };
});

transactionQueue.on('failed', (job, err) =>
  logger.error('Transaction job failed', { id: job?.id, err: err.message }),
);

logger.info('Worker started, listening for jobs...', { redis: REDIS_URL });

process.on('SIGTERM', async () => {
  logger.info('Shutting down worker...');
  await Promise.all([transactionQueue.close(), notificationQueue.close()]);
  process.exit(0);
});
