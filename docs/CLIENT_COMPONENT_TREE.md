# Discord-like Client Component Tree

```text
App
└── DiscordLayout
    ├── ServerRail
    │   └── ServerIcon[]
    ├── ChannelSidebar
    │   ├── ServerHeader
    │   └── ChannelItem[]
    ├── ChatArea
    │   ├── ChatHeader
    │   ├── MessageListVirtualized
    │   │   └── MessageRow[] (windowed)
    │   └── MessageComposer
    ├── MemberSidebar
    │   ├── MemberGroup(Online)
    │   │   └── MemberRow[]
    │   └── MemberGroup(Offline)
    │       └── MemberRow[]
    └── VoiceUserBar
        ├── VoiceControls (mic/headphones/settings)
        └── CurrentUserSummary
```

## State ownership
- `DiscordLayout`: selected server/channel + normalized UI state.
- `useWebSocket`: real-time transport, reconnection, incoming events.
- `ChatArea`: message draft + send action.
- `MessageListVirtualized`: rendering window logic for large histories.
