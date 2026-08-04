import React, { useState, useEffect } from 'react';
import { type Tab } from '../components/layout/Sidebar';
import { useAuthStore } from '../store/authStore';
import ChatPanel from '../components/chat/ChatPanel';
import AnalyticsDashboard from '../components/analytics/AnalyticsDashboard';
import KnowledgeBasePanel from '../components/kb/KnowledgeBasePanel';
import DashboardShell from '../components/layout/DashboardShell';
import { chatClient } from '../api/client';
import { type ChatSessionPreview } from '../types/api';

const DashboardPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [sessionId, setSessionId] = useState<string>(() => crypto.randomUUID());
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
  };

  const handleSelectSession = (id: string) => {
    setSessionId(id);
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
