import { useMemo } from 'react';
import type { MessageItem } from '../types/chat';

interface UseVirtualMessagesArgs {
  messages: MessageItem[];
  scrollTop: number;
  containerHeight: number;
  rowHeight: number;
  overscan?: number;
}

export function useVirtualMessages({
  messages,
  scrollTop,
  containerHeight,
  rowHeight,
  overscan = 8,
}: UseVirtualMessagesArgs) {
  return useMemo(() => {
    const total = messages.length;
    const visibleCount = Math.ceil(containerHeight / rowHeight);
    const start = Math.max(Math.floor(scrollTop / rowHeight) - overscan, 0);
    const end = Math.min(start + visibleCount + overscan * 2, total);

    const offsetTop = start * rowHeight;
    const offsetBottom = Math.max((total - end) * rowHeight, 0);
    const items = messages.slice(start, end);

    return { items, start, end, offsetTop, offsetBottom, totalHeight: total * rowHeight };
  }, [containerHeight, messages, overscan, rowHeight, scrollTop]);
}
