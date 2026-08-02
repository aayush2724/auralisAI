import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, RefreshCw } from 'lucide-react';
import { Button } from '../ui/Button';

const NAV_LINKS = [
  { name: 'Product', href: '/#features' },
  { name: 'Solutions', href: '/#how-it-works' },
  { name: 'Pricing', href: '/pricing' },
  { name: 'Resources', href: '/resources' },
];

export default function PageNavbar({ transparent = false }: { transparent?: boolean }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const handleNav = (href: string) => {
    setOpen(false);
    if (href.startsWith('/#')) {
      navigate('/');
      setTimeout(() => {
        const id = href.replace('/#', '');
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else {
      navigate(href);
    }
  };

  return (
    <header className={`fixed left-0 right-0 top-0 z-50 px-4 py-4 sm:px-6 sm:py-5 ${transparent ? 'bg-transparent' : ''}`}>
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 rounded-[32px] border border-theme-border bg-white/55 px-4 py-3 shadow-[0_18px_60px_rgba(16,32,51,0.08)] backdrop-blur-2xl sm:px-5">
        <Link to="/" className="flex items-center gap-3 pl-1">
          <span className="text-[22px] sm:text-[24px] font-semibold tracking-[-0.05em] text-theme-primary select-none">Auralis</span>
        </Link>

        <nav className="hidden md:flex items-center gap-2">
          {NAV_LINKS.map((link) => {
            const active = location.pathname === link.href;
            return (
              <button
                key={link.name}
                onClick={() => handleNav(link.href)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 ${
                  active
                    ? 'bg-white/80 text-theme-primary shadow-sm'
                    : 'text-theme-secondary hover:bg-white/55 hover:text-theme-primary'
                }`}
              >
                {link.name}
              </button>
            );
          })}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <Button
            variant="secondary"
            onClick={() => navigate('/?login=true')}
            className="rounded-full px-5 py-2.5"
          >
            Login
          </Button>
          <Button
            variant="secondary"
            onClick={() => window.location.reload()}
            className="rounded-full px-4 py-2.5"
            aria-label="Refresh page"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        <button
          className="md:hidden inline-flex h-11 items-center gap-2 rounded-full border border-theme-border bg-white/70 px-4 text-sm font-medium text-theme-primary shadow-sm"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          Menu
          <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mx-auto mt-3 max-w-[1600px] rounded-[28px] border border-theme-border bg-white/78 px-4 py-4 shadow-[0_24px_70px_rgba(16,32,51,0.10)] backdrop-blur-2xl md:hidden"
          >
            <div className="flex flex-col gap-2">
              {NAV_LINKS.map((link) => (
                <button
                  key={link.name}
                  onClick={() => handleNav(link.href)}
                  className="rounded-2xl px-4 py-3 text-left text-sm font-medium text-theme-secondary hover:bg-white/70 hover:text-theme-primary"
                >
                  {link.name}
                </button>
              ))}
              <Button
                onClick={() => { setOpen(false); navigate('/?login=true'); }}
                variant="primary"
                className="mt-2 w-full rounded-full py-3"
              >
                Login
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
