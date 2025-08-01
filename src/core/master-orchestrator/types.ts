import type {
  Message,
  AgentType,
  Document as CustomDocument,
} from "../shared/types.js";

export interface Query {
  text: string;
  conversationId?: string;
  history?: Message[];
  metadata?: Record<string, any>;
}

export interface Plan {
  id: string;
  steps: PlanStep[];
  metadata?: Record<string, any>;
}

export interface PlanStep {
  id: string;
  task: string;
  description: string;
  agentType: AgentType;
  requiresTool: boolean;
  toolName?: string;
  ragQuery: string;
  expectedOutput: string;
  dependencies: string[];
  parameters?: Record<string, any>;
}

export interface ExecutionResult {
  success: boolean;
  results: StepResult[];
  summary: string;
  plan?: Plan;
  metadata?: Record<string, any>;
}

export interface PlanExecutionResult extends ExecutionResult {
  completedSteps: number;
  failedSteps: number;
  error?: string;
}

export interface StepResult {
  stepId: string;
  success: boolean;
  output?: string;
  data?: any;
  error?: string;
  metadata?: Record<string, any>;
}

export interface ReviewResult {
  satisfactory: boolean;
  feedback: string;
  failedSteps: string[];
  suggestions?: string[];
}

export interface Context {
  documents: CustomDocument[];
  relevance: number;
  metadata?: Record<string, any>;
}

// Re-export from shared types to avoid circular dependencies
export type {
  Document,
  DocumentMetadata,
  Message,
  AgentType,
} from "../shared/types.js";

export interface MasterOrchestratorConfig {
  model?: string;
  ollamaUrl: string;
  rag?: RAGConfig;
  database?: any; // For testing with in-memory database
  agents?: AgentConfig[];
  maestro?: MaestroConfig;
}

export interface RAGConfig {
  vectorStore: VectorStoreConfig;
  chunking: ChunkingConfig;
  retrieval: RetrievalConfig;
}

export interface VectorStoreConfig {
  type: "chromadb" | "pinecone" | "weaviate";
  path?: string;
  apiKey?: string;
  collectionName: string;
  dimension?: number;
}

export interface ChunkingConfig {
  size: number;
  overlap: number;
  method?: "sentence" | "token" | "character";
}

export interface RetrievalConfig {
  topK: number;
  minScore: number;
  reranking?: boolean;
}

export interface AgentConfig {
  type: AgentType;
  enabled: boolean;
  config?: Record<string, any>;
}

export interface MaestroConfig {
  queueConfig: QueueConfig;
  maxConcurrentTasks: number;
  taskTimeout?: number;
}

export interface QueueConfig {
  maxSize: number;
  strategy: "fifo" | "lifo" | "priority";
}

export interface Task {
  id?: string;
  type: "agent" | "tool" | "composite";
  priority?: number;
  data: any;
  timeout?: number;
  retries?: number;
}

export interface TaskResult {
  taskId: string;
  success: boolean;
  result?: any;
  error?: Error;
  duration: number;
  metadata?: Record<string, any>;
}
