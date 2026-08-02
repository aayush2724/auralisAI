import React, { useState, useRef, useEffect } from 'react';
import { Mic, ChevronDown, ChevronUp, FileText, Gauge, Lightbulb, ShieldAlert, PanelRightOpen, PanelRightClose } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChat } from '../../api/hooks/useChat';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
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
      <mark key={`${part}-${index}`} className="rounded bg-[#0D9488]/15 px-1 py-0.5 text-theme-primary border border-[#0D9488]/30">
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
    <div className="flex items-center gap-2 rounded-full border border-theme-border bg-theme-surface px-2.5 py-1 text-[11px] font-medium text-theme-primary shadow-sm">
      <span className="relative h-8 w-8">
        <svg className="h-8 w-8 -rotate-90" viewBox="0 0 32 32" aria-hidden="true">
          <circle cx="16" cy="16" r="14" fill="none" stroke="rgba(15,23,42,0.06)" strokeWidth="3" />
          <circle
            cx="16"
            cy="16"
            r="14"
            fill="none"
            stroke="#0D9488"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={stroke}
            strokeDashoffset={offset}
          />
        </svg>
        <Gauge className="absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 text-[#0D9488]" />
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
    <div className="overflow-hidden rounded-xl border border-theme-border bg-theme-surface">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs font-medium text-theme-primary"
      >
        <span className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 text-[#0D9488]" />
          {title}
        </span>
        {isOpen ? <ChevronUp className="h-4 w-4 text-theme-muted" /> : <ChevronDown className="h-4 w-4 text-theme-muted" />}
      </button>
      {isOpen && (
        <div className="p-4 border-t border-theme-border/50 max-w-2xl mx-auto w-full relative z-10">
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
          <div className="rounded-lg bg-theme-border p-3 leading-relaxed text-theme-primary">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-theme-muted">Original signal</span>
            <p>{highlightTriggerPhrases(sourceMessage, data.explanation.trigger_phrases)}</p>
          </div>
        )}

        <div className="grid gap-2">
          {explanationRows.map((row) => (
            <div key={row.label} className="rounded-lg border border-theme-border bg-theme-surface-solid p-3 text-theme-muted">
              <span className="block text-[10px] font-semibold uppercase tracking-widest text-theme-primary">{row.label}</span>
              <p className="mt-1 leading-relaxed">{row.reason}</p>
            </div>
          ))}
        </div>

        {data.explanation.confidence_note && (
          <div className="rounded-lg bg-theme-surface p-3 leading-relaxed text-theme-primary border border-theme-border">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-[#0D9488]">Confidence note</span>
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
          <div key={`${doc.source_file}-${doc.chunk_index}-${index}`} className="flex items-center justify-between gap-3 rounded-lg bg-theme-surface-solid px-3 py-2 border border-theme-border">
            <span className="min-w-0 truncate font-mono text-[11px] text-theme-primary">
              {doc.source_file} · chunk {doc.chunk_index}
            </span>
            <span className="shrink-0 rounded-full bg-theme-border px-2 py-0.5 font-mono text-[10px] text-theme-muted border border-theme-border">
              {Math.round(Math.max(0, 1 - doc.score / 2) * 100)}%
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
        <span className="rounded-full border border-theme-border bg-theme-border px-2.5 py-1 text-[11px] font-medium capitalize text-theme-muted">
          {data.objection_label.replace(/_/g, ' ')}
        </span>
      </div>

      {data.should_handoff && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-amber-300">
          <div className="flex items-start gap-2">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <div>
              <p className="text-xs font-semibold">Escalate to a human rep</p>
              <p className="mt-1 text-xs leading-relaxed text-amber-300/80">
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

  const { isListening, transcript, supported, toggleListening } = useSpeechRecognition();
  const [baseInput, setBaseInput] = useState('');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  useEffect(() => {
    if (isListening) {
      setBaseInput(input);
    } else {
      setBaseInput(input);
    }
  }, [isListening]);

  useEffect(() => {
    if (isListening && transcript) {
      const newText = (baseInput ? baseInput + ' ' : '') + transcript;
      setInput(newText);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
      }
    }
  }, [transcript, isListening, baseInput]);

  const handleNewSession = () => {
    setCurrentSessionId(crypto.randomUUID());
    clearMessages();
  };

  const handleSubmit = () => {
    if (!input.trim() || isLoading) return;
    sendMessage(input.trim());
    setInput('');
    setBaseInput('');
    if (isListening) {
      toggleListening();
    }
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
    if (!isListening) {
      setBaseInput(e.target.value);
    }
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  return (
    <div className="flex flex-row h-full w-full bg-theme-bg text-theme-primary">
      <div className="flex flex-col flex-1 h-full min-w-0 relative">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-theme-border bg-white/90 backdrop-blur-md z-10 sticky top-0 shadow-md">
          <div className="flex items-center space-x-2 truncate min-w-0">
            <span className="w-2 h-2 rounded-full bg-[#0D9488] animate-pulse shrink-0" aria-hidden="true" />
            <span className="font-mono text-xs text-theme-muted font-medium truncate">
              {currentSessionId}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-2">
            <button
              onClick={() => setDiagnosticsOpen(!diagnosticsOpen)}
              className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg border border-theme-border bg-theme-border text-theme-primary hover:bg-theme-border-strong transition-colors"
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
          <div className="max-w-3xl mx-auto flex flex-col space-y-6 min-h-full justify-center">
            <AnimatePresence mode="wait">
              {messages.length === 0 ? (
                <motion.div
                  key="empty-state"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.4, ease: "easeInOut" }}
                  className="flex flex-col items-center justify-center text-center py-12 relative"
                >
                  {/* Glowing spec background halo */}
                  <div className="absolute w-80 h-80 rounded-full bg-gradient-to-br from-[#4F46E5] via-rose-400 to-orange-500 opacity-15 blur-[100px] animate-halo-pulse z-0 pointer-events-none" />
                  
                  {/* Hero Orb & Floating Element */}
                  <div className="relative w-full flex justify-center items-center mb-6 z-10">
                    <div className="relative w-32 h-32 animate-orb-breath">
                      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-indigo-200 via-slate-100 to-sky-200 shadow-[inset_-10px_-10px_20px_rgba(0,0,0,0.1),_inset_10px_10px_20px_rgba(255,255,255,1),_0_20px_40px_rgba(79,70,229,0.2)]" />
                      <div className="absolute inset-1 rounded-full bg-gradient-to-tr from-sky-400/40 to-transparent blur-[2px]" />
                      <div className="absolute inset-2 rounded-full bg-gradient-to-bl from-purple-400/40 to-transparent blur-[2px]" />
                      <div className="absolute inset-[15%] rounded-full border border-white/40 shadow-[inset_0_0_15px_rgba(255,255,255,0.8)]" />
                      <div className="absolute top-4 left-6 w-10 h-6 rounded-full bg-white opacity-80 blur-[2px] transform -rotate-45" />
                    </div>
                    {/* Floating Card */}
                    <motion.div 
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5, type: 'spring' }}
                      className="absolute right-0 lg:right-10 top-1/2 -translate-y-1/2 neo-card rounded-[24px] p-5 w-48 hidden md:block"
                    >
                      <p className="text-xs font-sans text-center text-[#1e293b] leading-relaxed">
                        Send a message to it... <br /> (Test your AI)
                      </p>
                    </motion.div>
                  </div>

                  <p className="text-xs font-serif italic text-theme-muted tracking-wide mb-2 z-10">
                    Auralis Sales Assistant
                  </p>
                  <h2 className="text-3xl font-display font-normal text-theme-primary tracking-tight z-10">
                    How can I help you today?
                  </h2>
                </motion.div>
              ) : (
                <div className="flex flex-col space-y-6 w-full">
                  {messages.map((msg) => {
                    const isUser = msg.role === 'user';
                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, scale: 0.95, x: isUser ? 20 : -20, y: 10 }}
                        animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
                        transition={{ type: "spring", stiffness: 500, damping: 30, mass: 0.8 }}
                        className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} space-x-3`}
                      >
                        {!isUser && (
                          <div className="flex-shrink-0 mt-1">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0D9488] to-[#4F46E5] flex items-center justify-center shadow-md border border-white/10" aria-hidden="true">
                              <Mic className="w-4 h-4 text-white" />
                            </div>
                          </div>
                        )}
                        
                        <div className={`
                          px-5 py-4 max-w-[80%] text-sm leading-relaxed shadow-lg font-sans
                          ${isUser 
                            ? 'bg-theme-surface-solid text-theme-primary rounded-2xl rounded-tr-sm border border-theme-border-strong' 
                            : 'bg-theme-surface text-theme-primary border border-theme-border rounded-2xl rounded-tl-sm backdrop-blur-md'}
                        `}>
                          {isUser ? (
                            <div className="whitespace-pre-wrap font-normal">{msg.content}</div>
                          ) : (
                            <ReactMarkdown 
                              remarkPlugins={[remarkGfm]}
                              components={{
                                p: (props) => <p className="mb-3 last:mb-0 text-theme-primary" {...props} />,
                                ul: (props) => <ul className="list-disc pl-5 mb-3 last:mb-0 space-y-1.5 marker:text-[#0D9488]" {...props} />,
                                ol: (props) => <ol className="list-decimal pl-5 mb-3 last:mb-0 space-y-1.5 marker:text-[#0D9488]" {...props} />,
                                li: (props) => <li className="pl-1" {...props} />,
                                strong: (props) => <strong className="font-semibold text-theme-primary" {...props} />,
                                a: (props) => <a className="underline text-[#0D9488] hover:opacity-80 underline-offset-2" {...props} />
                              }}
                            >
                              {msg.content}
                            </ReactMarkdown>
                          )}
                          {!isUser && <AssistantMessageMeta message={msg} />}
                        </div>

                        {isUser && (
                          <div className="flex-shrink-0 mt-1">
                            <div className="w-8 h-8 rounded-full bg-theme-surface-solid border border-theme-border flex items-center justify-center shadow-md" aria-hidden="true">
                              <span className="text-theme-primary text-xs font-bold">U</span>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </AnimatePresence>
            {isLoading && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Gradient-border chat input bar */}
        <div className="absolute bottom-0 inset-x-0 bg-transparent p-3 sm:p-4 z-20">
          <div className="max-w-4xl mx-auto relative">
            {wsError && (
              <div className="absolute -top-9 left-1/2 w-[min(92vw,42rem)] -translate-x-1/2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-300 font-medium">
                {wsError}
              </div>
            )}
            
            <div className="relative group w-full">
              <div className="relative p-1.5 rounded-[40px] neo-inset flex items-center shadow-[inset_4px_4px_8px_rgba(0,0,0,0.05),_inset_-4px_-4px_8px_rgba(255,255,255,0.7)]">
                <div className="w-full flex items-center space-x-3 rounded-[32px] bg-transparent px-6 py-2">
                  <label htmlFor="chat-input" className="sr-only">Type your message</label>
                  <textarea
                    id="chat-input"
                    ref={textareaRef}
                    rows={1}
                    value={input}
                    onChange={handleInput}
                    onKeyDown={handleKeyDown}
                    placeholder="Type your message..."
                    className="flex-1 resize-none outline-none bg-transparent transition-all text-sm text-theme-primary placeholder-theme-muted max-h-[120px] font-sans font-normal border-none focus:ring-0 p-0 focus:outline-none"
                  />
                  
                  {supported && (
                    <button
                      onClick={toggleListening}
                      className={`flex-shrink-0 w-10 h-10 p-0 flex items-center justify-center transition-all rounded-full border border-theme-border ${
                        isListening ? 'bg-red-500/10 border-red-500/30 text-red-500 hover:bg-red-500/20' : 'text-theme-muted hover:text-theme-primary bg-slate-900/[0.04] hover:bg-slate-900/[0.08]'
                      }`}
                      type="button"
                      aria-label={isListening ? "Stop listening" : "Start listening"}
                    >
                      {isListening ? (
                        <span className="relative flex h-5 w-5 items-center justify-center">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <Mic className="relative inline-flex rounded-full h-4 w-4 text-red-400" />
                        </span>
                      ) : (
                        <Mic className="w-4 h-4" />
                      )}
                    </button>
                  )}
                  
                  <button
                    onClick={handleSubmit}
                    disabled={!input.trim() || isLoading}
                    className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-white/40 hover:bg-white/60 text-theme-muted rounded-full shadow-[inset_0_1px_2px_rgba(255,255,255,0.8)] active:scale-95 transition-all"
                    type="button"
                    aria-label="Send message"
                  >
                    <span className="sr-only">Send</span>
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-slate-500 ml-1">
                      <path d="M2.01 21L23 12L2.01 3L2 10L17 12L2 14L2.01 21Z" fill="currentColor"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
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
              className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden"
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
