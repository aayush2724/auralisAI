import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import IconButton from './IconButton';
import Card from './Card';

const iconMap = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
} as const;

export default function Notification({
  title,
  description,
  variant = 'info',
  onClose,
}: {
  title: string;
  description?: ReactNode;
  variant?: keyof typeof iconMap;
  onClose?: () => void;
}) {
  const Icon = iconMap[variant];

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}>
      <Card variant="panel" className="flex items-start gap-4 p-4">
        <span className="icon-badge icon-badge--primary h-11 w-11 shrink-0">
          <Icon className="h-5 w-5 text-[#4F46E5]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-theme-primary">{title}</p>
          {description && <div className="mt-1 text-sm text-theme-secondary">{description}</div>}
        </div>
        {onClose && (
          <IconButton onClick={onClose} aria-label="Dismiss notification" className="h-10 w-10">
            <XCircle className="h-4 w-4" />
          </IconButton>
        )}
      </Card>
    </motion.div>
  );
}

