import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, Database, Layers, Clock } from 'lucide-react';
import { useKBStats, useIngestFiles, useResetKB } from '../../api/hooks/useKnowledgeBase';
import { useCountUp } from '../../hooks/useCountUp';
import FileDropzone from './FileDropzone';
import Skeleton from '../ui/Skeleton';

const Toast = ({ message, onClose }: { message: string, onClose: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 50, scale: 0.9 }}
      className="fixed bottom-6 right-6 bg-theme-surface-solid text-theme-primary border border-theme-border rounded-xl px-4 py-3 shadow-2xl z-50 flex items-center space-x-2"
    >
      <span className="text-sm font-medium">{message}</span>
    </motion.div>
  );
};

export default function KnowledgeBasePanel() {
  const { data: stats, isLoading: statsLoading, isError: statsError, refetch } = useKBStats();
  const ingestMutation = useIngestFiles();
  const resetMutation = useResetKB();
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const docCount = useCountUp(stats?.total_documents || 0, 1200, true);
  const chunkCount = useCountUp(stats?.total_chunks || 0, 1200, true);

  useEffect(() => {
    if (ingestMutation.isSuccess) {
      refetch();
    }
  }, [ingestMutation.isSuccess, refetch]);

  const handleIngest = async (files: File[]) => {
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    
    ingestMutation.mutate(formData, {
      onSuccess: (data) => {
        setToastMessage(`Success: ${data.chunks_added} chunks added to Knowledge Base.`);
      },
    });
  };

  const handleReset = async () => {
    if (window.confirm("This will delete all knowledge base content. Are you sure?")) {
      resetMutation.mutate(undefined, {
        onSuccess: () => {
          setToastMessage("Knowledge Base has been reset successfully.");
          refetch();
        },
        onError: () => {
          setToastMessage("Failed to reset Knowledge Base.");
        }
      });
    }
  };

  return (
    <div className="px-6 py-8 max-w-3xl mx-auto bg-transparent min-h-full">
      <h2 className="text-2xl font-display font-normal text-theme-primary mb-2 tracking-tight">Knowledge Base</h2>
      <p className="text-sm font-sans font-light text-theme-muted mb-8">Upload sales collateral to train auralis</p>

        <div className="w-full max-w-4xl">
          <FileDropzone
            onIngest={handleIngest}
            error={ingestMutation.isError ? 'Failed to ingest files. Please try again.' : null}
          />
        </div>

      <div className="my-8 border-t border-theme-border" />

      <h3 className="text-lg font-display font-normal text-theme-primary mb-4">Current Statistics</h3>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-display font-normal text-[#0a0a0a]">Current Statistics</h3>
        <button
          onClick={handleReset}
          disabled={resetMutation.isPending}
          className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {resetMutation.isPending ? 'Resetting...' : 'Reset Knowledge Base'}
        </button>
      </div>
      
      {statsLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : statsError || !stats ? (
        <div className="bg-red-500/10 border border-red-500/20 text-red-300 rounded-xl p-4 flex items-center space-x-3">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <span>Failed to load KB stats.</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="bg-theme-surface border border-theme-border rounded-xl p-4 flex flex-col items-center justify-center text-center shadow-lg hover:shadow-[0_8px_30px_rgba(221,102,104,0.12)] hover:-translate-y-1 transition-all duration-300"
          >
            <Database className="w-6 h-6 text-[#dd6668] mb-2" />
            <p className="text-xl font-display font-normal text-theme-primary">{Math.round(docCount)}</p>
            <p className="text-xs font-sans font-medium uppercase tracking-widest text-theme-muted mt-1">Total Documents</p>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="bg-theme-surface border border-theme-border rounded-xl p-4 flex flex-col items-center justify-center text-center shadow-lg hover:shadow-[0_8px_30px_rgba(221,102,104,0.12)] hover:-translate-y-1 transition-all duration-300"
          >
            <Layers className="w-6 h-6 text-[#dd6668] mb-2" />
            <p className="text-xl font-display font-normal text-theme-primary">{Math.round(chunkCount)}</p>
            <p className="text-xs font-sans font-medium uppercase tracking-widest text-theme-muted mt-1">Total Chunks</p>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="bg-theme-surface border border-theme-border rounded-xl p-4 flex flex-col items-center justify-center text-center shadow-lg hover:shadow-[0_8px_30px_rgba(221,102,104,0.12)] hover:-translate-y-1 transition-all duration-300"
          >
            <Clock className="w-6 h-6 text-[#dd6668] mb-2" />
            <p className="text-sm font-sans font-medium text-theme-primary truncate w-full px-2">
              {stats.last_updated ? new Date(stats.last_updated).toLocaleDateString() : 'Never'}
            </p>
            <p className="text-xs font-sans font-medium uppercase tracking-widest text-theme-muted mt-1">Last Updated</p>
          </motion.div>
        </div>
      )}

      <AnimatePresence>
        {toastMessage && (
          <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
