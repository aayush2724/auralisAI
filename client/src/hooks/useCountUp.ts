import { useState, useEffect } from 'react';

export function useCountUp(target: number, duration = 1200, isVisible = true) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isVisible) return;
    if (target === 0) {
      setCount(0);
      return;
    }
    
    let startTime: number | null = null;
    let animationFrame: number;
    
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
    
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = timestamp - startTime;
      const percentage = Math.min(progress / duration, 1);
      
      const currentVal = target * easeOutCubic(percentage);
      setCount(currentVal);
      
      if (percentage < 1) {
        animationFrame = requestAnimationFrame(animate);
      } else {
        setCount(target);
      }
    };
    
    animationFrame = requestAnimationFrame(animate);
    
    return () => cancelAnimationFrame(animationFrame);
  }, [target, duration, isVisible]);

  return count;
}
