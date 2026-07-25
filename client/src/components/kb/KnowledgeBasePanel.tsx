import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Database, Layers, Clock, AlertCircle } from 'lucide-react';
import { useKBStats, useIngestFiles } from '../../api/hooks/useKnowledgeBase';
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
      className="fixed bottom-6 right-6 bg-[#0a0a0a] text-white rounded-xl px-4 py-3 shadow-lg z-50 flex items-center space-x-2"
    >
      <span className="text-sm font-medium">{message}</span>
    </motion.div>
  );
};

export default function KnowledgeBasePanel() {
  const { data: stats, isLoading: statsLoading, isError: statsError, refetch } = useKBStats();
  const ingestMutation = useIngestFiles();
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

  return (
    <div className="px-6 py-8 max-w-3xl mx-auto bg-white min-h-full">
      <h2 className="text-2xl font-display font-normal text-[#0a0a0a] mb-2 tracking-tight">Knowledge Base</h2>
      <p className="text-sm font-sans font-light text-[#6b7280] mb-8">Upload sales collateral to train auralis</p>

      <FileDropzone 
        onIngest={handleIngest} 
        isIngesting={ingestMutation.isPending}
        isSuccess={ingestMutation.isSuccess}
        error={ingestMutation.isError ? "Failed to ingest files. Please try again." : null}
        successData={ingestMutation.data}
      />

      <div className="my-8 border-t border-[#f9fafb]" />

      <h3 className="text-lg font-display font-normal text-[#0a0a0a] mb-4">Current Statistics</h3>
      
      {statsLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : statsError || !stats ? (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 flex items-center space-x-3">
          <AlertCircle className="w-5 h-5" />
          <span>Failed to load KB stats.</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="bg-[#f9fafb] border border-[#f9fafb] rounded-xl p-4 flex flex-col items-center justify-center text-center"
          >
            <Database className="w-6 h-6 text-[#dd6668] mb-2" />
            <p className="text-xl font-display font-normal text-[#0a0a0a]">{Math.round(docCount)}</p>
            <p className="text-xs font-sans font-medium uppercase tracking-widest text-[#6b7280] mt-1">Total Documents</p>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="bg-[#f9fafb] border border-[#f9fafb] rounded-xl p-4 flex flex-col items-center justify-center text-center"
          >
            <Layers className="w-6 h-6 text-[#dd6668] mb-2" />
            <p className="text-xl font-display font-normal text-[#0a0a0a]">{Math.round(chunkCount)}</p>
            <p className="text-xs font-sans font-medium uppercase tracking-widest text-[#6b7280] mt-1">Total Chunks</p>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="bg-[#f9fafb] border border-[#f9fafb] rounded-xl p-4 flex flex-col items-center justify-center text-center"
          >
            <Clock className="w-6 h-6 text-[#dd6668] mb-2" />
            <p className="text-sm font-sans font-medium text-[#0a0a0a] truncate w-full px-2">
              {stats.last_updated ? new Date(stats.last_updated).toLocaleDateString() : 'Never'}
            </p>
            <p className="text-xs font-sans font-medium uppercase tracking-widest text-[#6b7280] mt-1">Last Updated</p>
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
