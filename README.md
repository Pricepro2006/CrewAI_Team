# CrewAI Team - Enterprise AI Agent Framework

⚠️ **IMPORTANT: This system is currently a FRAMEWORK ONLY - LLM processing is NOT operational** ⚠️

A well-architected enterprise AI agent framework **designed for** comprehensive email intelligence, Walmart grocery automation, and advanced workflow orchestration.

<!-- Test change for pre-commit hook verification -->

![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![React](https://img.shields.io/badge/React-18.2-61dafb)
![Node.js](https://img.shields.io/badge/Node.js-20.11-green)
![SQLite](https://img.shields.io/badge/SQLite-3.44-003B57)
![Status](https://img.shields.io/badge/Status-Framework_Only-orange)
![Phase](https://img.shields.io/badge/LLM_Processing-Not_Implemented-red)

## Overview

CrewAI Team is an **architectural framework** for a multi-agent AI system designed for enterprise-scale operations. It includes the **design** for intelligent email processing, automated workflow management, and business system integration.

### ⚠️ Current Status: Framework Ready, Core Features Pending

**CRITICAL**: Previous documentation claimed operational status. Database analysis reveals:

- ❌ **Email Pipeline NOT Operational** - Only 15 of 132,084 emails (0.011%) processed with LLM
- ❌ **NO Real-Time Processing** - Scripts created but not integrated into production
- ❌ **Basic Rule Processing Only** - 99.99% of emails have only simple workflow states
- ✅ **Framework Architecture Complete** - Well-designed 3-phase system ready for implementation
- ✅ **Data Foundation Ready** - 143,850 emails properly stored and indexed

See `/docs/ACTUAL_PROJECT_STATUS_AUGUST_2025.md` for verified metrics.

### Email Pipeline Architecture (DESIGN ONLY - NOT IMPLEMENTED)

The email pipeline **design** includes an **adaptive three-phase analysis system** intended to support multiple operational modes:

#### Designed Operational Modes (NOT YET IMPLEMENTED)

1. **Manual Load Mode** - Batch import from JSON files or existing databases ✅ (Data loaded)
2. **Auto-Pull Mode** - Scheduled pulling every 1-60 minutes from email providers ❌ (Not built)
3. **Hybrid Mode** - Concurrent manual and auto operations with priority management ❌ (Not built)

#### Adaptive Strategy

- **Complete Email Chains (70%+ completeness)**: Full three-phase analysis for maximum workflow intelligence
- **Incomplete Chains (<70% completeness)**: Two-phase analysis for efficiency
- **Time Savings**: 62% reduction in processing time while maintaining quality
- **Workflow Learning**: Extracts reusable templates from complete customer journeys
- **Performance**: 60+ emails/minute with parallel processing (target)

#### Phase 1: Rule-Based Triage + Chain Analysis (< 1 second)

- Email chain completeness detection (NEW)
- Workflow state identification (START_POINT, IN_PROGRESS, COMPLETION)
- Entity extraction (PO numbers, quotes, cases, parts, amounts)
- Priority calculation and urgency scoring
- Sender categorization (key_customer, internal, partner, standard)
- Financial impact assessment

#### Phase 2: LLM Enhancement with Llama 3.2 (DESIGNED - NOT IMPLEMENTED)

**STATUS**: Only 15 emails (0.011%) have received this processing

- Validates and corrects Phase 1 findings ❌
- Discovers missed entities and relationships ❌
- Identifies specific action items with owners and deadlines ❌
- Assesses business risk and opportunities ❌
- Generates initial response suggestions ❌
- Extracts all business requirements ❌
- **Quality Score: N/A - Not tested at scale**

#### Phase 3: Strategic Analysis with Phi-4 (NOT IMPLEMENTED)

**STATUS**: No emails have received Phase 3 processing

- Executive-level strategic insights ❌
- Cross-email pattern recognition ❌
- Competitive intelligence extraction ❌
- Revenue maximization opportunities ❌
- Workflow optimization recommendations ❌
- Predictive next steps and bottleneck analysis ❌
- **Quality Score: N/A - Never implemented**

#### Critical Issues Resolved

**Email & Walmart Component Integration:**

- Fixed browser compatibility by creating custom logger (`/src/ui/utils/logger.ts`)
- Resolved "path.join is not a function" error affecting UI components
- Implemented proper ES module imports with `.js` extensions
- Created empty polyfills for Node.js modules (`fs`, `path`, `crypto`)
- Fixed Vite configuration for module externalization

**Real Data Loading Implementation:**

- Transitioned from 100% static to 95% dynamic data across all components
- Email Dashboard: Real-time database integration with live analytics
- Walmart Grocery Agent: All 13 components now use live API data
- Agents Page: Real-time status monitoring with auto-refresh
- Dashboard: Live health metrics and system statistics

### Designed Features (Implementation Status)

- **Multi-Agent Architecture** - Framework created, agents not processing emails ⚠️
- **Email Intelligence** - Basic rule extraction only (0.011% with AI analysis) ❌
- **Walmart Integration** - UI components created, backend integration pending ⚠️
- **Local-First Design** - Ollama integration designed but not deployed ❌
- **TypeScript Architecture** - End-to-end type safety implemented ✅
- **Real-Time Updates** - WebSocket infrastructure ready, no live processing ⚠️
- **Security-First** - Security middleware implemented ✅
- **Browser Compatibility** - Compatibility issues resolved ✅

### Email Pipeline Features (DESIGNED BUT NOT OPERATIONAL)

- **Adaptive Three-Phase Analysis** - Designed, not implemented ❌
- **Chain Completeness Detection** - Analysis complete, 29,495 chains scored ✅
- **Batch Processing** - Scripts created, not in production ❌
- **Smart Caching** - Infrastructure ready, not utilized ⚠️
- **Event-Driven Architecture** - Framework ready, no events flowing ❌
- **Health Monitoring** - Endpoints exist but report false metrics ⚠️
- **Time Optimization** - Theoretical calculation only ❌
- **Workflow Intelligence** - Basic states only (START/PROGRESS/COMPLETE) ⚠️
- **Production Scripts** - Created but not integrated into pipeline ⚠️

## Getting Started

### Prerequisites

- Node.js 20.11 or higher
- SQLite 3.44 or higher
- Redis (for queue management)
- Ollama (for local LLM inference with llama3.2:3b model)
- ChromaDB (for vector operations using llama3.2:3b embeddings)
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
DATABASE_PATH=./data/crewai.db
REDIS_URL=redis://localhost:6379
OLLAMA_HOST=http://localhost:11434
CHROMADB_URL=http://localhost:8000
NODE_ENV=development
PORT=3001
```

**Note:** The database path has been updated to use `crewai.db` for consistency with the Phase 4 real data integration.

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
    ├── Ollama (LLM - local inference with llama3.2:3b)
    ├── ChromaDB (Vector operations - using llama3.2:3b embeddings)
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
scripts/
├── email-extraction/  # Email extraction and processing scripts
│   ├── app_auth.py                      # Client credentials authentication
│   ├── fixed_device_auth.py             # Interactive device authentication
│   ├── refresh_token.py                 # Token refresh utility
│   ├── run_with_auth.sh                 # Main extraction entry point
│   ├── run_comprehensive_extraction.sh  # Full email extraction
│   ├── run_email_batching.sh            # Create 5-email JSON batches
│   └── extract_all_2025.py              # Extract emails from 2025 onwards
```

### Email Extraction Scripts

The `scripts/email-extraction/` directory contains tools for extracting emails from Microsoft Graph API:

#### Authentication

- **app_auth.py** - Uses client credentials flow with secrets from `.env`
- **fixed_device_auth.py** - Interactive authentication via https://microsoft.com/devicelogin
- **refresh_token.py** - Refreshes expired access tokens

#### Extraction

- **run_with_auth.sh** - Main entry point that checks authentication and runs extraction
- **run_comprehensive_extraction.sh** - Extracts all emails from all folders
- **extract_all_2025.py** - Python script to extract emails from 2025 onwards

#### Batching

- **run_email_batching.sh** - Creates JSON files with 5 emails each for processing
- **comprehensive_email_batcher.py** - Python implementation of email batching

#### Usage

```bash
# Authenticate and extract emails
./scripts/email-extraction/run_with_auth.sh --start-date 2025-05-22T00:00:00Z

# Create email batches for analysis
./scripts/email-extraction/run_email_batching.sh
```

## API Documentation

The system provides a comprehensive REST and tRPC API:

- `/api/health` - System health check
- `/api/health/email-pipeline` - Email pipeline health monitoring
- `/api/agents` - Agent management
- `/api/emails` - Email operations
- `/api/tasks` - Task management
- `/api/email-analysis` - Email analysis results
- `/api/workflow-stats` - Workflow statistics and analytics

### Email Pipeline Endpoints

#### Health Check

```bash
GET /api/health/email-pipeline

Response:
{
  "status": "healthy",
  "timestamp": "2025-01-30T12:00:00Z",
  "database": { "connected": true, "emailCount": 51796 },
  "redis": { "connected": true, "queueLength": 0 },
  "pipeline": { "active": true, "batchesProcessed": 245 }
}
```

#### Email Analysis Stats

```bash
GET /api/email-analysis/stats

Response:
{
  "totalAnalyzed": 12453,
  "byWorkflow": {
    "return_merchandise": 3421,
    "quote_to_order": 2156,
    "order_processing": 4532,
    "general_inquiry": 2344
  },
  "byPriority": {
    "critical": 512,
    "high": 2341,
    "medium": 7823,
    "low": 1777
  }
}
```

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

### UI Components Fixed

**Email Dashboard Components:**

- `EmailDashboard.tsx` - Database integration with real-time analytics
- `EmailStats.tsx` - Live metrics from crewai.db
- `EmailList.tsx` - Dynamic email data with 5-second refresh
- `EmailFilters.tsx` - API-powered filtering system

**Walmart Grocery Components (13 Total):**

- `WalmartBudgetTracker.tsx` - Real-time budget calculations
- `WalmartProductSearch.tsx` - Live API product search
- `WalmartShoppingCart.tsx` - Persistent cart with real data
- `WalmartDealAlert.tsx` - Live deal notifications
- `WalmartOrderHistory.tsx` - Actual transaction history
- _...and 8 more components with full API integration_

### Critical Fixes Applied

1. **Logger Error:** Fixed `TypeError: path.join is not a function`
2. **Module Loading:** Resolved browser incompatibility with Node.js modules
3. **Import Resolution:** Added `.js` extensions to all imports
4. **Backend Stability:** Fixed server cleanup infinite loop
5. **Data Loading:** Implemented 95% dynamic data replacement

### Performance Improvements

- **TypeScript Errors** - Reduced from 726 to 0 blocking errors
- **UI Load Time** - Optimized with Vite bundling and code splitting
- **API Response** - 5-second polling with intelligent caching
- **Memory Management** - No memory leaks detected
- **Error Handling** - Comprehensive error boundaries and recovery

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

- Documentation: [docs/](docs/)
- Issues: [GitHub Issues](https://github.com/Pricepro2006/CrewAI_Team/issues)
- Email: support@crewai-team.com

# Test
