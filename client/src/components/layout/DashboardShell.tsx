import type { ReactNode } from 'react';
import Sidebar, { type Tab } from './Sidebar';
import AmbientBackground from '../ui/AmbientBackground';

export default function DashboardShell({
  children,
  activeTab,
  setActiveTab,
  sessionId,
  sidebarOpen,
  setSidebarOpen,
  role,
}: {
  children: ReactNode;
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  sessionId: string;
  sidebarOpen: boolean;
  setSidebarOpen: (value: boolean) => void;
  role: string | null;
}) {
  return (
    <div className="h-screen light-shell relative overflow-hidden bg-theme-bg text-theme-primary font-sans">
      <AmbientBackground />
      <div className="relative z-10 flex h-screen">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          sessionId={sessionId}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          role={role}
        />
        <main className="flex h-screen flex-1 flex-col lg:ml-[300px] p-3 sm:p-4 lg:p-6">
          <div className="glass-panel h-[calc(100vh-1.5rem)] overflow-hidden rounded-[var(--radius-container)]">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

