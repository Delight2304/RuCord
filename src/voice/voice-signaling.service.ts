import { Injectable, Logger } from '@nestjs/common';
import { ChatWsError } from '../chat/errors/chat-ws.error';
import { PermissionsService } from '../chat/permissions.service';

/**
 * Voice signaling coordinator.
 * In production this service should integrate with LiveKit/mediasoup control plane.
 */
@Injectable()
export class VoiceSignalingService {
  private readonly logger = new Logger(VoiceSignalingService.name);

  constructor(private readonly permissionsService: PermissionsService) {}

  async authorizeJoin(userId: string, channelId: string): Promise<void> {
    const canAccess = await this.permissionsService.canAccessChannel(userId, channelId);
    if (!canAccess) {
      throw new ChatWsError('FORBIDDEN', 'No access to voice channel');
    }
  }

  async buildJoinResponse(channelId: string, participantId: string): Promise<{
    channelId: string;
    participantId: string;
    sfuEndpoint: string;
    iceServers: Array<{ urls: string; username?: string; credential?: string }>;
  }> {
    // TODO: dynamic region/SFU selection by user geolocation and SFU load.
    return {
      channelId,
      participantId,
      sfuEndpoint: process.env.SFU_WS_ENDPOINT ?? 'wss://sfu.example.internal',
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        {
          urls: process.env.TURN_URL ?? 'turn:turn.example.internal:3478',
          username: process.env.TURN_USERNAME ?? 'mvp',
          credential: process.env.TURN_PASSWORD ?? 'mvp-secret',
        },
      ],
    };
  }

  logSdp(userId: string, channelId: string, type: 'offer' | 'answer'): void {
    this.logger.debug(`Received SDP ${type} from user=${userId} channel=${channelId}`);
  }

  logCandidate(userId: string, channelId: string): void {
    this.logger.debug(`Received ICE candidate from user=${userId} channel=${channelId}`);
  }
}
