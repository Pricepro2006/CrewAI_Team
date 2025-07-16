# AI Agent Team Framework

A production-ready, local-first multi-agent orchestration system built with TypeScript and React. Features a Master Orchestrator with plan/replan loops, specialized agents with tool capabilities, and RAG-enhanced knowledge management. Designed for complete privacy with local Ollama models.

## 🚀 Current Status

**Development Phase** - The system architecture is complete with a working UI and mock API. See [PRODUCTION_MIGRATION_PLAN.md](./PRODUCTION_MIGRATION_PLAN.md) for the roadmap to production.

### What's Working
- ✅ React UI with chat interface
- ✅ tRPC API structure 
- ✅ Agent architecture framework
- ✅ Tool system design
- ✅ RAG system structure
- ✅ SQLite database schema

### In Development
- 🚧 Master Orchestrator LLM integration
- 🚧 Agent implementations
- 🚧 Tool executions
- 🚧 RAG vector store
- 🚧 WebSocket real-time updates

## 🌟 Features

- **Master Orchestrator** with intelligent planning and replan capabilities
- **Specialized Agents**:
  - ResearchAgent - Web search and information synthesis
  - CodeAgent - Code generation and analysis
  - DataAnalysisAgent - Data processing and insights
  - WriterAgent - Content creation and formatting
  - ToolExecutorAgent - General tool execution
- **RAG System** with vector storage and semantic search
- **Tool Ecosystem** for web search, scraping, and custom tools
- **Type-Safe API** with tRPC
- **Real-time Updates** via WebSockets
- **100% Local** - No data leaves your machine
- **Professional UI** with React and Tailwind CSS

## 📋 Prerequisites

- Node.js 18+ (tested with v22.15.0)
- pnpm package manager
- Ollama installed locally
- 16GB+ RAM recommended
- GPU optional but recommended

## 🛠️ Quick Start

### 1. Install Dependencies

```bash
# Install pnpm if not already installed
npm install -g pnpm

# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull required models
ollama pull qwen3:14b
ollama pull qwen3:8b
ollama pull nomic-embed-text
```

### 2. Clone & Setup

```bash
git clone https://github.com/yourusername/ai-agent-team.git
cd ai-agent-team
pnpm install
pnpm approve-builds  # Approve native module builds
```

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env with your settings
```

### 4. Initialize & Start

```bash
# Initialize database
pnpm init:db

# Start development (currently mock server)
pnpm dev:client  # Frontend only
# or
pnpm dev:alt     # Using the alternative dev script
```

### 5. Access the UI

Open http://localhost:5173 in your browser.

## 🏗️ Architecture

### System Overview

```
┌─────────────────────────────┐
│      React Frontend         │
│   (Chat UI + Monitoring)    │
└──────────────┬──────────────┘
               │ tRPC
┌──────────────▼──────────────┐
│      API Gateway            │
│    (Express + tRPC)         │
└──────────────┬──────────────┘
               │
┌──────────────▼──────────────┐
│    Master Orchestrator      │
│  (Planning & Coordination)  │
└─────┬────────────────┬──────┘
      │                │
┌─────▼─────┐    ┌────▼──────┐
│   Agents  │◄───►│    RAG    │
│ Registry  │     │  System   │
└─────┬─────┘     └───────────┘
      │
┌─────▼─────────────────────┐
│      Tool Registry         │
│ (Web, File, Data, Custom) │
└───────────────────────────┘
```

### Core Components

1. **Master Orchestrator** - Plans, executes, and reviews complex tasks
2. **Agent System** - Specialized agents for different domains
3. **RAG System** - Knowledge management with vector search
4. **Tool Framework** - Extensible tool ecosystem
5. **tRPC API** - Type-safe client-server communication

## 🔧 Configuration

### Models Configuration
```typescript
// src/config/ollama.config.ts
export const ollamaConfig = {
  models: {
    main: 'qwen3:14b',      // Orchestrator
    agents: 'qwen3:8b',     // Agents
    embedding: 'nomic-embed-text'
  }
}
```

### Environment Variables
```env
NODE_ENV=development
OLLAMA_URL=http://localhost:11434
DATABASE_PATH=./data/app.db
JWT_SECRET=your-secret-key
```

## 🧪 Development

### Available Scripts

```bash
pnpm dev          # Start full dev environment
pnpm dev:client   # Frontend only
pnpm dev:server   # Backend only
pnpm build        # Build for production
pnpm test         # Run tests
pnpm typecheck    # Type checking
pnpm lint         # Linting
```

### Known Issues

1. **ESM Module Resolution** - Node.js v22 has issues with TypeScript imports. Use `pnpm dev:client` for UI development or see [TROUBLESHOOTING.md](./TROUBLESHOOTING.md).

2. **Backend Implementation** - Currently using mock servers. See [PRODUCTION_MIGRATION_PLAN.md](./PRODUCTION_MIGRATION_PLAN.md) for implementation status.

## 📚 Documentation

- [CLAUDE.md](./CLAUDE.md) - Development guide for Claude
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Common issues and solutions
- [PRODUCTION_MIGRATION_PLAN.md](./PRODUCTION_MIGRATION_PLAN.md) - Roadmap to production
- [PROJECT_STATUS.md](./PROJECT_STATUS.md) - Current implementation status

## 🤝 Contributing

1. Check the [PRODUCTION_MIGRATION_PLAN.md](./PRODUCTION_MIGRATION_PLAN.md)
2. Pick a task from the TODO list
3. Create a feature branch
4. Implement with tests
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- Inspired by [CrewAI](https://github.com/crewAIInc/crewAI)
- Powered by [Ollama](https://ollama.com)
- UI built with [React](https://react.dev) and [Vite](https://vitejs.dev)
- API powered by [tRPC](https://trpc.io)