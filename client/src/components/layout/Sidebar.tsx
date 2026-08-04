import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, BarChart2, Database, LogOut, Menu, MessageSquarePlus, Trash2, Clock } from 'lucide-react';
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

function groupSessionsByDate(sessions: ChatSessionPreview[]): { label: string; items: ChatSessionPreview[] }[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const last7 = new Date(today);
  last7.setDate(last7.getDate() - 7);
  const last30 = new Date(today);
  last30.setDate(last30.getDate() - 30);

  const groups: { label: string; items: ChatSessionPreview[] }[] = [
    { label: 'Today', items: [] },
    { label: 'Yesterday', items: [] },
    { label: 'Last 7 Days', items: [] },
    { label: 'Last 30 Days', items: [] },
    { label: 'Older', items: [] },
  ];

  for (const session of sessions) {
    const date = session.updated_at ? new Date(session.updated_at) : null;
    if (!date) {
      groups[4].items.push(session);
      continue;
    }
    const sessionDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    if (sessionDay >= today) {
      groups[0].items.push(session);
    } else if (sessionDay >= yesterday) {
      groups[1].items.push(session);
    } else if (date >= last7) {
      groups[2].items.push(session);
    } else if (date >= last30) {
      groups[3].items.push(session);
    } else {
      groups[4].items.push(session);
    }
  }

  return groups.filter((g) => g.items.length > 0);
}

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
  sessions = [],
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

  const groupedSessions = useMemo(() => groupSessionsByDate(sessions), [sessions]);

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
        className={`fixed left-0 top-0 z-40 flex h-screen w-[300px] -translate-x-full flex-col border-r border-theme-border bg-white/55 shadow-[28px_0_80px_rgba(16,32,51,0.10)] backdrop-blur-2xl transition-transform duration-300 lg:translate-x-0 ${isOpen ? 'translate-x-0' : ''}`}
        role="navigation"
        aria-label="Dashboard navigation"
      >
        {/* Header */}
        <div className="shrink-0 px-4 py-4 space-y-4">
          <div className="flex items-start gap-3 px-2">
            <div className="flex flex-col">
              <span className="text-2xl font-semibold tracking-[-0.05em] text-theme-primary leading-none">Auralis</span>
              <span className="mt-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-theme-muted">default tenant</span>
            </div>
          </div>

          {/* New Chat Button */}
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

          {/* Nav Items */}
          <nav className="space-y-1" aria-label="Dashboard tabs">
            {visibleItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id as Tab)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`relative flex w-full items-center gap-3 rounded-[24px] px-3 py-2.5 text-left transition-all duration-200 ${
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
        </div>

        {/* Chat History - always shown when on chat tab */}
        {activeTab === 'chat' && (
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col border-t border-theme-border/50">
            <div className="px-5 pt-4 pb-2 shrink-0 flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-theme-muted" />
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-theme-muted">
                Chat History
              </span>
            </div>

            <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-4 scrollbar-thin scrollbar-thumb-theme-border scrollbar-track-transparent">
              {sessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                  <div className="h-10 w-10 rounded-full bg-theme-border/30 flex items-center justify-center mb-3">
                    <MessageSquare className="h-4 w-4 text-theme-muted" />
                  </div>
                  <p className="text-xs font-medium text-theme-muted">No conversations yet</p>
                  <p className="text-[10px] text-theme-muted/70 mt-1">Start a new chat to begin</p>
                </div>
              ) : (
                groupedSessions.map((group) => (
                  <div key={group.label}>
                    <div className="px-2 mb-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-theme-muted/60">
                        {group.label}
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      {group.items.map((session) => {
                        const isActive = currentSessionId === session.session_id;
                        const title = session.company_name || 'New Conversation';
                        const preview = session.preview || 'No messages yet';

                        return (
                          <motion.div
                            key={session.session_id}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.15 }}
                            className={`group relative flex items-center rounded-xl transition-all duration-150 ${
                              isActive
                                ? 'bg-white/75 shadow-[0_4px_16px_rgba(79,70,229,0.08)] ring-1 ring-white/70'
                                : 'hover:bg-white/45'
                            }`}
                          >
                            <button
                              onClick={() => {
                                onSelectSession?.(session.session_id);
                                if (window.innerWidth < 1024) onToggle();
                              }}
                              className="flex-1 min-w-0 px-3 py-2.5 text-left"
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                {isActive && (
                                  <span className="shrink-0 h-1.5 w-1.5 rounded-full bg-[#4f46e5]" />
                                )}
                                <span className={`truncate text-xs font-semibold ${isActive ? 'text-theme-primary' : 'text-theme-secondary'}`}>
                                  {title}
                                </span>
                                {session.persona_label && (
                                  <span className="shrink-0 rounded-full border border-theme-border/60 bg-white/80 px-1.5 py-0.5 text-[9px] font-medium text-theme-secondary">
                                    {session.persona_label}
                                  </span>
                                )}
                              </div>
                              <p className="truncate text-[10px] text-theme-muted mt-0.5 leading-relaxed">
                                {preview}
                              </p>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteSession?.(session.session_id);
                              }}
                              className="shrink-0 mr-2 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all duration-150 p-1.5 rounded-lg hover:bg-red-50"
                              aria-label="Delete chat session"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-theme-muted hover:text-red-500" />
                            </button>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="shrink-0 border-t border-theme-border px-4 py-4">
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
