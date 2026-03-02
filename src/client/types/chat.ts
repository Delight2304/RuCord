export interface ServerItem {
  id: string;
  name: string;
  shortName: string;
}

export interface ChannelItem {
  id: string;
  serverId: string;
  name: string;
}

export interface MemberItem {
  id: string;
  username: string;
  online: boolean;
}

export interface MessageItem {
  id: string;
  channelId: string;
  author: string;
  content: string;
  createdAt: string;
}

export interface IncomingWsMessage {
  type: 'message_created';
  payload: MessageItem;
}
