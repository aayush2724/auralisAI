import { useState, useRef, type DragEvent, type ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, FileText, FileSpreadsheet, FileCode, X, Loader2, Check } from 'lucide-react';
import type { KBIngestResponse } from '../../types/api';

interface FileDropzoneProps {
  onIngest: (files: File[]) => void;
  isIngesting: boolean;
  isSuccess: boolean;
  error: string | null;
  successData?: KBIngestResponse;
}

export default function FileDropzone({ onIngest, isIngesting, isSuccess, error, successData }: FileDropzoneProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const newFiles = Array.from(e.dataTransfer.files).filter(file => {
        const ext = file.name.toLowerCase().split('.').pop();
        return ['pdf', 'csv', 'md'].includes(ext || '');
      });
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleIngestClick = () => {
    if (files.length > 0) {
      onIngest(files);
      // Optional: empty files list if we want it to clear on ingest
      // setFiles([]); 
    }
  };

  const getFileIcon = (filename: string) => {
    const ext = filename.toLowerCase().split('.').pop();
    if (ext === 'csv') return <FileSpreadsheet className="w-5 h-5 text-[#4F46E5]" />;
    if (ext === 'md') return <FileCode className="w-5 h-5 text-[#94A3B8]" />;
    return <FileText className="w-5 h-5 text-[#4F46E5]" />;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="w-full">
      <input 
        type="file" 
        multiple 
        accept=".pdf,.csv,.md" 
        className="hidden" 
        ref={fileInputRef}
        onChange={handleFileSelect}
      />
      
      <motion.div
        animate={{ scale: isDragging ? 1.02 : 1 }}
        whileHover={{ scale: 1.01 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`neo-inset rounded-[40px] px-8 py-20 cursor-pointer flex flex-col items-center justify-center transition-colors shadow-[inset_4px_4px_10px_rgba(0,0,0,0.05),_inset_-4px_-4px_10px_rgba(255,255,255,0.7)] mb-4 ${
          isDragging ? 'bg-slate-900/[0.04]' : 'hover:bg-slate-900/[0.024]'
        }`}
      >
        <div className="relative mb-6">
           <UploadCloud className="w-16 h-16 text-white absolute inset-0 blur-[6px] opacity-70 drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
           <UploadCloud className="w-16 h-16 text-white relative z-10 drop-shadow-[0_2px_4px_rgba(0,0,0,0.2)]" />
        </div>
        <h2 className="text-4xl font-display font-medium text-[#1e293b] mb-3">Knowledge Base</h2>
        <p className="text-[11px] font-sans font-bold uppercase tracking-[0.2em] text-[#64748b] mb-8 text-center max-w-md leading-relaxed">
          Drop PDF, CSV, or MD files here <br/><span className="underline underline-offset-4 cursor-pointer">Click to Browse</span>
        </p>

        <button
          onClick={(e) => { e.stopPropagation(); handleIngestClick(); }}
          disabled={files.length === 0 || isIngesting}
          className={`neo-card rounded-full bg-[#1e293b] px-10 py-3.5 text-white text-sm font-sans font-medium transition-transform hover:-translate-y-0.5 active:translate-y-0 shadow-[0_10px_20px_rgba(30,41,59,0.3)] disabled:opacity-50 disabled:cursor-not-allowed z-20 ${
            isSuccess ? 'bg-emerald-600' : ''
          }`}
        >
          {isIngesting ? (
            <div className="flex items-center space-x-2"><Loader2 className="w-4 h-4 animate-spin" /><span>Ingesting...</span></div>
          ) : isSuccess && successData ? (
            <div className="flex items-center space-x-2"><Check className="w-4 h-4" /><span>{successData.chunks_added} chunks added</span></div>
          ) : (
            <span>Ingest Files {files.length > 0 ? `(${files.length})` : ''}</span>
          )}
        </button>
      </motion.div>

      <div className="mt-6">
        <AnimatePresence>
          {files.map((file, idx) => (
            <motion.div
              key={`${file.name}-${idx}`}
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: 'auto', marginBottom: 8 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              className="flex items-center justify-between neo-inset rounded-[40px] p-3 overflow-hidden"
            >
              <div className="flex items-center space-x-3 truncate pr-4">
                {getFileIcon(file.name)}
                <div className="truncate">
                  <p className="text-sm font-sans font-medium text-theme-primary truncate">{file.name}</p>
                  <p className="text-xs font-sans font-light text-theme-muted">{formatSize(file.size)}</p>
                </div>
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); removeFile(idx); }}
                className="p-1.5 hover:bg-theme-border rounded-lg transition-colors text-theme-muted hover:text-red-400 flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {error && (
        <div className="mt-4 text-sm text-red-300 bg-red-500/10 px-4 py-2 rounded-lg border border-red-500/20">
          {error}
        </div>
      )}


    </div>
  );
}
