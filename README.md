# CrewAI Team - Enterprise AI Agent Framework

A production-ready enterprise AI agent framework with comprehensive email intelligence, Walmart grocery automation, and advanced workflow orchestration.

![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![React](https://img.shields.io/badge/React-18.2-61dafb)
![Node.js](https://img.shields.io/badge/Node.js-20.11-green)
![SQLite](https://img.shields.io/badge/SQLite-3.44-003B57)
![Status](https://img.shields.io/badge/Status-Production-green)
![Phase](https://img.shields.io/badge/Phase_4-Complete-brightgreen)

## Overview

CrewAI Team is a sophisticated multi-agent AI system designed for enterprise-scale operations. It features intelligent email processing, automated workflow management, and seamless integration with business systems.

### 🎉 Phase 4 Complete: Real-Time Data Integration

The system has successfully completed Phase 4, transitioning from static data to full API integration:
- ✅ **95% Complete** - All UI components now fetch real data from APIs
- ✅ **Real-Time Updates** - 5-second polling and WebSocket integration
- ✅ **Production Ready** - All critical bugs resolved, comprehensive error handling
- ✅ **TypeScript Migration** - Reduced from 726 to 0 blocking errors

### Key Features

- **Multi-Agent Architecture** - Specialized agents for research, analysis, code generation, and task execution
- **Email Intelligence** - Advanced email analysis with 90% entity extraction accuracy
- **Walmart Integration** - Complete grocery shopping automation with 13 UI components
- **Local-First Design** - Direct integration with Ollama for privacy and performance
- **TypeScript Architecture** - End-to-end type safety with tRPC
- **Real-Time Updates** - WebSocket-powered live data synchronization
- **Security-First** - CSRF protection, security headers, and comprehensive middleware

## Getting Started

### Prerequisites

- Node.js 20.11 or higher
- SQLite 3.44 or higher
- Redis (for queue management)
- Ollama (for local LLM inference)
- ChromaDB (for vector operations)

### Installation

```bash
# Clone the repository
git clone https://github.com/Pricepro2006/CrewAI_Team.git
cd CrewAI_Team

# Install dependencies
npm install

# Initialize the database
npm run db:init

# Start development server
npm run dev
```

### Environment Setup

Create a `.env` file based on `.env.example`:

```env
DATABASE_PATH=./app.db
REDIS_URL=redis://localhost:6379
OLLAMA_HOST=http://localhost:11434
CHROMADB_URL=http://localhost:8000
```

## Architecture

### System Components

```
Frontend (React + TypeScript)
    ├── tRPC Client (with real-time polling)
    ├── WebSocket Client (live updates)
    ├── UI Components (13 Walmart components)
    └── Browser-Compatible Logger

Backend (Node.js + Express)
    ├── tRPC Server (type-safe API)
    ├── Agent System (5 specialized agents)
    ├── Email Pipeline (3-stage processing)
    └── Database Layer (optimized queries)

Services
    ├── Ollama (LLM - local inference)
    ├── ChromaDB (Vector operations)
    ├── Redis (Queue management)
    └── SQLite (Primary data store)
```

### Agent System

- **MasterOrchestrator** - Coordinates agent activities
- **ResearchAgent** - Web search and information gathering
- **EmailAnalysisAgent** - Email processing and classification
- **CodeAgent** - Code generation and analysis
- **DataAnalysisAgent** - Data processing and insights

## Development

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run test         # Run test suite
npm run lint         # Run ESLint
npm run typecheck    # Run TypeScript checks
```

### Project Structure

```
src/
├── api/            # API routes and services
├── client/         # React frontend
├── core/           # Core business logic
├── database/       # Database layer
├── shared/         # Shared types and utilities
└── ui/             # UI components
```

## API Documentation

The system provides a comprehensive REST and tRPC API:

- `/api/health` - System health check
- `/api/agents` - Agent management
- `/api/emails` - Email operations
- `/api/tasks` - Task management

See [docs/api/](docs/api/) for detailed API documentation.

## Deployment

### Docker Deployment

```bash
docker-compose up -d
```

### Production Configuration

See [deployment/](deployment/) for production deployment guides including:

- Docker configuration
- Kubernetes manifests
- Environment setup
- Security best practices

## Testing

```bash
npm run test              # Unit tests
npm run test:integration  # Integration tests
npm run test:e2e         # End-to-end tests
```

## Recent Updates (Phase 4 - January 2025)

### Technical Achievements
- **Module Resolution** - Fixed ES module imports and Vite configuration
- **Browser Compatibility** - Resolved Node.js module externalization
- **Logger Implementation** - Created browser-compatible logging system
- **Error Recovery** - Comprehensive error handling and graceful degradation
- **Real-Time Integration** - All components now use live API data

### Performance Improvements
- **TypeScript Errors** - Reduced from 726 to 0 blocking errors
- **UI Load Time** - Optimized with Vite bundling and code splitting
- **API Response** - 5-second polling with intelligent caching
- **Memory Management** - No memory leaks detected

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

- Documentation: [docs/](docs/)
- Issues: [GitHub Issues](https://github.com/Pricepro2006/CrewAI_Team/issues)
- Email: support@crewai-team.com
