import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/Button';

export default function Footer() {
  const navigate = useNavigate();


  return (
    <footer id="footer" className="w-full flex flex-col">
      {/* CTA BAND */}
      <div className="w-full bg-theme-primary py-24 px-6 flex flex-col items-center justify-center text-center">
        <h2 className="text-4xl font-semibold tracking-tight text-white md:text-5xl leading-tight mb-6">
          Ready to close more deals?
        </h2>
        <p className="font-sans text-white/75 text-lg text-center max-w-xl mx-auto mb-10">
          Join sales teams already using Auralis to handle objections,
          read the room, and never miss a close.
        </p>
        <Button onClick={() => navigate('/?login=true')} className="rounded-full px-8 py-4">
          Try it now
        </Button>
      </div>

      {/* FOOTER BAR */}
      <footer className="bg-white py-8 px-6 border-t border-theme-border">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 text-center md:text-left">
          <div className="text-theme-primary font-semibold text-xl">
            Auralis
          </div>
          <div className="text-theme-muted text-xs font-sans">
            © 2026 Auralis. All rights reserved.
          </div>
        </div>
      </footer>
    </footer>
  );
}
