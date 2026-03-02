import { useCallback, useEffect, useRef, useState } from 'react';
import type { IncomingWsMessage, MessageItem } from '../types/chat';

interface UseWebSocketOptions {
  url: string;
  onMessageCreated?: (message: MessageItem) => void;
  onError?: (error: string) => void;
}

/**
 * Resilient websocket hook:
 * - auto reconnect with capped backoff
 * - safe JSON parsing
 * - explicit send helper
 */
export function useWebSocket({ url, onMessageCreated, onError }: UseWebSocketOptions) {
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectAttemptRef = useRef(0);
  const [isConnected, setIsConnected] = useState(false);

  const clearReconnectTimer = () => {
    if (reconnectTimerRef.current !== null) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  };

  const connect = useCallback(() => {
    clearReconnectTimer();

    try {
      const socket = new WebSocket(url);
      socketRef.current = socket;

      socket.onopen = () => {
        reconnectAttemptRef.current = 0;
        setIsConnected(true);
      };

      socket.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data) as IncomingWsMessage;
          if (parsed.type === 'message_created') {
            onMessageCreated?.(parsed.payload);
          }
        } catch {
          onError?.('Failed to parse websocket payload');
        }
      };

      socket.onerror = () => {
        onError?.('WebSocket error occurred');
      };

      socket.onclose = () => {
        setIsConnected(false);

        // Exponential backoff: 0.5s, 1s, 2s, 4s, 8s max
        const attempt = reconnectAttemptRef.current;
        const delay = Math.min(500 * 2 ** attempt, 8_000);
        reconnectAttemptRef.current += 1;

        reconnectTimerRef.current = window.setTimeout(() => {
          connect();
        }, delay);
      };
    } catch {
      onError?.('Unable to initialize websocket connection');
    }
  }, [onError, onMessageCreated, url]);

  useEffect(() => {
    connect();

    return () => {
      clearReconnectTimer();
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [connect]);

  const send = useCallback((event: string, payload: unknown) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;

    socket.send(JSON.stringify({ event, payload }));
    return true;
  }, []);

  return { isConnected, send };
}
