export interface ChatMessagePayload {
  id: string;
  channelId: string;
  authorId: string;
  content: string;
  createdAt: string;
}

export interface SendMessageContext {
  userId: string;
  channelId: string;
  content: string;
}
