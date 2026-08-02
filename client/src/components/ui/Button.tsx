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
    
    let variantStyles = '';
    
    if (variant === 'primary') {
      variantStyles = 'bg-[#dd6668] text-white px-6 py-3 rounded-full font-sans font-medium text-sm tracking-wide hover:bg-[#c45557] transition-colors duration-200 [.light-shell_&]:bg-gradient-to-r [.light-shell_&]:from-[#dd6668] [.light-shell_&]:to-[#f4a261] [.light-shell_&]:text-white [.light-shell_&]:hover:brightness-115';
    } else if (variant === 'outline') {
      variantStyles = 'bg-transparent text-[#0a0a0a] px-6 py-3 rounded-full border border-[#0a0a0a]/20 hover:border-[#0a0a0a]/60 hover:bg-[#0a0a0a]/5 transition-all duration-200 font-sans font-medium text-sm tracking-wide [.light-shell_&]:text-theme-primary [.light-shell_&]:border-theme-border-strong [.light-shell_&]:hover:border-theme-primary [.light-shell_&]:hover:bg-theme-border';
    } else if (variant === 'ghost') {
      variantStyles = 'bg-transparent text-[#0a0a0a] hover:text-[#dd6668] underline underline-offset-4 decoration-1 hover:decoration-2 transition-all font-sans font-medium text-sm p-0 m-0 border-none inline-flex items-center justify-center [.light-shell_&]:text-theme-muted [.light-shell_&]:hover:text-theme-primary [.light-shell_&]:no-underline';
    }

    return (
      <motion.button
        ref={ref}
        whileTap={{ scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 500, damping: 32 }}
        className={`${buttonBase} ${variantClass} ${className}`}
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
    <span className={`bg-[#f9fafb] text-[#0a0a0a] px-3 py-1 rounded-full text-xs font-sans font-medium tracking-widest uppercase inline-flex items-center gap-1.5 [.light-shell_&]:bg-theme-border [.light-shell_&]:text-theme-muted [.light-shell_&]:border [.light-shell_&]:border-theme-border-strong ${className}`}>
      {children}
    </span>
  );
};

