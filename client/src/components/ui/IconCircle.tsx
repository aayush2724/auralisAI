import type { LucideIcon } from 'lucide-react';

export default function IconCircle({
  icon: Icon,
  variant = 'primary',
  className = '',
  iconClassName = '',
}: {
  icon: LucideIcon;
  variant?: 'primary' | 'secondary' | 'neutral';
  className?: string;
  iconClassName?: string;
}) {
  const variantClass =
    variant === 'secondary' ? 'icon-badge icon-badge--secondary' :
    variant === 'neutral' ? 'icon-badge' :
    'icon-badge icon-badge--primary';

  return (
    <span className={`${variantClass} ${className}`}>
      <Icon className={`h-5 w-5 text-theme-primary ${iconClassName}`} />
    </span>
  );
}

