import React, { useState, useRef, useEffect } from 'react';
import { Mic, Gauge, ShieldAlert, PanelRightOpen, PanelRightClose, Send, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChat } from '../../api/hooks/useChat';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import DiagnosticsPanel from './DiagnosticsPanel';
import TypingIndicator from './TypingIndicator';
import Card from '../ui/Card';
import ChatBubble from '../ui/ChatBubble';
import GlassPanel from '../ui/GlassPanel';
import IconButton from '../ui/IconButton';
import PrimaryButton from '../ui/PrimaryButton';
import Tooltip from '../ui/Tooltip';
import type { Message } from '../../types/api';


function ConfidenceIndicator({ confidence }: { confidence: number }) {
  const percent = Math.round(confidence * 100);
  const stroke = 2 * Math.PI * 14;
  const offset = stroke - (stroke * percent) / 100;

  return (
    <div className="flex items-center gap-2 rounded-full border border-theme-border bg-white/60 px-2.5 py-1 text-[11px] font-medium text-theme-primary shadow-sm backdrop-blur-xl">
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


function AssistantMessageMeta({ message }: { message: Message }) {
  const data = message.responseMeta;
  if (!data) return null;

  return (
    <div className="mt-3 flex flex-col gap-2 relative z-10 w-full">
      <div className="flex flex-wrap items-center gap-2">
        <ConfidenceIndicator confidence={data.confidence} />
        <span className="rounded-full border border-theme-border bg-white/60 px-2.5 py-1 text-[11px] font-medium text-theme-primary shadow-sm backdrop-blur-xl">
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


    </div>
  );
}

export default function ChatPanel({ sessionId }: { sessionId: string }) {
  const { messages, sendMessage, isLoading, lastResponse, wsError } = useChat(sessionId);
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
    <div className="flex h-full w-full flex-row bg-theme-bg text-theme-primary">
      <div className="flex flex-col flex-1 h-full min-w-0 relative">
        <div className="sticky top-0 z-10 flex items-center justify-end border-b border-theme-border bg-white/65 px-4 py-3 shadow-[0_10px_30px_rgba(16,32,51,0.08)] backdrop-blur-2xl sm:px-4">
          <div className="flex items-center gap-2 shrink-0 ml-2">
            <Tooltip content={diagnosticsOpen ? 'Hide diagnostics' : 'Show diagnostics'}>
              <button
              onClick={() => setDiagnosticsOpen(!diagnosticsOpen)}
              className="lg:hidden inline-flex h-11 w-11 items-center justify-center rounded-full border border-theme-border bg-white/60 text-theme-primary shadow-sm backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:shadow-md"
              aria-label={diagnosticsOpen ? 'Hide diagnostics' : 'Show diagnostics'}
            >
              {diagnosticsOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
            </button>
            </Tooltip>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-4 lg:px-6">
          <div className="mx-auto flex min-h-full max-w-5xl flex-col justify-center gap-6">
            <AnimatePresence mode="wait">
              {messages.length === 0 ? (
                <motion.div
                  key="empty-state"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.4, ease: "easeInOut" }}
                  className="relative flex flex-col items-center justify-center py-14 text-center"
                >
                  <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 pointer-events-none">
                    <div className="mx-auto h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(79,70,229,0.22)_0%,rgba(79,70,229,0.10)_26%,transparent_70%)] blur-3xl" />
                  </div>
                  <div className="relative z-10 mb-8 flex flex-col items-center">
                    <div className="relative mb-6">
                      <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(79,70,229,0.32),rgba(13,148,136,0.18),transparent_72%)] blur-2xl animate-glow" />
                      <div className="relative flex h-36 w-36 items-center justify-center rounded-full border border-white/70 bg-white/55 shadow-[0_25px_80px_rgba(79,70,229,0.18),inset_0_1px_1px_rgba(255,255,255,0.9)] backdrop-blur-2xl animate-orb-breath">
                        <div className="h-20 w-20 rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.95),rgba(79,70,229,0.18))] shadow-[inset_0_0_30px_rgba(255,255,255,0.8),0_0_40px_rgba(79,70,229,0.20)]" />
                      </div>
                    </div>
                    <p className="section-label mb-2">Auralis Sales Assistant</p>
                    <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-theme-primary sm:text-4xl">
                      How can I help you today?
                    </h2>
                  </div>

                  <Card variant="glass" className="relative z-10 w-full max-w-2xl rounded-[28px] p-4 text-left shadow-[0_18px_60px_rgba(16,32,51,0.08)]">
                    <div className="flex items-start gap-4">
                      <span className="icon-badge icon-badge--secondary h-11 w-11 shrink-0">
                        <Sparkles className="h-5 w-5 text-[#0D9488]" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-theme-primary">New here? Start with one of these</p>
                        <p className="mt-1 text-sm leading-6 text-theme-secondary">
                          See what Auralis can actually do — no setup needed, just ask.
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {[
                            "Why are you 2x more expensive than [Competitor]?",
                            "How do I know our data is safe with you?",
                            "We don't have engineering bandwidth to integrate right now."
                          ].map((item) => (
                            <button 
                              key={item} 
                              type="button" 
                              onClick={() => {
                                setInput('');
                                sendMessage(item);
                              }}
                              className="rounded-full border border-theme-border bg-white/60 px-4 py-2 text-xs font-medium text-theme-primary transition-all hover:-translate-y-0.5 hover:shadow-sm"
                            >
                              {item}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ) : (
                <div className="flex w-full flex-col gap-4">
                  {messages.map((msg) => {
                    const isUser = msg.role === 'user';
                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, scale: 0.95, x: isUser ? 20 : -20, y: 10 }}
                        animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
                        transition={{ type: "spring", stiffness: 500, damping: 30, mass: 0.8 }}
                        className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} gap-3`}
                      >
                        {!isUser && (
                          <div className="flex-shrink-0 mt-1">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/60 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.95),rgba(79,70,229,0.20))] shadow-[0_0_25px_rgba(79,70,229,0.20)] backdrop-blur-xl" aria-hidden="true">
                              <Mic className="w-4 h-4 text-white" />
                            </div>
                          </div>
                        )}
                        
                        <ChatBubble role={isUser ? 'user' : 'assistant'}>
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
                        </ChatBubble>

                        {isUser && (
                          <div className="flex-shrink-0 mt-1">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-theme-border bg-white/65 shadow-sm backdrop-blur-xl" aria-hidden="true">
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
        <div className="absolute bottom-0 inset-x-0 z-20 bg-transparent p-3 sm:p-4">
          <div className="mx-auto max-w-4xl relative">
            {wsError && (
              <div className="absolute -top-10 left-1/2 w-[min(92vw,42rem)] -translate-x-1/2 rounded-full border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-xs font-medium text-amber-700 shadow-sm backdrop-blur-xl">
                {wsError}
              </div>
            )}
            
            <GlassPanel className="rounded-[32px] p-3 shadow-[0_20px_70px_rgba(16,32,51,0.12)]">
              <div className="flex items-end gap-3 rounded-[28px] bg-white/55 px-3 py-3 backdrop-blur-2xl">
                <label htmlFor="chat-input" className="sr-only">Type your message</label>
                <textarea
                  id="chat-input"
                  ref={textareaRef}
                  rows={1}
                  value={input}
                  onChange={handleInput}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your message..."
                  className="min-h-[56px] flex-1 resize-none border-none bg-transparent p-0 text-sm text-theme-primary outline-none placeholder:text-theme-muted focus:ring-0"
                />

                {supported && (
                  <Tooltip content={isListening ? 'Stop microphone' : 'Start microphone'}>
                    <IconButton
                      onClick={toggleListening}
                      type="button"
                      aria-label={isListening ? 'Stop listening' : 'Start listening'}
                      className={`h-12 w-12 shrink-0 ${isListening ? 'bg-red-500/15 text-red-600' : ''}`}
                    >
                      {isListening ? (
                        <span className="relative flex h-5 w-5 items-center justify-center">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-70" />
                          <Mic className="relative h-4 w-4 text-red-600" />
                        </span>
                      ) : (
                        <Mic className="h-4 w-4" />
                      )}
                    </IconButton>
                  </Tooltip>
                )}

                <Tooltip content="Send message">
                  <PrimaryButton
                    onClick={handleSubmit}
                    disabled={!input.trim() || isLoading}
                    type="button"
                    className="h-12 min-w-12 rounded-full px-4"
                    aria-label="Send message"
                  >
                    <Send className="h-4 w-4" />
                  </PrimaryButton>
                </Tooltip>
              </div>
            </GlassPanel>
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
