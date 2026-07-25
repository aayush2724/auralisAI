import { motion } from 'framer-motion';

export default function TypingIndicator() {
  return (
    <div className="flex w-full mt-4 space-x-3 max-w-2xl">
      <div className="flex-shrink-0 mt-1">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#dd6668] to-[#0a0a0a] flex items-center justify-center">
          <span className="text-white text-xs font-bold">A</span>
        </div>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[#f9fafb] text-[#0a0a0a] rounded-2xl rounded-tl-sm px-4 py-4 max-w-[70%] flex items-center space-x-1 shadow-sm h-10"
      >
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-1.5 h-1.5 bg-[#6b7280] rounded-full"
            animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
            transition={{
              repeat: Infinity,
              duration: 1.4,
              delay: i * 0.2,
            }}
          />
        ))}
      </motion.div>
    </div>
  );
}
