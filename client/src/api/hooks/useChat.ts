import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { chatRequest, chatClient } from '../client';
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
    window.dispatchEvent(new Event('chat_updated'));
  }, []);

  const sendWithHttpFallback = useCallback(async (message: string) => {
    try {
      const req: ChatRequest = { session_id: sessionId, message };
      const data = await chatRequest<ChatResponse>(req);
      appendAssistantMessage(data, message);
    } catch (error: unknown) {
      let errMsg = "The AI is currently busy, please try again in a moment.";
      if (axios.isAxiosError(error)) {
        errMsg = error.response?.data?.detail || errMsg;
      } else if (error instanceof Error) {
        errMsg = error.message;
      }
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
    let active = true;
    
    // Immediately clear state for the new session
    setMessages([]);
    setLastResponse(null);
    setWsError(null);
    setIsLoading(true);
    pendingSourceRef.current = null;

    const fetchHistory = async () => {
      try {
        const { data } = await chatClient.get<any[]>(`/chat/history/${sessionId}`);
        if (!active) return;
        
        const mappedMessages: Message[] = data.map((msg) => {
          const hasMeta = msg.metadata && (msg.metadata.persona || msg.metadata.objection);
          return {
            id: msg.id || crypto.randomUUID(),
            role: msg.role === 'assistant' ? 'assistant' : 'user',
            content: msg.content,
            timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
            responseMeta: hasMeta ? {
              response: msg.content,
              session_id: sessionId,
              objection_label: msg.metadata?.objection?.label || 'neutral',
              confidence: msg.metadata?.objection?.confidence ?? 1.0,
              sentiment: msg.metadata?.sentiment?.label || 'neutral',
              persona: msg.metadata?.persona?.label || 'Unknown',
              strategy: msg.metadata?.strategy || 'discovery_questions',
              should_handoff: msg.metadata?.should_handoff || false,
              memory_context: '',
              retrieved_docs: [],
              explanation: msg.metadata?.explanation || {
                objection_reason: '',
                persona_reason: '',
                sentiment_reason: '',
                strategy_reason: '',
                trigger_phrases: [],
              }
            } : undefined
          };
        });
        setMessages(mappedMessages);
      } catch (err) {
        if (active) {
          const status = axios.isAxiosError(err) ? err.response?.status : undefined;
          if (status === 404) {
            // Genuinely new/empty session — expected, no error needed
            setMessages([]);
          } else {
            // Unexpected failure — log it so this class of bug isn't invisible again
            console.error('Failed to load chat history for session', sessionId, err);
            setWsError('Could not load previous messages for this session.');
            setMessages([]);
          }
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    fetchHistory();

    return () => {
      active = false;
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
    window.dispatchEvent(new Event('chat_updated'));
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
