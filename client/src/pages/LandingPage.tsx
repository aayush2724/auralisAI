import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import LoginModal from '../components/ui/LoginModal';
import PageNavbar from '../components/layout/PageNavbar';
import HowItWorks from '../components/landing/HowItWorks';
import RobotFeatures from '../components/landing/RobotFeatures';
import Footer from '../components/landing/Footer';

const LandingPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const showLogin = searchParams.get('login') === 'true';
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const prevX = useRef<number | null>(null);
  const targetTime = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const pendingTime = useRef<number | null>(null);

  // Hook 1: Desktop mouse scrubbing
  useEffect(() => {
    if (window.innerWidth < 1024) return;
    const video = videoRef.current;
    if (!video) return;

    const tick = () => {
      if (pendingTime.current !== null && !video.seeking) {
        video.currentTime = pendingTime.current;
        pendingTime.current = null;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    const handleMouseMove = (e: MouseEvent) => {
      if (prevX.current === null) { prevX.current = e.clientX; return; }
      const delta = e.clientX - prevX.current;
      targetTime.current = Math.max(
        0,
        Math.min(
          targetTime.current + (delta / window.innerWidth) * 0.8 * video.duration,
          video.duration
        )
      );
      pendingTime.current = targetTime.current;
      prevX.current = e.clientX;
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Hook 2: Mobile autoplay
  useEffect(() => {
    if (window.innerWidth >= 1024) return;
    const video = videoRef.current;
    if (!video) return;
    video.autoplay = true;
    video.play().catch(() => {});
  }, []);



  return (
    <div className="relative bg-white text-neutral-900 font-sans selection:bg-[#f9fafb] selection:text-[#0a0a0a] antialiased flex flex-col">
      {showLogin && <LoginModal />}
      
      <PageNavbar transparent={true} />

      {/* HERO SCROLL WRAPPER */}
  <div className="relative min-h-screen overflow-hidden bg-white">

    {/* Video — right side, same container as before */}
    <div
      className="absolute inset-0 lg:z-0 overflow-hidden pointer-events-none"
      style={{ transform: 'translateZ(0)' }}
    >
      <video
        ref={videoRef}
        muted
        playsInline
        preload="auto"
        className="w-full h-full object-cover object-right
                   lg:object-right-bottom will-change-transform"
      >
        <source
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260601_110537_3a579fa0-7bbc-4d94-9d25-0e816c7840f5.mp4"
          type="video/mp4"
        />
      </video>
    </div>

    {/* Static hero text — left side */}
    <div className="relative z-10 h-full min-h-screen flex flex-col
                    justify-center px-8 md:px-12 lg:px-20 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
        className="max-w-lg"
      >
        <span className="text-[#dd6668] font-sans tracking-wide uppercase
                         text-sm font-semibold mb-4 block">
          AI SALES INTELLIGENCE
        </span>
        <h1 className="font-display text-[48px] lg:text-[64px] text-[#0a0a0a]
                       leading-[1.08] mb-6">
          Turn every objection<br />into a closed deal.
        </h1>
        <p className="font-sans text-xl text-[#6b7280] leading-relaxed mb-10">
          Auralis reads the room in real time — classifying objections,
          adapting to buyer personas, and knowing exactly when to bring
          in a human.
        </p>
        <div className="flex flex-row items-center gap-4">
          <button
            onClick={() => navigate('/?login=true')}
            className="bg-[#dd6668] text-white px-7 py-3.5 rounded-full
                       font-sans font-medium text-sm hover:bg-[#c45557]
                       transition-colors"
          >
            Try it now
          </button>
          <button
            onClick={() =>
              document.getElementById('how-it-works')
                ?.scrollIntoView({ behavior: 'smooth' })
            }
            className="text-[#dd6668] font-sans font-medium text-sm
                       underline underline-offset-4 hover:opacity-70
                       transition-opacity"
          >
            See how it works
          </button>
        </div>
      </motion.div>
    </div>
  </div>

      <HowItWorks />
      <RobotFeatures />
      <Footer />
    </div>
  );
};

export default LandingPage;
