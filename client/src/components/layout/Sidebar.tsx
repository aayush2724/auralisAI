import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, BarChart2, FlaskConical, Database, LogOut, Menu } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { Button } from '../ui/Button';
import IconCircle from '../ui/IconCircle';

export type Tab = 'chat' | 'analytics' | 'ab' | 'kb';

interface SidebarProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  sessionId: string;
  isOpen: boolean;
  onToggle: () => void;
  role: string | null;
}

const navItems = [
  { id: 'chat', label: 'Sales Chat', icon: MessageSquare },
  { id: 'analytics', label: 'Analytics', icon: BarChart2 },
  { id: 'ab', label: 'A/B Test', icon: FlaskConical },
  { id: 'kb', label: 'Knowledge Base', icon: Database },
] as const;

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, sessionId, isOpen, onToggle, role }) => {
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
        className={`fixed left-0 top-0 z-40 flex h-screen w-[300px] -translate-x-full flex-col justify-between border-r border-theme-border bg-white/55 px-5 py-6 shadow-[28px_0_80px_rgba(16,32,51,0.10)] backdrop-blur-2xl transition-transform duration-300 lg:translate-x-0 ${isOpen ? 'translate-x-0' : ''}`}
        role="navigation"
        aria-label="Dashboard navigation"
      >
        <div className="space-y-8">
          <div className="space-y-4 px-2">
            <div className="flex items-start gap-3">
              <div className="flex flex-col">
                <span className="text-2xl font-semibold tracking-[-0.05em] text-theme-primary leading-none">Auralis</span>
                <span className="mt-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-theme-muted">default tenant</span>
              </div>
              <div className="mt-2 h-3 w-3 rounded-full bg-[#4f46e5] shadow-[0_0_18px_rgba(79,70,229,0.7)]" aria-hidden="true" />
            </div>
            <div className="w-fit rounded-full border border-theme-border bg-white/50 px-3 py-1 text-[11px] font-medium text-theme-secondary shadow-sm">
              Live session
            </div>
          </div>

          <nav className="space-y-2" aria-label="Dashboard tabs">
            {visibleItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id as Tab)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`relative flex w-full items-center gap-4 rounded-[24px] px-4 py-4 text-left transition-all duration-200 ${
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
                    className="relative z-10 h-11 w-11"
                    iconClassName={isActive ? 'text-[#4f46e5]' : 'text-theme-muted'}
                  />
                  <span className="relative z-10 text-sm font-semibold tracking-tight">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="space-y-4 border-t border-theme-border pt-5">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-theme-muted">Session</span>
            <span className="rounded-full border border-theme-border bg-white/65 px-3 py-1 text-[11px] font-medium text-theme-primary shadow-sm">
              {sessionId.slice(0, 8)}
            </span>
          </div>
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
