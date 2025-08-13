// Shared types to avoid circular dependencies

export interface Document {
  id: string;
  content: string;
  metadata: DocumentMetadata;
  score?: number;
}

export interface DocumentMetadata {
  sourceId: string;
  title?: string;
  author?: string;
  createdAt?: string;
  updatedAt?: string;
  tags?: string[];
  chunkIndex?: number;
  totalChunks?: number;
  [key: string]: any;
}

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: string;
}

export type AgentType =
  | "ResearchAgent"
  | "CodeAgent"
  | "DataAnalysisAgent"
  | "WriterAgent"
  | "ToolExecutorAgent";
