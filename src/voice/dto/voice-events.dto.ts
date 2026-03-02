import { IsObject, IsString, IsUUID } from 'class-validator';

export class VoiceJoinDto {
  @IsUUID()
  channelId!: string;
}

export class SdpPayloadDto {
  @IsUUID()
  channelId!: string;

  @IsObject()
  sdp!: Record<string, unknown>;
}

export class IceCandidateDto {
  @IsUUID()
  channelId!: string;

  @IsObject()
  candidate!: Record<string, unknown>;
}
