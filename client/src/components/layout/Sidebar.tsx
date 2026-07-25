import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, BarChart2, FlaskConical, Database, LogOut, Menu } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { Button } from '../ui/Button';

export type Tab = 'chat' | 'analytics' | 'ab' | 'kb';

interface SidebarProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  sessionId: string;
  isOpen: boolean;
  onToggle: () => void;
}

const navItems = [
  { id: 'chat', label: 'Sales Chat', icon: MessageSquare },
  { id: 'analytics', label: 'Analytics', icon: BarChart2 },
  { id: 'ab', label: 'A/B Test', icon: FlaskConical },
  { id: 'kb', label: 'Knowledge Base', icon: Database },
] as const;

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, sessionId, isOpen, onToggle }) => {
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
        className="fixed top-4 left-4 z-50 lg:hidden w-10 h-10 flex items-center justify-center rounded-lg bg-white border border-[#F1F3F1] shadow-sm text-[#0a0a0a] hover:bg-[#f9fafb] transition-colors"
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
        className={`fixed left-0 top-0 h-screen w-[240px] border-r border-[#F1F3F1] bg-white flex flex-col justify-between z-40 transition-transform duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
        role="navigation"
        aria-label="Dashboard navigation"
      >
        <div>
          <div className="p-6 flex items-center space-x-2">
            <span className="text-xl font-logo font-semibold text-[#0a0a0a] tracking-tight">Auralis</span>
            <div className="w-2 h-2 rounded-full bg-[#10b981] shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-blink" aria-hidden="true"></div>
          </div>
          
          <nav className="px-3 space-y-1 mt-4 relative" aria-label="Dashboard tabs">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id as Tab)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`relative w-full flex items-center px-3 py-2 rounded-lg transition-all font-sans text-sm ${
                    isActive
                      ? 'text-[#0a0a0a] font-medium'
                      : 'text-auralis-text font-light hover:bg-[#f9fafb]'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-pill"
                      className="absolute inset-0 bg-[#f9fafb] rounded-lg z-0"
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  )}
                  <div className="relative z-10 flex items-center space-x-3">
                    <Icon className="w-4 h-4" aria-hidden="true" />
                    <span>{item.label}</span>
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-[#F1F3F1]">
          <div className="flex items-center justify-between mb-4 px-2">
            <span className="text-xs font-sans font-medium text-auralis-text uppercase tracking-widest">Session</span>
            <span className="text-xs font-mono text-[#6b7280] bg-[#f9fafb] px-2 py-1 rounded">
              {sessionId.slice(0, 8)}
            </span>
          </div>
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="w-full flex items-center justify-center space-x-2 py-2 px-3 text-[#6b7280] hover:text-[#dd6668] no-underline"
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
