export interface TokenResponse {
  access_token: string;
  token_type?: string;
}

export interface ChatRequest {
  session_id: string;
  message: string;
}

export interface ExplanationResult {
  objection_reason: string;
  persona_reason: string;
  sentiment_reason: string;
  strategy_reason: string;
  trigger_phrases: string[];
  confidence_note?: string;
  handoff_reason?: string;
}

export interface RetrievedDoc {
  source_file: string;
  chunk_index: number;
  score: number;
  text: string;
}

export interface ChatResponse {
  response: string;
  session_id: string;
  objection_label: "price" | "trust" | "timing" | "competitor" | "fit" | "buying_signal" | "neutral";
  confidence: number;
  sentiment: "positive" | "neutral" | "negative";
  persona: string;
  strategy: string;
  should_handoff: boolean;
  memory_context: string;
  retrieved_docs: RetrievedDoc[];
  explanation: ExplanationResult;
}

export interface SentimentDaySnapshot {
  date: string;
  positive: number;
  neutral: number;
  negative: number;
}

export interface AnalyticsDashboard {
  total_sessions: number;
  conversion_rate: number;
  avg_confidence: number;
  objection_distribution: Record<string, number>;
  persona_distribution: Record<string, number>;
  sentiment_trend: SentimentDaySnapshot[];
}

export interface ABTestResults {
  static_conversion_rate: number;
  adaptive_conversion_rate: number;
  sessions_per_variant: { STATIC: number; ADAPTIVE: number };
  static_avg_confidence: number;
  adaptive_avg_confidence: number;
}

export interface KBIngestResponse {
  files_processed: number;
  chunks_added: number;
  upload_dir: string;
  index_updated: boolean;
}

export interface KBStats {
  total_documents: number;
  total_chunks: number;
  last_updated: string | null;
}

export interface HealthResponse {
  status: string;
  version: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  responseMeta?: ChatResponse;
  sourceMessage?: string;
}
