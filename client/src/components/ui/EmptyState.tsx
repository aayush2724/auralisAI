import type { ReactNode } from 'react';
import { Sparkles } from 'lucide-react';
import Card from './Card';
import IconCircle from './IconCircle';

export default function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <Card variant="panel" className="flex flex-col items-center justify-center px-8 py-12 text-center">
      <div className="relative mb-5">
        <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(79,70,229,0.26),transparent_72%)] blur-2xl" />
        <IconCircle icon={Sparkles} variant="secondary" className="relative h-16 w-16" />
      </div>
      <h3 className="text-lg font-semibold tracking-tight text-theme-primary">{title}</h3>
      {description && <p className="mt-2 max-w-md text-sm leading-6 text-theme-secondary">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </Card>
  );
}
