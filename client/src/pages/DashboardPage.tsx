import React, { useState, useEffect } from 'react';
import Sidebar, { type Tab } from '../components/layout/Sidebar';
import ChatPanel from '../components/chat/ChatPanel';
import AnalyticsDashboard from '../components/analytics/AnalyticsDashboard';
import ABTestPanel from '../components/ab/ABTestPanel';
import KnowledgeBasePanel from '../components/kb/KnowledgeBasePanel';

const DashboardPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [sessionId] = useState<string>(() => crypto.randomUUID());
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
    <div className="min-h-screen bg-white">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        sessionId={sessionId}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />
      <main className="lg:ml-[240px] h-screen flex flex-col pt-16 lg:pt-0 overflow-hidden">
        {renderContent()}
      </main>
    </div>
  );
};

export default DashboardPage;
