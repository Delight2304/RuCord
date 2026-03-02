import { Injectable, Logger } from '@nestjs/common';
import { Message } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { ChatWsError } from './errors/chat-ws.error';
import { ChatMessagePayload, SendMessageContext } from './interfaces/chat-message.interface';
import { MessageCacheService } from './message-cache.service';
import { PermissionsService } from './permissions.service';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionsService: PermissionsService,
    private readonly messageCache: MessageCacheService,
  ) {}

  async getRecentMessages(channelId: string, limit = 50): Promise<ChatMessagePayload[]> {
    const cached = await this.messageCache.getLastMessages(channelId);
    if (cached) return cached;

    const rows = await this.prisma.message.findMany({
      where: { channelId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 50),
    });

    const payload = rows.reverse().map(this.toPayload);
    for (const message of payload) {
      await this.messageCache.pushMessage(channelId, message);
    }

    return payload;
  }

  async createMessage(input: SendMessageContext): Promise<ChatMessagePayload> {
    const content = input.content?.trim();
    if (!content) {
      throw new ChatWsError('VALIDATION_ERROR', 'Message content cannot be empty');
    }

    if (content.length > 2000) {
      throw new ChatWsError('VALIDATION_ERROR', 'Message is too long (max 2000 chars)');
    }

    const canSend = await this.permissionsService.canSendMessage(input.userId, input.channelId);
    if (!canSend) {
      throw new ChatWsError('FORBIDDEN', 'No permission to send messages in this channel');
    }

    let saved: Message;
    try {
      saved = await this.prisma.message.create({
        data: {
          channelId: input.channelId,
          authorId: input.userId,
          content,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to store message: ${(error as Error).message}`);
      throw new ChatWsError('PERSISTENCE_ERROR', 'Failed to save message');
    }

    const payload = this.toPayload(saved);
    await this.messageCache.pushMessage(input.channelId, payload);
    return payload;
  }

  private toPayload(message: Message): ChatMessagePayload {
    return {
      id: message.id.toString(),
      channelId: message.channelId,
      authorId: message.authorId,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
    };
  }
}
