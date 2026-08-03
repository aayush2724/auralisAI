import type { ReactNode } from 'react';

export default function PageContainer({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto w-full max-w-[1600px] px-5 sm:px-8 lg:px-10 xl:px-12 ${className}`}>
      <div className="glass-panel min-h-[calc(100vh-2rem)] overflow-clip rounded-[var(--radius-container)]">
        {children}
      </div>
    </div>
  );
}

