import { Module } from '@nestjs/common';
import { ChatGateway } from './chat/chat.gateway';
import { ChatService } from './chat/chat.service';
import { MessageCacheService } from './chat/message-cache.service';
import { PermissionsService } from './chat/permissions.service';
import { PrismaService } from './common/prisma.service';
import { RedisService } from './common/redis.service';
import { VoiceGateway } from './voice/voice.gateway';
import { VoiceSignalingService } from './voice/voice-signaling.service';

@Module({
  providers: [
    PrismaService,
    RedisService,
    PermissionsService,
    MessageCacheService,
    ChatService,
    ChatGateway,
    VoiceSignalingService,
    VoiceGateway,
  ],
})
export class AppModule {}
