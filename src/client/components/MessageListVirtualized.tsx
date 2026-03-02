import { useMemo, useRef, useState } from 'react';
import { useVirtualMessages } from '../hooks/useVirtualMessages';
import type { MessageItem } from '../types/chat';

interface Props {
  messages: MessageItem[];
}

const ROW_HEIGHT = 52;

export function MessageListVirtualized({ messages }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const containerHeight = 420;

  const { items, offsetTop, offsetBottom } = useVirtualMessages({
    messages,
    scrollTop,
    containerHeight,
    rowHeight: ROW_HEIGHT,
    overscan: 6,
  });

  const onScroll: React.UIEventHandler<HTMLDivElement> = (event) => {
    setScrollTop(event.currentTarget.scrollTop);
  };

  const rows = useMemo(
    () =>
      items.map((message) => (
        <div key={message.id} className="message-row" style={{ height: ROW_HEIGHT }}>
          <div className="message-avatar">{message.author[0]?.toUpperCase() ?? 'U'}</div>
          <div className="message-content">
            <div className="message-meta">
              <strong>{message.author}</strong>
              <span>{new Date(message.createdAt).toLocaleTimeString()}</span>
            </div>
            <p>{message.content}</p>
          </div>
        </div>
      )),
    [items],
  );

  return (
    <div ref={containerRef} className="message-list" style={{ height: containerHeight }} onScroll={onScroll}>
      <div style={{ height: offsetTop }} />
      {rows}
      <div style={{ height: offsetBottom }} />
    </div>
  );
}
