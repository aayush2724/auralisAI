import React from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { buttonBase, buttonVariants } from './designSystem';

export type ButtonVariant = keyof typeof buttonVariants;

export interface ButtonProps extends HTMLMotionProps<"button"> {
  variant?: ButtonVariant;
  children: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', children, className = '', ...props }, ref) => {
    return (
      <motion.button
        ref={ref}
        whileTap={{ scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 500, damping: 32 }}
        className={`${buttonBase} ${buttonVariants[variant]} ${className}`}
        {...props}
      >
        {children}
      </motion.button>
    );
  }
);
Button.displayName = 'Button';

export const PillTag = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => {
  return (
    <span className={`bg-theme-surface-solid text-theme-primary px-3 py-1 rounded-full text-xs font-sans font-medium tracking-widest uppercase inline-flex items-center gap-1.5 border border-theme-border-strong ${className}`}>
      {children}
    </span>
  );
};

