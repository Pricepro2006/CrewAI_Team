# CrewAI Team - Enterprise AI Agent Framework

## Intelligent Email Processing & Business Automation System

**Current Status: ⚠️ FRAMEWORK ARCHITECTURALLY COMPLETE - INTEGRATION IN PROGRESS**

An enterprise AI agent framework with adaptive email analysis, business intelligence extraction, and Walmart grocery automation. The system architecture is complete but requires integration work to become fully operational.

![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![React](https://img.shields.io/badge/React-18.2-61dafb)
![Node.js](https://img.shields.io/badge/Node.js-20.11-green)
![SQLite](https://img.shields.io/badge/SQLite-143K_Emails-003B57)
![tRPC](https://img.shields.io/badge/tRPC-Type_Safe-purple)
![Build](https://img.shields.io/badge/Build-Partial-yellow)
![TypeScript Errors](https://img.shields.io/badge/TS_Errors-2119-red)

## System Overview

CrewAI Team is an enterprise AI agent framework designed for intelligent email processing, business intelligence extraction, and specialized automation. The system architecture is complete with comprehensive TypeScript implementation, but integration between components is still in progress.

### 📊 Current System Status (August 15, 2025)

**What's Working:**
- ✅ **Frontend UI** - React components build and run successfully
- ✅ **Basic API Endpoints** - Core API routes are functional
- ✅ **Database Operations** - SQLite database with 143,850 emails stored
- ✅ **WebSocket Infrastructure** - Real-time update capability ready on port 8080
- ✅ **Agent Framework** - Architecturally complete, awaiting integration

**Known Issues:**
- ⚠️ **TypeScript Compilation** - 2,119 type errors (down from 2,200+)
- ⚠️ **Email Processing Pipeline** - Only 0.011% of emails processed with LLM
- ⚠️ **Walmart Integration** - Mock data needs replacement with real data
- ⚠️ **Agent Integration** - Routes bypass MasterOrchestrator
- ⚠️ **Mixed LLM Usage** - Inconsistent Ollama/llama.cpp implementation

### 📈 Development Progress

- **Database**: 143,850 emails collected and stored
- **LLM Processing**: Only 15 emails (0.011%) have received AI analysis
- **Type Safety**: 2,119 TypeScript errors remaining
- **UI Components**: Frontend builds successfully despite type issues
- **Backend**: Partially functional with type compatibility problems

### 🛒 Walmart Grocery Agent

**Status**: ⚠️ UI COMPONENTS BUILT - NEEDS REAL DATA INTEGRATION

The Walmart Grocery Agent consists of UI components and service architecture:

**Current State:**
- **UI Components**: 14 React components created and functional
- **Database**: walmart_grocery.db exists but contains mock data (0 real orders)
- **NLP Model**: Qwen3:0.6b integration designed but not verified
- **Microservices**: Port architecture defined but integration incomplete

**Service Ports (Defined but not all operational):**
- Port 3005: Grocery Service
- Port 3006: Cache Warmer Service  
- Port 3007: Pricing Service
- Port 3008: NLP Service
- Port 3009: Deal Engine
- Port 3010: Memory Monitor
- Port 8080: WebSocket Gateway

### Email Pipeline Architecture

**Status**: ⚠️ FRAMEWORK DESIGNED - LLM INTEGRATION PENDING

The email processing system has a three-phase architecture designed but not fully operational:

**Phase 1: Rule-Based Analysis** ✅ WORKING
- Basic entity extraction (PO numbers, quotes, cases)
- Email chain detection (29,495 chains identified)
- Priority scoring and categorization
- Currently processing all 143,850 emails

**Phase 2: LLM Enhancement** ❌ NOT INTEGRATED  
- Designed to use Llama 3.2 for deeper analysis
- Only 15 test emails (0.011%) processed
- Scripts exist but not in production pipeline

**Phase 3: Strategic Analysis** ❌ NOT IMPLEMENTED
- Intended for executive insights with Phi-4
- 0 emails processed
- Architecture designed only

## Technology Stack

### Core Technologies
- **Frontend**: React 18.2.0 + TypeScript 5.0
- **Backend**: Node.js 20.11 + Express
- **Database**: SQLite with better-sqlite3
- **API Layer**: tRPC for type-safe APIs
- **Queue**: Redis + BullMQ (configured but underutilized)
- **LLM**: Ollama (transitioning between Ollama and llama.cpp)
- **Vector Store**: ChromaDB (configured but not actively used)
- **WebSocket**: Port 8080 (infrastructure ready)

## Getting Started

### Prerequisites

- Node.js 20.11 or higher
- SQLite 3
- Redis (optional - for queue management)
- Ollama (optional - for LLM features when integrated)
- Python 3.x with distutils (for node-gyp compilation)

### Installation

```bash
# Clone the repository
git clone https://github.com/Pricepro2006/CrewAI_Team.git
cd CrewAI_Team

# Install dependencies
npm install

# Note: If you encounter node-gyp errors, you may need to install Python distutils:
# Ubuntu/Debian: sudo apt-get install python3-distutils
# Or use a Python environment with distutils installed

# For WebSocket functionality, socket.io is required but may fail to install
# due to better-sqlite3 compilation issues. This is optional for basic functionality.

# Initialize the database
npm run db:init

# Start development server
npm run dev
```

### Environment Setup

Create a `.env` file based on `.env.example`:

```env
# Database
DATABASE_PATH=./data/crewai.db
WALMART_DB_PATH=./data/walmart_grocery.db

# Services
REDIS_URL=redis://localhost:6379
OLLAMA_HOST=http://localhost:11434
CHROMADB_URL=http://localhost:8000

# NLP Configuration
WALMART_NLP_MODEL=qwen3:0.6b
OLLAMA_MODEL=qwen3:0.6b

# Microservice Ports
NLP_SERVICE_PORT=3008
PRICING_SERVICE_PORT=3007
CACHE_WARMER_PORT=3006
GROCERY_SERVICE_PORT=3005
DEAL_ENGINE_PORT=3009
MEMORY_MONITOR_PORT=3010

# WebSocket
WEBSOCKET_PORT=8080

# Main Server
NODE_ENV=development
PORT=3001
```

**Note:** The database path has been updated to use `crewai.db` for consistency with the Phase 4 real data integration. Walmart Grocery Agent uses a dedicated `walmart_grocery.db` database.

## Project Structure

```
src/
├── api/              # API routes and services
│   ├── routes/       # Express and tRPC routers
│   └── services/     # Business logic services
├── client/           # Frontend client code
│   └── store/        # State management
├── core/             # Core business logic
│   ├── agents/       # Agent framework (not integrated)
│   ├── middleware/   # Express middleware
│   └── services/     # Core services
├── database/         # Database layer
├── shared/           # Shared types and utilities
└── ui/               # React components
    └── components/   # UI components including Walmart

scripts/              # Processing and utility scripts
docs/                 # Documentation (needs accuracy updates)
data/                 # Database files and backups
```

### Agent System (Architecturally Complete)

The following agents are designed but not actively processing emails:

- **MasterOrchestrator** - Designed to coordinate agent activities
- **ResearchAgent** - Web search and information gathering capability
- **EmailAnalysisAgent** - Email processing and classification logic
- **CodeAgent** - Code generation and analysis functions
- **DataAnalysisAgent** - Data processing and insights extraction

**Note**: Routes currently bypass the MasterOrchestrator and agents are not processing the email backlog.

## Development

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production (may fail due to TS errors)
npm run test         # Run test suite
npm run lint         # Run ESLint
npm run typecheck    # Run TypeScript checks (shows 2119 errors)
```

**⚠️ Note**: TypeScript compilation has 2,119 errors but the frontend still builds and runs in development mode.

## API Endpoints

### Core APIs (Functional)
- `/api/health` - System health check
- `/api/agents` - Agent management (agents not processing)
- `/api/emails` - Email operations
- `/api/tasks` - Task management

### tRPC Routers
- Email router - Email data access
- Agent router - Agent status (mock data)
- Walmart router - Grocery operations (needs real data)

**Note**: API endpoints return data but metrics may be inaccurate due to incomplete LLM processing.

## Deployment

**⚠️ Production deployment not recommended until TypeScript errors are resolved**

### Docker Support
- Docker configuration exists but needs testing with current codebase
- See `/deployment/` directory for configuration files

### Current Deployment Blockers
- 2,119 TypeScript compilation errors
- Incomplete LLM integration
- Mock data in Walmart system
- Agent framework not processing emails

## Testing

```bash
npm run test              # Unit tests (coverage incomplete)
npm run test:integration  # Integration tests
npm run test:e2e         # End-to-end tests
```

## Documentation

**⚠️ Note**: Documentation may contain aspirational features not yet implemented. Verify against actual code.

### Available Documentation
- Architecture documentation in `/docs/` directory
- API documentation (may describe unimplemented features)
- Database schema documentation
- Various technical guides (accuracy needs verification)

## Roadmap to Production

### Priority 1: Fix TypeScript Errors
- [ ] Resolve 2,119 compilation errors
- [ ] Ensure clean build for production
- [ ] Fix type mismatches in services

### Priority 2: Complete LLM Integration  
- [ ] Integrate Llama 3.2 into email pipeline
- [ ] Process backlog of 143,835 unprocessed emails
- [ ] Implement Phase 2 and Phase 3 analysis

### Priority 3: Agent Integration
- [ ] Connect routes to MasterOrchestrator
- [ ] Enable agent-based email processing
- [ ] Implement agent coordination logic

### Priority 4: Real Data Integration
- [ ] Replace Walmart mock data with real data
- [ ] Connect to actual Walmart APIs
- [ ] Implement real order tracking

### Priority 5: Production Readiness
- [ ] Complete test coverage
- [ ] Performance optimization
- [ ] Security audit
- [ ] Deployment automation

## Key Metrics Summary

| Metric | Value | Status |
|--------|-------|--------|
| Total Emails in Database | 143,850 | ✅ Stored |
| Emails Processed with LLM | 15 (0.011%) | ❌ Needs Processing |
| TypeScript Errors | 2,119 | ❌ Blocking Production |
| Frontend Components | 266+ | ✅ Building |
| Agent Integration | 0% | ❌ Not Connected |
| Walmart Real Data | 0 orders | ❌ Mock Data Only |
| WebSocket Infrastructure | Ready | ⚠️ Unused |
| Production Ready | No | ❌ Multiple Blockers |

## Contributing

Contributions are welcome! Key areas needing help:
- TypeScript error resolution
- LLM integration completion
- Real data integration for Walmart system
- Test coverage improvement

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

- **Issues**: [GitHub Issues](https://github.com/Pricepro2006/CrewAI_Team/issues)
- **Documentation**: See `/docs/` directory (verify accuracy against code)
- **Current Branch**: fix/typescript-errors-batch-1
