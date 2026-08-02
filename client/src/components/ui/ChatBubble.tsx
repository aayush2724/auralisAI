import type { ReactNode } from 'react';
import Card from './Card';

export default function ChatBubble({
  children,
  role = 'assistant',
}: {
  children: ReactNode;
  role?: 'assistant' | 'user';
}) {
  const isUser = role === 'user';
  return (
    <Card
      variant="glass"
      className={`max-w-[80%] rounded-[28px] px-4 py-3 text-sm leading-6 ${
        isUser
          ? 'ml-auto rounded-br-lg bg-white/70 text-theme-primary'
          : 'rounded-bl-lg bg-white/55 text-theme-primary'
      }`}
    >
      {children}
    </Card>
  );
}

