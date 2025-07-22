# RAG (Retrieval-Augmented Generation) Implementation Patterns

## Overview

Retrieval-Augmented Generation (RAG) is a powerful technique that combines the generative capabilities of Large Language Models with external knowledge retrieval systems. This guide covers implementation patterns for RAG systems using TypeScript, ChromaDB, and modern frameworks like LangChain.

## Core RAG Architecture

### Two-Stage Architecture

RAG applications typically consist of two main components:

1. **Indexing Pipeline** (offline processing):
   - Data ingestion from various sources
   - Document chunking and preprocessing
   - Embedding generation
   - Vector storage and indexing

2. **Retrieval and Generation Pipeline** (runtime processing):
   - Query processing and transformation
   - Semantic search and retrieval
   - Context augmentation
   - LLM-powered response generation

### Architecture Flow

```
User Query → Query Processing → Vector Search → Context Retrieval → LLM Generation → Response
              ↓                    ↓              ↓                ↓
           Embedding            Vector DB      Document Store    Prompt Template
```

## Implementation Patterns

### 1. Document Loading and Processing Pattern

```typescript
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { PDFLoader } from "langchain/document_loaders/fs/pdf";

class DocumentProcessor {
  private textSplitter: RecursiveCharacterTextSplitter;
  
  constructor() {
    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
      separators: ["\n\n", "\n", " ", ""],
    });
  }
  
  async processDocument(filePath: string): Promise<Document[]> {
    const loader = new PDFLoader(filePath);
    const docs = await loader.load();
    return await this.textSplitter.splitDocuments(docs);
  }
}
```

### 2. Vector Database Integration Pattern

```typescript
import { Chroma } from "langchain/vectorstores/chroma";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";

class VectorStoreManager {
  private vectorStore: Chroma;
  private embeddings: OpenAIEmbeddings;
  
  constructor() {
    this.embeddings = new OpenAIEmbeddings({
      model: "text-embedding-3-small",
    });
  }
  
  async initializeVectorStore(collectionName: string): Promise<Chroma> {
    this.vectorStore = new Chroma(this.embeddings, {
      collectionName,
      url: "http://localhost:8000",
    });
    return this.vectorStore;
  }
  
  async addDocuments(documents: Document[]): Promise<void> {
    await this.vectorStore.addDocuments(documents);
  }
  
  async similaritySearch(query: string, k: number = 4): Promise<Document[]> {
    return await this.vectorStore.similaritySearch(query, k);
  }
}
```

### 3. RAG Chain Pattern

```typescript
import { ChatOpenAI } from "langchain/chat_models/openai";
import { ChatPromptTemplate } from "langchain/prompts";
import { RunnableSequence } from "langchain/schema/runnable";

class RAGChain {
  private llm: ChatOpenAI;
  private vectorStore: Chroma;
  private promptTemplate: ChatPromptTemplate;
  
  constructor(vectorStore: Chroma) {
    this.llm = new ChatOpenAI({
      model: "gpt-3.5-turbo",
      temperature: 0,
    });
    this.vectorStore = vectorStore;
    this.promptTemplate = ChatPromptTemplate.fromMessages([
      ["system", "Use the following context to answer the question. If you don't know the answer, say so."],
      ["user", "Context: {context}\n\nQuestion: {question}"],
    ]);
  }
  
  async invoke(question: string): Promise<string> {
    const retrievedDocs = await this.vectorStore.similaritySearch(question);
    const context = retrievedDocs.map(doc => doc.pageContent).join("\n");
    
    const chain = RunnableSequence.from([
      this.promptTemplate,
      this.llm,
    ]);
    
    const result = await chain.invoke({
      context,
      question,
    });
    
    return result.content;
  }
}
```

### 4. Advanced Query Analysis Pattern

```typescript
import { z } from "zod";
import { ChatPromptTemplate } from "langchain/prompts";
import { StructuredOutputParser } from "langchain/output_parsers";

const queryAnalysisSchema = z.object({
  query: z.string().describe("The user's query"),
  filter: z.object({
    source: z.string().optional(),
    time_range: z.string().optional(),
  }).optional(),
  search_type: z.enum(["similarity", "mmr", "similarity_score_threshold"]),
});

class QueryAnalyzer {
  private llm: ChatOpenAI;
  private parser: StructuredOutputParser<z.infer<typeof queryAnalysisSchema>>;
  
  constructor() {
    this.llm = new ChatOpenAI({ model: "gpt-3.5-turbo" });
    this.parser = StructuredOutputParser.fromZodSchema(queryAnalysisSchema);
  }
  
  async analyzeQuery(query: string): Promise<z.infer<typeof queryAnalysisSchema>> {
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", "Analyze the user's query and extract search parameters."],
      ["user", "{query}"],
    ]);
    
    const chain = prompt.pipe(this.llm).pipe(this.parser);
    return await chain.invoke({ query });
  }
}
```

### 5. Multi-Vector Retrieval Pattern

