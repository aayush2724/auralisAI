import type { LucideIcon } from 'lucide-react';
import Card from './Card';
import IconCircle from './IconCircle';

type Size = 'small' | 'medium' | 'large';
type Tone = 'indigo' | 'teal' | 'amber' | 'rose';

const sizeClasses: Record<Size, string> = {
  small: 'min-h-[118px] p-5',
  medium: 'min-h-[136px] p-6',
  large: 'min-h-[158px] p-8',
};

const valueClasses: Record<Size, string> = {
  small: 'text-3xl',
  medium: 'text-4xl',
  large: 'text-5xl',
};

const toneClasses: Record<Tone, string> = {
  indigo: 'from-[#eef1ff] via-[#e0e5ff] to-[#d2d9ff]',
  teal: 'from-[#eefdfa] via-[#ddf7f1] to-[#c5f2e7]',
  amber: 'from-[#fff8ea] via-[#fcefcf] to-[#f8dfae]',
  rose: 'from-[#fff1f5] via-[#ffe0e8] to-[#ffc9d7]',
};

const orbClasses: Record<Tone, string> = {
  indigo: 'from-[#4f46e5]/30 via-[#818cf8]/18 to-transparent',
  teal: 'from-[#0d9488]/28 via-[#2dd4bf]/16 to-transparent',
  amber: 'from-[#f59e0b]/28 via-[#fbbf24]/16 to-transparent',
  rose: 'from-[#ec4899]/24 via-[#fb7185]/14 to-transparent',
};

export default function MetricCard({
  label,
  value,
  suffix,
  icon,
  size = 'medium',
  tone = 'indigo',
}: {
  label: string;
  value: string | number;
  suffix?: string;
  icon: LucideIcon;
  size?: Size;
  tone?: Tone;
}) {
  return (
    <Card variant="glass" className={`relative flex items-center justify-between overflow-hidden bg-gradient-to-br ${toneClasses[tone]} ${sizeClasses[size]}`}>
      <div className={`absolute -right-10 -bottom-10 h-44 w-44 rounded-full bg-gradient-to-br ${orbClasses[tone]} blur-[48px]`} />
      <div className="relative z-10">
        <p className={`font-semibold tracking-tight text-theme-primary ${valueClasses[size]}`}>
          {value}
          {suffix ? <span className="ml-1 text-xl font-normal text-theme-secondary">{suffix}</span> : null}
        </p>
        <p className="section-label mt-1">{label}</p>
      </div>
      <IconCircle icon={icon} variant="secondary" className="relative z-10" />
    </Card>
  );
}
