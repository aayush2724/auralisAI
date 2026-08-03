import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import LoginModal from '../components/ui/LoginModal';
import PublicShell from '../components/layout/PublicShell';
import HowItWorks from '../components/landing/HowItWorks';
import RobotFeatures from '../components/landing/RobotFeatures';
import Footer from '../components/layout/Footer';

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
    <PublicShell transparentNav={true}>
      {showLogin && <LoginModal />}

      {/* HERO SCROLL WRAPPER */}
  <div className="relative min-h-[calc(100vh-2rem)] overflow-hidden bg-white">

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
    <div className="relative z-10 h-full min-h-[calc(100vh-2rem)] flex flex-col
                    justify-center px-8 md:px-12 lg:px-20 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
        className="max-w-lg"
      >
        <span className="section-label mb-4 block">
          AI SALES INTELLIGENCE
        </span>
        <h1 className="font-display text-[48px] lg:text-[64px] text-theme-primary
                       leading-[1.08] mb-6">
          Turn every objection<br />into a closed deal.
        </h1>
        <p className="body-text text-xl mb-10">
          Auralis reads the room in real time — classifying objections,
          adapting to buyer personas, and knowing exactly when to bring
          in a human.
        </p>
        <div className="flex flex-row items-center gap-4">
          <Button
            onClick={() => navigate('/?login=true')}
            className="px-7 py-3.5 rounded-full"
          >
            Try it now
          </Button>
          <button
            onClick={() =>
              document.getElementById('how-it-works')
                ?.scrollIntoView({ behavior: 'smooth' })
            }
            className="text-[#4F46E5] font-sans font-medium text-sm
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
    </PublicShell>
  );
};

export default LandingPage;
