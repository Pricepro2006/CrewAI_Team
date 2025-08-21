# Knowledge-Backed LLM Setup Guide

## Overview

The CrewAI Team project now supports advanced Knowledge-Backed LLM integration using `node-llama-cpp` with ChromaDB for RAG (Retrieval-Augmented Generation). This provides production-ready, context-aware AI responses with seamless fallback mechanisms.

## Features

- **Native LLM Integration**: Direct integration with llama.cpp via node-llama-cpp
- **Multi-Model Support**: Primary (Mistral 7B) and fallback (Llama 3.2) models
- **RAG Integration**: ChromaDB vector store for context-aware responses
- **Flexible Provider System**: Seamless switching between Ollama, llama.cpp, and Knowledge-Backed modes
- **Production Ready**: Error handling, performance monitoring, and graceful fallbacks

## Quick Start

### 1. Install Dependencies

```bash
npm install node-llama-cpp
```

### 2. Download Models

```bash
# Make download script executable
chmod +x scripts/download-models.sh

# Download models (Mistral 7B and Llama 3.2)
./scripts/download-models.sh
```

Models will be downloaded to `/home/pricepro2006/CrewAI_Team/models/`

### 3. Configure Environment

```bash
# Copy example configuration
cp .env.llm.example .env.llm

# Edit configuration as needed
nano .env.llm
```

### 4. Test Installation

```bash
# Run comprehensive test suite
tsx scripts/test-knowledge-backed-llm.ts

# Run example agent
tsx src/examples/knowledge-backed-agent.ts
```

## Architecture

### Component Overview

```
┌─────────────────────────────────────────────┐
│            Application Layer                 │
├─────────────────────────────────────────────┤
│         LLMProviderFactory                   │
├──────────┬────────────┬────────────────────┤
│ Ollama   │ LlamaCpp   │ KnowledgeBackedLLM │
│ Provider │ Provider   │    (NEW)            │
└──────────┴────────────┴──────┬──────────────┘
                               │
                    ┌──────────┴──────────┐
                    │                      │
              ┌─────▼─────┐        ┌──────▼──────┐
              │   Llama    │        │  RAGSystem  │
              │   Models   │        │  ChromaDB   │
              └────────────┘        └─────────────┘
```

### Key Components

1. **KnowledgeBackedLLM** (`src/core/llm/KnowledgeBackedLLM.ts`)
   - Main class for RAG-enhanced LLM operations
   - Manages model initialization and context retrieval
   - Handles prompt augmentation with knowledge base context

2. **LLMProviderFactory** (`src/core/llm/LLMProviderFactory.ts`)
   - Unified interface for all LLM providers
   - Automatic provider selection based on availability
   - Configuration management

3. **RAGSystem** (`src/core/rag/RAGSystem.ts`)
   - Vector store management
   - Document chunking and embedding
   - Similarity search and retrieval

## Configuration Options

### Model Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| `modelPath` | mistral-7b-instruct-v0.2.Q4_K_M.gguf | Primary model path |
| `fallbackModelPath` | Llama-3.2-3B-Instruct-Q4_K_M.gguf | Fallback model path |
| `contextSize` | 8192 | Maximum context window size |
| `gpuLayers` | 0 | Number of layers to offload to GPU |
| `threads` | 8 | Number of CPU threads to use |
| `temperature` | 0.7 | Generation temperature |

### RAG Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| `enabled` | true | Enable/disable RAG integration |
| `topK` | 5 | Number of documents to retrieve |
| `minScore` | 0.5 | Minimum similarity score |
| `maxContextDocs` | 3 | Maximum documents in prompt |

## Usage Examples

### Basic Generation

```typescript
import { createKnowledgeBackedLLM } from './src/core/llm/KnowledgeBackedLLM';

const llm = await createKnowledgeBackedLLM();

const response = await llm.generateWithContext(
  "What are the key features of CrewAI Team?",
  { maxTokens: 512, temperature: 0.7 }
);

console.log(response.response);
```

### With RAG Context

```typescript
import { KnowledgeBackedLLM } from './src/core/llm/KnowledgeBackedLLM';
import { RAGSystem } from './src/core/rag/RAGSystem';

// Initialize RAG system
const ragSystem = new RAGSystem({
  vectorStore: {
    type: 'adaptive',
    baseUrl: 'http://localhost:8001',
    collectionName: 'knowledge-base',
  },
  chunking: { chunkSize: 500, chunkOverlap: 50 },
  retrieval: { topK: 5, minScore: 0.5 },
});

// Create LLM with RAG
const llm = new KnowledgeBackedLLM(
  {
    modelPath: '/path/to/model.gguf',
    ragConfig: { enabled: true },
  },
  ragSystem
);

await llm.initialize();

// Add documents to knowledge base
await llm.addToKnowledgeBase(
  "CrewAI Team is an enterprise AI framework...",
  { source: 'documentation', type: 'overview' }
);

// Generate with context
const response = await llm.generateWithContext(
  "How does CrewAI process emails?",
  { useRAG: true }
);
```

