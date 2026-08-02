import type { HTMLAttributes } from 'react';

type CardProps = HTMLAttributes<HTMLDivElement> & {
  variant?: 'glass' | 'panel' | 'floating';
};

export default function Card({ variant = 'glass', className = '', ...props }: CardProps) {
  const variantClass =
    variant === 'panel' ? 'glass-panel' :
    variant === 'floating' ? 'floating-card' :
    'glass-card';

  return <div className={`${variantClass} ${className}`} {...props} />;
}

