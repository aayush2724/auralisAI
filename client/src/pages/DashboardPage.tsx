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

    const handleChatUpdated = () => {
      fetchSessions();
    };

    window.addEventListener('chat_updated', handleChatUpdated);
    return () => {
      window.removeEventListener('chat_updated', handleChatUpdated);
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
      } else {
        fetchSessions();
      }
    } catch (err) {
      console.error('Error deleting session:', err);
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
      <div className="h-full overflow-hidden relative">
        <div className={`h-full ${activeTab === 'chat' ? 'block' : 'hidden'}`}>
          <ChatPanel key={sessionId} sessionId={sessionId} />
        </div>
        {activeTab === 'analytics' && (
          <div className="h-full overflow-y-auto">
            <AnalyticsDashboard />
          </div>
        )}
        {activeTab === 'kb' && (
          <div className="h-full overflow-y-auto">
            <KnowledgeBasePanel />
          </div>
        )}
      </div>
    </DashboardShell>
  );
};

export default DashboardPage;
