import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/Button';

export default function Footer() {
  const navigate = useNavigate();

  const links = [
    { name: 'Product', href: '/#features' },
    { name: 'Solutions', href: '/#how-it-works' },
    { name: 'Pricing', href: '/pricing' },
    { name: 'Resources', href: '/resources' }
  ];

  return (
    <footer id="footer" className="w-full flex flex-col">
      {/* CTA BAND */}
      <div className="w-full bg-theme-primary py-24 px-6 flex flex-col items-center justify-center">
        <h2 className="text-4xl font-semibold tracking-tight text-white text-center md:text-5xl leading-tight mb-6">
          Ready to close more deals?
        </h2>
        <p className="body-text text-white/70 text-lg text-center max-w-xl mx-auto mb-10">
          Join sales teams already using Auralis to handle objections,
          read the room, and never miss a close.
        </p>
        <Button
          onClick={() => navigate('/?login=true')}
          className="rounded-full px-8 py-4"
        >
          Try it now
        </Button>
      </div>

      {/* FOOTER BAR */}
      <div className="w-full bg-theme-primary">
        <div className="max-w-6xl mx-auto py-8 px-6 flex flex-col md:flex-row justify-between items-center gap-4 text-center md:text-left">
          <div className="text-white text-xl font-semibold tracking-tight">Auralis</div>
          
          <div className="flex flex-row items-center gap-6">
            {links.map((link) => (
              <button
                key={link.name}
                onClick={() => {
                  if (link.href.startsWith('/#')) {
                    navigate('/');
                    setTimeout(() => {
                      const id = link.href.replace('/#', '');
                      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
                    }, 100);
                  } else {
                    navigate(link.href);
                  }
                }}
                className="text-sm text-white/60 hover:text-white transition-colors"
              >
                {link.name}
              </button>
            ))}
          </div>

          <div className="text-xs text-white/60">
            (c) 2026 Auralis. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
}
