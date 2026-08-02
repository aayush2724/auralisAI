interface SkeletonProps {
  className?: string;
}

export default function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div 
      className={`bg-gradient-to-r from-[#f9fafb] via-white to-[#f9fafb] animate-shimmer rounded-2xl [.light-shell_&]:from-[rgba(15,23,42,0.03)] [.light-shell_&]:via-[rgba(15,23,42,0.06)] [.light-shell_&]:to-[rgba(15,23,42,0.03)] ${className}`}
      style={{ backgroundSize: '200% 100%' }}
    />
  );
}
