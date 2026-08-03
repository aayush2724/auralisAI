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
    const variantClass = buttonVariants[variant];
    const paddingClass = variant === 'icon' ? '' : 'px-5 py-3';

    return (
      <motion.button
        ref={ref}
        whileTap={{ scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 500, damping: 32 }}
        className={`${buttonBase} ${paddingClass} ${variantClass} ${className}`}
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
    <span className={`button-pill text-[11px] uppercase tracking-[0.2em] ${className}`}>
      {children}
    </span>
  );
};

