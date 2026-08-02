import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  SmilePlus, Frown, Meh, User, Zap, AlertTriangle, ChevronDown, ChevronUp
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ChatResponse } from '../../types/api';

const sentimentIcons: Record<string, LucideIcon> = {
  positive: SmilePlus,
  negative: Frown,
  neutral: Meh,
};

const badgeColors: Record<string, string> = {
  price: 'bg-red-500/10 text-red-400 border-red-500/20',
  trust: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  timing: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  competitor: 'bg-green-500/10 text-green-400 border-green-500/20',
  fit: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  buying_signal: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  neutral: 'bg-theme-border text-theme-muted border-theme-border-strong',
};

function Accordion({ title, children, defaultOpen = false }: { title: string, children: React.ReactNode, defaultOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border border-theme-border rounded-xl overflow-hidden mb-4 shadow-sm">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-900/[0.024] hover:bg-slate-900/[0.048] transition-colors text-left font-sans"
      >
        <span className="font-semibold text-xs text-theme-primary uppercase tracking-wider">{title}</span>
        {isOpen ? <ChevronUp className="w-4 h-4 text-theme-muted" /> : <ChevronDown className="w-4 h-4 text-theme-muted" />}
      </button>
      {isOpen && (
        <div className="px-4 py-3 bg-theme-surface-solid border-t border-theme-border text-xs text-theme-muted">
          {children}
        </div>
      )}
    </div>
  );
}

export default function DiagnosticsPanel({ data }: { data: ChatResponse | null }) {
  if (!data) {
    return (
      <div className="w-72 border-l border-theme-border bg-white/90 backdrop-blur-md h-full flex flex-col items-center justify-center p-6 text-center shadow-lg">
        <div className="w-16 h-16 rounded-full bg-theme-border border border-theme-border-strong flex items-center justify-center mb-4">
          <Zap className="w-8 h-8 text-[#0D9488]" />
        </div>
        <p className="text-theme-muted text-sm leading-relaxed font-sans font-medium">Send a message to see live diagnostics</p>
      </div>
    );
  }

  const SentimentIcon = sentimentIcons[data.sentiment.toLowerCase()] || Meh;
  const badgeClass = badgeColors[data.objection_label] || badgeColors['neutral'];

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="w-72 border-l border-theme-border bg-white/90 backdrop-blur-md h-full flex flex-col overflow-y-auto shadow-md"
    >
      <div className="p-5 space-y-6">
        
        {/* Objection Badge */}
        <div>
          <h4 className="text-xs font-sans font-medium text-theme-muted uppercase tracking-widest mb-2">Primary Objection</h4>
          <div className={`w-full border rounded-xl p-3 flex flex-col items-center justify-center text-center ${badgeClass}`}>
            <span className="font-sans font-bold text-sm tracking-wide uppercase">{data.objection_label.replace('_', ' ')}</span>
          </div>
          <div className="mt-2 w-full bg-theme-border rounded-full h-1.5 overflow-hidden relative">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${Math.round(data.confidence * 100)}%` }}
              transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.3 }}
              className="absolute left-0 top-0 bottom-0 bg-[#0D9488] opacity-70"
            />
          </div>
          <p className="text-right text-[10px] text-theme-muted mt-1 font-mono">
            {Math.round(data.confidence * 100)}% CONFIDENCE
          </p>
        </div>

        {/* Handoff Warning */}
        {data.should_handoff && (
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-xl p-3 flex items-start space-x-3"
          >
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span className="text-sm font-sans font-medium">Human handoff recommended</span>
          </motion.div>
        )}

        {/* Quick Stats */}
        <div className="space-y-3">
          <div className="flex items-center space-x-3 text-sm text-theme-primary">
            <SentimentIcon className="w-4 h-4 text-theme-muted" />
            <span className="capitalize">{data.sentiment} Sentiment</span>
          </div>
          <div className="flex items-center space-x-3 text-sm text-theme-primary">
            <User className="w-4 h-4 text-theme-muted" />
            <span className="capitalize">{data.persona}</span>
          </div>
          <div className="flex items-center space-x-3 text-sm text-theme-primary">
            <Zap className="w-4 h-4 text-theme-muted" />
            <span className="capitalize">{data.strategy.replace(/_/g, ' ')} Strategy</span>
          </div>
        </div>

        {/* Memory Context */}
        {data.memory_context && (
          <Accordion title="Memory Context">
            <div className="font-mono text-xs whitespace-pre-wrap">
              {data.memory_context}
            </div>
          </Accordion>
        )}

        {/* Explanation */}
        {data.explanation && (
          <Accordion title="Why did Auralis say this?">
            <div className="space-y-3">
              <div>
                <span className="block text-[10px] font-semibold text-theme-primary uppercase mb-1">Objection Reasoning</span>
                <p className="text-xs leading-relaxed">{data.explanation.objection_reason}</p>
              </div>
              <div>
                <span className="block text-[10px] font-semibold text-theme-primary uppercase mb-1">Persona Reasoning</span>
                <p className="text-xs leading-relaxed">{data.explanation.persona_reason}</p>
              </div>
              <div>
                <span className="block text-[10px] font-semibold text-theme-primary uppercase mb-1">Sentiment Reasoning</span>
                <p className="text-xs leading-relaxed">{data.explanation.sentiment_reason}</p>
              </div>
              <div>
                <span className="block text-[10px] font-semibold text-theme-primary uppercase mb-1">Strategy</span>
                <p className="text-xs leading-relaxed">{data.explanation.strategy_reason}</p>
              </div>
              {data.explanation.confidence_note && (
                <div>
                  <span className="block text-[10px] font-semibold text-theme-primary uppercase mb-1">Confidence Note</span>
                  <p className="text-xs leading-relaxed">{data.explanation.confidence_note}</p>
                </div>
              )}
              {data.explanation.trigger_phrases && data.explanation.trigger_phrases.length > 0 && (
                <div>
                  <span className="block text-[10px] font-semibold text-theme-primary uppercase mb-1">Trigger Phrases</span>
                  <div className="flex flex-wrap gap-1">
                    {data.explanation.trigger_phrases.map((tp, idx) => (
                      <span key={idx} className="bg-theme-border border border-theme-border-strong text-theme-primary text-[10px] px-2 py-0.5 rounded-md font-mono">
                        "{tp}"
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Accordion>
        )}

        {/* Retrieved Docs */}
        {data.retrieved_docs && data.retrieved_docs.length > 0 && (
          <Accordion title="Retrieved documents">
            <div className="space-y-4">
              {data.retrieved_docs.map((doc, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] truncate pr-2 text-theme-primary">
                      {doc.source_file} (Chunk {doc.chunk_index})
                    </span>
                    <span className="text-[10px] text-theme-muted">{Math.round(Math.max(0, 1 - doc.score / 2) * 100)}%</span>
                  </div>
                  <div className="w-full bg-theme-border h-1 rounded-full overflow-hidden relative">
                    <div className="absolute left-0 top-0 bottom-0 bg-[#0D9488]" style={{ width: `${Math.max(0, 1 - doc.score / 2) * 100}%` }} />
                  </div>
                  <p className="text-[10px] leading-snug line-clamp-3 italic opacity-80 mt-1">
                    {doc.text.substring(0, 300)}
                    {doc.text.length > 300 && '...'}
                  </p>
                </div>
              ))}
            </div>
          </Accordion>
        )}

      </div>
    </motion.div>
  );
}
