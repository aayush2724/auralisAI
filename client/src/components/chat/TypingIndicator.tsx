import { motion } from 'framer-motion';
import ChatBubble from '../ui/ChatBubble';
import IconCircle from '../ui/IconCircle';
import { Mic } from 'lucide-react';

export default function TypingIndicator() {
  return (
    <div className="flex w-full max-w-2xl gap-3">
      <IconCircle icon={Mic} variant="secondary" className="mt-1 h-9 w-9 shrink-0" iconClassName="text-[#0D9488]" />
      <ChatBubble role="assistant">
        <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
          className="flex h-10 items-center gap-1"
        >
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-theme-secondary"
              animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
              transition={{
                repeat: Infinity,
                duration: 1.4,
                delay: i * 0.2,
              }}
            />
          ))}
        </motion.div>
      </ChatBubble>
    </div>
  );
}
