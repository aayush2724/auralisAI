import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import LoginModal from '../components/ui/LoginModal';
import HowItWorks from '../components/landing/HowItWorks';
import RobotFeatures from '../components/landing/RobotFeatures';
import Footer from '../components/landing/Footer';
import PublicShell from '../components/layout/PublicShell';
import { Button } from '../components/ui/Button';

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
    <PublicShell transparentNav>
      {showLogin && <LoginModal />}

      <div className="relative min-h-screen overflow-hidden">

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

    <div className="relative z-10 h-full min-h-screen flex flex-col
                    justify-center px-8 md:px-12 lg:px-20 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
        className="max-w-lg"
      >
        <span className="section-label mb-4 block text-[#4f46e5]">
          AI SALES INTELLIGENCE
        </span>
        <h1 className="text-[48px] font-semibold leading-[1.08] tracking-tight text-theme-primary lg:text-[64px] mb-6">
          Turn every objection<br />into a closed deal.
        </h1>
        <p className="body-text text-xl mb-10 max-w-xl">
          Auralis reads the room in real time — classifying objections,
          adapting to buyer personas, and knowing exactly when to bring
          in a human.
        </p>
        <div className="flex flex-row items-center gap-4">
          <Button
            onClick={() => navigate('/?login=true')}
            className="rounded-full px-7 py-3.5"
          >
            Try it now
          </Button>
          <Button
            onClick={() =>
              document.getElementById('how-it-works')
                ?.scrollIntoView({ behavior: 'smooth' })
            }
            variant="ghost"
            className="px-0"
          >
            See how it works
          </Button>
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
