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
        className={`fixed left-0 top-0 h-screen w-[240px] border-r border-[#E2E8F0] bg-white shadow-sm flex flex-col justify-between z-40 transition-transform duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
        role="navigation"
        aria-label="Dashboard navigation"
      >
        <div>
          <div className="p-6 flex flex-col space-y-2">
            <div className="flex items-center space-x-2">
              <span className="text-xl font-logo font-bold text-[#0F172A] tracking-tight">Auralis</span>
              <div className="w-2 h-2 rounded-full bg-[#0D9488] shadow-[0_0_8px_rgba(13,148,136,0.8)] animate-blink" aria-hidden="true"></div>
            </div>
            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-[#F1F5F9] border border-[#E2E8F0] w-fit">
              <Building2 className="w-3 h-3 text-[#0D9488]" />
              <span className="text-[11px] font-mono text-[#334155] font-semibold">default_tenant</span>
            </div>
          </div>
          
          <nav className="px-3 space-y-1.5 mt-4 relative" aria-label="Dashboard tabs">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id as Tab)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`relative w-full flex items-center px-3.5 py-2.5 rounded-lg transition-all font-sans text-sm ${
                    isActive
                      ? 'text-[#0F172A] font-semibold'
                      : 'text-[#475569] font-medium hover:bg-[#F8FAFC] hover:text-[#0F172A]'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-pill"
                      className="absolute inset-0 bg-[#F1F5F9] border border-[#CBD5E1] rounded-lg z-0 shadow-xs"
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  )}
                  <div className="relative z-10 flex items-center space-x-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-[#0D9488]' : 'text-[#64748B]'}`} aria-hidden="true" />
                    <span>{item.label}</span>
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-[#E2E8F0] bg-[#F8FAFC]">
          <div className="flex items-center justify-between mb-4 px-1">
            <span className="text-[11px] font-sans font-semibold text-[#64748B] uppercase tracking-wider">Session</span>
            <span className="text-xs font-mono text-[#0F172A] bg-white border border-[#E2E8F0] px-2 py-0.5 rounded font-medium shadow-xs">
              {sessionId.slice(0, 8)}
            </span>
          </div>
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="w-full flex items-center justify-center space-x-2 py-2 px-3 text-[#64748B] hover:text-[#0F172A] hover:bg-white border border-transparent hover:border-[#E2E8F0] no-underline transition-all"
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
