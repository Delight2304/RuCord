export interface VoiceJoinPayload {
  channelId: string;
}

export interface SdpOfferPayload {
  channelId: string;
  sdp: RTCSessionDescriptionInit;
}

export interface SdpAnswerPayload {
  channelId: string;
  sdp: RTCSessionDescriptionInit;
}

export interface IceCandidatePayload {
  channelId: string;
  candidate: RTCIceCandidateInit;
}
