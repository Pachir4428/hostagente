import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class RunnerService {
  private readonly logger = new Logger(RunnerService.name);
  private readonly runnerUrl: string;
  private readonly internalSecret: string;

  constructor() {
    this.runnerUrl = process.env.RUNNER_INTERNAL_URL || 'http://bot-runner:4001';
    this.internalSecret = process.env.INTERNAL_SECRET || '';
  }

  private get headers() {
    return { 'x-internal-secret': this.internalSecret };
  }

  async startBot(botId: string): Promise<{ success: boolean; containerId?: string; message?: string }> {
    try {
      const res = await axios.post(
        `${this.runnerUrl}/bots/start`,
        { botId },
        { headers: this.headers },
      );
      return res.data;
    } catch (err) {
      this.logger.error(`Failed to start bot ${botId}`, err.message);
      return { success: false, message: err.message };
    }
  }

  async stopBot(botId: string): Promise<{ success: boolean; message?: string }> {
    try {
      const res = await axios.post(
        `${this.runnerUrl}/bots/stop`,
        { botId },
        { headers: this.headers },
      );
      return res.data;
    } catch (err) {
      this.logger.error(`Failed to stop bot ${botId}`, err.message);
      return { success: false, message: err.message };
    }
  }

  async getBotStatus(botId: string): Promise<any> {
    try {
      const res = await axios.get(
        `${this.runnerUrl}/bots/status/${botId}`,
        { headers: this.headers },
      );
      return res.data;
    } catch (err) {
      this.logger.error(`Failed to get status for bot ${botId}`, err.message);
      return { status: 'unknown' };
    }
  }
}
