import { OnModuleInit } from '@nestjs/common';
import {
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import Redis from 'ioredis';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const jwt = require('jsonwebtoken');
import { PrismaService } from '../prisma/prisma.service';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const JWT_SECRET = process.env.JWT_SECRET || '';

// Real-time bot console over WebSockets. Forwards each bot's Redis stream
// (published by the engine) to the browsers watching that bot. Falls back
// gracefully: if this isn't reachable, the frontend keeps HTTP polling.
@WebSocketGateway({ cors: { origin: true, credentials: true } })
export class BotsGateway implements OnModuleInit, OnGatewayConnection {
  @WebSocketServer() server: Server;
  private redisSub = new Redis(REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 2 });

  constructor(private prisma: PrismaService) {
    this.redisSub.on('error', () => {});
  }

  onModuleInit() {
    // One pattern subscription forwards all bots' streams to their rooms.
    this.redisSub.psubscribe('bot:*:stream').catch(() => {});
    this.redisSub.on('pmessage', (_pattern, channel, message) => {
      const botId = channel.split(':')[1];
      if (!botId) return;
      let evt: any;
      try {
        evt = JSON.parse(message);
      } catch {
        return;
      }
      this.server.to(`bot:${botId}`).emit('live', evt);
    });
  }

  handleConnection() {
    /* auth happens on the subscribe message */
  }

  @SubscribeMessage('subscribe')
  async subscribe(@ConnectedSocket() client: Socket, @MessageBody() data: { botId: string; token: string }) {
    try {
      const payload: any = jwt.verify(data?.token || '', JWT_SECRET);
      const tenantId = payload?.tenantId;
      if (!tenantId) return { ok: false };
      const bot = await this.prisma.bot.findFirst({ where: { id: data.botId, tenantId }, select: { id: true } });
      if (!bot) return { ok: false };
      // Leave any previous bot rooms, join this one.
      for (const r of client.rooms) if (r.startsWith('bot:')) client.leave(r);
      client.join(`bot:${data.botId}`);
      return { ok: true };
    } catch {
      return { ok: false };
    }
  }
}