```typescript
class MultiVectorRetriever {
  private vectorStore: Chroma;
  private docStore: Map<string, Document>;
  
  constructor(vectorStore: Chroma) {
    this.vectorStore = vectorStore;
    this.docStore = new Map();
  }
  
  async addDocuments(documents: Document[]): Promise<void> {
    // Create summaries for each document
    const summaries = await this.createSummaries(documents);
    
    // Store original documents with unique IDs
    documents.forEach((doc, index) => {
      const docId = `doc_${index}`;
      this.docStore.set(docId, doc);
      summaries[index].metadata.docId = docId;
    });
    
    // Add summaries to vector store
    await this.vectorStore.addDocuments(summaries);
  }
  
  async retrieve(query: string, k: number = 4): Promise<Document[]> {
    // Search using summaries
    const summaryMatches = await this.vectorStore.similaritySearch(query, k);
    
    // Return original documents
    return summaryMatches.map(summary => {
      const docId = summary.metadata.docId;
      return this.docStore.get(docId)!;
    });
  }
  
  private async createSummaries(documents: Document[]): Promise<Document[]> {
    // Implementation for creating document summaries
    // This would use an LLM to generate concise summaries
    return documents; // Placeholder
  }
}
```

## ChromaDB Integration Patterns

### 1. ChromaDB Client Setup

```typescript
import { ChromaClient } from "chromadb";

class ChromaManager {
  private client: ChromaClient;
  
  constructor(host: string = "localhost", port: number = 8000) {
    this.client = new ChromaClient({
      path: `http://${host}:${port}`,
    });
  }
  
  async createCollection(
    name: string,
    metadata?: Record<string, any>
  ): Promise<Collection> {
    return await this.client.createCollection({
      name,
      metadata,
    });
  }
  
  async getOrCreateCollection(name: string): Promise<Collection> {
    try {
      return await this.client.getCollection({ name });
    } catch (error) {
      return await this.createCollection(name);
    }
  }
}
```

### 2. Embedding and Storage Pattern

```typescript
class EmbeddingManager {
  private collection: Collection;
  private embeddings: OpenAIEmbeddings;
  
  constructor(collection: Collection) {
    this.collection = collection;
    this.embeddings = new OpenAIEmbeddings();
  }
  
  async addDocuments(documents: Document[]): Promise<void> {
    const texts = documents.map(doc => doc.pageContent);
    const embeddings = await this.embeddings.embedDocuments(texts);
    
    await this.collection.add({
      ids: documents.map((_, index) => `doc_${index}`),
      embeddings,
      documents: texts,
      metadatas: documents.map(doc => doc.metadata),
    });
  }
  
  async query(queryText: string, nResults: number = 4): Promise<QueryResult> {
    const queryEmbedding = await this.embeddings.embedQuery(queryText);
    
    return await this.collection.query({
      queryEmbeddings: [queryEmbedding],
      nResults,
    });
  }
}
```

### 3. Metadata Filtering Pattern

```typescript
class FilteredRetriever {
  private collection: Collection;
  
  async queryWithFilters(
    query: string,
    filters: Record<string, any>,
    nResults: number = 4
  ): Promise<Document[]> {
    const queryEmbedding = await this.embeddings.embedQuery(query);
    
    const results = await this.collection.query({
      queryEmbeddings: [queryEmbedding],
      nResults,
      where: filters,
    });
    
    return results.documents[0].map((doc, index) => ({
      pageContent: doc,
      metadata: results.metadatas[0][index],
    }));
  }
}
```

## Advanced Patterns

### 1. Conversational RAG Pattern

```typescript
class ConversationalRAG {
  private ragChain: RAGChain;
  private conversationHistory: Array<{ role: string; content: string }> = [];
  
  async chat(message: string): Promise<string> {
    // Add user message to history
    this.conversationHistory.push({ role: "user", content: message });
    
    // Create context-aware query
    const contextualQuery = await this.createContextualQuery(message);
    
    // Get RAG response
    const response = await this.ragChain.invoke(contextualQuery);
    
    // Add assistant response to history
    this.conversationHistory.push({ role: "assistant", content: response });
    
    return response;
  }
  
  private async createContextualQuery(message: string): Promise<string> {
    const recentHistory = this.conversationHistory.slice(-6); // Last 3 exchanges
    const historyContext = recentHistory
      .map(msg => `${msg.role}: ${msg.content}`)
      .join("\n");
    
    return `Previous conversation:\n${historyContext}\n\nCurrent question: ${message}`;
  }
}
```

### 2. Hybrid Search Pattern

```typescript
class HybridSearchRAG {
  private vectorStore: Chroma;
  private bm25Retriever: BM25Retriever;
  
  async hybridRetrieve(query: string, k: number = 4): Promise<Document[]> {
    // Get results from both retrievers
    const vectorResults = await this.vectorStore.similaritySearch(query, k);
    const bm25Results = await this.bm25Retriever.getRelevantDocuments(query);
    
    // Combine and rank results
    return this.combineResults(vectorResults, bm25Results, k);
  }
  
