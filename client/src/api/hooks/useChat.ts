import { useCallback, useEffect, useRef, useState } from 'react';
import { chatRequest } from '../client';
import type { ChatResponse, ChatRequest, Message } from '../../types/api';

type WebSocketEvent =
  | { type: 'chat_response'; data: ChatResponse }
  | { type: 'error'; detail: string };

function buildWebSocketUrl(token: string): string {
  const baseUrl = import.meta.env.VITE_API_URL || '/api';
  if (baseUrl.startsWith('http://') || baseUrl.startsWith('https://')) {
    const wsUrl = new URL(baseUrl);
    wsUrl.protocol = wsUrl.protocol === 'https:' ? 'wss:' : 'ws:';
    wsUrl.pathname = `${wsUrl.pathname.replace(/\/$/, '')}/ws/chat`;
    wsUrl.searchParams.set('token', token);
    return wsUrl.toString();
  }

  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const path = `${baseUrl.startsWith('/') ? baseUrl : `/${baseUrl}`}`.replace(/\/$/, '');
  return `${protocol}://${window.location.host}${path}/ws/chat?token=${encodeURIComponent(token)}`;
}

export const useChat = (sessionId: string) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [lastResponse, setLastResponse] = useState<ChatResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const pendingSourceRef = useRef<string | null>(null);
  const [wsError, setWsError] = useState<string | null>(null);

  const appendAssistantMessage = useCallback((data: ChatResponse, source: string) => {
    setLastResponse(data);
    const assistantMessage: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: data.response,
      timestamp: new Date(),
      responseMeta: data,
      sourceMessage: source,
    };
    setMessages((prev) => [...prev, assistantMessage]);
  }, []);

  const sendWithHttpFallback = useCallback(async (message: string) => {
    try {
      const req: ChatRequest = { session_id: sessionId, message };
      const data = await chatRequest<ChatResponse>(req);
      appendAssistantMessage(data, message);
    } catch (error: any) {
      const errMsg = error.response?.data?.detail || "The AI is currently busy, please try again in a moment.";
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `**Error**: ${errMsg}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    }
  }, [appendAssistantMessage, sessionId]);

  const ensureSocket = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState <= WebSocket.OPEN) {
      return wsRef.current;
    }

    const token = localStorage.getItem('auralis_token');
    if (!token) {
      setWsError('Missing auth token for WebSocket connection.');
      return null;
    }

    const socket = new WebSocket(buildWebSocketUrl(token));
    socket.onmessage = (event) => {
      try {
        const payload: WebSocketEvent = JSON.parse(event.data);
        if (payload.type === 'chat_response') {
          appendAssistantMessage(payload.data, pendingSourceRef.current ?? '');
          pendingSourceRef.current = null;
          setIsLoading(false);
        } else if (payload.type === 'error') {
          setWsError(payload.detail);
          const assistantMessage: Message = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: `**Error**: ${payload.detail}`,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, assistantMessage]);
          pendingSourceRef.current = null;
          setIsLoading(false);
        }
      } catch {
        setWsError('Invalid message received from WebSocket.');
        pendingSourceRef.current = null;
        setIsLoading(false);
      }
    };
    socket.onerror = () => {
      setWsError('WebSocket connection failed. Falling back to HTTP.');
    };
    socket.onclose = () => {
      wsRef.current = null;
      if (pendingSourceRef.current) {
        const pendingMessage = pendingSourceRef.current;
        pendingSourceRef.current = null;
        void sendWithHttpFallback(pendingMessage)
          .catch(() => {
            setWsError('WebSocket disconnected and HTTP fallback failed.');
          })
          .finally(() => {
            setIsLoading(false);
          });
      }
    };
    wsRef.current = socket;
    return socket;
  }, [appendAssistantMessage, sendWithHttpFallback]);

  useEffect(() => {
    return () => {
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [sessionId]);

  const sendMessage = async (message: string) => {
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: message,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setWsError(null);
    pendingSourceRef.current = message;

    try {
      const socket = ensureSocket();
      if (!socket) {
        await sendWithHttpFallback(message);
        pendingSourceRef.current = null;
        setIsLoading(false);
        return;
      }

      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ session_id: sessionId, message }));
        return;
      }

      await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          reject(new Error('WebSocket open timeout'));
        }, 5000);

        const handleOpen = () => {
          window.clearTimeout(timeout);
          socket.removeEventListener('open', handleOpen);
          socket.removeEventListener('error', handleError);
          resolve();
        };

        const handleError = () => {
          window.clearTimeout(timeout);
          socket.removeEventListener('open', handleOpen);
          socket.removeEventListener('error', handleError);
          reject(new Error('WebSocket connection error'));
        };

        socket.addEventListener('open', handleOpen);
        socket.addEventListener('error', handleError);
      });

      socket.send(JSON.stringify({ session_id: sessionId, message }));
    } catch {
      try {
        await sendWithHttpFallback(message);
      } finally {
        pendingSourceRef.current = null;
        setIsLoading(false);
      }
    }
  };

  return {
    messages,
    sendMessage,
    clearMessages: () => {
      setMessages([]);
      setLastResponse(null);
      setWsError(null);
    },
    isLoading,
    lastResponse,
    wsError,
  };
};