### Stream Generation

```typescript
const llm = await createKnowledgeBackedLLM();

// Stream response
for await (const chunk of llm.streamGenerateWithContext(prompt)) {
  process.stdout.write(chunk);
}
```

## Model Selection

### Recommended Models

1. **Primary: Mistral 7B Instruct v0.2 Q4_K_M**
   - Size: ~4.4GB
   - Context: 8192 tokens
   - Best for: General purpose, business analysis
   - Performance: ~30-40 tokens/second on CPU

2. **Fallback: Llama 3.2 3B Instruct Q4_K_M**
   - Size: ~2.0GB
   - Context: 4096 tokens
   - Best for: Quick responses, lower memory usage
   - Performance: ~50-60 tokens/second on CPU

### Custom Models

To use custom models:

1. Download GGUF format model
2. Place in `/models` directory
3. Update environment variables:

```bash
MISTRAL_MODEL_PATH=/path/to/your/model.gguf
LLAMA_MODEL_PATH=/path/to/fallback/model.gguf
```

## Performance Optimization

### CPU Optimization

```bash
# Use more threads for better performance
LLM_THREADS=16

# Optimize batch size
LLM_BATCH_SIZE=1024

# Reduce context for faster processing
LLM_CONTEXT_SIZE=4096
```

### GPU Acceleration

```bash
# Enable GPU layers (requires CUDA)
LLM_GPU_LAYERS=35  # Offload 35 layers to GPU

# Full GPU offload for smaller models
LLM_GPU_LAYERS=999  # Offload all layers
```

### Memory Management

- **Mistral 7B**: Requires ~6GB RAM
- **Llama 3.2**: Requires ~3GB RAM
- **With RAG**: Additional 1-2GB for embeddings

## Troubleshooting

### Models Not Found

```bash
# Download models
./scripts/download-models.sh

# Or manually download from:
# Mistral: https://huggingface.co/TheBloke/Mistral-7B-Instruct-v0.2-GGUF
# Llama: https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF
```

### Out of Memory

1. Use smaller model (Llama 3.2 instead of Mistral 7B)
2. Reduce context size: `LLM_CONTEXT_SIZE=2048`
3. Reduce batch size: `LLM_BATCH_SIZE=256`

### Slow Performance

1. Increase threads: `LLM_THREADS=12`
2. Enable GPU: `LLM_GPU_LAYERS=20`
3. Use quantized models (Q4_K_M or Q5_K_M)

### ChromaDB Connection Issues

```bash
# Start ChromaDB if not running
docker run -p 8001:8001 chromadb/chroma

# Or use in-memory fallback
ENABLE_RAG=false
```

## API Reference

### KnowledgeBackedLLM

```typescript
class KnowledgeBackedLLM {
  constructor(config: KnowledgeBackedConfig, ragSystem?: RAGSystem);
  
  // Initialize the LLM
  async initialize(): Promise<void>;
  
  // Generate with optional RAG context
  async generateWithContext(
    prompt: string,
    options?: GenerateWithContextOptions
  ): Promise<{
    response: string;
    context?: QueryResult[];
    metadata?: any;
  }>;
  
  // Stream generation
  async *streamGenerateWithContext(
    prompt: string,
    options?: GenerateWithContextOptions
  ): AsyncGenerator<string>;
  
  // Add to knowledge base
  async addToKnowledgeBase(
    content: string,
    metadata: Record<string, any>
  ): Promise<void>;
  
  // Clear conversation history
  clearHistory(): void;
  
  // Cleanup resources
  async cleanup(): Promise<void>;
}
```

## Integration with CrewAI Agents

See `src/examples/knowledge-backed-agent.ts` for a complete example of integrating Knowledge-Backed LLM with CrewAI agents for email analysis.

## Monitoring and Metrics

The system automatically tracks:

- Generation time per request
- Token throughput (tokens/second)
- RAG retrieval performance
- Error rates and fallback usage
- Memory consumption

Access metrics via the monitoring dashboard or logs.

## Contributing

To add support for new models:

1. Ensure model is in GGUF format
2. Test with `scripts/test-knowledge-backed-llm.ts`
3. Update configuration defaults if needed
4. Submit PR with test results

## Support

For issues or questions:

1. Check this documentation
2. Run test suite: `tsx scripts/test-knowledge-backed-llm.ts`
3. Review logs in `logs/` directory
4. Open issue on GitHub with error details

## License

This integration is part of the CrewAI Team project and follows the same licensing terms.