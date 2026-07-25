interface SkeletonProps {
  className?: string;
}

export default function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div 
      className={`bg-gradient-to-r from-[#f9fafb] via-white to-[#f9fafb] animate-shimmer rounded-2xl ${className}`}
      style={{ backgroundSize: '200% 100%' }}
    />
  );
}
