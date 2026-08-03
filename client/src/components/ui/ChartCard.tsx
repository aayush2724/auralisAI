import type { ReactNode } from 'react';
import Card from './Card';

type Size = 'small' | 'large';

const sizeClasses: Record<Size, string> = {
  small: 'p-3 min-h-[240px]',
  large: 'p-5 min-h-[360px]',
};

export default function ChartCard({
  title,
  subtitle,
  children,
  size = 'large',
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  size?: Size;
}) {
  return (
    <Card variant="glass" className={`relative overflow-hidden ${sizeClasses[size]}`}>
      <div className="mb-4">
        <h3 className="card-title">{title}</h3>
        {subtitle && <p className="mt-1 text-sm leading-6 text-theme-secondary">{subtitle}</p>}
      </div>
      {children}
    </Card>
  );
}
