import type { Document, DocumentMetadata } from '../shared/types';
export type { Document, DocumentMetadata };

export interface ProcessedDocument extends Document {
  embedding?: number[];
  tokens?: number;
}

export interface QueryResult extends Document {
  score: number;
  highlights?: string[];
}

export interface RAGConfig {
  vectorStore: VectorStoreConfig;
  chunking: ChunkingConfig;
  retrieval: RetrievalConfig;
}

export interface VectorStoreConfig {
  type: 'chromadb' | 'pinecone' | 'weaviate' | 'qdrant' | 'mcp-vectorize';
  path?: string;
  baseUrl?: string;
  apiKey?: string;
  collectionName: string;
  dimension?: number;
  // Pinecone specific
  indexName?: string;
  // MCP Vectorize specific
  pipelineId?: string;
}

export interface ChunkingConfig {
  size: number;
  overlap: number;
  method?: 'sentence' | 'token' | 'character';
  separator?: string;
  trimWhitespace?: boolean;
  preserveFormatting?: boolean;
}

export interface RetrievalConfig {
  topK: number;
  minScore: number;
  reranking?: boolean;
  diversityFactor?: number;
  boostRecent?: boolean;
  filters?: FilterConfig[];
}

export interface FilterConfig {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'contains';
  value: any;
}

export interface EmbeddingConfig {
  model: string;
  baseUrl?: string;
  batchSize?: number;
  dimensions?: number;
}

export interface ChunkOptions {
  size: number;
  overlap: number;
  separator?: string;
}

export interface SearchOptions {
  limit?: number;
  minScore?: number;
  filter?: Record<string, any>;
  includeMetadata?: boolean;
  includeEmbeddings?: boolean;
}

export interface RAGStats {
  totalDocuments: number;
  totalChunks: number;
  averageChunkSize: number;
  collections: string[];
  lastUpdated?: string;
}
