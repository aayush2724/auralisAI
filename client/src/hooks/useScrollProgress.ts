import { useRef } from 'react';
import { useInView } from 'framer-motion';

export function useScrollProgress(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const isVisible = useInView(ref, { amount: threshold, once: true });
  
  return { ref, isVisible };
}
