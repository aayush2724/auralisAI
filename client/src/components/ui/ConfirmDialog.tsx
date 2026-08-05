import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Loader2 } from 'lucide-react';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  loading = false,
  onConfirm,
  onCancel,
}) => {
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  // Focus trapping & Escape key
  useEffect(() => {
    if (!open) return;
    
    // Prevent background scrolling
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    
    // Focus default button
    const timeout = setTimeout(() => {
      confirmBtnRef.current?.focus();
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timeout);
    };
  }, [open, loading, onCancel]);

  if (typeof document === 'undefined') return null;

  const modalContent = (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-theme-primary/10 backdrop-blur-[2px]"
            onClick={() => !loading && onCancel()}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="relative w-full max-w-[420px] rounded-[18px] bg-auralis-card shadow-floating border border-theme-border p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            aria-describedby="confirm-dialog-description"
          >
            <div className="flex flex-col items-center text-center">
              <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-full ${
                variant === 'danger' ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-500'
              }`}>
                <AlertTriangle className="h-6 w-6" />
              </div>
              
              <h2 id="confirm-dialog-title" className="mb-2 text-lg font-semibold text-theme-primary">
                {title}
              </h2>
              
              <p id="confirm-dialog-description" className="mb-6 text-sm text-theme-secondary">
                {description}
              </p>
              
              <div className="flex w-full flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={loading}
                  className="flex-1 rounded-xl border border-theme-border bg-white px-4 py-2.5 text-sm font-medium text-theme-primary transition-colors hover:bg-theme-bg focus:outline-none focus:ring-2 focus:ring-theme-border disabled:opacity-50"
                >
                  {cancelText}
                </button>
                <button
                  type="button"
                  ref={confirmBtnRef}
                  onClick={onConfirm}
                  disabled={loading}
                  className={`flex flex-1 items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium text-white transition-colors focus:outline-none focus:ring-2 disabled:opacity-50 ${
                    variant === 'danger' 
                      ? 'bg-red-500 hover:bg-red-600 focus:ring-red-500/50' 
                      : 'bg-amber-500 hover:bg-amber-600 focus:ring-amber-500/50'
                  }`}
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {confirmText}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
};
