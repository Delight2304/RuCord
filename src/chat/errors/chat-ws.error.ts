import { WsException } from '@nestjs/websockets';

export class ChatWsError extends WsException {
  constructor(code: string, message: string) {
    super({ code, message });
  }
}
