import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

/**
 * Minimal WebRTC + WS signaling example for voice channel.
 * Notes:
 * - For real SFU integration, replace room-relay semantics with SFU client SDK flow.
 * - This sample emphasizes required browser events and PTT behavior.
 */
export function VoiceClientExample({ channelId, userId }: { channelId: string; userId: string }) {
  const socketRef = useRef<Socket | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const localAudioTrackRef = useRef<MediaStreamTrack | null>(null);
  const [connectionState, setConnectionState] = useState('new');

  useEffect(() => {
    let unmounted = false;

    async function init(): Promise<void> {
      // 1) Request microphone access.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      if (unmounted) return;

      localStreamRef.current = stream;
      localAudioTrackRef.current = stream.getAudioTracks()[0] ?? null;

      // Push-to-Talk default: muted until hotkey pressed.
      if (localAudioTrackRef.current) localAudioTrackRef.current.enabled = false;

      // 2) Connect to WebSocket signaling.
      const socket = io('/voice', {
        auth: { userId },
        transports: ['websocket'],
      });
      socketRef.current = socket;

      socket.on('connect', () => {
        socket.emit('voice_join', { channelId });
      });

      socket.on('voice_joined', async (payload: { iceServers: RTCIceServer[] }) => {
        // 3) Build RTCPeerConnection.
        const peer = new RTCPeerConnection({ iceServers: payload.iceServers });
        peerRef.current = peer;

        // Add local audio to peer.
        stream.getAudioTracks().forEach((track) => peer.addTrack(track, stream));

        // Required events.
        peer.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit('ice_candidate', {
              channelId,
              candidate: event.candidate.toJSON(),
            });
          }
        };

        peer.ontrack = (event) => {
          // Attach remote stream to <audio> element.
          const [remoteStream] = event.streams;
          const audioEl = document.getElementById('remote-audio') as HTMLAudioElement | null;
          if (audioEl && remoteStream) {
            audioEl.srcObject = remoteStream;
            void audioEl.play().catch(() => undefined);
          }
        };

        peer.onconnectionstatechange = () => {
          setConnectionState(peer.connectionState);
          if (peer.connectionState === 'failed') {
            console.warn('WebRTC connection failed, consider ICE restart');
          }
        };

        // 4) Create offer and signal SDP.
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        socket.emit('sdp_offer', { channelId, sdp: offer });
      });

      socket.on('sdp_offer', async ({ sdp }: { sdp: RTCSessionDescriptionInit }) => {
        const peer = peerRef.current;
        if (!peer) return;

        await peer.setRemoteDescription(new RTCSessionDescription(sdp));
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);

        socket.emit('sdp_answer', { channelId, sdp: answer });
      });

      socket.on('sdp_answer', async ({ sdp }: { sdp: RTCSessionDescriptionInit }) => {
        const peer = peerRef.current;
        if (!peer) return;

        await peer.setRemoteDescription(new RTCSessionDescription(sdp));
      });

      socket.on('ice_candidate', async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
        const peer = peerRef.current;
        if (!peer) return;

        try {
          await peer.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
          console.warn('Failed to add ICE candidate', error);
        }
      });

      socket.on('disconnect', () => {
        console.warn('Signaling WS disconnected');
      });
    }

    void init();

    return () => {
      unmounted = true;
      socketRef.current?.emit('voice_leave', { channelId });
      socketRef.current?.disconnect();
      peerRef.current?.close();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [channelId, userId]);

  // 5) Push-to-Talk hotkey implementation.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.repeat) return;
      const target = event.target as HTMLElement | null;
      const isTypingContext = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      if (isTypingContext) return;

      if (event.code === 'Space' && localAudioTrackRef.current) {
        localAudioTrackRef.current.enabled = true;
        socketRef.current?.emit('ptt_state', { channelId, speaking: true });
      }
    };

    const onKeyUp = (event: KeyboardEvent): void => {
      if (event.code === 'Space' && localAudioTrackRef.current) {
        localAudioTrackRef.current.enabled = false;
        socketRef.current?.emit('ptt_state', { channelId, speaking: false });
      }
    };

    const onBlur = (): void => {
      if (localAudioTrackRef.current) {
        localAudioTrackRef.current.enabled = false;
        socketRef.current?.emit('ptt_state', { channelId, speaking: false });
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [channelId]);

  return (
    <div>
      <p>Voice connection state: {connectionState}</p>
      <audio id="remote-audio" autoPlay playsInline />
    </div>
  );
}
