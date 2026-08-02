import type { SelectHTMLAttributes } from 'react';

export default function Dropdown({
  className = '',
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`h-12 rounded-full border border-theme-border bg-white/65 px-4 text-sm font-medium text-theme-primary shadow-sm outline-none backdrop-blur-xl transition-all duration-200 focus:border-[#4F46E5] ${className}`}
      {...props}
    />
  );
}

