import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../common/redis.service';
import { ChatMessagePayload } from './interfaces/chat-message.interface';

@Injectable()
export class MessageCacheService {
  private readonly logger = new Logger(MessageCacheService.name);
  private static readonly CACHE_SIZE = 50;
  private static readonly TTL_SECONDS = 60 * 60; // 1 hour

  constructor(private readonly redisService: RedisService) {}

  private cacheKey(channelId: string): string {
    return `channel:${channelId}:messages:last50`;
  }

  async pushMessage(channelId: string, message: ChatMessagePayload): Promise<void> {
    const key = this.cacheKey(channelId);
    const redis = this.redisService.getClient();

    try {
      await redis.multi()
        .lpush(key, JSON.stringify(message))
        .ltrim(key, 0, MessageCacheService.CACHE_SIZE - 1)
        .expire(key, MessageCacheService.TTL_SECONDS)
        .exec();
    } catch (error) {
      this.logger.warn(`Failed to write message cache for channel=${channelId}: ${(error as Error).message}`);
    }
  }

  async getLastMessages(channelId: string): Promise<ChatMessagePayload[] | null> {
    const key = this.cacheKey(channelId);
    const redis = this.redisService.getClient();

    try {
      const raw = await redis.lrange(key, 0, MessageCacheService.CACHE_SIZE - 1);
      if (!raw.length) return null;

      // lpush stores newest first; keep chronological order for client.
      return raw
        .map((item) => JSON.parse(item) as ChatMessagePayload)
        .reverse();
    } catch (error) {
      this.logger.warn(`Failed to read message cache for channel=${channelId}: ${(error as Error).message}`);
      return null;
    }
  }
}
