import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { useCountUp } from '../../hooks/useCountUp';

interface MetricCardProps {
  label: string;
  value: string | number;
  suffix?: string;
  icon: LucideIcon;
  color: string;
}

export default function MetricCard({ label, value, suffix, icon: Icon, color }: MetricCardProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.1 });
  
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  const count = useCountUp(numValue, 1200, isInView);
  
  const decimals = typeof value === 'string' && value.includes('.') 
    ? value.split('.')[1].length 
    : (Number.isInteger(numValue) ? 0 : 2);
    
  const displayValue = count.toFixed(decimals);

  return (
    <motion.div 
      ref={ref}
      variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
      whileHover={{ y: -2, boxShadow: "0 8px 30px rgba(99,102,241,0.15)" }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className="neo-card relative overflow-hidden px-8 py-5 rounded-[40px] flex items-center min-h-[110px]"
    >
      <div className={`absolute -right-8 -bottom-8 w-40 h-40 rounded-full blur-[40px] opacity-30 pointer-events-none 
        ${color === 'indigo' ? 'bg-indigo-400' : 
          color === 'green' ? 'bg-teal-400' : 
          'bg-orange-400'}
      `} />
      <div className="flex justify-between items-center w-full relative z-10">
        <div className="flex flex-col justify-center">
          <div className="text-4xl font-display font-medium text-[#1e293b] [.light-shell_&]:text-theme-primary flex items-baseline tracking-tighter mb-1">
            <span>{displayValue}</span>
            {suffix && <span className="text-xl font-sans font-light text-[#64748b] [.light-shell_&]:text-theme-muted ml-1">{suffix}</span>}
          </div>
          <p className="text-[10px] font-sans font-bold uppercase tracking-[0.2em] text-[#64748b] [.light-shell_&]:text-theme-muted">{label}</p>
        </div>
        <div className="w-12 h-12 rounded-full flex items-center justify-center neo-inset text-[#64748b] shrink-0">
          <Icon className="w-5 h-5 opacity-80" />
        </div>
      </div>
    </motion.div>
  );
}
