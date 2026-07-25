import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const RobotFeatures = () => {
  const navigate = useNavigate();
  const wrapperRef = useRef<HTMLDivElement>(null);
  
  const { scrollYProgress } = useScroll({
    target: wrapperRef,
    offset: ['start start', 'end end'],
  });

  const videoScale = useTransform(
    scrollYProgress,
    [0, 0.20, 0.45, 0.70, 0.88, 1],
    [1,  1,   2.5,  2.5,  2,    1]
  );
  
  const videoOrigin = useTransform(
    scrollYProgress,
    [0,       0.20,     0.45,     0.70,     0.88,     1],
    ["75% 40%","75% 40%","75% 25%","60% 65%","80% 40%","75% 40%"]
  );

  const stage1Opacity = useTransform(
    scrollYProgress,
    [0, 0.16, 0.20, 1],
    [1, 1,    0,    0]
  );
  const stage1PointerEvents = useTransform(
    scrollYProgress,
    (v) => (v < 0.20) ? 'auto' : 'none'
  );
  
  const stage2Opacity = useTransform(
    scrollYProgress,
    [0, 0.20, 0.24, 0.41, 0.45, 1],
    [0, 0,    1,    1,    0,    0]
  );
  
  const stage3Opacity = useTransform(
    scrollYProgress,
    [0, 0.45, 0.49, 0.66, 0.70, 1],
    [0, 0,    1,    1,    0,    0]
  );
  
  const stage4Opacity = useTransform(
    scrollYProgress,
    [0, 0.70, 0.74, 0.84, 0.88, 1],
    [0, 0,    1,    1,    0,    0]
  );
  
  const stage5Opacity = useTransform(
    scrollYProgress,
    [0, 0.88, 0.92, 1],
    [0, 0,    1,   1]
  );
  const stage5PointerEvents = useTransform(
    scrollYProgress,
    (v) => (v > 0.88) ? 'auto' : 'none'
  );

  return (
    <section id="robot-features" className="relative bg-white">
      <div ref={wrapperRef} className="relative w-full h-[500vh]">
        <div className="sticky top-0 h-screen w-full overflow-hidden">
  
          {/* Video — identical container and element to old hero */}
          <div
            className="absolute inset-0 lg:z-0 overflow-hidden pointer-events-none"
            style={{ transform: 'translateZ(0)' }}
          >
            <motion.video
              autoPlay
              loop
              muted
              playsInline
              preload="none"
              className="w-full h-full object-cover object-right
                         lg:object-right-bottom will-change-transform"
              style={{ scale: videoScale, transformOrigin: videoOrigin as any }}
            >
              <source
                src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260601_110537_3a579fa0-7bbc-4d94-9d25-0e816c7840f5.mp4"
                type="video/mp4"
              />
            </motion.video>
          </div>
  
          {/* Text stages */}
          <div className="relative z-10 h-full flex flex-col justify-center
                          px-8 md:px-12 lg:px-20 max-w-7xl mx-auto w-full pointer-events-none">
            <div className="relative max-w-lg" style={{ minHeight: '360px' }}>
  
              {/* Stage 1 — intro */}
              <motion.div
                style={{ opacity: stage1Opacity, pointerEvents: stage1PointerEvents as any }}
                className="absolute inset-0 flex flex-col justify-center"
              >
                <span className="text-[#dd6668] font-sans tracking-wide uppercase
                                 text-sm font-semibold mb-4 block">
                  BUILT FOR EVERY MOMENT
                </span>
                <h2 className="font-display text-[48px] lg:text-[64px] text-[#0a0a0a]
                               leading-[1.08] mb-6">
                  Four capabilities.<br />One seamless experience.
                </h2>
                <p className="font-sans text-xl text-[#6b7280] leading-relaxed">
                  Scroll to see how Auralis handles the moments that
                  make or break a deal.
                </p>
              </motion.div>
  
              {/* Stage 2 — Objection Classification */}
              <motion.div
                style={{ opacity: stage2Opacity }}
                className="absolute inset-0 flex flex-col justify-center
                           pointer-events-none"
              >
                <span className="text-[#dd6668] font-sans tracking-wide uppercase
                                 text-sm font-semibold mb-4 block">
                  OBJECTION CLASSIFICATION
                </span>
                <h2 className="font-display text-[48px] lg:text-[64px] text-[#0a0a0a]
                               leading-[1.08] mb-6">
                  Every objection,<br />instantly understood.
                </h2>
                <p className="font-sans text-xl text-[#6b7280] leading-relaxed">
                  Price. Trust. Timing. Competitor. Fit. Auralis classifies
                  objection type in under 2 seconds and routes it to the right
                  playbook automatically.
                </p>
              </motion.div>
  
              {/* Stage 3 — Buyer Persona */}
              <motion.div
                style={{ opacity: stage3Opacity }}
                className="absolute inset-0 flex flex-col justify-center
                           pointer-events-none"
              >
                <span className="text-[#dd6668] font-sans tracking-wide uppercase
                                 text-sm font-semibold mb-4 block">
                  BUYER PERSONA DETECTION
                </span>
                <h2 className="font-display text-[48px] lg:text-[64px] text-[#0a0a0a]
                               leading-[1.08] mb-6">
                  Knows who it's<br />talking to.
                </h2>
                <p className="font-sans text-xl text-[#6b7280] leading-relaxed">
                  Auralis identifies the prospect's role and communication
                  style so every response feels like it was written for them
                  specifically — not generated.
                </p>
              </motion.div>
  
              {/* Stage 4 — Smart Handoff */}
              <motion.div
                style={{ opacity: stage4Opacity }}
                className="absolute inset-0 flex flex-col justify-center
                           pointer-events-none"
              >
                <span className="text-[#dd6668] font-sans tracking-wide uppercase
                                 text-sm font-semibold mb-4 block">
                  SMART HANDOFF
                </span>
                <h2 className="font-display text-[48px] lg:text-[64px] text-[#0a0a0a]
                               leading-[1.08] mb-6">
                  Knows when to<br />step aside.
                </h2>
                <p className="font-sans text-xl text-[#6b7280] leading-relaxed">
                  When confidence drops or frustration spikes, Auralis flags
                  for human takeover before the deal is at risk. No dropped
                  conversations, no awkward moments.
                </p>
              </motion.div>
  
              {/* Stage 5 — CTA */}
              <motion.div
                style={{ opacity: stage5Opacity, pointerEvents: stage5PointerEvents as any }}
                className="absolute inset-0 flex flex-col justify-center"
              >
                <span className="text-[#dd6668] font-sans tracking-wide uppercase
                                 text-sm font-semibold mb-4 block">
                  READY TO SEE IT LIVE
                </span>
                <h2 className="font-display text-[48px] lg:text-[64px] text-[#0a0a0a]
                               leading-[1.08] mb-6">
                  Your pipeline deserves<br />better than guesswork.
                </h2>
                <p className="font-sans text-xl text-[#6b7280] leading-relaxed mb-10">
                  Join sales teams already using Auralis to handle objections,
                  read the room, and never miss a close.
                </p>
                <button
                  onClick={() => navigate('/?login=true')}
                  className="w-fit bg-[#dd6668] text-white px-7 py-3.5 rounded-full
                             font-sans font-medium text-sm hover:bg-[#c45557]
                             transition-colors pointer-events-auto"
                >
                  Try it now
                </button>
              </motion.div>
  
            </div>
          </div>
  
          {/* Scroll progress bar */}
          <motion.div
            style={{
              opacity: useTransform(scrollYProgress, [0, 0.05, 0.95, 1], [0, 1, 1, 0])
            }}
            className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none"
          >
            <div className="w-[2px] h-28 bg-[#e5e7eb] rounded-full
                            relative overflow-hidden">
              <motion.div
                style={{ scaleY: scrollYProgress, transformOrigin: 'top' }}
                className="absolute inset-0 bg-[#dd6668] rounded-full"
              />
            </div>
          </motion.div>
  
        </div>
      </div>
    </section>
  );
};

export default RobotFeatures;
