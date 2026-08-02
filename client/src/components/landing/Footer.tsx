import { useNavigate } from 'react-router-dom';

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
      <div className="w-full bg-[#dd6668] py-24 px-6 flex flex-col items-center justify-center">
        <h2 className="font-display text-4xl md:text-5xl text-white text-center leading-tight mb-6">
          Ready to close more deals?
        </h2>
        <p className="font-sans text-white/70 text-lg text-center max-w-xl mx-auto mb-10">
          Join sales teams already using Auralis to handle objections,
          read the room, and never miss a close.
        </p>
        <button
          onClick={() => navigate('/?login=true')}
          className="bg-white text-[#dd6668] font-sans font-medium text-sm px-8 py-4 rounded-full hover:bg-[#0a0a0a] hover:text-white transition-colors duration-300"
        >
          Try it now
        </button>
      </div>

      {/* FOOTER BAR */}
      <div className="w-full bg-[#0a0a0a]">
        <div className="max-w-6xl mx-auto py-8 px-6 flex flex-col md:flex-row justify-between items-center gap-4 text-center md:text-left">
          <div className="text-white font-display text-xl">
            auralis
          </div>
          
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
                className="text-[#6b7280] text-sm font-sans hover:text-white transition-colors"
              >
                {link.name}
              </button>
            ))}
          </div>

          <div className="text-[#6b7280] text-xs font-sans">
            © 2026 Auralis. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
}
