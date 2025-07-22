# CrewAI Team System Architecture

## Overview

The CrewAI Team system is a modern, scalable multi-agent orchestration platform built with TypeScript, React, and Node.js. It leverages local LLM inference through Ollama and provides enterprise-grade email management with AI-powered assistance.

## Table of Contents

- [System Overview](#system-overview)
- [Core Architecture Principles](#core-architecture-principles)
- [Component Architecture](#component-architecture)
- [Data Flow](#data-flow)
- [Tool Integration Architecture](#tool-integration-architecture)
- [Agent Architecture](#agent-architecture)
- [Performance Considerations](#performance-considerations)
- [Security Architecture](#security-architecture)
- [Deployment Architecture](#deployment-architecture)

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Frontend Layer                             │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐                │
│  │  React SPA  │  │   Tailwind   │  │  Chart.js   │                │
│  │ TypeScript  │  │   Shadcn/ui  │  │  Analytics  │                │
│  └──────┬──────┘  └──────────────┘  └─────────────┘                │
│         │                                                            │
│         ▼                                                            │
│  ┌─────────────────────────────────────────────────┐                │
│  │            tRPC Type-Safe API Layer             │                │
│  └─────────────────────────┬───────────────────────┘                │
└────────────────────────────┼────────────────────────────────────────┘
                             │
┌────────────────────────────┼────────────────────────────────────────┐
│                     Backend Services Layer                           │
│  ┌─────────────────────────┴───────────────────────┐                │
│  │              Express.js API Server               │                │
│  │  ┌───────────┐  ┌──────────┐  ┌──────────────┐  │                │
│  │  │   Auth    │  │  Router  │  │  Middleware   │  │                │
│  │  │  Service  │  │  Layer   │  │    Stack      │  │                │
│  │  └───────────┘  └──────────┘  └──────────────┘  │                │
│  └─────────────────────────┬───────────────────────┘                │
│                            │                                         │
│  ┌─────────────────────────┴───────────────────────┐                │
│  │            Master Orchestrator                   │                │
│  │  ┌───────────┐  ┌──────────┐  ┌──────────────┐  │                │
│  │  │   Plan    │  │  Agent   │  │    Task       │  │                │
│  │  │  Creator  │  │  Pool    │  │    Queue      │  │                │
│  │  └───────────┘  └──────────┘  └──────────────┘  │                │
│  └─────────────────────────┬───────────────────────┘                │
│                            │                                         │
│  ┌─────────────────────────┴───────────────────────┐                │
│  │              Agent Layer                         │                │
│  │  ┌────────────┐ ┌────────────┐ ┌─────────────┐  │                │
│  │  │  Research  │ │   Email    │ │    Code     │  │                │
│  │  │   Agent    │ │   Agent    │ │    Agent    │  │                │
│  │  └────────────┘ └────────────┘ └─────────────┘  │                │
│  └─────────────────────────┬───────────────────────┘                │
│                            │                                         │
│  ┌─────────────────────────┴───────────────────────┐                │
│  │               Tool Layer                         │                │
│  │  ┌────────────┐ ┌────────────┐ ┌─────────────┐  │                │
│  │  │WebSearch   │ │ WebScraper │ │ FileSystem  │  │                │
│  │  │   Tool     │ │    Tool    │ │    Tool     │  │                │
│  │  └────────────┘ └────────────┘ └─────────────┘  │                │
│  └──────────────────────────────────────────────────┘                │
└──────────────────────────────────────────────────────────────────────┘
                             │
┌────────────────────────────┼────────────────────────────────────────┐
│                    Infrastructure Layer                              │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐                │
│  │ PostgreSQL  │  │    Redis     │  │   Ollama    │                │
│  │  Database   │  │    Cache     │  │  LLM Server │                │
│  └─────────────┘  └──────────────┘  └─────────────┘                │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐                │
│  │  ChromaDB   │  │  WebSocket   │  │    Bull     │                │
│  │   Vector    │  │   Server     │  │   Queue     │                │
│  └─────────────┘  └──────────────┘  └─────────────┘                │
└──────────────────────────────────────────────────────────────────────┘
```

## Core Architecture Principles

### 1. Local-First LLM Integration

- **Direct SDK Integration**: No unnecessary API layers between services
- **Optimal Pattern**: Frontend → tRPC → Backend → Direct Ollama SDK
- **Zero-Latency**: Direct memory access for agent coordination
- **CPU Optimization**: Designed for CPU-based inference (AMD Ryzen 7 PRO 7840HS)

### 2. Type Safety Throughout

- **End-to-End TypeScript**: From React components to database queries
- **tRPC Integration**: Type-safe API calls without manual type definitions
- **Zod Validation**: Runtime validation matching TypeScript types
- **Strict Mode**: TypeScript strict mode enabled project-wide

### 3. Modular Agent System

- **Specialized Agents**: Each agent has a specific domain expertise
- **Tool Composition**: Agents can use multiple tools
- **Parallel Execution**: Independent tasks run concurrently
- **Result Synthesis**: Master orchestrator combines agent outputs

### 4. Resilient Tool Architecture

- **Validated Tools**: All tools extend ValidatedTool base class
- **Timeout Management**: Configurable timeouts for all operations
- **Fallback Strategies**: Multiple levels of fallback for external services
- **Error Recovery**: Graceful degradation on failures

## Component Architecture

### Frontend Components

```
src/client/
├── components/          # Reusable UI components
│   ├── Dashboard/      # Main dashboard views
│   ├── Chat/          # Chat interface components
│   ├── Email/         # Email management UI
│   └── Common/        # Shared components
├── hooks/             # Custom React hooks
├── services/          # API service layer
└── utils/             # Frontend utilities
```

### Backend Services

```
src/
├── api/               # API layer
│   ├── routes/       # Express routes
│   └── trpc/         # tRPC routers
├── core/              # Core business logic
│   ├── agents/       # Agent implementations
│   ├── tools/        # Tool implementations
│   └── orchestrator/ # Master orchestrator
└── services/          # Service layer
```

### Agent Structure

```typescript
interface Agent {
  name: string;
  capabilities: string[];
  tools: Map<string, BaseTool>;

  async execute(task: Task): Promise<AgentResult>;
  async executeWithTool(params: ToolExecutionParams): Promise<AgentResult>;
}
```

### Tool Structure

```typescript
abstract class ValidatedTool extends BaseTool {
  abstract validateExecution(params: any): Promise<ValidationResult>;
  abstract performExecution(params: any): Promise<any>;
  abstract getTimeout(): number;

  async execute(params: any): Promise<ToolResult> {
    // Validation → Timeout wrapper → Execution → Result validation
  }
}
```

## Data Flow

### Query Processing Flow

1. **User Input** → React UI
2. **tRPC Call** → Type-safe API request
3. **Master Orchestrator** → Query analysis and planning
4. **Agent Assignment** → Task distribution to specialized agents
5. **Tool Execution** → Agents use tools to gather information
6. **LLM Processing** → Synthesis of results
7. **Response Generation** → Formatted response
8. **UI Update** → Real-time update via WebSocket

### Tool Execution Flow

```
User Query
    ↓
Master Orchestrator
    ↓
Agent Selection
    ↓
Tool Execution ← → Fallback Strategy
    ↓                    ↓
Primary Method      Secondary Method
    ↓                    ↓
Result Processing   Mock Data
    ↓
Agent Synthesis
    ↓
User Response
```

## Tool Integration Architecture

### Tool Lifecycle

1. **Registration**: Tools register with the Tool Registry
2. **Discovery**: Agents discover available tools
3. **Validation**: Input validation before execution
4. **Execution**: Wrapped with timeout and error handling
5. **Result Processing**: Agent-specific processing
6. **Response Formation**: Structured response generation

### Tool Registry Pattern

```typescript
class ToolRegistry {
  private tools = new Map<string, ToolMetadata>();

  registerTool(tool: BaseTool, metadata: ToolMetadata): void {
    this.validateToolImplementation(tool);
    this.tools.set(tool.name, {
      ...metadata,
      instance: tool,
      capabilities: tool.getCapabilities(),
      requirements: tool.getRequirements(),
    });
  }

  getToolsForCapability(capability: string): BaseTool[] {
    // Return tools that provide the requested capability
  }
}
```

### Agent-Tool Integration

```typescript
class ResearchAgent extends BaseAgent {
  async executeWithTool(params: ToolExecutionParams): Promise<AgentResult> {
    const { tool, context } = params;

    // Tools requiring synthesis
    if (["web_search", "web_scraper"].includes(tool.name)) {
      const toolResult = await tool.execute(params.parameters);

      if (!toolResult.success) {
        return this.handleToolFailure(toolResult);
      }

      // Synthesize through LLM
      const synthesis = await this.synthesizeResults(toolResult.data, context);
      return this.formatResponse(synthesis);
    }

    // Simple tools
    return super.executeWithTool(params);
  }
}
```

## Agent Architecture

### Agent Types

1. **ResearchAgent**: Web search, information synthesis
2. **EmailAgent**: Email analysis and response generation
3. **CodeAgent**: Code analysis and generation
4. **DataAnalysisAgent**: Data processing and insights
5. **PlannerAgent**: High-level task planning

### Agent Capabilities

- **Tool Usage**: Each agent can use specific tools
- **LLM Integration**: Direct access to Ollama for reasoning
- **Context Management**: Maintains conversation context
- **Result Synthesis**: Combines multiple data sources

### Agent Pool Management

```typescript
class AgentPool {
  private agents = new Map<string, BaseAgent>();
  private availability = new Map<string, boolean>();

  async assignTask(task: Task): Promise<BaseAgent> {
    const suitableAgents = this.findSuitableAgents(task);
    const availableAgent = suitableAgents.find((agent) =>
      this.availability.get(agent.name),
    );

    if (!availableAgent) {
      // Queue task or create new agent instance
    }

    return availableAgent;
  }
}
```

## Performance Considerations

### CPU-Based Inference

- **Model**: granite3.3:2b (2.7B parameters)
- **Hardware**: AMD Ryzen 7 PRO 7840HS
- **Inference Time**: ~28-30 seconds per LLM call
- **Optimization**: Minimize sequential LLM calls

### Timeout Configuration

```typescript
export const DEFAULT_TIMEOUTS = {
  QUERY_PROCESSING: 30000, // 30 seconds
  AGENT_EXECUTION: 120000, // 2 minutes
  TOOL_EXECUTION: 45000, // 45 seconds
  LLM_GENERATION: 90000, // 90 seconds
  TOTAL_EXECUTION: 240000, // 4 minutes
  API_REQUEST: 10000, // 10 seconds
  DATABASE_QUERY: 5000, // 5 seconds
};
```

### Caching Strategy

- **Query Cache**: Common queries cached in Redis
- **Tool Results**: Successful API calls cached
- **LLM Responses**: Frequent patterns cached
- **Vector Embeddings**: ChromaDB for semantic search

### Optimization Techniques

1. **Parallel Execution**: Run independent tasks concurrently
2. **Early Termination**: Stop processing when sufficient data gathered
3. **Result Streaming**: Stream partial results to UI
4. **Connection Pooling**: Reuse database and LLM connections

## Security Architecture

### Authentication & Authorization

- **JWT Tokens**: Stateless authentication
- **Role-Based Access**: User, Admin, System roles
- **API Key Management**: Secure storage in environment variables
- **Session Management**: Redis-based session store

### Data Security

- **Encryption at Rest**: Database encryption
- **Encryption in Transit**: TLS for all communications
- **Input Sanitization**: Prevent injection attacks
- **Output Filtering**: Remove sensitive data from responses

### Tool Security

- **Sandboxed Execution**: Tools run in isolated contexts
- **Permission Checks**: File system access controls
- **Rate Limiting**: Prevent abuse of external APIs
- **Audit Logging**: Track all tool executions

## Deployment Architecture

### Production Stack

```
┌─────────────────┐     ┌─────────────────┐
│   CloudFlare    │     │   Kubernetes    │
│      CDN        │     │    Cluster      │
└────────┬────────┘     └────────┬────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│    Frontend     │     │   Backend Pods  │
│   Static Host   │     │  (Replicated)   │
└─────────────────┘     └────────┬────────┘
                                 │
                        ┌────────┴────────┐
                        │                 │
                        ▼                 ▼
                ┌─────────────┐   ┌─────────────┐
                │ PostgreSQL  │   │   Redis     │
                │  Primary    │   │  Cluster    │
                └─────────────┘   └─────────────┘
```

### Scaling Strategy

1. **Horizontal Scaling**: Add more backend pods
2. **Database Replicas**: Read replicas for queries
3. **Cache Layer**: Redis for frequent data
4. **CDN**: Static asset delivery
5. **Queue Workers**: Separate worker pods

### Monitoring & Observability

- **Metrics**: Prometheus + Grafana
- **Logging**: Structured JSON logs → Loki
- **Tracing**: OpenTelemetry for distributed tracing
- **Alerts**: PagerDuty integration
- **Health Checks**: Kubernetes probes

## Future Enhancements

### Short Term (Q3 2025)

- GPU support for faster inference
- Additional agent types
- Enhanced tool marketplace
- Improved caching strategies

### Long Term (Q4 2025)

- Multi-model support (Phi-3, Llama 3.2)
- Distributed agent processing
- Edge deployment capabilities
- Advanced orchestration patterns

---

_Last Updated: July 22, 2025_
_Version: 1.0_
