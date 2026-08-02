import type { LucideIcon } from 'lucide-react';
import Card from './Card';
import IconCircle from './IconCircle';

export default function StatisticsTile({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
}) {
  return (
    <Card variant="glass" className="flex items-center justify-between p-4">
      <div>
        <p className="text-2xl font-semibold tracking-tight text-theme-primary">{value}</p>
        <p className="section-label mt-1">{label}</p>
      </div>
      <IconCircle icon={icon} variant="secondary" />
    </Card>
  );
}

