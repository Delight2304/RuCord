import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { ChatWsError } from '../chat/errors/chat-ws.error';
import { IceCandidateDto, SdpPayloadDto, VoiceJoinDto } from './dto/voice-events.dto';
import { VoiceSignalingService } from './voice-signaling.service';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/voice',
})
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class VoiceGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private server!: Server;

  private readonly logger = new Logger(VoiceGateway.name);

  constructor(private readonly voiceService: VoiceSignalingService) {}

  handleConnection(client: Socket): void {
    const userId = this.extractUserId(client);
    if (!userId) {
      client.emit('voice_error', { code: 'UNAUTHORIZED', message: 'Missing user id' });
      client.disconnect(true);
      return;
    }

    client.data.userId = userId;
    this.logger.log(`Voice socket connected: socket=${client.id} user=${userId}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Voice socket disconnected: socket=${client.id} user=${client.data.userId ?? 'unknown'}`);
  }

  @SubscribeMessage('voice_join')
  async handleVoiceJoin(@ConnectedSocket() client: Socket, @MessageBody() body: VoiceJoinDto): Promise<void> {
    const userId = this.getUserIdOrThrow(client);

    await this.voiceService.authorizeJoin(userId, body.channelId);
    await client.join(body.channelId);

    const joined = await this.voiceService.buildJoinResponse(body.channelId, userId);
    client.emit('voice_joined', joined);

    // Notify channel members about participant presence.
    client.to(body.channelId).emit('voice_participant_joined', {
      channelId: body.channelId,
      participantId: userId,
    });
  }

  @SubscribeMessage('sdp_offer')
  async handleOffer(@ConnectedSocket() client: Socket, @MessageBody() body: SdpPayloadDto): Promise<void> {
    const userId = this.getUserIdOrThrow(client);
    this.voiceService.logSdp(userId, body.channelId, 'offer');

    // In a real system this payload is routed to SFU control plane.
    // For MVP signaling skeleton we re-emit to room as relay event.
    client.to(body.channelId).emit('sdp_offer', {
      channelId: body.channelId,
      fromUserId: userId,
      sdp: body.sdp,
    });
  }

  @SubscribeMessage('sdp_answer')
  async handleAnswer(@ConnectedSocket() client: Socket, @MessageBody() body: SdpPayloadDto): Promise<void> {
    const userId = this.getUserIdOrThrow(client);
    this.voiceService.logSdp(userId, body.channelId, 'answer');

    client.to(body.channelId).emit('sdp_answer', {
      channelId: body.channelId,
      fromUserId: userId,
      sdp: body.sdp,
    });
  }

  @SubscribeMessage('ice_candidate')
  async handleIceCandidate(@ConnectedSocket() client: Socket, @MessageBody() body: IceCandidateDto): Promise<void> {
    const userId = this.getUserIdOrThrow(client);
    this.voiceService.logCandidate(userId, body.channelId);

    client.to(body.channelId).emit('ice_candidate', {
      channelId: body.channelId,
      fromUserId: userId,
      candidate: body.candidate,
    });
  }

  @SubscribeMessage('voice_leave')
  async handleVoiceLeave(@ConnectedSocket() client: Socket, @MessageBody() body: VoiceJoinDto): Promise<void> {
    const userId = this.getUserIdOrThrow(client);
    await client.leave(body.channelId);

    client.to(body.channelId).emit('voice_participant_left', {
      channelId: body.channelId,
      participantId: userId,
    });
  }

  private getUserIdOrThrow(client: Socket): string {
    const userId = client.data.userId as string | undefined;
    if (!userId) throw new ChatWsError('UNAUTHORIZED', 'No user in websocket context');
    return userId;
  }

  private extractUserId(client: Socket): string | null {
    const candidate = client.handshake.auth?.userId ?? client.handshake.query?.userId;
    return typeof candidate === 'string' && candidate.length > 0 ? candidate : null;
  }
}
