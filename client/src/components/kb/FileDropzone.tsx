import { useState, useRef, type DragEvent, type ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, FileSpreadsheet, FileCode, X, CloudUpload } from 'lucide-react';


interface FileDropzoneProps {
  onIngest: (files: File[]) => void;
  error: string | null;
}

export default function FileDropzone({ onIngest, error }: FileDropzoneProps) {
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

  const getFileIcon = (filename: string) => {
    const ext = filename.toLowerCase().split('.').pop();
    if (ext === 'csv') return <FileSpreadsheet className="w-5 h-5 text-[#dd6668]" />;
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
        className={`border-2 rounded-2xl p-6 sm:p-12 cursor-pointer flex flex-col items-center justify-center transition-colors ${
          isDragging 
            ? 'border-[#dd6668] bg-slate-900/[0.04] border-solid' 
            : 'border-theme-border bg-theme-surface hover:bg-slate-900/[0.024] border-dashed text-theme-primary'
        }`}
      >
        <CloudUpload className="w-12 h-12 text-[#dd6668] mb-4" />
        <p className="text-sm font-sans font-light text-theme-muted">Drop PDF, CSV, or Markdown files here</p>
        <p className="text-xs font-sans font-medium text-[#dd6668] underline mt-1">or click to browse</p>
      </motion.div>

      <div className="mt-6">
        <AnimatePresence>
          {files.map((file, idx) => (
            <motion.div
              key={`${file.name}-${idx}`}
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: 'auto', marginBottom: 8 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              className="flex items-center justify-between bg-theme-surface border border-theme-border rounded-xl p-3 overflow-hidden"
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

      {files.length > 0 && (
        <div className="mt-4 flex justify-end">
          <button
            onClick={() => {
              onIngest(files);
              setFiles([]);
            }}
            className="px-6 py-2 bg-[#dd6668] text-white rounded-xl hover:bg-[#c45557] font-medium transition-colors"
          >
            Upload Files
          </button>
        </div>
      )}

      {error && (
        <div className="mt-4 text-sm text-red-300 bg-red-500/10 px-4 py-2 rounded-lg border border-red-500/20">
          {error}
        </div>
      )}
    </div>
  );
}
