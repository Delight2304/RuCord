import { IsString, IsUUID, Length } from 'class-validator';

export class JoinChannelDto {
  @IsUUID()
  channelId!: string;
}

export class TypingStartDto {
  @IsUUID()
  channelId!: string;
}

export class SendMessageDto {
  @IsUUID()
  channelId!: string;

  @IsString()
  @Length(1, 2000)
  content!: string;
}
