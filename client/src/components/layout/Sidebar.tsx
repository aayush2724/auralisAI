import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, BarChart2, Database, LogOut, Menu, MessageSquarePlus, Trash2 } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { Button } from '../ui/Button';
import IconCircle from '../ui/IconCircle';
import { type ChatSessionPreview } from '../../types/api';

export type Tab = 'chat' | 'analytics' | 'kb';

interface SidebarProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  onNewChat: () => void;
  isOpen: boolean;
  onToggle: () => void;
  role: string | null;
  currentSessionId?: string;
  onSelectSession?: (sessionId: string) => void;
  onDeleteSession?: (sessionId: string) => void;
  sessions?: ChatSessionPreview[];
}

const navItems = [
  { id: 'chat', label: 'Sales Chat', icon: MessageSquare },
  { id: 'analytics', label: 'Analytics', icon: BarChart2 },
  { id: 'kb', label: 'Knowledge Base', icon: Database },
] as const;

const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  onNewChat,
  isOpen,
  onToggle,
  role,
  currentSessionId,
  onSelectSession,
  onDeleteSession,
  sessions,
}) => {
  const clearToken = useAuthStore((state) => state.clearToken);

  const handleLogout = () => {
    clearToken();
    window.location.href = '/';
  };

  const handleNavClick = (tab: Tab) => {
    setActiveTab(tab);
    if (window.innerWidth < 1024) onToggle();
  };

  const visibleItems = role === 'admin' ? navItems : navItems.filter((item) => item.id === 'chat');

  return (
    <>
      <button
        onClick={onToggle}
        className="fixed left-4 top-4 z-50 inline-flex h-12 w-12 items-center justify-center rounded-full border border-theme-border bg-theme-surface-solid text-theme-primary shadow-[0_10px_30px_rgba(16,32,51,0.12)] backdrop-blur-xl lg:hidden"
        aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
      >
        <Menu className="h-5 w-5" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-30 bg-slate-950/20 backdrop-blur-sm lg:hidden"
            onClick={onToggle}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      <aside
        className={`fixed left-0 top-0 z-40 flex h-screen w-[300px] -translate-x-full flex-col justify-between border-r border-theme-border bg-white/55 px-4 py-4 shadow-[28px_0_80px_rgba(16,32,51,0.10)] backdrop-blur-2xl transition-transform duration-300 lg:translate-x-0 ${isOpen ? 'translate-x-0' : ''}`}
        role="navigation"
        aria-label="Dashboard navigation"
      >
        <div className="space-y-6 flex flex-col h-[calc(100vh-80px)]">
          <div className="space-y-4 px-2 shrink-0">
            <div className="flex items-start gap-3">
              <div className="flex flex-col">
                <span className="text-2xl font-semibold tracking-[-0.05em] text-theme-primary leading-none">Auralis</span>
                <span className="mt-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-theme-muted">default tenant</span>
              </div>
            </div>
          </div>

          <div className="px-2 shrink-0">
            <button
              onClick={() => {
                onNewChat();
                setActiveTab('chat');
                if (window.innerWidth < 1024) onToggle();
              }}
              className="relative flex w-full items-center gap-3 rounded-[24px] border border-[#4f46e5]/20 bg-gradient-to-r from-[rgba(79,70,229,0.14)] to-[rgba(13,148,136,0.10)] px-3 py-3 text-left text-theme-primary shadow-sm hover:opacity-80 transition-all duration-200"
            >
              <IconCircle
                icon={MessageSquarePlus}
                variant="primary"
                className="relative z-10 h-9 w-9"
                iconClassName="text-[#4f46e5]"
              />
              <span className="relative z-10 text-sm font-semibold tracking-tight">New Chat</span>
            </button>
          </div>

          <nav className="space-y-2 shrink-0" aria-label="Dashboard tabs">
            {visibleItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id as Tab)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`relative flex w-full items-center gap-3 rounded-[24px] px-3 py-3 text-left transition-all duration-200 ${
                    isActive
                      ? 'bg-white/75 text-theme-primary shadow-[0_12px_32px_rgba(79,70,229,0.14)] ring-1 ring-white/70'
                      : 'text-theme-secondary hover:bg-white/45 hover:text-theme-primary'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-pill"
                      className="absolute inset-0 rounded-[24px] border border-white/80 bg-gradient-to-r from-[rgba(79,70,229,0.14)] to-[rgba(13,148,136,0.10)] shadow-[0_0_24px_rgba(79,70,229,0.12)]"
                      transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                    />
                  )}
                  <IconCircle
                    icon={Icon}
                    variant={isActive ? 'primary' : 'neutral'}
                    className="relative z-10 h-9 w-9"
                    iconClassName={isActive ? 'text-[#4f46e5]' : 'text-theme-muted'}
                  />
                  <span className="relative z-10 text-sm font-semibold tracking-tight">{item.label}</span>
                </button>
              );
            })}
          </nav>

          {activeTab === 'chat' && sessions && sessions.length > 0 && (
            <div className="flex-1 overflow-y-auto px-2 space-y-2 mt-2 border-t border-theme-border/50 pt-4 min-h-0">
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-theme-muted px-2 mb-2">
                Recent Chats
              </div>
              <div className="space-y-1">
                {sessions.map((session) => {
                  const isActive = currentSessionId === session.session_id;
                  return (
                    <div
                      key={session.session_id}
                      className={`group relative flex items-center justify-between rounded-xl px-3 py-2 text-left transition-all duration-200 ${
                        isActive
                          ? 'bg-white/75 text-theme-primary shadow-[0_4px_16px_rgba(79,70,229,0.08)] ring-1 ring-white/70'
                          : 'text-theme-secondary hover:bg-white/45 hover:text-theme-primary'
                      }`}
                    >
                      <button
                        onClick={() => {
                          onSelectSession?.(session.session_id);
                          if (window.innerWidth < 1024) onToggle();
                        }}
                        className="flex-1 min-w-0 pr-6 text-left"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-xs font-semibold">
                            {session.company_name || 'New Lead'}
                          </span>
                          {session.persona_label && (
                            <span className="rounded-full border border-theme-border/60 bg-white/80 px-1.5 py-0.5 text-[9px] font-medium text-theme-secondary scale-90 origin-left">
                              {session.persona_label}
                            </span>
                          )}
                        </div>
                        <p className="truncate text-[10px] text-theme-muted mt-0.5">
                          {session.preview}
                        </p>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteSession?.(session.session_id);
                        }}
                        className="absolute right-2 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity p-1 rounded-md hover:bg-white/80"
                        aria-label="Delete chat session"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-theme-muted hover:text-red-500" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4 border-t border-theme-border pt-4 shrink-0">
          <Button
            variant="secondary"
            onClick={handleLogout}
            className="w-full justify-center py-3"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            <span>Logout</span>
          </Button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
