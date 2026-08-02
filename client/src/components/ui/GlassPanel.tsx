import type { HTMLAttributes } from 'react';
import Card from './Card';

export default function GlassPanel({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <Card variant="panel" className={className} {...props} />;
}

