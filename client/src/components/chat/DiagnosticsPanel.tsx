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
  price: 'bg-red-100 text-red-700 border-red-200',
  trust: 'bg-orange-100 text-orange-700 border-orange-200',
  timing: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  competitor: 'bg-green-100 text-green-700 border-green-200',
  fit: 'bg-blue-100 text-blue-700 border-blue-200',
  buying_signal: 'bg-purple-100 text-purple-700 border-purple-200',
  neutral: 'bg-gray-100 text-gray-700 border-gray-200',
};

function Accordion({ title, children, defaultOpen = false }: { title: string, children: React.ReactNode, defaultOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border border-[#f9fafb] rounded-xl overflow-hidden mb-4">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-[#f9fafb] transition-colors text-left font-sans"
      >
        <span className="font-medium text-sm text-[#0a0a0a]">{title}</span>
        {isOpen ? <ChevronUp className="w-4 h-4 text-[#6b7280]" /> : <ChevronDown className="w-4 h-4 text-[#6b7280]" />}
      </button>
      {isOpen && (
        <div className="px-4 py-3 bg-white border-t border-[#f9fafb] text-sm text-[#6b7280]">
          {children}
        </div>
      )}
    </div>
  );
}

export default function DiagnosticsPanel({ data }: { data: ChatResponse | null }) {
  if (!data) {
    return (
      <div className="w-72 border-l border-[#f9fafb] bg-white h-full flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-[#f9fafb] flex items-center justify-center mb-4">
          <Zap className="w-8 h-8 text-[#6b7280] opacity-50" />
        </div>
        <p className="text-[#6b7280] text-sm leading-relaxed font-sans font-light">Send a message to see live diagnostics</p>
      </div>
    );
  }

  const SentimentIcon = sentimentIcons[data.sentiment.toLowerCase()] || Meh;
  const badgeClass = badgeColors[data.objection_label] || badgeColors['neutral'];

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="w-72 border-l border-[#f9fafb] bg-white h-full flex flex-col overflow-y-auto"
    >
      <div className="p-5 space-y-6">
        
        {/* Objection Badge */}
        <div>
          <h4 className="text-xs font-sans font-medium text-[#6b7280] uppercase tracking-widest mb-2">Primary Objection</h4>
          <div className={`w-full border rounded-xl p-3 flex flex-col items-center justify-center text-center ${badgeClass}`}>
            <span className="font-sans font-bold text-sm tracking-wide uppercase">{data.objection_label.replace('_', ' ')}</span>
          </div>
          <div className="mt-2 w-full bg-[#f9fafb] rounded-full h-1.5 overflow-hidden relative">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${Math.round(data.confidence * 100)}%` }}
              transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.3 }}
              className="absolute left-0 top-0 bottom-0 bg-current opacity-70"
            />
          </div>
          <p className="text-right text-[10px] text-[#6b7280] mt-1 font-mono">
            {Math.round(data.confidence * 100)}% CONFIDENCE
          </p>
        </div>

        {/* Handoff Warning */}
        {data.should_handoff && (
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-amber-50 border border-amber-200 text-amber-700 rounded-xl p-3 flex items-start space-x-3"
          >
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span className="text-sm font-sans font-medium">Human handoff recommended</span>
          </motion.div>
        )}

        {/* Quick Stats */}
        <div className="space-y-3">
          <div className="flex items-center space-x-3 text-sm text-[#0a0a0a]">
            <SentimentIcon className="w-4 h-4 text-[#6b7280]" />
            <span className="capitalize">{data.sentiment} Sentiment</span>
          </div>
          <div className="flex items-center space-x-3 text-sm text-[#0a0a0a]">
            <User className="w-4 h-4 text-[#6b7280]" />
            <span className="capitalize">{data.persona}</span>
          </div>
          <div className="flex items-center space-x-3 text-sm text-[#0a0a0a]">
            <Zap className="w-4 h-4 text-[#6b7280]" />
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
                <span className="block text-[10px] font-semibold text-[#0a0a0a] uppercase mb-1">Objection Reasoning</span>
                <p className="text-xs leading-relaxed">{data.explanation.objection_reason}</p>
              </div>
              <div>
                <span className="block text-[10px] font-semibold text-[#0a0a0a] uppercase mb-1">Persona Reasoning</span>
                <p className="text-xs leading-relaxed">{data.explanation.persona_reason}</p>
              </div>
              <div>
                <span className="block text-[10px] font-semibold text-[#0a0a0a] uppercase mb-1">Sentiment Reasoning</span>
                <p className="text-xs leading-relaxed">{data.explanation.sentiment_reason}</p>
              </div>
              <div>
                <span className="block text-[10px] font-semibold text-[#0a0a0a] uppercase mb-1">Strategy</span>
                <p className="text-xs leading-relaxed">{data.explanation.strategy_reason}</p>
              </div>
              {data.explanation.confidence_note && (
                <div>
                  <span className="block text-[10px] font-semibold text-[#0a0a0a] uppercase mb-1">Confidence Note</span>
                  <p className="text-xs leading-relaxed">{data.explanation.confidence_note}</p>
                </div>
              )}
              {data.explanation.trigger_phrases && data.explanation.trigger_phrases.length > 0 && (
                <div>
                  <span className="block text-[10px] font-semibold text-[#0a0a0a] uppercase mb-1">Trigger Phrases</span>
                  <div className="flex flex-wrap gap-1">
                    {data.explanation.trigger_phrases.map((tp, idx) => (
                      <span key={idx} className="bg-[#f9fafb] border border-[#f9fafb] text-[#0a0a0a] text-[10px] px-2 py-0.5 rounded-md font-mono">
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
                    <span className="font-mono text-[10px] truncate pr-2 text-[#0a0a0a]">
                      {doc.source_file} (Chunk {doc.chunk_index})
                    </span>
                    <span className="text-[10px] text-[#6b7280]">{Math.round(doc.score * 100)}%</span>
                  </div>
                  <div className="w-full bg-[#f9fafb] h-1 rounded-full overflow-hidden relative">
                    <div className="absolute left-0 top-0 bottom-0 bg-[#dd6668]" style={{ width: `${doc.score * 100}%` }} />
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
