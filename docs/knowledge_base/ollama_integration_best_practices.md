# Ollama Integration Best Practices for TypeScript and Node.js

## Overview

Ollama is an ideal choice for running Large Language Models (LLMs) locally due to its simplicity, compatibility with non-GPU intensive machines, and excellent JavaScript/TypeScript support. This guide covers best practices for integrating Ollama API with TypeScript and Node.js applications.

## Installation and Setup

### Prerequisites

1. **Install Ollama**: Download and install Ollama from [ollama.com](https://ollama.com)
2. **Node.js Environment**: Ensure Node.js is installed (recommend v18+)
3. **TypeScript Configuration**: Properly configured TypeScript environment

### Project Setup

```bash
# Install Ollama JavaScript library
npm install ollama

# For TypeScript projects
npm install --save-dev @types/node typescript
```

### TypeScript Configuration

Ensure your `tsconfig.json` has proper configuration:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

## API Configuration

### Port Management

Ollama API runs on `localhost:11434` by default. Before starting:

```bash
# Check if Ollama is running
ollama serve

# If port is occupied, clear it or use a different port
```

### Connection Setup

```typescript
import ollama from 'ollama';

// Basic configuration
const client = ollama.create({
  host: 'http://localhost:11434',
  // Optional: timeout configuration
  timeout: 30000
});
```

## Model Selection Best Practices

### Resource-Based Selection

- **Limited Resources**: Use smaller models like:
  - Llama 3.2 (1B) - Minimal resource usage
  - Moondream 2 (1.4B) - Good for vision tasks
  - Qwen 2.5 (3B) - Balanced performance/resource usage

- **High-Performance Hardware**: Use larger models like:
  - Llama 3.1 (70B) - Superior performance
  - Qwen 3 (14B) - Good balance for orchestration
  - DeepSeek R1 (671B) - Maximum capabilities

### Model Management

```typescript
// Pull models programmatically
await ollama.pull({ model: 'qwen3:8b' });

// List available models
const models = await ollama.list();
```

## Core Implementation Patterns

### Basic Chat Implementation

```typescript
import ollama from 'ollama';

async function basicChat(prompt: string): Promise<string> {
  try {
    const response = await ollama.chat({
      model: 'qwen3:8b',
      messages: [
        { role: 'user', content: prompt }
      ],
      options: {
        temperature: 0.7,
        max_tokens: 1000
      }
    });
    
    return response.message.content;
  } catch (error) {
    console.error('Chat error:', error);
    throw error;
  }
}
```

### Streaming Responses

```typescript
async function streamingChat(prompt: string): Promise<void> {
  const response = await ollama.chat({
    model: 'qwen3:8b',
    messages: [{ role: 'user', content: prompt }],
    stream: true
  });

  for await (const chunk of response) {
    process.stdout.write(chunk.message.content);
  }
}
```

### Context Management

```typescript
class ConversationManager {
  private messages: Array<{ role: string; content: string }> = [];
  
  async addMessage(role: 'user' | 'assistant', content: string): Promise<string> {
    this.messages.push({ role, content });
    
    const response = await ollama.chat({
      model: 'qwen3:8b',
      messages: this.messages
    });
    
    this.messages.push({
      role: 'assistant',
      content: response.message.content
    });
    
    return response.message.content;
  }
  
  clearContext(): void {
    this.messages = [];
  }
}
```

## Advanced Features

### Tool/Function Calling

Ollama supports tool calling for extending LLM capabilities:

```typescript
const tools = [{
  type: 'function',
  function: {
    name: 'getFavoriteColor',
    description: 'Returns favorite color for a person given their city and country',
    parameters: {
      type: 'object',
      properties: {
        city: {
          type: 'string',
          description: 'The city for the person'
        },
        country: {
          type: 'string',
          description: 'The country for the person'
        }
      },
      required: ['city', 'country']
    }
  }
}];

async function handleToolCalls(messages: any[], response: any): Promise<any> {
  messages.push(response.message);
  
  if (response.message.tool_calls && response.message.tool_calls.length > 0) {
    for (const tool of response.message.tool_calls) {
      const funcResponse = await callFunction(tool.function.name, tool.function.arguments);
      messages.push({ role: 'tool', content: funcResponse });
    }
    
    // Recursive call to handle tool responses
    return handleToolCalls(messages, 
      await ollama.chat({ model: 'qwen3:8b', messages, tools })
    );
  }
  
  return response;
}
```

### Multimodal Support

```typescript
// Image analysis with vision models
async function analyzeImage(imagePath: string, prompt: string): Promise<string> {
  const response = await ollama.chat({
    model: 'llava:7b',
    messages: [
      {
        role: 'user',
        content: prompt,
        images: [imagePath]
      }
    ]
  });
  
  return response.message.content;
}
```

## Error Handling and Resilience

### Retry Logic

```typescript
async function chatWithRetry(
  prompt: string, 
  maxRetries: number = 3
): Promise<string> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await ollama.chat({
        model: 'qwen3:8b',
        messages: [{ role: 'user', content: prompt }]
      }).then(res => res.message.content);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  throw new Error('Max retries exceeded');
}
```

### Connection Health Checking

```typescript
async function checkOllamaHealth(): Promise<boolean> {
  try {
    const response = await fetch('http://localhost:11434/api/tags');
    return response.ok;
  } catch {
    return false;
  }
}
```

## Performance Optimization

### Model Caching

```typescript
class ModelCache {
  private static instance: ModelCache;
  private loadedModels: Set<string> = new Set();
  
  static getInstance(): ModelCache {
    if (!ModelCache.instance) {
      ModelCache.instance = new ModelCache();
    }
    return ModelCache.instance;
  }
  
  async ensureModelLoaded(modelName: string): Promise<void> {
    if (!this.loadedModels.has(modelName)) {
      await ollama.pull({ model: modelName });
      this.loadedModels.add(modelName);
    }
  }
}
```

### Request Batching

```typescript
class RequestBatcher {
  private queue: Array<{
    prompt: string;
    resolve: (value: string) => void;
    reject: (error: Error) => void;
  }> = [];
  
  async addRequest(prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.queue.push({ prompt, resolve, reject });
      this.processBatch();
    });
  }
  
  private async processBatch(): Promise<void> {
    if (this.queue.length === 0) return;
    
    const batch = this.queue.splice(0, 5); // Process 5 at a time
    
    const promises = batch.map(async ({ prompt, resolve, reject }) => {
      try {
        const response = await ollama.chat({
          model: 'qwen3:8b',
          messages: [{ role: 'user', content: prompt }]
        });
        resolve(response.message.content);
      } catch (error) {
        reject(error as Error);
      }
    });
    
    await Promise.all(promises);
  }
}
```

## Integration with Frameworks

### Express.js Integration

```typescript
import express from 'express';
import ollama from 'ollama';

const app = express();
app.use(express.json());

app.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;
    const response = await ollama.chat({
      model: 'qwen3:8b',
      messages: [{ role: 'user', content: message }]
    });
    
    res.json({ response: response.message.content });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

### LangChain Integration

```typescript
import { Ollama } from "@langchain/ollama";

const llm = new Ollama({
  model: "qwen3:8b",
  temperature: 0,
  maxRetries: 2,
});

const completion = await llm.invoke("What is the capital of France?");
```

## Security Considerations

### Input Validation

```typescript
function validateInput(input: string): boolean {
  // Implement input validation
  if (input.length > 4000) return false;
  if (input.includes('<script>')) return false;
  return true;
}
```

### Rate Limiting

```typescript
import rateLimit from 'express-rate-limit';

const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});

