import Dockerode from 'dockerode';
import { createLogger, transports, format } from 'winston';

const logger = createLogger({
  level: 'info',
  format: format.combine(format.timestamp(), format.json()),
  transports: [new transports.Console()],
});

const docker = new Dockerode({ socketPath: '/var/run/docker.sock' });

const BOT_ENGINE_IMAGE = process.env.BOT_ENGINE_IMAGE || 'bot-engine:latest';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

function containerName(botId: string): string {
  return `bot-engine-${botId}`;
}

export const dockerService = {
  async startBot(
    botId: string,
    opts: { phone?: string } = {},
  ): Promise<{ success: boolean; containerId?: string; message?: string }> {
    const name = containerName(botId);

    // Remove existing container if any
    try {
      const existing = docker.getContainer(name);
      await existing.remove({ force: true });
      logger.info(`Removed existing container for bot ${botId}`);
    } catch {
      // Container doesn't exist, that's fine
    }

    try {
      const container = await docker.createContainer({
        Image: BOT_ENGINE_IMAGE,
        name,
        Env: [
          `BOT_ID=${botId}`,
          `REDIS_URL=${REDIS_URL}`,
          `PHONE=${opts.phone || ''}`,
          `NODE_ENV=${process.env.NODE_ENV || 'production'}`,
        ],
        HostConfig: {
          RestartPolicy: { Name: 'unless-stopped' },
          NetworkMode: 'bot-network',
          Memory: 256 * 1024 * 1024,
          // projects-data holds each bot's uploaded Node project (written by
          // the API); the engine extracts/installs/runs it from /data/projects.
          Binds: ['projects-data:/data/projects'],
        },
        Labels: {
          'bot-platform': 'true',
          'bot-id': botId,
        },
      });

      await container.start();
      const info = await container.inspect();
      logger.info(`Started bot container ${botId}`, { containerId: info.Id });

      return { success: true, containerId: info.Id };
    } catch (err: any) {
      logger.error(`Failed to start container for bot ${botId}`, { error: err.message });
      return { success: false, message: err.message };
    }
  },

  async stopBot(botId: string): Promise<{ success: boolean; message?: string }> {
    const name = containerName(botId);
    try {
      const container = docker.getContainer(name);
      await container.stop({ t: 10 });
      await container.remove();
      logger.info(`Stopped and removed container for bot ${botId}`);
      return { success: true };
    } catch (err: any) {
      if (err.statusCode === 404) {
        return { success: true, message: 'Container not found, already stopped' };
      }
      logger.error(`Failed to stop container for bot ${botId}`, { error: err.message });
      return { success: false, message: err.message };
    }
  },

  async getBotStatus(botId: string): Promise<{ status: string; containerId?: string }> {
    const name = containerName(botId);
    try {
      const container = docker.getContainer(name);
      const info = await container.inspect();
      return {
        status: info.State.Status,
        containerId: info.Id,
      };
    } catch (err: any) {
      if (err.statusCode === 404) {
        return { status: 'stopped' };
      }
      throw err;
    }
  },
};
