import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { useCountUp } from '../../hooks/useCountUp';
import Card from '../ui/Card';
import IconCircle from '../ui/IconCircle';

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
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className="relative overflow-hidden"
    >
      <Card variant="glass" className="card-hover relative flex min-h-[110px] items-center overflow-hidden px-8 py-5">
        <div className={`absolute -right-8 -bottom-8 h-40 w-40 rounded-full blur-[40px] opacity-30 pointer-events-none
          ${color === 'indigo' ? 'bg-indigo-400' :
            color === 'green' ? 'bg-teal-400' :
            'bg-orange-400'}
        `} />
        <div className="relative z-10 flex w-full items-center justify-between">
          <div className="flex flex-col justify-center">
            <div className="mb-1 flex items-baseline text-4xl font-semibold tracking-tight text-theme-primary">
            <span>{displayValue}</span>
              {suffix && <span className="ml-1 text-xl font-normal text-theme-muted">{suffix}</span>}
            </div>
            <p className="section-label">{label}</p>
          </div>
          <IconCircle icon={Icon} variant="secondary" />
        </div>
      </Card>
      whileHover={{ y: -2, boxShadow: "0 8px 30px rgba(221,102,104,0.15)" }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className="bg-white border border-[#f9fafb] rounded-2xl p-5 shadow-sm [.light-shell_&]:bg-theme-surface [.light-shell_&]:backdrop-blur [.light-shell_&]:border-theme-border [.light-shell_&]:shadow-[0_8px_30px_rgba(15,23,42,0.04)]"
    >
      <div className="flex justify-between items-start">
        <div>
          <div className="text-3xl font-display font-normal text-[#0a0a0a] [.light-shell_&]:text-theme-primary flex items-baseline space-x-1 tracking-tight">
            <span>{displayValue}</span>
            {suffix && <span className="text-sm font-sans font-light text-[#6b7280] [.light-shell_&]:text-theme-muted">{suffix}</span>}
          </div>
          <p className="text-xs font-sans font-medium uppercase tracking-widest text-[#6b7280] [.light-shell_&]:text-theme-muted mt-1">{label}</p>
        </div>
        <div className={`w-10 h-10 rounded-full flex items-center justify-center border
          ${color === '[#dd6668]' ? 'bg-[#dd6668]/10 text-[#dd6668] border-[#dd6668]/20' : 
            color === 'green' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 
            'bg-purple-500/10 text-purple-400 border-purple-500/20'}
        `}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </motion.div>
  );
}
