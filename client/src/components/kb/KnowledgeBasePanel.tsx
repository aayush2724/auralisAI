import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, RefreshCw, Files, Boxes, Clock3 } from 'lucide-react';
import { useKBStats, useIngestFiles, useResetKB, useExtractImage, useIngestImage } from '../../api/hooks/useKnowledgeBase';
import { useCountUp } from '../../hooks/useCountUp';
import FileDropzone from './FileDropzone';
import Skeleton from '../ui/Skeleton';
import SectionHeader from '../ui/SectionHeader';
import MetricCard from '../ui/MetricCard';
import GlassPanel from '../ui/GlassPanel';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import OCRPreviewModal from './OCRPreviewModal';
import type { ImageExtractionResult } from '../../types/api';

const Toast = ({ message, onClose }: { message: string, onClose: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
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
  const extractMutation = useExtractImage();
  const ingestImageMutation = useIngestImage();

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [previewResults, setPreviewResults] = useState<ImageExtractionResult[]>([]);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [lastSelectedAudience, setLastSelectedAudience] = useState<"internal" | "external">("internal");

  const docCount = useCountUp(stats?.total_documents || 0, 1200, true);
  const chunkCount = useCountUp(stats?.total_chunks || 0, 1200, true);

  useEffect(() => {
    if (ingestMutation.isSuccess || ingestImageMutation.isSuccess) {
      refetch();
    }
  }, [ingestMutation.isSuccess, ingestImageMutation.isSuccess, refetch]);

  const handleIngest = async (files: File[], audience: "internal" | "external") => {
    setLastSelectedAudience(audience);
    const images = files.filter(f => ['png', 'jpg', 'jpeg', 'webp'].includes(f.name.split('.').pop()?.toLowerCase() || ''));
    const standardFiles = files.filter(f => !['png', 'jpg', 'jpeg', 'webp'].includes(f.name.split('.').pop()?.toLowerCase() || ''));

    // Process standard documents
    if (standardFiles.length > 0) {
      const formData = new FormData();
      standardFiles.forEach(file => formData.append('files', file));
      formData.append('audience', audience);
      
      ingestMutation.mutate(formData, {
        onSuccess: (data) => {
          let msg = `Success: ${data.chunks_added} chunks added from documents.`;
          if (data.files_overridden && data.files_overridden.length > 0) {
            msg += ` Note: ${data.files_overridden.join(', ')} auto-tagged as internal.`;
          }
          setToastMessage(msg);
        },
        onError: () => {
          setToastMessage("Failed to ingest files. Please try again.");
        }
      });
    }

    // Process images
    if (images.length > 0) {
      const imageFormData = new FormData();
      images.forEach(file => imageFormData.append('files', file));
      
      extractMutation.mutate(imageFormData, {
        onSuccess: (data) => {
          setPreviewResults(data);
          setIsPreviewOpen(true);
        },
        onError: () => {
          setToastMessage("Failed to extract text from images.");
        }
      });
    }
  };

  const handleAcceptImages = () => {
    ingestImageMutation.mutate({ images: previewResults, audience: lastSelectedAudience }, {
      onSuccess: (data) => {
        let msg = `Success: ${data.chunks_added} chunks added from images.`;
        if (data.files_overridden && data.files_overridden.length > 0) {
          msg += ` Note: ${data.files_overridden.join(', ')} auto-tagged as internal.`;
        }
        setToastMessage(msg);
        setIsPreviewOpen(false);
        setPreviewResults([]);
      },
      onError: () => {
        setToastMessage("Failed to ingest image text.");
      }
    });
  };

  const executeReset = async () => {
    resetMutation.mutate(undefined, {
      onSuccess: () => {
        setToastMessage("Knowledge Base has been reset successfully.");
        setIsResetConfirmOpen(false);
        refetch();
      },
      onError: () => {
        setToastMessage("Failed to reset Knowledge Base.");
        setIsResetConfirmOpen(false);
      }
    });
  };

  const handleReset = () => {
    setIsResetConfirmOpen(true);
  };

  return (
    <div className="h-full overflow-y-auto px-4 py-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-4">
        <SectionHeader
          eyebrow="Knowledge Base"
          title="Upload and manage collateral"
          description="Train the knowledge base with a polished drag-and-drop upload flow and centered statistics."
        />

        <div className="w-full max-w-4xl">
          <FileDropzone
            onIngest={handleIngest}
            isIngesting={ingestMutation.isPending || extractMutation.isPending}
            isSuccess={ingestMutation.isSuccess}
            error={(ingestMutation.isError || extractMutation.isError) ? 'Failed to ingest files. Please try again.' : null}
            successData={ingestMutation.data}
          />
        </div>

        <GlassPanel className="w-full max-w-5xl rounded-[32px] p-4">
          <div className="mb-4 flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
            <div>
              <p className="section-label mb-2">Current Statistics</p>
              <h3 className="text-xl font-semibold tracking-tight text-theme-primary">Knowledge Base Status</h3>
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
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Skeleton className="h-[160px]" />
              <Skeleton className="h-[160px]" />
              <Skeleton className="h-[160px]" />
            </div>
          ) : statsError || !stats ? (
            <div className="rounded-[24px] border border-red-500/20 bg-red-500/10 px-3 py-3 text-red-700 shadow-sm">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5" />
                <span>Failed to load KB stats.</span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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

      <ConfirmDialog
        open={isResetConfirmOpen}
        title="Delete Knowledge Base"
        description="Are you sure you want to delete all knowledge base content? This will permanently remove all ingested files and embeddings."
        confirmText="Delete"
        variant="danger"
        loading={resetMutation.isPending}
        onConfirm={executeReset}
        onCancel={() => setIsResetConfirmOpen(false)}
      />

      <AnimatePresence>
        {toastMessage && <Toast message={toastMessage} onClose={() => setToastMessage(null)} />}
      </AnimatePresence>

      <OCRPreviewModal
        open={isPreviewOpen}
        onClose={() => { setIsPreviewOpen(false); setPreviewResults([]); }}
        onAccept={handleAcceptImages}
        results={previewResults}
        isIngesting={ingestImageMutation.isPending}
      />
    </div>
  );
}
