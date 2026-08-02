import type { ReactNode } from 'react';

export default function SectionHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        {eyebrow && <p className="section-label mb-2">{eyebrow}</p>}
        <h2 className="text-2xl font-semibold tracking-tight text-theme-primary sm:text-3xl">{title}</h2>
        {description && <p className="mt-2 text-sm leading-6 text-theme-secondary">{description}</p>}
      </div>
      {action && <div className="flex items-center gap-3">{action}</div>}
    </div>
  );
}
