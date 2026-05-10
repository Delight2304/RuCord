import { useMemo, useState } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import type { ChannelItem, MemberItem, MessageItem, ServerItem } from '../types/chat';
import { MessageListVirtualized } from './MessageListVirtualized';

const SERVERS: ServerItem[] = [
  { id: '1', name: 'RuCord', shortName: 'RC' },
  { id: '2', name: 'Frontend Team', shortName: 'FE' },
  { id: '3', name: 'Gaming', shortName: 'GG' },
];

const CHANNELS: ChannelItem[] = [
  { id: 'ch-1', serverId: '1', name: 'general' },
  { id: 'ch-2', serverId: '1', name: 'architecture' },
  { id: 'ch-3', serverId: '1', name: 'voice-lobby' },
  { id: 'ch-4', serverId: '2', name: 'frontend' },
  { id: 'ch-5', serverId: '2', name: 'design-system' },
  { id: 'ch-6', serverId: '3', name: 'matchmaking' },
];

const MEMBERS: MemberItem[] = [
  { id: 'u1', username: 'alex', online: true },
  { id: 'u2', username: 'olga', online: true },
  { id: 'u3', username: 'roman', online: false },
  { id: 'u4', username: 'max', online: false },
];

const INITIAL_MESSAGES: MessageItem[] = Array.from({ length: 220 }, (_, i) => ({
  id: `m-${i + 1}`,
  channelId: 'ch-1',
  author: i % 3 === 0 ? 'alex' : i % 2 === 0 ? 'olga' : 'max',
  content: `Message #${i + 1} in channel. This demonstrates virtual scrolling behavior for long history.`,
  createdAt: new Date(Date.now() - (220 - i) * 30_000).toISOString(),
}));

export function DiscordLayout() {
  const [selectedServerId, setSelectedServerId] = useState('1');
  const [selectedChannelId, setSelectedChannelId] = useState('ch-1');
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<MessageItem[]>(INITIAL_MESSAGES);
  const [error, setError] = useState<string | null>(null);

  const { isConnected, send } = useWebSocket({
    url: 'ws://localhost:3000/chat',
    onMessageCreated: (message) => {
      if (message.channelId === selectedChannelId) {
        setMessages((prev) => [...prev, message]);
      }
    },
    onError: setError,
  });

  const serverChannels = useMemo(
    () => CHANNELS.filter((channel) => channel.serverId === selectedServerId),
    [selectedServerId],
  );

  const onlineMembers = MEMBERS.filter((m) => m.online);
  const offlineMembers = MEMBERS.filter((m) => !m.online);

  const handleSend = () => {
    const content = draft.trim();
    if (!content) return;

    const optimistic: MessageItem = {
      id: `local-${Date.now()}`,
      channelId: selectedChannelId,
      author: 'you',
      content,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimistic]);
    setDraft('');

    send('send_message', {
      channelId: selectedChannelId,
      content,
    });
  };

  return (
    <div className="app-shell">
      <aside className="server-rail">
        {SERVERS.map((server) => (
          <button
            key={server.id}
            className={`server-icon ${server.id === selectedServerId ? 'active' : ''}`}
            onClick={() => setSelectedServerId(server.id)}
            title={server.name}
          >
            {server.shortName}
          </button>
        ))}
      </aside>

      <aside className="channel-sidebar">
        <header className="panel-header">Server Channels</header>
        <div className="channel-list">
          {serverChannels.map((channel) => (
            <button
              key={channel.id}
              className={`channel-item ${channel.id === selectedChannelId ? 'active' : ''}`}
              onClick={() => setSelectedChannelId(channel.id)}
            >
              # {channel.name}
            </button>
          ))}
        </div>
      </aside>

      <main className="chat-panel">
        <header className="chat-header">
          <span># {serverChannels.find((c) => c.id === selectedChannelId)?.name ?? 'general'}</span>
          <span className={`socket-badge ${isConnected ? 'ok' : 'down'}`}>
            {isConnected ? 'Connected' : 'Reconnecting'}
          </span>
        </header>

        <MessageListVirtualized messages={messages.filter((m) => m.channelId === selectedChannelId)} />

        <footer className="chat-composer">
          {error && <div className="inline-error">{error}</div>}
          <div className="composer-row">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSend();
              }}
              placeholder="Message #channel"
              maxLength={2000}
            />
            <button onClick={handleSend}>Send</button>
          </div>
        </footer>
      </main>

      <aside className="member-sidebar">
        <header className="panel-header">Members</header>

        <section>
          <h4>ONLINE — {onlineMembers.length}</h4>
          {onlineMembers.map((member) => (
            <div key={member.id} className="member-row online">● {member.username}</div>
          ))}
        </section>

        <section>
          <h4>OFFLINE — {offlineMembers.length}</h4>
          {offlineMembers.map((member) => (
            <div key={member.id} className="member-row offline">● {member.username}</div>
          ))}
        </section>
      </aside>

      <footer className="voice-bar">
        <div className="profile-pill">
          <div className="avatar">Y</div>
          <div>
            <strong>you</strong>
            <span>Online</span>
          </div>
        </div>

        <div className="voice-controls">
          <button title="Mute mic">🎙️</button>
          <button title="Deafen">🎧</button>
          <button title="Settings">⚙️</button>
        </div>
      </footer>
    </div>
  );
}
