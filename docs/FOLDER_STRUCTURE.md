# Chat Core Folder Structure (MVP)

```text
.
├── docs/
│   ├── FOLDER_STRUCTURE.md
│   ├── VOICE_CHAT_ARCHITECTURE.md
│   └── examples/
│       └── voice-client.example.tsx
├── prisma/
│   └── schema.prisma
└── src/
    ├── common/
    │   ├── prisma.service.ts      # Prisma client lifecycle
    │   └── redis.service.ts       # Redis client + helper methods
    ├── chat/
    │   ├── dto/
    │   │   └── ws-events.dto.ts   # DTO validation for websocket events
    │   ├── errors/
    │   │   └── chat-ws.error.ts   # Typed websocket errors
    │   ├── interfaces/
    │   │   └── chat-message.interface.ts
    │   ├── permissions.service.ts # Permission checks for channel operations
    │   ├── message-cache.service.ts # Redis cache for last 50 messages
    │   ├── chat.service.ts        # Message persistence + read-through cache
    │   └── chat.gateway.ts        # WebSocket gateway: join/send/typing
    └── voice/
        ├── dto/
        │   └── voice-events.dto.ts      # DTO validation for voice signaling
        ├── interfaces/
        │   └── voice-events.interface.ts
        ├── voice-signaling.service.ts   # SFU orchestration and join auth
        └── voice.gateway.ts             # signaling events (join/sdp/ice/leave)
```

## Design notes
- `chat.gateway.ts` and `voice.gateway.ts` are transport-level WS adapters.
- Business logic is isolated in services (`chat.service.ts`, `voice-signaling.service.ts`).
- `permissions.service.ts` is shared and can evolve from MVP checks to full RBAC bitmask engine.
- `message-cache.service.ts` encapsulates Redis list strategy for hot message history.
- `docs/VOICE_CHAT_ARCHITECTURE.md` captures the WebRTC/SFU design rationale and signaling sequence.
