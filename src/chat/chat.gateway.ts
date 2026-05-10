import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { JoinChannelDto, SendMessageDto, TypingStartDto } from './dto/ws-events.dto';
import { ChatWsError } from './errors/chat-ws.error';
import { PermissionsService } from './permissions.service';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/chat',
})
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private server!: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly chatService: ChatService,
    private readonly permissionsService: PermissionsService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const userId = this.extractUserId(client);
      if (!userId) {
        throw new ChatWsError('UNAUTHORIZED', 'User is not authenticated');
      }

      client.data.userId = userId;
      this.logger.log(`Client connected socketId=${client.id} userId=${userId}`);
    } catch (error) {
      this.emitError(client, error);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected socketId=${client.id} userId=${client.data.userId ?? 'unknown'}`);
  }

  @SubscribeMessage('join_channel')
  async handleJoinChannel(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: JoinChannelDto,
  ): Promise<void> {
    const userId = this.getUserIdOrThrow(client);

    const canAccess = await this.permissionsService.canAccessChannel(userId, body.channelId);
    if (!canAccess) {
      throw new ChatWsError('FORBIDDEN', 'No access to this channel');
    }

    await client.join(body.channelId);

    const history = await this.chatService.getRecentMessages(body.channelId, 50);
    client.emit('channel_history', {
      channelId: body.channelId,
      messages: history,
    });

    client.emit('joined_channel', { channelId: body.channelId });
    this.logger.debug(`User ${userId} joined channel=${body.channelId}`);
  }

  @SubscribeMessage('typing_start')
  async handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: TypingStartDto,
  ): Promise<void> {
    const userId = this.getUserIdOrThrow(client);

    const canAccess = await this.permissionsService.canAccessChannel(userId, body.channelId);
    if (!canAccess) {
      throw new ChatWsError('FORBIDDEN', 'No access to this channel');
    }

    // Broadcast typing status to everyone except sender.
    client.to(body.channelId).emit('typing_started', {
      channelId: body.channelId,
      userId,
      at: new Date().toISOString(),
    });
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: SendMessageDto,
  ): Promise<void> {
    const userId = this.getUserIdOrThrow(client);

    const message = await this.chatService.createMessage({
      userId,
      channelId: body.channelId,
      content: body.content,
    });

    this.server.to(body.channelId).emit('message_created', message);
    this.logger.debug(`Message sent messageId=${message.id} channelId=${body.channelId} userId=${userId}`);
  }

  private getUserIdOrThrow(client: Socket): string {
    const userId = client.data.userId as string | undefined;
    if (!userId) throw new ChatWsError('UNAUTHORIZED', 'No user in websocket context');
    return userId;
  }

  /**
   * MVP extraction strategy. In production:
   * - validate JWT in a WS Guard
   * - attach claims to client.data
   */
  private extractUserId(client: Socket): string | null {
    const candidate = client.handshake.auth?.userId ?? client.handshake.query?.userId;
    return typeof candidate === 'string' && candidate.length > 0 ? candidate : null;
  }

  private emitError(client: Socket, error: unknown): void {
    if (error instanceof WsException) {
      client.emit('error_event', error.getError());
      return;
    }

    this.logger.error(`Unhandled websocket error: ${(error as Error).message}`);
    client.emit('error_event', {
      code: 'INTERNAL_ERROR',
      message: 'Unexpected error',
    });
  }
}
