import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import type { ImageExtractionResult } from '../../types/api';
import { Button } from '../ui/Button';

interface OCRPreviewModalProps {
  open: boolean;
  onClose: () => void;
  onAccept: () => void;
  results: ImageExtractionResult[];
  isIngesting: boolean;
}

export default function OCRPreviewModal({ open, onClose, onAccept, results, isIngesting }: OCRPreviewModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-theme-primary/40 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-2xl bg-theme-base rounded-[24px] shadow-xl overflow-hidden flex flex-col max-h-[85vh] border border-theme-border"
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-theme-border bg-white/50 backdrop-blur-md">
          <h2 className="text-lg font-semibold text-theme-primary">Review Extracted Text</h2>
          <button 
            onClick={onClose} 
            disabled={isIngesting}
            className="p-2 text-theme-muted hover:text-theme-primary rounded-full hover:bg-theme-muted/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-theme-base">
          {results.map((result, idx) => (
            <div key={idx} className="space-y-3">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-theme-muted">Image</span>
                <span className="text-sm font-medium text-theme-primary truncate">{result.filename}</span>
              </div>
              <div className="bg-theme-muted/5 rounded-[16px] p-5 border border-theme-border/50 font-mono text-sm leading-relaxed text-theme-primary whitespace-pre-wrap">
                {result.extracted_text || <span className="text-theme-muted italic">No text found.</span>}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-5 border-t border-theme-border bg-theme-muted/5 backdrop-blur-md">
          <Button variant="secondary" onClick={onClose} disabled={isIngesting} className="rounded-full px-6">
            Cancel
          </Button>
          <Button onClick={onAccept} disabled={isIngesting} className="rounded-full px-8">
            {isIngesting ? "Ingesting..." : "Accept & Ingest"}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
