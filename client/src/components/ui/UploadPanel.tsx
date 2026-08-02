import type { ReactNode } from 'react';
import Card from './Card';

export default function UploadPanel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card variant="panel" className="p-6">
      <h3 className="card-title">{title}</h3>
      {description && <p className="mt-2 text-sm leading-6 text-theme-secondary">{description}</p>}
      <div className="mt-5">{children}</div>
    </Card>
  );
}

