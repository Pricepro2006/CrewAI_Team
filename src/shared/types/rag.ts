export interface RAGDocument {
  id: string;
  content: string;
  embedding?: number[];
  metadata?: Record<string, unknown>;
}

export interface RAGQuery {
  query: string;
  topK?: number;
  filter?: Record<string, unknown>;
}

export interface RAGResult {
  document: RAGDocument;
  score: number;
}