app.use('/chat', chatLimiter);
```

## Monitoring and Logging

### Request Logging

```typescript
class OllamaLogger {
  static logRequest(model: string, prompt: string, responseTime: number): void {
    console.log({
      timestamp: new Date().toISOString(),
      model,
      promptLength: prompt.length,
      responseTime,
      type: 'ollama_request'
    });
  }
}
```

### Performance Metrics

```typescript
class MetricsCollector {
  private metrics: Map<string, number[]> = new Map();
  
  recordResponseTime(model: string, time: number): void {
    if (!this.metrics.has(model)) {
      this.metrics.set(model, []);
    }
    this.metrics.get(model)?.push(time);
  }
  
  getAverageResponseTime(model: string): number {
    const times = this.metrics.get(model) || [];
    return times.reduce((a, b) => a + b, 0) / times.length;
  }
}
```

## Best Practices Summary

1. **Resource Management**: Choose models appropriate for your hardware
2. **Error Handling**: Implement robust retry logic and connection monitoring
3. **Performance**: Use caching, batching, and appropriate model selection
4. **Security**: Validate inputs and implement rate limiting
5. **Monitoring**: Log requests and track performance metrics
6. **Testing**: Test with different models and validate tool calling behavior
7. **Scalability**: Design for horizontal scaling and load balancing

## Common Pitfalls to Avoid

1. **Model Hallucination**: Always validate function calls and responses
2. **Token Limits**: Monitor token usage for smaller models
3. **Connection Issues**: Implement proper connection handling
4. **Memory Usage**: Monitor memory consumption with larger models
5. **Tool Calling**: Test that models don't call non-existent functions

This comprehensive guide provides the foundation for building robust, scalable applications with Ollama, TypeScript, and Node.js, ensuring optimal performance and reliability in production environments.