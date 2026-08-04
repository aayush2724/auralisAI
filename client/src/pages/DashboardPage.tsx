import React, { useState, useEffect } from 'react';
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
  const [sessionId, setSessionId] = useState<string>(() => {
    const urlSessionId = searchParams.get(CHAT_SESSION_QUERY_KEY);
    if (urlSessionId) return urlSessionId;

    const savedSessionId = window.localStorage.getItem(ACTIVE_CHAT_SESSION_KEY);
    return savedSessionId || crypto.randomUUID();
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sessions, setSessions] = useState<ChatSessionPreview[]>([]);
  const role = useAuthStore((state) => state.role);

  const fetchSessions = async () => {
    try {
      const { data } = await chatClient.get<ChatSessionPreview[]>('/chat/sessions');
      setSessions(data);
    } catch (err) {
      console.error('Error fetching sessions:', err);
    }
  };

  useEffect(() => {
    fetchSessions();

    // Refresh sessions list when a chat message is sent/received
    const handleChatUpdated = () => {
      // Small delay to allow DB write to complete
      setTimeout(fetchSessions, 800);
    };

    window.addEventListener('chat_updated', handleChatUpdated);

    // Poll every 30 seconds for fresh data
    const interval = setInterval(fetchSessions, 30_000);

    return () => {
      window.removeEventListener('chat_updated', handleChatUpdated);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(ACTIVE_CHAT_SESSION_KEY, sessionId);
  }, [sessionId]);

  useEffect(() => {
    const urlSessionId = searchParams.get(CHAT_SESSION_QUERY_KEY);
    if (urlSessionId && urlSessionId !== sessionId) {
      setSessionId(urlSessionId);
      return;
    }

    if (!urlSessionId) {
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
      // Always refetch to update the list
      fetchSessions();
    } catch (err) {
      console.error('Error deleting session:', err);
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'chat':
        return <ChatPanel key={sessionId} sessionId={sessionId} />;
      case 'analytics':
        return <AnalyticsDashboard />;
      case 'kb':
        return <KnowledgeBasePanel />;
      default:
        return null;
    }
  };

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
      sessions={sessions}
    >
      <div className="h-full overflow-hidden">
        {renderContent()}
      </div>
    </DashboardShell>
  );
};

export default DashboardPage;
