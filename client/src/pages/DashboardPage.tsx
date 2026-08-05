import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { type Tab } from '../components/layout/Sidebar';
import { useAuthStore } from '../store/authStore';
import ChatPanel from '../components/chat/ChatPanel';
import AnalyticsDashboard from '../components/analytics/AnalyticsDashboard';
import KnowledgeBasePanel from '../components/kb/KnowledgeBasePanel';
import DashboardShell from '../components/layout/DashboardShell';
import { chatClient } from '../api/client';
import { type ChatSessionPreview } from '../types/api';

const ACTIVE_CHAT_SESSION_KEY = 'auralis_active_chat_session_id';
const CHAT_SESSION_QUERY_KEY = 'session';

const DashboardPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [sessionId, setSessionId] = useState<string | null>(() => {
    const urlSessionId = searchParams.get(CHAT_SESSION_QUERY_KEY);
    if (urlSessionId) return urlSessionId;

    const savedSessionId = window.localStorage.getItem(ACTIVE_CHAT_SESSION_KEY);
    return savedSessionId || null;
  });
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sessions, setSessions] = useState<ChatSessionPreview[]>([]);
  const [isInitializing, setIsInitializing] = useState(true);
  const role = useAuthStore((state) => state.role);
  const isInitialLoad = useRef(true);

  const fetchSessions = async () => {
    try {
      const { data } = await chatClient.get<ChatSessionPreview[]>('/chat/sessions');
      setSessions(data);
      return data;
    } catch (err) {
      console.error('Error fetching sessions:', err);
      return [];
    }
  };

  useEffect(() => {
    const init = async () => {
      const data = await fetchSessions();
      
      if (isInitialLoad.current) {
        if (!sessionId) {
          if (data.length > 0) {
            handleSelectSession(data[0].session_id);
          } else {
            handleNewChat();
          }
        }
        isInitialLoad.current = false;
        setIsInitializing(false);
      }
    };
    init();

    const handleChatUpdated = () => {
      setTimeout(fetchSessions, 800);
    };

    window.addEventListener('chat_updated', handleChatUpdated);
    const interval = setInterval(fetchSessions, 30_000);

    return () => {
      window.removeEventListener('chat_updated', handleChatUpdated);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (sessionId) {
      window.localStorage.setItem(ACTIVE_CHAT_SESSION_KEY, sessionId);
    }
  }, [sessionId]);

  useEffect(() => {
    const urlSessionId = searchParams.get(CHAT_SESSION_QUERY_KEY);
    if (urlSessionId && urlSessionId !== sessionId) {
      setSessionId(urlSessionId);
      return;
    }

    if (!urlSessionId && sessionId) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set(CHAT_SESSION_QUERY_KEY, sessionId);
        return next;
      }, { replace: true });
    }
  }, [searchParams, sessionId, setSearchParams]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleNewChat = () => {
    const newId = crypto.randomUUID();
    setSessionId(newId);
    window.localStorage.setItem(ACTIVE_CHAT_SESSION_KEY, newId);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set(CHAT_SESSION_QUERY_KEY, newId);
      return next;
    }, { replace: true });
  };

  const handleSelectSession = (id: string) => {
    setSessionId(id);
    window.localStorage.setItem(ACTIVE_CHAT_SESSION_KEY, id);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set(CHAT_SESSION_QUERY_KEY, id);
      return next;
    }, { replace: true });
  };

  const handleDeleteSession = async (id: string) => {
    if (!confirm('Are you sure you want to delete this chat session?')) return;
    try {
      await chatClient.delete(`/chat/session/${id}`);
      if (sessionId === id) {
        handleNewChat();
      }
      fetchSessions();
    } catch (err) {
      console.error('Error deleting session:', err);
    }
  };

  const handleRenameSession = async (id: string, newTitle: string) => {
    try {
      await chatClient.put(`/chat/session/${id}`, { title: newTitle });
      fetchSessions();
    } catch (err) {
      console.error('Error renaming session:', err);
    }
  };

  if (isInitializing || !sessionId) {
    return (
      <DashboardShell
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onNewChat={handleNewChat}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        role={role}
        currentSessionId={sessionId || undefined}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
        onRenameSession={handleRenameSession}
        sessions={sessions}
      >
        <div className="flex h-full items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#4f46e5] border-t-transparent" />
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      onNewChat={handleNewChat}
      sidebarOpen={sidebarOpen}
      setSidebarOpen={setSidebarOpen}
      role={role}
      currentSessionId={sessionId}
      onSelectSession={handleSelectSession}
      onDeleteSession={handleDeleteSession}
      onRenameSession={handleRenameSession}
      sessions={sessions}
    >
      <div className="h-full overflow-hidden relative">
        <div className={`absolute inset-0 transition-opacity duration-200 ${activeTab === 'chat' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
          <ChatPanel sessionId={sessionId} />
        </div>
        
        {activeTab === 'analytics' && (
          <div className="absolute inset-0 z-10 bg-theme-bg overflow-y-auto">
            <AnalyticsDashboard />
          </div>
        )}
        
        {activeTab === 'kb' && (
          <div className="absolute inset-0 z-10 bg-theme-bg overflow-y-auto">
            <KnowledgeBasePanel />
          </div>
        )}
      </div>
    </DashboardShell>
  );
};

export default DashboardPage;
