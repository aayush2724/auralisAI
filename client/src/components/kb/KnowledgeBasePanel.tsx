import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, RefreshCw, Files, Boxes, Clock3 } from 'lucide-react';
import { useKBStats, useIngestFiles, useResetKB } from '../../api/hooks/useKnowledgeBase';
import { useCountUp } from '../../hooks/useCountUp';
import FileDropzone from './FileDropzone';
import Skeleton from '../ui/Skeleton';
import SectionHeader from '../ui/SectionHeader';
import MetricCard from '../ui/MetricCard';
import GlassPanel from '../ui/GlassPanel';
import { Button } from '../ui/Button';

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
      className="fixed bottom-6 right-6 z-50 flex items-center space-x-2 rounded-full border border-theme-border bg-white/75 px-4 py-3 text-theme-primary shadow-[0_18px_50px_rgba(16,32,51,0.12)] backdrop-blur-2xl"
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
    <div className="h-full overflow-y-auto px-6 py-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-6">
        <SectionHeader
          eyebrow="Knowledge Base"
          title="Upload and manage collateral"
          description="Train the knowledge base with a polished drag-and-drop upload flow and centered statistics."
        />

        <div className="w-full max-w-4xl">
          <FileDropzone
            onIngest={handleIngest}
            isIngesting={ingestMutation.isPending}
            isSuccess={ingestMutation.isSuccess}
            error={ingestMutation.isError ? 'Failed to ingest files. Please try again.' : null}
            successData={ingestMutation.data}
          />
        </div>

        <GlassPanel className="w-full max-w-5xl rounded-[32px] p-6">
          <div className="mb-5 flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
            <div>
              <p className="section-label mb-2">Current Statistics</p>
              <h3 className="text-2xl font-semibold tracking-tight text-theme-primary">Knowledge Base Status</h3>
            </div>
            <Button
              onClick={handleReset}
              disabled={resetMutation.isPending}
              variant="secondary"
              className="rounded-full px-5 py-3 text-red-600"
            >
              <RefreshCw className={`h-4 w-4 ${resetMutation.isPending ? 'animate-spin' : ''}`} />
              {resetMutation.isPending ? 'Resetting...' : 'Reset'}
            </Button>
          </div>

          {statsLoading ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <Skeleton className="h-[160px]" />
              <Skeleton className="h-[160px]" />
              <Skeleton className="h-[160px]" />
            </div>
          ) : statsError || !stats ? (
            <div className="rounded-[24px] border border-red-500/20 bg-red-500/10 px-4 py-4 text-red-700 shadow-sm">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5" />
                <span>Failed to load KB stats.</span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <MetricCard
                label="Total Documents"
                value={Math.round(docCount)}
                icon={Files}
                tone="indigo"
                size="large"
              />
              <MetricCard
                label="Total Chunks"
                value={Math.round(chunkCount)}
                icon={Boxes}
                tone="teal"
                size="large"
              />
              <MetricCard
                label="Last Updated"
                value={stats.last_updated ? new Date(stats.last_updated).toLocaleDateString() : 'Never'}
                icon={Clock3}
                tone="amber"
                size="large"
              />
            </div>
          )}
        </GlassPanel>
      </div>

      <AnimatePresence>
        {toastMessage && (
          <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
