import React, { useState, useEffect } from 'react';
import { type Tab } from '../components/layout/Sidebar';
import { useAuthStore } from '../store/authStore';
import ChatPanel from '../components/chat/ChatPanel';
import AnalyticsDashboard from '../components/analytics/AnalyticsDashboard';
import ABTestPanel from '../components/ab/ABTestPanel';
import KnowledgeBasePanel from '../components/kb/KnowledgeBasePanel';
import DashboardShell from '../components/layout/DashboardShell';

const DashboardPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [sessionId] = useState<string>(() => crypto.randomUUID());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const role = useAuthStore((state) => state.role);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case 'chat':
        return <ChatPanel sessionId={sessionId} />;
      case 'analytics':
        return <AnalyticsDashboard />;
      case 'ab':
        return <ABTestPanel />;
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
      sessionId={sessionId}
      sidebarOpen={sidebarOpen}
      setSidebarOpen={setSidebarOpen}
      role={role}
    >
      <div className="h-full overflow-hidden">
        {renderContent()}
      </div>
    </DashboardShell>
  );
};

export default DashboardPage;
