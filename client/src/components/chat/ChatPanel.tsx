import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, ChevronDown, ChevronUp, FileText, Gauge, Lightbulb, ShieldAlert, PanelRightOpen, PanelRightClose } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChat } from '../../api/hooks/useChat';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import DiagnosticsPanel from './DiagnosticsPanel';
import TypingIndicator from './TypingIndicator';
import { Button } from '../ui/Button';
import type { ChatResponse, Message } from '../../types/api';

function highlightTriggerPhrases(text: string, phrases: string[]) {
  const cleanPhrases = phrases.map((phrase) => phrase.trim()).filter(Boolean);
  if (cleanPhrases.length === 0) return text;

  const escaped = cleanPhrases.map((phrase) => phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const matcher = new RegExp(`(${escaped.join('|')})`, 'gi');

  return text.split(matcher).map((part, index) => {
    const isTrigger = cleanPhrases.some((phrase) => phrase.toLowerCase() === part.toLowerCase());
    if (!isTrigger) return <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>;

    return (
      <mark key={`${part}-${index}`} className="rounded bg-amber-200/80 px-1 py-0.5 text-[#0a0a0a]">
        {part}
      </mark>
    );
  });
}

function ConfidenceIndicator({ confidence }: { confidence: number }) {
  const percent = Math.round(confidence * 100);
  const stroke = 2 * Math.PI * 14;
  const offset = stroke - (stroke * percent) / 100;

  return (
    <div className="flex items-center gap-2 rounded-full border border-[#f9fafb] bg-white px-2.5 py-1 text-[11px] font-medium text-[#0a0a0a] shadow-sm">
      <span className="relative h-8 w-8">
        <svg className="h-8 w-8 -rotate-90" viewBox="0 0 32 32" aria-hidden="true">
          <circle cx="16" cy="16" r="14" fill="none" stroke="#EAECE9" strokeWidth="3" />
          <circle
            cx="16"
            cy="16"
            r="14"
            fill="none"
            stroke="#dd6668"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={stroke}
            strokeDashoffset={offset}
          />
        </svg>
        <Gauge className="absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 text-[#dd6668]" />
      </span>
      <span>{percent}% confidence</span>
    </div>
  );
}

function MessageAccordion({ title, icon: Icon, children, defaultOpen = false }: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="overflow-hidden rounded-xl border border-[#f9fafb] bg-white/80">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs font-medium text-[#0a0a0a]"
      >
        <span className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 text-[#dd6668]" />
          {title}
        </span>
        {isOpen ? <ChevronUp className="h-4 w-4 text-[#6b7280]" /> : <ChevronDown className="h-4 w-4 text-[#6b7280]" />}
      </button>
      {isOpen && (
        <div className="border-t border-[#f9fafb] px-3 py-3 text-xs text-[#6b7280]">
          {children}
        </div>
      )}
    </div>
  );
}

function WhyThisResponse({ data, sourceMessage }: { data: ChatResponse; sourceMessage?: string }) {
  const explanationRows = [
    { label: `Objection: ${data.objection_label.replace(/_/g, ' ')}`, reason: data.explanation.objection_reason },
    { label: `Persona: ${data.persona}`, reason: data.explanation.persona_reason },
    { label: `Sentiment: ${data.sentiment}`, reason: data.explanation.sentiment_reason },
    { label: `Strategy: ${data.strategy.replace(/_/g, ' ')}`, reason: data.explanation.strategy_reason },
  ];

  return (
    <MessageAccordion title="Why this response" icon={Lightbulb} defaultOpen>
      <div className="space-y-3">
        {sourceMessage && (
          <div className="rounded-lg bg-[#f9fafb] p-3 leading-relaxed text-[#0a0a0a]">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-[#6b7280]">Original signal</span>
            <p>{highlightTriggerPhrases(sourceMessage, data.explanation.trigger_phrases)}</p>
          </div>
        )}

        <div className="grid gap-2">
          {explanationRows.map((row) => (
            <div key={row.label} className="rounded-lg border border-[#f9fafb] bg-white p-3">
              <span className="block text-[10px] font-semibold uppercase tracking-widest text-[#0a0a0a]">{row.label}</span>
              <p className="mt-1 leading-relaxed">{row.reason}</p>
            </div>
          ))}
        </div>

        {data.explanation.confidence_note && (
          <div className="rounded-lg bg-[#f9fafb]/70 p-3 leading-relaxed text-[#0a0a0a]">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-[#dd6668]">Confidence note</span>
            {data.explanation.confidence_note}
          </div>
        )}
      </div>
    </MessageAccordion>
  );
}

function SourcesUsed({ data }: { data: ChatResponse }) {
  if (!data.retrieved_docs.length) return null;

  return (
    <MessageAccordion title="Sources used" icon={FileText}>
      <div className="space-y-2">
        {data.retrieved_docs.map((doc, index) => (
          <div key={`${doc.source_file}-${doc.chunk_index}-${index}`} className="flex items-center justify-between gap-3 rounded-lg bg-[#f9fafb] px-3 py-2">
            <span className="min-w-0 truncate font-mono text-[11px] text-[#0a0a0a]">
              {doc.source_file} · chunk {doc.chunk_index}
            </span>
            <span className="shrink-0 rounded-full bg-white px-2 py-0.5 font-mono text-[10px] text-[#6b7280]">
              {Math.round(doc.score * 100)}%
            </span>
          </div>
        ))}
      </div>
    </MessageAccordion>
  );
}

function AssistantMessageMeta({ message }: { message: Message }) {
  const data = message.responseMeta;
  if (!data) return null;

  return (
    <div className="mt-3 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <ConfidenceIndicator confidence={data.confidence} />
        <span className="rounded-full border border-[#f9fafb] bg-white px-2.5 py-1 text-[11px] font-medium capitalize text-[#6b7280]">
          {data.objection_label.replace(/_/g, ' ')}
        </span>
      </div>

      {data.should_handoff && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-800">
          <div className="flex items-start gap-2">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="text-xs font-semibold">Escalate to a human rep</p>
              <p className="mt-1 text-xs leading-relaxed">
                Auralis recommends human handoff for this response.
                {data.explanation.handoff_reason ? ` ${data.explanation.handoff_reason}` : ''}
              </p>
            </div>
          </div>
        </div>
      )}

      <WhyThisResponse data={data} sourceMessage={message.sourceMessage} />
      <SourcesUsed data={data} />
    </div>
  );
}

export default function ChatPanel({ sessionId: initialSessionId }: { sessionId: string }) {
  const [currentSessionId, setCurrentSessionId] = useState(initialSessionId);
  const { messages, sendMessage, isLoading, lastResponse, clearMessages, wsError } = useChat(currentSessionId);
  const [input, setInput] = useState('');
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleNewSession = () => {
    setCurrentSessionId(crypto.randomUUID());
    clearMessages();
  };

  const handleSubmit = () => {
    if (!input.trim() || isLoading) return;
    sendMessage(input.trim());
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  return (
    <div className="flex flex-row h-full w-full bg-white">
      <div className="flex flex-col flex-1 h-full min-w-0 relative">
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-[#f9fafb] bg-white/50 backdrop-blur-sm z-10 sticky top-0">
          <div className="flex items-center space-x-2 truncate min-w-0">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" aria-hidden="true" />
            <span className="font-mono text-xs text-[#6b7280] truncate">
              {currentSessionId}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-2">
            <button
              onClick={() => setDiagnosticsOpen(!diagnosticsOpen)}
              className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg border border-[#f9fafb] text-[#0a0a0a] hover:bg-[#f9fafb] transition-colors"
              aria-label={diagnosticsOpen ? 'Hide diagnostics' : 'Show diagnostics'}
            >
              {diagnosticsOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
            </button>
            <Button 
              variant="outline"
              onClick={handleNewSession}
              className="flex-shrink-0"
            >
              New Session
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 pb-32">
          <div className="max-w-3xl mx-auto flex flex-col space-y-6">
            <AnimatePresence initial={false}>
              {messages.map((msg) => {
                const isUser = msg.role === 'user';
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, scale: 0.9, x: isUser ? 20 : -20, y: 10 }}
                    animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30, mass: 0.8 }}
                    className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} space-x-3`}
                  >
                    {!isUser && (
                      <div className="flex-shrink-0 mt-1">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#dd6668] to-[#0a0a0a] flex items-center justify-center" aria-hidden="true">
                          <Mic className="w-4 h-4 text-white" />
                        </div>
                      </div>
                    )}
                    
                    <div className={`
                      px-5 py-4 max-w-[80%] text-sm leading-relaxed shadow-sm font-sans font-light
                      ${isUser 
                        ? 'bg-[#0a0a0a] text-white rounded-2xl rounded-tr-sm' 
                        : 'bg-[#f9fafb] text-[#0a0a0a] rounded-2xl rounded-tl-sm'}
                    `}>
                      {isUser ? (
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                      ) : (
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm]}
                          components={{
                            p: (props) => <p className="mb-3 last:mb-0" {...props} />,
                            ul: (props) => <ul className="list-disc pl-5 mb-3 last:mb-0 space-y-1.5 marker:text-[#dd6668]" {...props} />,
                            ol: (props) => <ol className="list-decimal pl-5 mb-3 last:mb-0 space-y-1.5 marker:text-[#dd6668]" {...props} />,
                            li: (props) => <li className="pl-1" {...props} />,
                            strong: (props) => <strong className="font-semibold text-current" {...props} />,
                            a: (props) => <a className="underline hover:opacity-80 underline-offset-2" {...props} />
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      )}
                      {!isUser && <AssistantMessageMeta message={msg} />}
                    </div>

                    {isUser && (
                      <div className="flex-shrink-0 mt-1">
                        <div className="w-8 h-8 rounded-full bg-[#f9fafb] border border-[#f9fafb] flex items-center justify-center" aria-hidden="true">
                          <span className="text-[#6b7280] text-xs font-bold">U</span>
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
            {isLoading && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="absolute bottom-0 inset-x-0 bg-white border-t border-[#f9fafb] p-3 sm:p-4">
          <div className="max-w-3xl mx-auto flex items-end space-x-3 bg-white">
            {wsError && (
              <div className="absolute -top-9 left-1/2 w-[min(92vw,42rem)] -translate-x-1/2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-800">
                {wsError}
              </div>
            )}
            <label htmlFor="chat-input" className="sr-only">Type your message</label>
            <textarea
              id="chat-input"
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              className="flex-1 rounded-2xl border border-[#f9fafb] px-4 py-3 resize-none outline-none focus:border-[#dd6668] bg-[#f9fafb] focus:bg-white transition-colors text-sm max-h-[120px] font-sans font-light"
            />
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={!input.trim() || isLoading}
              className="flex-shrink-0 w-12 h-[46px] p-0 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Send message"
            >
              <Send className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      <div className="hidden lg:block">
        <DiagnosticsPanel data={lastResponse} />
      </div>

      <AnimatePresence>
        {diagnosticsOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm lg:hidden"
              onClick={() => setDiagnosticsOpen(false)}
              aria-hidden="true"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="fixed right-0 top-0 bottom-0 z-40 lg:hidden"
            >
              <DiagnosticsPanel data={lastResponse} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
