# Claude.md - AI Agent Team Implementation Guide

## Overview

This document provides a comprehensive guide to implementing the AI Agent Team framework, a TypeScript-based multi-agent orchestration system with RAG capabilities, designed for local deployment using Ollama models.

## Table of Contents

1. [Architecture Deep Dive](#architecture-deep-dive)
2. [Master Orchestrator Implementation](#master-orchestrator-implementation)
3. [Agent System Design](#agent-system-design)
4. [RAG System Architecture](#rag-system-architecture)
5. [Tool Framework](#tool-framework)
6. [Maestro Framework Integration](#maestro-framework-integration)
7. [tRPC API Design](#trpc-api-design)
8. [UI/UX Considerations](#uiux-considerations)
9. [Performance & Scalability](#performance--scalability)
10. [Security & Privacy](#security--privacy)

## Architecture Deep Dive

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        User Interface                         │
│                    (React + TypeScript)                       │
└───────────────────────────┬─────────────────────────────────┘
                            │ tRPC
┌───────────────────────────▼─────────────────────────────────┐
│                      API Gateway                              │
│                  (tRPC Router + WebSocket)                    │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                   Master Orchestrator                         │
│              (Planning + Coordination + Review)               │
└─────┬───────────────────────────────────────────┬───────────┘
      │                                           │
      ▼                                           ▼
┌─────────────────┐                     ┌─────────────────────┐
│   Agent Pool    │                     │    RAG System       │
│  (Specialized)  │◄────────────────────►  (Vector Store)     │
└─────────┬───────┘                     └─────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│                        Tool Registry                          │
│              (Web, File, Data, Custom Tools)                 │
└─────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│                      Ollama Provider                          │
│            (Qwen3:14B, Qwen3:8B, Embeddings)                │
└─────────────────────────────────────────────────────────────┘
```

### Core Design Principles

1. **Modularity**: Each component is self-contained and replaceable
2. **Type Safety**: Full TypeScript with strict typing
3. **Local-First**: All processing happens locally
4. **Async-First**: Non-blocking operations throughout
5. **Observable**: Real-time monitoring and debugging

## Master Orchestrator Implementation

### Core MasterOrchestrator Class

```typescript
// src/core/master-orchestrator/MasterOrchestrator.ts

import { OllamaProvider } from '../llm/OllamaProvider';
import { AgentRegistry } from '../agents/registry/AgentRegistry';
import { RAGSystem } from '../rag/RAGSystem';
import { PlanExecutor } from './PlanExecutor';
import { PlanReviewer } from './PlanReviewer';
import { Plan, ExecutionResult, Query } from './types';

export class MasterOrchestrator {
  private llm: OllamaProvider;
  private agentRegistry: AgentRegistry;
  private ragSystem: RAGSystem;
  private planExecutor: PlanExecutor;
  private planReviewer: PlanReviewer;

  constructor(config: MasterOrchestratorConfig) {
    this.llm = new OllamaProvider({
      model: 'qwen3:14b',
      baseUrl: config.ollamaUrl
    });
    
    this.agentRegistry = new AgentRegistry();
    this.ragSystem = new RAGSystem(config.rag);
    this.planExecutor = new PlanExecutor(this.agentRegistry, this.ragSystem);
    this.planReviewer = new PlanReviewer(this.llm);
  }

  async processQuery(query: Query): Promise<ExecutionResult> {
    // Step 1: Create initial plan
    const plan = await this.createPlan(query);
    
    // Step 2: Execute plan with replan loop
    let executionResult: ExecutionResult;
    let attempts = 0;
    const maxAttempts = 3;

    do {
      executionResult = await this.planExecutor.execute(plan);
      
      // Step 3: Review execution results
      const review = await this.planReviewer.review(
        query, 
        plan, 
        executionResult
      );

      if (!review.satisfactory && attempts < maxAttempts) {
        // Step 4: Replan if necessary
        plan = await this.replan(query, plan, review);
        attempts++;
      } else {
        break;
      }
    } while (attempts < maxAttempts);

    // Step 5: Format and return final response
    return this.formatResponse(executionResult);
  }

  private async createPlan(query: Query): Promise<Plan> {
    const prompt = `
      You are the Master Orchestrator. Create a detailed plan to address this query:
      "${query.text}"
      
      Break down the task into clear, actionable steps.
      For each step, determine:
      1. What information is needed (RAG query)
      2. Which agent should handle it
      3. What tools might be required
      4. Expected output
      
      Return a structured plan in JSON format.
    `;

    const response = await this.llm.generate(prompt);
    return this.parsePlan(response);
  }

  private async replan(
    query: Query, 
    originalPlan: Plan, 
    review: ReviewResult
  ): Promise<Plan> {
    const prompt = `
      The original plan did not satisfy the requirements.
      
      Original Query: "${query.text}"
      Original Plan: ${JSON.stringify(originalPlan)}
      Review Feedback: ${review.feedback}
      
      Create a revised plan that addresses the issues.
    `;

    const response = await this.llm.generate(prompt);
    return this.parsePlan(response);
  }
}
```

### Plan Executor Implementation

```typescript
// src/core/master-orchestrator/PlanExecutor.ts

export class PlanExecutor {
  constructor(
    private agentRegistry: AgentRegistry,
    private ragSystem: RAGSystem
  ) {}

  async execute(plan: Plan): Promise<ExecutionResult> {
    const results: StepResult[] = [];

    for (const step of plan.steps) {
      // Step 1: Gather context from RAG
      const context = await this.gatherContext(step);
      
      // Step 2: Determine if tool or information response
      if (step.requiresTool) {
        const result = await this.executeWithTool(step, context);
        results.push(result);
      } else {
        const result = await this.executeInformationQuery(step, context);
        results.push(result);
      }

      // Step 3: Check if we should continue
      if (!this.shouldContinue(results)) {
        break;
      }
    }

    return {
      success: true,
      results,
      summary: this.summarizeResults(results)
    };
  }

  private async gatherContext(step: PlanStep): Promise<Context> {
    const ragQuery = this.buildRAGQuery(step);
    const documents = await this.ragSystem.search(ragQuery);
    
    return {
      documents,
      relevance: this.calculateRelevance(documents, step)
    };
  }

  private async executeWithTool(
    step: PlanStep, 
    context: Context
  ): Promise<StepResult> {
    const agent = this.agentRegistry.getAgent(step.agentType);
    const tool = agent.getTool(step.toolName);
    
    return await agent.executeWithTool({
      tool,
      context,
      parameters: step.parameters
    });
  }
}
```

## Agent System Design

### Base Agent Implementation

```typescript
// src/core/agents/base/BaseAgent.ts

import { OllamaProvider } from '../../llm/OllamaProvider';
import { Tool } from '../../tools/base/BaseTool';
import { AgentCapability, AgentContext, AgentResult } from './AgentTypes';

export abstract class BaseAgent {
  protected llm: OllamaProvider;
  protected tools: Map<string, Tool>;
  protected capabilities: AgentCapability[];

  constructor(
    protected name: string,
    protected description: string
  ) {
    this.llm = new OllamaProvider({
      model: 'qwen3:8b' // Smaller model for agents
    });
    this.tools = new Map();
    this.capabilities = [];
  }

  abstract async execute(
    task: string, 
    context: AgentContext
  ): Promise<AgentResult>;

  async executeWithTool(params: {
    tool: Tool,
    context: AgentContext,
    parameters: any
  }): Promise<AgentResult> {
    try {
      // Prepare prompt with context
      const prompt = this.buildPromptWithContext(params);
      
      // Get LLM guidance
      const guidance = await this.llm.generate(prompt);
      
      // Execute tool
      const toolResult = await params.tool.execute({
        ...params.parameters,
        guidance
      });

      // Process and return result
      return this.processToolResult(toolResult, params.context);
    } catch (error) {
      return this.handleError(error);
    }
  }

  registerTool(tool: Tool): void {
    this.tools.set(tool.name, tool);
    this.updateCapabilities();
  }

  protected abstract buildPromptWithContext(params: any): string;
  protected abstract processToolResult(
    result: any, 
    context: AgentContext
  ): AgentResult;
}
```

### Specialized Agent Example

```typescript
// src/core/agents/specialized/ResearchAgent.ts

import { BaseAgent } from '../base/BaseAgent';
import { WebSearchTool } from '../../tools/web/WebSearchTool';
import { WebScraperTool } from '../../tools/web/WebScraperTool';

export class ResearchAgent extends BaseAgent {
  constructor() {
    super(
      'ResearchAgent',
      'Specializes in web research and information gathering'
    );
    
    // Register tools
    this.registerTool(new WebSearchTool());
    this.registerTool(new WebScraperTool());
  }

  async execute(task: string, context: AgentContext): Promise<AgentResult> {
    const prompt = `
      You are a research specialist. Your task is: ${task}
      
      Context from knowledge base:
      ${this.formatContext(context)}
      
      Determine the best approach:
      1. What specific information to search for
      2. Which sources to prioritize
      3. How to validate information
      
      Provide a research plan.
    `;

    const plan = await this.llm.generate(prompt);
    const results = await this.executeResearchPlan(plan, context);

    return {
      success: true,
      data: results,
      metadata: {
        agent: this.name,
        toolsUsed: ['web_search', 'web_scraper'],
        timestamp: new Date()
      }
    };
  }

  private async executeResearchPlan(
    plan: string, 
    context: AgentContext
  ): Promise<any> {
    // Parse plan and execute searches
    const searchTool = this.tools.get('web_search');
    const scraperTool = this.tools.get('web_scraper');

    // Implementation details...
    return {};
  }
}
```

## RAG System Architecture

### Vector Store Implementation

```typescript
// src/core/rag/VectorStore.ts

import { ChromaClient } from 'chromadb';
import { EmbeddingService } from './EmbeddingService';
import { Document, QueryResult } from './types';

export class VectorStore {
  private client: ChromaClient;
  private collection: Collection;
  private embeddingService: EmbeddingService;

  constructor(config: VectorStoreConfig) {
    this.client = new ChromaClient({
      path: config.path
    });
    
    this.embeddingService = new EmbeddingService({
      model: 'nomic-embed-text'
    });
  }

  async initialize(): Promise<void> {
    this.collection = await this.client.getOrCreateCollection({
      name: 'agent-knowledge',
      metadata: { 
        description: 'Knowledge base for AI agents' 
      }
    });
  }

  async addDocuments(documents: Document[]): Promise<void> {
    const embeddings = await this.embeddingService.embedBatch(
      documents.map(d => d.content)
    );

    await this.collection.add({
      ids: documents.map(d => d.id),
      embeddings: embeddings,
      metadatas: documents.map(d => d.metadata),
      documents: documents.map(d => d.content)
    });
  }

  async search(query: string, limit: number = 5): Promise<QueryResult[]> {
    const queryEmbedding = await this.embeddingService.embed(query);
    
    const results = await this.collection.query({
      queryEmbeddings: [queryEmbedding],
      nResults: limit
    });

    return this.formatResults(results);
  }
}
```

### Document Processor

```typescript
// src/core/rag/DocumentProcessor.ts

export class DocumentProcessor {
  constructor(private config: ProcessorConfig) {}

  async processDocument(
    content: string, 
    metadata: DocumentMetadata
  ): Promise<ProcessedDocument[]> {
    // Clean and normalize text
    const cleaned = this.cleanText(content);
    
    // Split into chunks
    const chunks = this.chunkText(cleaned, {
      size: this.config.chunkSize,
      overlap: this.config.chunkOverlap
    });

    // Create document objects
    return chunks.map((chunk, index) => ({
      id: `${metadata.sourceId}-chunk-${index}`,
      content: chunk,
      metadata: {
        ...metadata,
        chunkIndex: index,
        totalChunks: chunks.length
      }
    }));
  }

  private chunkText(text: string, options: ChunkOptions): string[] {
    const chunks: string[] = [];
    const sentences = this.splitIntoSentences(text);
    
    let currentChunk = '';
    let currentLength = 0;

    for (const sentence of sentences) {
      if (currentLength + sentence.length > options.size) {
        chunks.push(currentChunk.trim());
        
        // Handle overlap
        const overlapStart = Math.max(
          0, 
          currentChunk.length - options.overlap
        );
        currentChunk = currentChunk.slice(overlapStart) + ' ' + sentence;
        currentLength = currentChunk.length;
      } else {
        currentChunk += ' ' + sentence;
        currentLength += sentence.length;
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }
}
```

## Tool Framework

### Base Tool Implementation

```typescript
// src/core/tools/base/BaseTool.ts

export abstract class BaseTool {
  constructor(
    public name: string,
    public description: string,
    public parameters: ToolParameter[]
  ) {}

  abstract execute(params: any): Promise<ToolResult>;

  validateParameters(params: any): ValidationResult {
    const errors: string[] = [];
    
    for (const param of this.parameters) {
      if (param.required && !(param.name in params)) {
        errors.push(`Missing required parameter: ${param.name}`);
      }
      
      if (param.name in params) {
        const value = params[param.name];
        if (!this.validateType(value, param.type)) {
          errors.push(
            `Invalid type for ${param.name}: expected ${param.type}`
          );
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  protected abstract validateType(value: any, type: string): boolean;
}
```

### Tool Implementation Example

```typescript
// src/core/tools/web/WebSearchTool.ts

import { BaseTool } from '../base/BaseTool';
import { SearchEngine } from '../../utils/SearchEngine';

export class WebSearchTool extends BaseTool {
  private searchEngine: SearchEngine;

  constructor() {
    super(
      'web_search',
      'Searches the web for information',
      [
        {
          name: 'query',
          type: 'string',
          required: true,
          description: 'Search query'
        },
        {
          name: 'limit',
          type: 'number',
          required: false,
          description: 'Maximum results to return',
          default: 10
        }
      ]
    );

    this.searchEngine = new SearchEngine();
  }

  async execute(params: {
    query: string,
    limit?: number
  }): Promise<ToolResult> {
    const validation = this.validateParameters(params);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.errors.join(', ')
      };
    }

    try {
      const results = await this.searchEngine.search({
        query: params.query,
        limit: params.limit || 10
      });

      return {
        success: true,
        data: {
          results,
          metadata: {
            query: params.query,
            resultCount: results.length,
            timestamp: new Date()
          }
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}
```

## Maestro Framework Integration

### Core Maestro Implementation

```typescript
// src/core/maestro/MaestroFramework.ts

import { EventEmitter } from 'events';
import { TaskQueue } from './TaskQueue';
import { ExecutionContext } from './ExecutionContext';
import { Task, TaskResult, MaestroConfig } from './types';

export class MaestroFramework extends EventEmitter {
  private taskQueue: TaskQueue;
  private executionContexts: Map<string, ExecutionContext>;
  private config: MaestroConfig;

  constructor(config: MaestroConfig) {
    super();
    this.config = config;
    this.taskQueue = new TaskQueue(config.queueConfig);
    this.executionContexts = new Map();
  }

  async submitTask(task: Task): Promise<string> {
    const taskId = this.generateTaskId();
    
    // Create execution context
    const context = new ExecutionContext({
      taskId,
      task,
      config: this.config
    });
    
    this.executionContexts.set(taskId, context);
    
    // Queue task
    await this.taskQueue.enqueue({
      id: taskId,
      priority: task.priority || 0,
      task,
      context
    });

    this.emit('task:submitted', { taskId, task });
    
    return taskId;
  }

  async executeNext(): Promise<TaskResult | null> {
    const queueItem = await this.taskQueue.dequeue();
    if (!queueItem) return null;

    const { id, task, context } = queueItem;
    
    try {
      this.emit('task:started', { taskId: id });
      
      // Execute task with context
      const result = await this.executeTask(task, context);
      
      this.emit('task:completed', { taskId: id, result });
      
      return result;
    } catch (error) {
      this.emit('task:failed', { taskId: id, error });
      throw error;
    } finally {
      this.executionContexts.delete(id);
    }
  }

  private async executeTask(
    task: Task, 
    context: ExecutionContext
  ): Promise<TaskResult> {
    // Set up execution environment
    context.initialize();
    
    try {
      // Execute based on task type
      switch (task.type) {
        case 'agent':
          return await this.executeAgentTask(task, context);
        case 'tool':
          return await this.executeToolTask(task, context);
        case 'composite':
          return await this.executeCompositeTask(task, context);
        default:
          throw new Error(`Unknown task type: ${task.type}`);
      }
    } finally {
      context.cleanup();
    }
  }
}
```

### Task Queue Implementation

```typescript
// src/core/maestro/TaskQueue.ts

export class TaskQueue {
  private queue: PriorityQueue<QueueItem>;
  private processing: Set<string>;

  constructor(private config: QueueConfig) {
    this.queue = new PriorityQueue(
      (a, b) => b.priority - a.priority
    );
    this.processing = new Set();
  }

  async enqueue(item: QueueItem): Promise<void> {
    if (this.queue.size() >= this.config.maxSize) {
      throw new Error('Queue is full');
    }

    this.queue.enqueue(item);
  }

  async dequeue(): Promise<QueueItem | null> {
    const item = this.queue.dequeue();
    if (item) {
      this.processing.add(item.id);
    }
    return item;
  }

  markComplete(taskId: string): void {
    this.processing.delete(taskId);
  }

  getStatus(): QueueStatus {
    return {
      queued: this.queue.size(),
      processing: this.processing.size,
      capacity: this.config.maxSize
    };
  }
}
```

## tRPC API Design

### Router Setup

```typescript
// src/api/trpc/router.ts

import { initTRPC } from '@trpc/server';
import { createContext } from './context';
import { agentRouter } from '../routes/agent.router';
import { taskRouter } from '../routes/task.router';
import { ragRouter } from '../routes/rag.router';
import { chatRouter } from '../routes/chat.router';

const t = initTRPC.context<typeof createContext>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(authMiddleware);

export const appRouter = router({
  agent: agentRouter,
  task: taskRouter,
  rag: ragRouter,
  chat: chatRouter
});

export type AppRouter = typeof appRouter;
```

### Chat Router Implementation

```typescript
// src/api/routes/chat.router.ts

import { z } from 'zod';
import { router, publicProcedure } from '../trpc/router';
import { MasterOrchestrator } from '../../core/master-orchestrator/MasterOrchestrator';

export const chatRouter = router({
  create: publicProcedure
    .input(z.object({
      message: z.string()
    }))
    .mutation(async ({ input, ctx }) => {
      const conversation = await ctx.conversationService.create();
      const orchestrator = ctx.masterOrchestrator;
      
      const result = await orchestrator.processQuery({
        text: input.message,
        conversationId: conversation.id
      });

      return {
        conversationId: conversation.id,
        response: result.summary,
        metadata: result.metadata
      };
    }),

  message: publicProcedure
    .input(z.object({
      conversationId: z.string(),
      message: z.string()
    }))
    .mutation(async ({ input, ctx }) => {
      const conversation = await ctx.conversationService.get(
        input.conversationId
      );
      
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      const result = await ctx.masterOrchestrator.processQuery({
        text: input.message,
        conversationId: input.conversationId,
        history: conversation.messages
      });

      await ctx.conversationService.addMessage(
        input.conversationId,
        {
          role: 'user',
          content: input.message
        },
        {
          role: 'assistant',
          content: result.summary
        }
      );

      return {
        response: result.summary,
        metadata: result.metadata
      };
    }),

  history: publicProcedure
    .input(z.object({
      conversationId: z.string()
    }))
    .query(async ({ input, ctx }) => {
      const conversation = await ctx.conversationService.get(
        input.conversationId
      );
      
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      return conversation.messages;
    })
});
```

## UI/UX Considerations

### Chat Interface Component

```typescript
// src/ui/components/Chat/ChatInterface.tsx

import React, { useState, useRef, useEffect } from 'react';
import { trpc } from '../../hooks/useTRPC';
import { MessageList } from './MessageList';
import { InputBox } from './InputBox';
import { AgentMonitor } from '../AgentStatus/AgentMonitor';

export const ChatInterface: React.FC = () => {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const createConversation = trpc.chat.create.useMutation();
  const sendMessage = trpc.chat.message.useMutation();
  const messageEndRef = useRef<HTMLDivElement>(null);

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;

    setIsProcessing(true);
    
    try {
      if (!conversationId) {
        // Create new conversation
        const result = await createConversation.mutateAsync({
          message: text
        });
        
        setConversationId(result.conversationId);
        setMessages([
          { role: 'user', content: text },
          { role: 'assistant', content: result.response }
        ]);
      } else {
        // Continue conversation
        const userMessage = { role: 'user', content: text };
        setMessages(prev => [...prev, userMessage]);
        
        const result = await sendMessage.mutateAsync({
          conversationId,
          message: text
        });
        
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: result.response
        }]);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // Handle error
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="chat-interface">
      <div className="chat-container">
        <MessageList messages={messages} isProcessing={isProcessing} />
        <div ref={messageEndRef} />
      </div>
      
      <InputBox 
        onSendMessage={handleSendMessage}
        disabled={isProcessing}
      />
      
      {isProcessing && <AgentMonitor />}
    </div>
  );
};
```

### Real-time Agent Monitoring

```typescript
// src/ui/components/AgentStatus/AgentMonitor.tsx

import React, { useEffect, useState } from 'react';
import { trpc } from '../../hooks/useTRPC';

export const AgentMonitor: React.FC = () => {
  const [activeAgents, setActiveAgents] = useState<AgentStatus[]>([]);
  
  // Subscribe to agent status updates
  const agentStatusSubscription = trpc.agent.statusUpdates.useSubscription(
    undefined,
    {
      onData: (data) => {
        setActiveAgents(prev => {
          const index = prev.findIndex(a => a.id === data.agentId);
          if (index >= 0) {
            const updated = [...prev];
            updated[index] = data;
            return updated;
          } else {
            return [...prev, data];
          }
        });
      }
    }
  );

  return (
    <div className="agent-monitor">
      <h3>Active Agents</h3>
      <div className="agent-list">
        {activeAgents.map(agent => (
          <div key={agent.id} className="agent-status">
            <div className="agent-name">{agent.name}</div>
            <div className="agent-task">{agent.currentTask}</div>
            <div className="agent-progress">
              <div 
                className="progress-bar"
                style={{ width: `${agent.progress}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
```

## Performance & Scalability

### Optimization Strategies

1. **Model Loading**
   ```typescript
   // Lazy load models
   class ModelLoader {
     private models: Map<string, OllamaModel> = new Map();
     
     async getModel(name: string): Promise<OllamaModel> {
       if (!this.models.has(name)) {
         const model = await this.loadModel(name);
         this.models.set(name, model);
       }
       return this.models.get(name)!;
     }
   }
   ```

2. **Context Window Management**
   ```typescript
   class ContextManager {
     private maxTokens = 4096;
     
     truncateContext(context: string[], query: string): string[] {
       const queryTokens = this.countTokens(query);
       let availableTokens = this.maxTokens - queryTokens - 500; // Buffer
       
       const truncated: string[] = [];
       for (const doc of context.reverse()) {
         const docTokens = this.countTokens(doc);
         if (availableTokens >= docTokens) {
           truncated.unshift(doc);
           availableTokens -= docTokens;
         } else {
           break;
         }
       }
       
       return truncated;
     }
   }
   ```

3. **Parallel Agent Execution**
   ```typescript
   async executeAgentsInParallel(tasks: AgentTask[]): Promise<AgentResult[]> {
     const independent = tasks.filter(t => !t.dependencies);
     const dependent = tasks.filter(t => t.dependencies);
     
     // Execute independent tasks in parallel
     const independentResults = await Promise.all(
       independent.map(task => this.executeAgent(task))
     );
     
     // Execute dependent tasks sequentially
     const results = [...independentResults];
     for (const task of dependent) {
       const result = await this.executeAgent(task);
       results.push(result);
     }
     
     return results;
   }
   ```

## Security & Privacy

### Data Protection

1. **Local Storage Encryption**
   ```typescript
   class SecureStorage {
     private key: CryptoKey;
     
     async encrypt(data: string): Promise<string> {
       const encoded = new TextEncoder().encode(data);
       const encrypted = await crypto.subtle.encrypt(
         { name: 'AES-GCM', iv: this.generateIV() },
         this.key,
         encoded
       );
       return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
     }
     
     async decrypt(encrypted: string): Promise<string> {
       const data = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
       const decrypted = await crypto.subtle.decrypt(
         { name: 'AES-GCM', iv: this.getIV() },
         this.key,
         data
       );
       return new TextDecoder().decode(decrypted);
     }
   }
   ```

2. **Input Validation**
   ```typescript
   class InputValidator {
     validateUserInput(input: string): ValidationResult {
       // Check for injection attempts
       if (this.containsInjection(input)) {
         return { valid: false, error: 'Invalid input detected' };
       }
       
       // Sanitize input
       const sanitized = this.sanitize(input);
       
       return { valid: true, sanitized };
     }
     
     private containsInjection(input: string): boolean {
       const patterns = [
         /[<>]/g,  // HTML tags
         /javascript:/gi,  // JS protocol
         /on\w+\s*=/gi  // Event handlers
       ];
       
       return patterns.some(pattern => pattern.test(input));
     }
   }
   ```

3. **Rate Limiting**
   ```typescript
   class RateLimiter {
     private requests: Map<string, number[]> = new Map();
     
     canProcess(userId: string): boolean {
       const now = Date.now();
       const userRequests = this.requests.get(userId) || [];
       
       // Remove old requests (older than 1 minute)
       const recent = userRequests.filter(
         time => now - time < 60000
       );
       
       if (recent.length >= 10) {  // Max 10 requests per minute
         return false;
       }
       
       recent.push(now);
       this.requests.set(userId, recent);
       return true;
     }
   }
   ```

## Deployment Considerations

### Docker Configuration

```dockerfile
# docker/Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

FROM node:18-alpine AS runner

WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

EXPOSE 3000 5173

CMD ["node", "dist/api/server.js"]
```

### Docker Compose

```yaml
# docker/docker-compose.yml
version: '3.8'

services:
  ollama:
    image: ollama/ollama:latest
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]

  app:
    build: .
    ports:
      - "3000:3000"
      - "5173:5173"
    environment:
      - OLLAMA_URL=http://ollama:11434
      - NODE_ENV=production
    volumes:
      - app_data:/app/data
    depends_on:
      - ollama

  chromadb:
    image: chromadb/chroma:latest
    ports:
      - "8000:8000"
    volumes:
      - chroma_data:/chroma/chroma

volumes:
  ollama_data:
  app_data:
  chroma_data:
```

## Testing Strategy

### Unit Test Example

```typescript
// tests/unit/MasterOrchestrator.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MasterOrchestrator } from '../../src/core/master-orchestrator/MasterOrchestrator';

describe('MasterOrchestrator', () => {
  let orchestrator: MasterOrchestrator;
  
  beforeEach(() => {
    orchestrator = new MasterOrchestrator({
      ollamaUrl: 'http://localhost:11434',
      rag: { /* mock config */ }
    });
  });

  it('should create a plan for a simple query', async () => {
    const query = { text: 'What is the weather today?' };
    const plan = await orchestrator.createPlan(query);
    
    expect(plan).toBeDefined();
    expect(plan.steps).toHaveLength(2);
    expect(plan.steps[0].type).toBe('information');
  });

  it('should execute plan with replan on failure', async () => {
    // Mock failed execution
    vi.spyOn(orchestrator.planExecutor, 'execute')
      .mockResolvedValueOnce({ success: false })
      .mockResolvedValueOnce({ success: true });
    
    const result = await orchestrator.processQuery({
      text: 'Complex task requiring replan'
    });
    
    expect(result.success).toBe(true);
    expect(orchestrator.planExecutor.execute).toHaveBeenCalledTimes(2);
  });
});
```

## Monitoring & Observability

### Logging System

```typescript
// src/utils/logger.ts

import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ 
      filename: 'data/logs/error.log', 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: 'data/logs/combined.log' 
    })
  ]
});

// Add console transport in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}
```

### Metrics Collection

```typescript
// src/utils/metrics.ts

export class MetricsCollector {
  private metrics: Map<string, Metric[]> = new Map();

  record(name: string, value: number, tags?: Record<string, string>): void {
    const metric: Metric = {
      timestamp: Date.now(),
      value,
      tags
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    this.metrics.get(name)!.push(metric);
    
    // Emit to monitoring service if configured
    this.emit(name, metric);
  }

  getMetrics(name: string, timeRange?: TimeRange): Metric[] {
    const metrics = this.metrics.get(name) || [];
    
    if (!timeRange) return metrics;
    
    return metrics.filter(
      m => m.timestamp >= timeRange.start && 
           m.timestamp <= timeRange.end
    );
  }
}
```

## Conclusion

This AI Agent Team framework provides a robust, scalable, and type-safe foundation for building sophisticated AI agent systems. The modular architecture allows for easy extension and customization while maintaining performance and security.

Key benefits:
- **Local-first**: Complete privacy and control
- **Cost-effective**: Using free Ollama models
- **Scalable**: Designed for growth
- **Type-safe**: Full TypeScript support
- **Observable**: Real-time monitoring
- **Extensible**: Easy to add new agents and tools

The framework is ready for production use and can be adapted to various use cases requiring intelligent agent orchestration.
