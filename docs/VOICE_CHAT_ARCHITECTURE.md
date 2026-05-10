# Voice Chat Architecture for Discord-like MVP (up to 10 users)

## 1) Connection Strategy: Mesh (P2P) vs SFU

### Decision: **SFU (Selective Forwarding Unit)**
For 10 participants, SFU is the practical choice.

- **Mesh cost explodes**: each client sends N-1 streams and receives N-1 streams.
  - For 10 users: each user handles 9 upstream + 9 downstream peer connections.
  - This quickly degrades CPU/battery/network on laptops/mobile.
- **SFU scales better**:
  - Each client sends a single uplink audio stream to SFU.
  - SFU forwards selected streams to others.
  - Lower client CPU and better quality consistency under packet loss.
- **Low latency target** is easier with SFU because routing and congestion control are centralized.

### MVP recommendation
- Use **LiveKit** (fastest path to production, mature SDKs, active ecosystem).
- Alternative if self-managed low-level control is required: **mediasoup**.

---

## 2) SFU implementation choice

### Recommended production path
- **LiveKit SFU** deployment + custom signaling in backend (or LiveKit token workflow).
- Keep your app WS signaling for:
  - voice channel membership,
  - permission checks,
  - voice state events (mute/deafen/PTT),
  - region assignment.

### Minimal custom SFU orchestration pseudo-flow
```text
1. Client joins voice channel via app WS (JWT auth + permission check).
2. Voice Signaling service selects SFU node/region.
3. Service returns SFU endpoint + ephemeral voice token.
4. Client establishes WebRTC transport to SFU.
5. Client publishes mic audio track.
6. SFU forwards track subscriptions to other participants.
7. Presence/state events are broadcast over app WS.
```

---

## 3) Signaling over WebSocket (SDP/ICE)

### Event contract
- `voice_join` -> request join voice channel.
- `voice_joined` -> server response with `roomId`, `participantId`, `iceServers`, `sfuEndpoint`.
- `sdp_offer` -> sender sends local offer (or SFU-offer flow depending architecture).
- `sdp_answer` -> receiver/server returns answer.
- `ice_candidate` -> trickle ICE in both directions.
- `voice_leave` -> disconnect/cleanup.
- `voice_error` -> structured errors.

### Typical sequence (offer/answer)
```text
Client A:
  - getUserMedia(audio)
  - create RTCPeerConnection(iceServers)
  - addTrack(audioTrack)
  - createOffer()
  - setLocalDescription(offer)
  - WS emit: sdp_offer

Server (signaling + SFU):
  - validate membership/permissions
  - route offer to SFU or recipient
  - generate/collect answer
  - WS emit to client: sdp_answer

Client A:
  - setRemoteDescription(answer)
  - exchange ICE via ice_candidate until connected
```

---

## 4) Push-to-Talk (PTT) on client

### Client-side approach
- Keep microphone track created but **mute by default**:
  - `audioTrack.enabled = false`
- On keydown (e.g. `Space` or configured key):
  - `audioTrack.enabled = true`
  - emit `ptt_state` (`speaking: true`) for UI indicators.
- On keyup:
  - `audioTrack.enabled = false`
  - emit `ptt_state` (`speaking: false`).

### Why this approach
- No renegotiation needed (low latency toggle).
- Avoids frequent `replaceTrack`/re-offer churn.
- Predictable UX similar to Discord PTT.

### Edge cases
- Ignore PTT hotkey while typing in input fields.
- Restore muted state when tab loses focus (`visibilitychange` / `blur`).
- Respect server mute/deafen flags (PTT should not bypass moderation).

