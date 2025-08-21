# RAG Integration for CrewAI Team

## Overview

The CrewAI Team project now includes a fully integrated Retrieval-Augmented Generation (RAG) system powered by ChromaDB for vector storage and the master knowledge base for context retrieval.

## Architecture

### Components

1. **KnowledgeIndexer** - Indexes documents from the master knowledge base
   - Supports `.md`, `.txt`, and `.json` files
   - Automatic metadata extraction and categorization
   - Batch processing for efficient indexing

2. **RAGSystem** - Core RAG functionality
   - Document chunking and embedding
   - Semantic search with relevance scoring
   - Adaptive fallback to in-memory storage

3. **AdaptiveVectorStore** - Resilient vector storage
   - Primary: ChromaDB for persistent storage
   - Fallback: In-memory storage when ChromaDB unavailable
   - Automatic failover and data preservation

4. **MasterOrchestrator Integration**
   - Automatic RAG context retrieval for queries
   - Context-aware planning and execution
   - Knowledge-enhanced agent responses

## Setup

### Prerequisites

1. **ChromaDB Server** (optional but recommended)
   ```bash
   # Install ChromaDB
   pip install chromadb

   # Start ChromaDB server
   chroma run --path ./chroma-data --port 8001
   ```

2. **Ollama** (for embeddings)
   ```bash
   # Ensure Ollama is running
   ollama serve

   # Pull embedding model
   ollama pull nomic-embed-text
   ```

### Indexing Knowledge Base

1. **Index the master knowledge base**:
   ```bash
   npm run rag:index
   ```

   This will:
   - Scan `/home/pricepro2006/master_knowledge_base/`
   - Process all eligible files
   - Create embeddings and store in ChromaDB
   - Display indexing statistics

2. **Clear and re-index** (if needed):
   ```bash
   CLEAR_EXISTING_INDEX=true npm run rag:index
   ```

### Testing Integration

Run the integration test to verify setup:
```bash
npm run rag:test
```

This will:
- Verify knowledge base is indexed
- Test RAG search functionality
- Process sample queries through MasterOrchestrator
- Display health status

## Configuration

### Environment Variables

```env
# ChromaDB Configuration
CHROMADB_URL=http://localhost:8001
CHROMADB_COLLECTION=crewai_knowledge

# Ollama Configuration
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL_MAIN=qwen3:14b
OLLAMA_MODEL_EMBEDDING=nomic-embed-text

# RAG Settings
RAG_CHUNK_SIZE=1500
RAG_CHUNK_OVERLAP=200
RAG_TOP_K=5
RAG_MIN_SCORE=0.7
```

### RAG Configuration Object

```typescript
const ragConfig: RAGConfig = {
  vectorStore: {
    type: "chromadb",
    path: "http://localhost:8001",
    collectionName: "crewai_knowledge",
    baseUrl: "http://localhost:11434",
  },
  chunking: {
    chunkSize: 1500,
    chunkOverlap: 200,
    minChunkSize: 100,
  },
  retrieval: {
    topK: 5,
    minScore: 0.7,
    maxTokens: 8000,
    useReranking: true,
    useCrossEncoder: false,
  },
};
```

## Usage

### Direct RAG Search

```typescript
import { RAGSystem } from "./src/core/rag/RAGSystem.js";

const ragSystem = new RAGSystem(ragConfig);
await ragSystem.initialize();

// Search for relevant documents
const results = await ragSystem.search("ChromaDB setup", 5);
results.forEach(r => {
  console.log(`Score: ${r.score} - ${r.content.substring(0, 100)}...`);
});
```

### Through MasterOrchestrator

```typescript
const orchestrator = new MasterOrchestrator({
  rag: ragConfig,
  llm: llmConfig,
});

await orchestrator.initialize();

// Query will automatically retrieve RAG context
const response = await orchestrator.processQuery({
  text: "How do I set up ChromaDB?",
  context: {},
});
```

## Knowledge Base Categories

The system automatically categorizes indexed content:

- `agent-knowledge` - Agent-specific documentation
- `mastra-framework` - Mastra framework docs
- `api-integration` - API integration guides
- `architecture` - System architecture docs
- `automation-n8n` - n8n automation workflows
- `project-docs` - Project documentation
- `project-sections` - Project organization sections
- `archived` - Archived content
- `general` - Uncategorized content

## Monitoring

### Health Check

```typescript
const health = await ragSystem.getHealthStatus();
console.log(`Status: ${health.status}`);
console.log(`Vector Store: ${health.vectorStore.status}`);
console.log(`Embeddings: ${health.embeddingService.status}`);
```

### Statistics

```typescript
const stats = await ragSystem.getStats();
console.log(`Total Documents: ${stats.totalDocuments}`);
console.log(`Total Chunks: ${stats.totalChunks}`);
console.log(`Store Type: ${stats.vectorStoreType}`);
console.log(`Fallback Mode: ${stats.fallbackMode}`);
```

## Troubleshooting

### ChromaDB Connection Issues

If ChromaDB is unavailable, the system automatically falls back to in-memory storage:
- Limited to session duration
- No persistence between restarts
- Suitable for development/testing

To verify ChromaDB is running:
```bash
curl http://localhost:8001/api/v1/version
```

### Embedding Service Issues

If Ollama is unavailable:
- Basic text search still works
- Semantic search quality degraded
- Check Ollama is running: `curl http://localhost:11434/api/tags`

### Performance Tips

1. **Optimize chunk size** - Smaller chunks (500-1000) for technical docs, larger (1500-2000) for narrative content
2. **Adjust topK** - Lower values (3-5) for specific queries, higher (10-15) for exploration
3. **Use filters** - Category-based filtering improves relevance
4. **Cache results** - Implement caching for frequently accessed queries

## API Reference

### KnowledgeIndexer

```typescript
class KnowledgeIndexer {
  constructor(options: IndexerOptions)
  async indexKnowledgeBase(): Promise<IndexingResult>
  async search(query: string, limit: number): Promise<any[]>
  async getStats(): Promise<any>
}
```

### RAGSystem

```typescript
class RAGSystem {
  constructor(config: RAGConfig)
  async initialize(): Promise<void>
  async addDocument(content: string, metadata: Record<string, any>): Promise<void>
  async search(query: string, limit: number): Promise<QueryResult[]>
  async searchWithFilter(query: string, filter: Record<string, any>, limit: number): Promise<QueryResult[]>
  async getHealthStatus(): Promise<HealthStatus>
  async getStats(): Promise<RAGStats>
}
```

## Future Enhancements

- [ ] Hybrid search (keyword + semantic)
- [ ] Dynamic re-ranking based on user feedback
- [ ] Multi-modal embeddings (text + code)
- [ ] Incremental indexing for real-time updates
- [ ] Query expansion and refinement
- [ ] Cross-lingual search support
- [ ] Custom embedding models per category
- [ ] Distributed vector storage