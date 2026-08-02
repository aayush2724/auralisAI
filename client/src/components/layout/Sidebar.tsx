import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, BarChart2, FlaskConical, Database, LogOut, Menu, Building2 } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { Button } from '../ui/Button';

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
    if (window.innerWidth < 1024) {
      onToggle();
    }
  };

  return (
    <>
      <button
        onClick={onToggle}
        className="fixed top-4 left-4 z-50 lg:hidden w-10 h-10 flex items-center justify-center rounded-lg bg-theme-surface-solid border border-theme-border shadow-md text-theme-primary hover:bg-theme-border transition-colors"
        aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
      >
        <Menu className="w-5 h-5" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm lg:hidden"
            onClick={onToggle}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      <aside
        className={`fixed left-0 top-0 h-screen w-[240px] border-r border-theme-border bg-white/90 backdrop-blur-md shadow-md flex flex-col justify-between z-40 transition-transform duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
        role="navigation"
        aria-label="Dashboard navigation"
      >
        <div>
          <div className="p-6 flex flex-col space-y-2">
            <div className="flex items-center space-x-2">
              <span className="text-xl font-logo font-bold text-theme-primary tracking-tight">Auralis</span>
              <div className="w-2 h-2 rounded-full bg-[#dd6668] shadow-[0_0_8px_rgba(221,102,104,0.5)] animate-blink" aria-hidden="true"></div>
            </div>
            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-theme-border border border-theme-border-strong w-fit">
              <Building2 className="w-3 h-3 text-[#dd6668]" />
              <span className="text-[11px] font-mono text-theme-muted font-semibold">default_tenant</span>
            </div>
          </div>
          
          <nav className="px-3 space-y-1.5 mt-4 relative" aria-label="Dashboard tabs">
            {(role === 'admin' ? navItems : navItems.filter(item => item.id === 'chat')).map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                   key={item.id}
                   onClick={() => handleNavClick(item.id as Tab)}
                   aria-current={isActive ? 'page' : undefined}
                   className={`relative w-full flex items-center px-3.5 py-2.5 rounded-lg transition-all font-sans text-sm z-10 ${
                     isActive
                       ? 'text-theme-primary font-semibold'
                       : 'text-theme-muted font-medium hover:bg-theme-border hover:text-theme-primary'
                   }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-pill"
                      className="absolute inset-0 bg-gradient-to-r from-[rgba(221,102,104,0.12)] to-[rgba(244,162,97,0.12)] border border-theme-border-strong rounded-lg z-0 shadow-[0_0_12px_rgba(221,102,104,0.15)]"
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  )}
                  <div className="relative z-10 flex items-center space-x-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-[#dd6668]' : 'text-theme-muted'}`} aria-hidden="true" />
                    <span>{item.label}</span>
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-theme-border bg-slate-50/50">
          <div className="flex items-center justify-between mb-4 px-1">
            <span className="text-[11px] font-sans font-semibold text-theme-muted uppercase tracking-wider">Session</span>
            <span className="text-xs font-mono text-theme-primary bg-theme-bg border border-theme-border px-2 py-0.5 rounded font-medium shadow-xs">
              {sessionId.slice(0, 8)}
            </span>
          </div>
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="w-full flex items-center justify-center space-x-2 py-2 px-3 text-theme-muted hover:text-theme-primary hover:bg-theme-border border border-transparent hover:border-theme-border no-underline transition-all"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
            <span>Logout</span>
          </Button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
