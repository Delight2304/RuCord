# Chat Core Folder Structure (MVP)

```text
.
├── docs/
│   ├── BUILD.md
│   ├── CLIENT_COMPONENT_TREE.md
│   ├── FOLDER_STRUCTURE.md
│   ├── VOICE_CHAT_ARCHITECTURE.md
│   └── examples/
│       ├── discord-layout-preview.html
│       └── voice-client.example.tsx
├── prisma/
│   └── schema.prisma
├── index.html
├── package.json
├── tsconfig.base.json
├── tsconfig.api.json
├── tsconfig.web.json
├── vite.config.ts
└── src/
    ├── app.module.ts
    ├── main.ts
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
    ├── client/
    │   ├── App.tsx
    │   ├── main.tsx
    │   ├── components/
    │   │   ├── DiscordLayout.tsx
    │   │   └── MessageListVirtualized.tsx
    │   ├── hooks/
    │   │   ├── useVirtualMessages.ts
    │   │   └── useWebSocket.ts
    │   ├── styles/
    │   │   └── discord.css
    │   └── types/
    │       └── chat.ts
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
- `src/client` contains Discord-like shell UI, real-time hook, and virtualized message rendering.
- `src/main.ts` + `src/app.module.ts` provide Nest bootstrap for runtime build.
- Business logic is isolated in services (`chat.service.ts`, `voice-signaling.service.ts`).
- `permissions.service.ts` is shared and can evolve from MVP checks to full RBAC bitmask engine.
- `message-cache.service.ts` encapsulates Redis list strategy for hot message history.
