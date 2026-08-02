import type { ReactNode } from 'react';

export default function Tooltip({
  children,
  content,
  className = '',
}: {
  children: ReactNode;
  content: ReactNode;
  className?: string;
}) {
  return (
    <span className={`group relative inline-flex ${className}`}>
      {children}
      <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden -translate-x-1/2 whitespace-nowrap rounded-full border border-theme-border bg-white/90 px-3 py-1 text-[11px] font-medium text-theme-primary shadow-[0_12px_30px_rgba(16,32,51,0.12)] backdrop-blur-xl group-hover:block">
        {content}
      </span>
    </span>
  );
}

