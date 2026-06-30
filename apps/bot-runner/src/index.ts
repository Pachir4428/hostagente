import express from 'express';
import { createLogger, transports, format } from 'winston';
import { botRoutes } from './routes/bots';

const logger = createLogger({
  level: 'info',
  format: format.combine(format.timestamp(), format.json()),
  transports: [new transports.Console()],
});

const app = express();
app.use(express.json());

const INTERNAL_SECRET = process.env.INTERNAL_SECRET || '';

// Auth middleware
app.use((req, res, next) => {
  if (req.path === '/health') return next();
  const secret = req.headers['x-internal-secret'];
  if (!INTERNAL_SECRET || secret === INTERNAL_SECRET) return next();
  res.status(401).json({ error: 'Unauthorized' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/bots', botRoutes);

const PORT = parseInt(process.env.PORT || '4001', 10);
app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Bot Runner listening on port ${PORT}`);
});

export { logger };