  private combineResults(
    vectorResults: Document[],
    bm25Results: Document[],
    k: number
  ): Document[] {
    // Implement ranking algorithm (e.g., RRF - Reciprocal Rank Fusion)
    const combined = new Map<string, { doc: Document; score: number }>();
    
    vectorResults.forEach((doc, index) => {
      const key = doc.pageContent;
      combined.set(key, {
        doc,
        score: 1 / (index + 1), // RRF scoring
      });
    });
    
    bm25Results.forEach((doc, index) => {
      const key = doc.pageContent;
      if (combined.has(key)) {
        combined.get(key)!.score += 1 / (index + 1);
      } else {
        combined.set(key, { doc, score: 1 / (index + 1) });
      }
    });
    
    return Array.from(combined.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, k)
      .map(item => item.doc);
  }
}
```

## Performance Optimization Patterns

### 1. Embedding Caching Pattern

```typescript
class CachedEmbeddings {
  private cache: Map<string, number[]> = new Map();
  private embeddings: OpenAIEmbeddings;
  
  constructor() {
    this.embeddings = new OpenAIEmbeddings();
  }
  
  async embedQuery(text: string): Promise<number[]> {
    const cacheKey = this.createCacheKey(text);
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }
    
    const embedding = await this.embeddings.embedQuery(text);
    this.cache.set(cacheKey, embedding);
    
    return embedding;
  }
  
  private createCacheKey(text: string): string {
    return Buffer.from(text).toString('base64');
  }
}
```

### 2. Batch Processing Pattern

```typescript
class BatchProcessor {
  private batchSize: number = 100;
  
  async processBatch(documents: Document[]): Promise<void> {
    for (let i = 0; i < documents.length; i += this.batchSize) {
      const batch = documents.slice(i, i + this.batchSize);
      await this.processDocumentBatch(batch);
      
      // Add delay to avoid rate limiting
      await this.delay(100);
    }
  }
  
  private async processDocumentBatch(batch: Document[]): Promise<void> {
    // Process batch of documents
    const embeddings = await this.embeddings.embedDocuments(
      batch.map(doc => doc.pageContent)
    );
    
    // Store in vector database
    await this.vectorStore.addDocuments(batch);
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

## Best Practices

### 1. Error Handling and Resilience

```typescript
class ResilientRAG {
  private maxRetries: number = 3;
  private backoffFactor: number = 2;
  
  async queryWithRetry(query: string): Promise<string> {
    let lastError: Error;
    
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        return await this.ragChain.invoke(query);
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < this.maxRetries - 1) {
          const delay = Math.pow(this.backoffFactor, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError!;
  }
}
```

### 2. Query Optimization

```typescript
class QueryOptimizer {
  async optimizeQuery(query: string): Promise<string> {
    // Remove stop words, normalize text, etc.
    const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at'];
    
    const optimized = query
      .toLowerCase()
      .split(' ')
      .filter(word => !stopWords.includes(word))
      .join(' ');
    
    return optimized;
  }
}
```

### 3. Monitoring and Metrics

```typescript
class RAGMetrics {
  private metrics: Map<string, number[]> = new Map();
  
  recordRetrievalTime(time: number): void {
    this.recordMetric('retrieval_time', time);
  }
  
  recordGenerationTime(time: number): void {
    this.recordMetric('generation_time', time);
  }
  
  recordRelevanceScore(score: number): void {
    this.recordMetric('relevance_score', score);
  }
  
  private recordMetric(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(value);
  }
  
  getAverageMetric(name: string): number {
    const values = this.metrics.get(name) || [];
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }
}
```

## Deployment Considerations

### 1. Environment Configuration

```typescript
interface RAGConfig {
  vectorDb: {
    host: string;
    port: number;
    collection: string;
  };
  embeddings: {
    model: string;
    apiKey: string;
  };
  llm: {
    model: string;
    temperature: number;
    maxTokens: number;
  };
  retrieval: {
    topK: number;
    scoreThreshold: number;
  };
}

class RAGSystem {
  private config: RAGConfig;
  
  constructor(config: RAGConfig) {
    this.config = config;
  }
  
  async initialize(): Promise<void> {
    // Initialize all components based on configuration
  }
}
```

### 2. Health Checks

```typescript
class RAGHealthChecker {
  async checkHealth(): Promise<{
    vectorDb: boolean;
    embeddings: boolean;
    llm: boolean;
  }> {
    const checks = await Promise.allSettled([
      this.checkVectorDb(),
      this.checkEmbeddings(),
      this.checkLLM(),
    ]);
    
    return {
      vectorDb: checks[0].status === 'fulfilled',
      embeddings: checks[1].status === 'fulfilled',
      llm: checks[2].status === 'fulfilled',
    };
  }
  
  private async checkVectorDb(): Promise<void> {
    await this.chromaClient.heartbeat();
  }
  
  private async checkEmbeddings(): Promise<void> {
    await this.embeddings.embedQuery("test");
  }
  
  private async checkLLM(): Promise<void> {
    await this.llm.invoke("test");
  }
}
```

This comprehensive guide provides the foundation for implementing robust, scalable RAG systems using TypeScript, ChromaDB, and modern AI frameworks. The patterns cover everything from basic implementation to advanced optimization techniques, ensuring production-ready deployments.