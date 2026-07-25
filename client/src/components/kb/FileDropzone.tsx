import { useState, useRef, type DragEvent, type ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, FileText, FileSpreadsheet, FileCode, X, Loader2, Check } from 'lucide-react';
import type { KBIngestResponse } from '../../types/api';
import { Button } from '../ui/Button';

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
    if (ext === 'csv') return <FileSpreadsheet className="w-5 h-5 text-green-600" />;
    if (ext === 'md') return <FileCode className="w-5 h-5 text-gray-600" />;
    return <FileText className="w-5 h-5 text-red-600" />;
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
        animate={{ scale: isDragging ? 1.01 : 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 rounded-2xl p-6 sm:p-12 cursor-pointer flex flex-col items-center justify-center transition-colors ${
          isDragging ? 'border-[#dd6668] bg-[#f9fafb] border-solid' : 'border-[#f9fafb] bg-white hover:bg-[#f9fafb] border-dashed'
        }`}
      >
        <UploadCloud className="w-12 h-12 text-[#dd6668] mb-4" />
        <p className="text-sm font-sans font-light text-[#6b7280]">Drop PDF, CSV, or Markdown files here</p>
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
              className="flex items-center justify-between bg-white border border-[#f9fafb] rounded-xl p-3 overflow-hidden"
            >
              <div className="flex items-center space-x-3 truncate pr-4">
                {getFileIcon(file.name)}
                <div className="truncate">
                  <p className="text-sm font-sans font-medium text-[#0a0a0a] truncate">{file.name}</p>
                  <p className="text-xs font-sans font-light text-[#6b7280]">{formatSize(file.size)}</p>
                </div>
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); removeFile(idx); }}
                className="p-1.5 hover:bg-[#f9fafb] rounded-lg transition-colors text-[#6b7280] hover:text-red-500 flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {error && (
        <div className="mt-4 text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg border border-red-200">
          {error}
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <Button
          variant="primary"
          onClick={handleIngestClick}
          disabled={files.length === 0 || isIngesting}
          className={`flex items-center justify-center space-x-2 ${
            isSuccess ? 'bg-emerald-500 hover:bg-emerald-600' : ''
          }`}
        >
          {isIngesting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Ingesting...</span>
            </>
          ) : isSuccess && successData ? (
            <>
              <Check className="w-5 h-5" />
              <span>{successData.chunks_added} chunks added</span>
            </>
          ) : (
            <span>Ingest Files ({files.length})</span>
          )}
        </Button>
      </div>
    </div>
  );
}
