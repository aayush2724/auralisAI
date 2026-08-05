import { useState, useRef, type DragEvent, type ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, FileSpreadsheet, FileCode, X, Loader2, Check, CloudUpload, Image as ImageIcon } from 'lucide-react';
import type { KBIngestResponse } from '../../types/api';
import { Button } from '../ui/Button';
import IconCircle from '../ui/IconCircle';
import UploadPanel from '../ui/UploadPanel';

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
        return ['pdf', 'csv', 'md', 'png', 'jpg', 'jpeg', 'webp'].includes(ext || '');
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
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return <FileText className="w-5 h-5 text-red-500" />;
    if (ext === 'csv') return <FileSpreadsheet className="w-5 h-5 text-green-500" />;
    if (ext === 'md') return <FileCode className="w-5 h-5 text-blue-500" />;
    if (['png', 'jpg', 'jpeg', 'webp'].includes(ext || '')) return <ImageIcon className="w-5 h-5 text-indigo-500" />;
    return <FileText className="w-5 h-5 text-theme-muted" />;
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
        className="mb-4 cursor-pointer"
      >
        <UploadPanel
          title="Upload Collateral"
          description="Drag and drop PDF, CSV, or MD files to train the knowledge base."
        >
          <div className={`flex flex-col items-center justify-center rounded-[32px] border border-dashed px-8 py-16 text-center transition-all duration-200 ${
            isDragging
              ? 'border-[#4F46E5]/40 bg-[rgba(79,70,229,0.08)] shadow-[0_0_40px_rgba(79,70,229,0.12)]'
              : 'border-theme-border bg-white/35 hover:bg-white/50'
          }`}>
            <div className="relative mb-6">
              <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(79,70,229,0.24),transparent_70%)] blur-2xl" />
              <IconCircle icon={CloudUpload} variant="secondary" className="relative h-16 w-16" />
            </div>
            <h2 className="mb-3 text-4xl font-semibold tracking-tight text-theme-primary">Drop files here</h2>
            <p className="mb-8 max-w-lg text-[11px] font-semibold uppercase tracking-[0.22em] text-theme-muted leading-relaxed">
              Or click anywhere in this area to browse your computer
            </p>

            <Button
              onClick={(e) => { e.stopPropagation(); handleIngestClick(); }}
              disabled={files.length === 0 || isIngesting}
              variant={isSuccess ? 'secondary' : 'primary'}
              className="z-20 rounded-full px-10 py-3.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isIngesting ? (
                <div className="flex items-center space-x-2"><Loader2 className="w-4 h-4 animate-spin" /><span>Ingesting...</span></div>
              ) : isSuccess && successData ? (
                <div className="flex items-center space-x-2"><Check className="w-4 h-4" /><span>{successData.chunks_added} chunks added</span></div>
              ) : (
                <span>Ingest Files {files.length > 0 ? `(${files.length})` : ''}</span>
              )}
            </Button>
          </div>
        </UploadPanel>
      </motion.div>

      <div className="mt-6">
        <AnimatePresence>
          {files.map((file, idx) => (
            <motion.div
              key={`${file.name}-${idx}`}
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: 'auto', marginBottom: 8 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              className="flex items-center justify-between rounded-[var(--radius-card)] p-3 overflow-hidden glass-card"
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
                className="p-1.5 hover:bg-white/70 rounded-full transition-colors text-theme-muted hover:text-red-400 flex-shrink-0"
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
