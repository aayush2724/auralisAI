import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const NAV_LINKS = [
  { name: 'Product',   href: '/#features'     },
  { name: 'Solutions', href: '/#how-it-works'  },
  { name: 'Pricing',   href: '/pricing'        },
  { name: 'Resources', href: '/resources'      },
];

export default function PageNavbar({ transparent = false }: { transparent?: boolean }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const handleNav = (href: string) => {
    setOpen(false);
    if (href.startsWith('/#')) {
      navigate('/');
      // Allow landing page to mount, then scroll
      setTimeout(() => {
        const id = href.replace('/#', '');
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else {
      navigate(href);
    }
  };

  const bgClass = transparent 
    ? 'bg-transparent'
    : 'bg-white/80 backdrop-blur-md border-b border-[#f3f4f6]';

  return (
    <header className={`fixed top-0 inset-x-0 z-50 px-5 sm:px-8 py-4 sm:py-5 flex flex-row justify-between items-center transition-colors duration-300 ${bgClass}`}>
      <Link to="/" className="flex items-center">
        <span className="text-[22px] sm:text-[24px] tracking-tight text-[#0a0a0a] font-logo font-semibold select-none">Auralis</span>
      </Link>

      {/* Desktop */}
      <nav className="hidden md:flex flex-row items-center gap-8 text-sm font-sans font-medium text-[#6b7280]">
        {NAV_LINKS.map((link) => {
          const active = location.pathname === link.href;
          return (
            <button
              key={link.name}
              onClick={() => handleNav(link.href)}
              className={`transition-colors hover:text-[#0a0a0a] ${active ? 'text-[#0a0a0a]' : ''}`}
            >
              {link.name}
            </button>
          );
        })}
      </nav>

      <button
        onClick={() => navigate('/?login=true')}
        className="hidden md:block text-sm font-sans font-medium text-[#6b7280] hover:text-[#0a0a0a] transition-colors"
      >
        Login
      </button>

      {/* Hamburger */}
      <button
        className="md:hidden relative w-6 h-[16px] flex flex-col justify-between z-20"
        onClick={() => setOpen(!open)}
        aria-label="Toggle menu"
      >
        <span className={`w-6 h-[2px] bg-black transition-all duration-300 origin-center ${open ? 'rotate-45 translate-y-[7px]' : ''}`} />
        <span className={`w-6 h-[2px] bg-black transition-all duration-300 ${open ? 'opacity-0' : ''}`} />
        <span className={`w-6 h-[2px] bg-black transition-all duration-300 origin-center ${open ? '-rotate-45 -translate-y-[7px]' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9] bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center space-y-8"
          >
            {NAV_LINKS.map((link) => (
              <button
                key={link.name}
                onClick={() => handleNav(link.href)}
                className="text-3xl font-sans font-medium text-[#6b7280] hover:text-[#0a0a0a] transition-colors"
              >
                {link.name}
              </button>
            ))}
            <button
              onClick={() => { setOpen(false); navigate('/?login=true'); }}
              className="mt-4 bg-[#dd6668] text-white font-sans font-medium text-sm px-8 py-4 rounded-full hover:bg-[#c45557] transition-colors"
            >
              Login
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
