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
    </motion.div>
  );
}
