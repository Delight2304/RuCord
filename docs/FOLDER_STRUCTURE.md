# Chat Core Folder Structure (MVP)

```text
.
├── docs/
│   └── FOLDER_STRUCTURE.md
├── prisma/
│   └── schema.prisma
└── src/
    ├── common/
    │   ├── prisma.service.ts      # Prisma client lifecycle
    │   └── redis.service.ts       # Redis client + helper methods
    └── chat/
        ├── dto/
        │   └── ws-events.dto.ts   # DTO validation for websocket events
        ├── errors/
        │   └── chat-ws.error.ts   # Typed websocket errors
        ├── interfaces/
        │   └── chat-message.interface.ts
        ├── permissions.service.ts # Permission checks for channel operations
        ├── message-cache.service.ts # Redis cache for last 50 messages
        ├── chat.service.ts        # Message persistence + read-through cache
        └── chat.gateway.ts        # WebSocket gateway: join/send/typing
```

## Design notes
- `chat.gateway.ts` is transport-level only (WebSocket protocol, events, connection lifecycle).
- `chat.service.ts` contains business logic and persistence orchestration.
- `permissions.service.ts` isolates access control checks (SRP + easy replacement by RBAC engine).
- `message-cache.service.ts` encapsulates Redis structure and TTL policy.
- `common/*` provides infrastructure adapters (Prisma, Redis).
