import { RAGConfig } from '../core/rag/types';

export const ragConfig: RAGConfig = {
  vectorStore: {
    type: 'chromadb',
    path: process.env.CHROMA_HOST 
      ? `http://${process.env.CHROMA_HOST}:${process.env.CHROMA_PORT || 8000}`
      : 'http://localhost:8000',
    collectionName: 'agent-knowledge',
    baseUrl: process.env.OLLAMA_URL || 'http://localhost:11434'
  },
  chunking: {
    size: parseInt(process.env.RAG_CHUNK_SIZE || '1000'),
    overlap: parseInt(process.env.RAG_CHUNK_OVERLAP || '200'),
    method: 'sentence',
    separator: '.',
    trimWhitespace: true,
    preserveFormatting: false
  },
  retrieval: {
    topK: parseInt(process.env.RAG_TOP_K || '5'),
    minScore: parseFloat(process.env.RAG_MIN_SCORE || '0.7'),
    reranking: true,
    diversityFactor: 0.3,
    boostRecent: true
  }
};

export default ragConfig;
