import { Router, Request, Response } from 'express';
import { dockerService } from '../services/dockerService';

export const botRoutes = Router();

botRoutes.post('/start', async (req: Request, res: Response) => {
  const { botId } = req.body;
  if (!botId) {
    return res.status(400).json({ error: 'botId is required' });
  }
  try {
    const result = await dockerService.startBot(botId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

botRoutes.post('/stop', async (req: Request, res: Response) => {
  const { botId } = req.body;
  if (!botId) {
    return res.status(400).json({ error: 'botId is required' });
  }
  try {
    const result = await dockerService.stopBot(botId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

botRoutes.get('/status/:botId', async (req: Request, res: Response) => {
  const { botId } = req.params;
  try {
    const status = await dockerService.getBotStatus(botId);
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
