import { useRef } from 'react';
import { motion, useScroll, useTransform, useMotionValueEvent } from 'framer-motion';

const HowItWorks = () => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const glowGroupRef = useRef<SVGGElement>(null);

  const { scrollYProgress } = useScroll({
    target: wrapperRef,
    offset: ['start start', 'end end'],
  });

  // Step 1 Transforms
  const step1Opacity = useTransform(scrollYProgress, [0.15, 0.23], [0, 1]);
  const step1Color = useTransform(scrollYProgress, [0.15, 0.23], ['#e5e7eb', '#dd6668']);

  // Step 2 Transforms
  const step2Opacity = useTransform(scrollYProgress, [0.45, 0.53], [0, 1]);
  const step2Color = useTransform(scrollYProgress, [0.45, 0.53], ['#e5e7eb', '#dd6668']);

  // Step 3 Transforms
  const step3Opacity = useTransform(scrollYProgress, [0.73, 0.81], [0, 1]);
  const step3Color = useTransform(scrollYProgress, [0.73, 0.81], ['#e5e7eb', '#dd6668']);

  useMotionValueEvent(scrollYProgress, 'change', (latest) => {
    const path = pathRef.current;
    const group = glowGroupRef.current;
    if (!path || !group) return;
    
    const total = path.getTotalLength();
    const pt = path.getPointAtLength(latest * total);
    group.setAttribute('transform', `translate(${pt.x}, ${pt.y})`);
  });

  const pathD = "M 0 140 C 80 140, 140 30, 250 30 C 380 30, 460 250, 600 250 C 740 250, 820 30, 950 30 C 1060 30, 1120 140, 1200 140";

  return (
    <section id="how-it-works" className="bg-white">
      <div ref={wrapperRef} style={{ height: '300vh' }} className="relative hidden md:block">
        <div className="sticky top-0 h-screen flex flex-col items-center justify-center overflow-hidden px-6">
          
          {/* Section header */}
          <div className="text-center mb-4 mt-[-40px]">
            <p className="text-xs font-sans font-medium tracking-widest text-[#dd6668] uppercase mb-3">
              HOW IT WORKS
            </p>
            <h2 className="font-display text-4xl md:text-5xl text-[#0a0a0a] leading-tight max-w-2xl mx-auto">
              Three steps to a smarter sales conversation.
            </h2>
          </div>

          <div className="w-full max-w-6xl mx-auto">
            <svg viewBox="0 0 1200 280" width="100%" preserveAspectRatio="xMidYMid meet" overflow="visible">
              <defs>
                <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="6" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Background path */}
              <path ref={pathRef} d={pathD} fill="none" stroke="#e5e7eb" strokeWidth={3} />

              {/* Reveal path */}
              <motion.path
                d={pathD}
                fill="none"
                stroke="#dd6668"
                strokeWidth={3}
                style={{ pathLength: scrollYProgress }}
                strokeDasharray="1"
              />

              {/* Glowing circle group */}
              <g ref={glowGroupRef} transform="translate(0, 140)">
                <circle r="10" fill="#dd6668" filter="url(#glow)" opacity="0.6" />
                <circle r="5" fill="#dd6668" />
                <circle r="2.5" fill="white" />
              </g>
            </svg>

            {/* Three step cards */}
            <div className="grid grid-cols-3 gap-8 -mt-32 relative z-10 px-4">
              
              {/* Step 1 */}
              <motion.div style={{ opacity: step1Opacity }} className="flex flex-col items-center text-center">
                <motion.div 
                  className="w-[10px] h-[10px] rounded-full mb-6"
                  style={{ backgroundColor: step1Color as any }}
                />
                <motion.div style={{ color: step1Color as any }} className="font-display text-7xl leading-none mb-6">
                  01
                </motion.div>
                <h3 className="font-sans font-medium text-lg text-[#0a0a0a] mb-3">
                  Message comes in
                </h3>
                <p className="font-sans text-sm text-[#6b7280] leading-relaxed max-w-xs">
                  A prospect sends a message. Auralis receives it and immediately begins reading intent, tone, and context.
                </p>
              </motion.div>

              {/* Step 2 */}
              <motion.div style={{ opacity: step2Opacity }} className="flex flex-col items-center text-center -translate-y-8">
                <motion.div 
                  className="w-[10px] h-[10px] rounded-full mb-6"
                  style={{ backgroundColor: step2Color as any }}
                />
                <motion.div style={{ color: step2Color as any }} className="font-display text-7xl leading-none mb-14">
                  02
                </motion.div>
                <h3 className="font-sans font-medium text-lg text-[#0a0a0a] mb-3">
                  Auralis reads the room
                </h3>
                <p className="font-sans text-sm text-[#6b7280] leading-relaxed max-w-xs">
                  Objection type, buyer persona, competitor mentions, and sentiment are all classified in under 2 seconds.
                </p>
              </motion.div>

              {/* Step 3 */}
              <motion.div style={{ opacity: step3Opacity }} className="flex flex-col items-center text-center">
                <motion.div 
                  className="w-[10px] h-[10px] rounded-full mb-6"
                  style={{ backgroundColor: step3Color as any }}
                />
                <motion.div style={{ color: step3Color as any }} className="font-display text-7xl leading-none mb-6">
                  03
                </motion.div>
                <h3 className="font-sans font-medium text-lg text-[#0a0a0a] mb-3">
                  The right response, instantly
                </h3>
                <p className="font-sans text-sm text-[#6b7280] leading-relaxed max-w-xs">
                  A tailored reply is generated. If confidence is low or frustration is high, Auralis flags for human handoff automatically.
                </p>
              </motion.div>

            </div>
          </div>
        </div>
      </div>

      {/* MOBILE FALLBACK */}
      <div className="md:hidden px-6 py-24 bg-white">
        <div className="text-center mb-16">
          <p className="text-xs font-sans font-medium tracking-widest text-[#dd6668] uppercase mb-3">
            HOW IT WORKS
          </p>
          <h2 className="font-display text-4xl text-[#0a0a0a] leading-tight">
            Three steps to a smarter sales conversation.
          </h2>
        </div>

        <div className="flex flex-col items-start max-w-md mx-auto">
          {/* Mobile Step 1 */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex flex-row gap-6 w-full"
          >
            <div className="font-display text-4xl text-[#dd6668] leading-none shrink-0">01</div>
            <div className="flex flex-col">
              <h3 className="font-sans font-medium text-lg text-[#0a0a0a] mb-2">Message comes in</h3>
              <p className="font-sans text-sm text-[#6b7280] leading-relaxed">
                A prospect sends a message. Auralis receives it and immediately begins reading intent, tone, and context.
              </p>
            </div>
          </motion.div>
          
          <div className="w-[2px] h-12 bg-[#e5e7eb] ml-[22px] my-4" />

          {/* Mobile Step 2 */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex flex-row gap-6 w-full"
          >
            <div className="font-display text-4xl text-[#dd6668] leading-none shrink-0">02</div>
            <div className="flex flex-col">
              <h3 className="font-sans font-medium text-lg text-[#0a0a0a] mb-2">Auralis reads the room</h3>
              <p className="font-sans text-sm text-[#6b7280] leading-relaxed">
                Objection type, buyer persona, competitor mentions, and sentiment are all classified in under 2 seconds.
              </p>
            </div>
          </motion.div>

          <div className="w-[2px] h-12 bg-[#e5e7eb] ml-[22px] my-4" />

          {/* Mobile Step 3 */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex flex-row gap-6 w-full"
          >
            <div className="font-display text-4xl text-[#dd6668] leading-none shrink-0">03</div>
            <div className="flex flex-col">
              <h3 className="font-sans font-medium text-lg text-[#0a0a0a] mb-2">The right response, instantly</h3>
              <p className="font-sans text-sm text-[#6b7280] leading-relaxed">
                A tailored reply is generated. If confidence is low or frustration is high, Auralis flags for human handoff automatically.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
