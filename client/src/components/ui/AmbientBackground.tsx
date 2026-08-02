import React from 'react';
import { motion } from 'framer-motion';

interface AmbientBackgroundProps {
  isChatEmpty?: boolean;
}

export const AmbientBackground: React.FC<AmbientBackgroundProps> = ({ isChatEmpty = false }) => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {/* Top Left Teal Glow */}
      <motion.div
        animate={{
          x: [0, 40, -20, 0],
          y: [0, -30, 20, 0],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="absolute -top-[10%] -left-[10%] w-[50vw] h-[50vw] rounded-full bg-[#0D9488] opacity-10 blur-[120px]"
      />

      {/* Bottom Right Indigo Glow */}
      <motion.div
        animate={{
          x: [0, -50, 30, 0],
          y: [0, 40, -30, 0],
        }}
        transition={{
          duration: 28,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="absolute -bottom-[10%] -right-[10%] w-[55vw] h-[55vw] rounded-full bg-[#4F46E5] opacity-10 blur-[130px]"
      />

      {/* Central glow for empty chat state */}
      {isChatEmpty && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 0.12, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 1 }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vw] max-w-[600px] max-h-[600px] rounded-full bg-gradient-to-br from-[#0D9488] to-[#4F46E5] opacity-12 blur-[150px] animate-halo-pulse"
        />
      )}
    </div>
  );
};

export default AmbientBackground;
