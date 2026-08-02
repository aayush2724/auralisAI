import type { ReactNode } from 'react';
import type { ButtonProps } from './Button';
import { Button } from './Button';

export default function IconButton({
  children,
  ...props
}: Omit<ButtonProps, 'variant'> & { children: ReactNode }) {
  return (
    <Button variant="icon" {...props}>
      {children}
    </Button>
  );
}
