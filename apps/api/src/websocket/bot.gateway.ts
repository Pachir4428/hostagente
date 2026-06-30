import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true,
  },
})
export class BotGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(BotGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribe-bot')
  handleSubscribeBot(@MessageBody() botId: string, @ConnectedSocket() client: Socket) {
    client.join(`bot:${botId}`);
    return { event: 'subscribed', data: botId };
  }

  @SubscribeMessage('unsubscribe-bot')
  handleUnsubscribeBot(@MessageBody() botId: string, @ConnectedSocket() client: Socket) {
    client.leave(`bot:${botId}`);
    return { event: 'unsubscribed', data: botId };
  }

  emitBotStatus(botId: string, status: string, extra?: any) {
    this.server.to(`bot:${botId}`).emit('bot-status', {
      botId,
      status,
      timestamp: new Date().toISOString(),
      ...extra,
    });
  }

  emitQrCode(botId: string, qrCode: string) {
    this.server.to(`bot:${botId}`).emit('bot-qr', { botId, qrCode });
  }
}
