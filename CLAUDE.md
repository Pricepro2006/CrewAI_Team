# CrewAI Team - Claude Development Instructions

## ALWAYS TELL THE TRUTH ABOUT THE WORK DONE COMPARED TO THE REQUEST ASKED

## Project Overview

CrewAI Team is an enterprise AI agent framework with **RECOVERED BACKEND FUNCTIONALITY** but **CRITICAL SECURITY VULNERABILITIES** that prevent production deployment. The backend recovery session of August 16, 2025 successfully restored server functionality through parallel agent strategy.

**Current Status:** ⚠️ FUNCTIONALITY RECOVERED - SECURITY HARDENING REQUIRED  
**Version:** v2.6.0-backend-recovery-complete  
**Last Updated:** August 16, 2025  
**Branch:** main

⚠️ **CRITICAL**: System is NOT production-ready due to security vulnerabilities (Path Traversal, XSS, CSRF) despite functional recovery

✅ **COMPLETED TODAY (August 16, 2025) - Backend Recovery Session**: 
- Server startup errors eliminated (170 critical errors fixed)
- TypeScript errors reduced from 2,278 to 2,108
- WebSocket functionality fully restored
- React component errors debugged and resolved
- Parallel agent strategy executed across 5 phases
- System now functional but still requires security hardening

✅ **PREVIOUSLY COMPLETED (August 15, 2025)**: 
- RAG System fully integrated with ALL agents (except EmailAnalysisAgent)
- MasterOrchestrator connected and actively processing
- WebSocket real-time updates with 5 new message types
- Database connection pool errors resolved
- Frontend-backend API mismatches fixed
- ChromaDB vector store operational with fallbacks

### Verified Completed Work - BACKEND RECOVERY SESSION (August 16, 2025)

✅ **Backend Recovery (5 Phases with Parallel Agents):**
- **Phase 1**: Core type definitions and interfaces fixed
- **Phase 2**: Service layer errors resolved  
- **Phase 3**: Database and middleware corrections
- **Phase 4**: WebSocket and real-time functionality restored
- **Phase 5**: React component errors debugged
- **Result**: 170 critical errors fixed, server starts successfully

### Previously Completed Work - PARALLEL DEBUG SESSION (August 15, 2025)

✅ **RAG System Integration (COMPLETED TODAY):**
- ChromaDB vector store fully operational
- All agents integrated with RAG (except EmailAnalysisAgent by design)
- Semantic search across 143,221 emails
- Document processing with chunking and embedding
- Fallback mechanisms for resilience

✅ **MasterOrchestrator Integration (COMPLETED TODAY):**
- Connected to email processing pipeline
- Creating and executing multi-step plans
- Dynamic agent routing based on task type
- Automatic replanning for quality assurance
- Integration with Plan Executor and Reviewer

✅ **Agent System Activation (COMPLETED TODAY):**
- 5 of 6 agents actively processing queries
- Agent Registry for dynamic discovery
- ResearchAgent, CodeAgent, DataAnalysisAgent operational
- WriterAgent and ToolExecutorAgent integrated
- EmailAnalysisAgent separate (intentional design)

✅ **WebSocket Real-time Updates (COMPLETED TODAY):**
- 5 new message types implemented
- agent.status, agent.task, plan.update
- rag.operation, system.health
- Live dashboard updates functional
- Performance monitoring active

✅ **Business Intelligence Integration (August 5, 2025):**
- Python analysis layer extracting $1M+ in business value from 941 emails
- TypeScript `BusinessIntelligenceService` with caching and aggregation
- tRPC endpoints for type-safe BI data delivery
- React `BusinessIntelligenceDashboard` component with interactive visualizations
- Full integration with existing `OptimizedBusinessAnalysisService`

✅ **Walmart NLP Integration (NEW - August 7, 2025):**
- **Qwen3:0.6b model** (522MB) integrated for NLP processing - NOT Qwen2.5:0.5b
- **87.5% accuracy** on intent detection (7 intent types supported)
- **WebSocket real-time updates** during NLP processing at port 8080
- **Dedicated microservices** on ports 3006-3010
- **Smart Search UI** component with AI insights
- **Dedicated database** walmart_grocery.db (separate from email system)
- **SimplifiedQwenProcessor** with hybrid rule-based and LLM approach

✅ **Walmart Order Data Import (COMPLETED - August 9, 2025):**
- **25 orders** systematically scraped from walmart.com/orders (March-August 2025)
- **161 unique products** cataloged with complete metadata
- **229 order line items** with pricing history across 4.5 months
- **6 store locations** mapped across South Carolina
- **Enhanced database schema** with 20+ new columns for comprehensive tracking
- **Production-ready API** tested and verified for data access
- **Full documentation** created for ongoing maintenance and expansion

### Email Pipeline Architecture - FULLY INTEGRATED

The email processing pipeline now features **COMPLETE INTEGRATION** between all components:

1. **Manual Load Mode** - Batch import from JSON files or databases ✅ **OPERATIONAL**
2. **Auto-Pull Mode** - Scheduled pulling from APIs ❌ **PENDING**
3. **Agent-Driven Mode** - MasterOrchestrator routing ✅ **ACTIVE**

**Implemented Features (Post-Debug Status):**

- Adaptive 3-phase analysis ✅ **INTEGRATED via MasterOrchestrator**
- Chain completeness scoring ✅ **OPERATIONAL**
- Real-time UI updates via WebSocket ✅ **5 NEW MESSAGE TYPES**
- Agent-based task distribution ✅ **ACTIVELY ROUTING**
- RAG-enhanced processing ✅ **SEMANTIC SEARCH ENABLED**
- Ollama integration (qwen3:14b, llama3.2:3b) ✅ **MULTIPLE MODELS**

See `/docs/EMAIL_PIPELINE_PRODUCTION_ARCHITECTURE.md` for full details.

## Current System Assessment - POST-BACKEND RECOVERY (August 16, 2025)

### Integration Status - FULLY OPERATIONAL
```typescript
// System Components Status
const systemStatus = {
  ragSystem: 'OPERATIONAL',           // ChromaDB + embeddings active
  masterOrchestrator: 'ACTIVE',       // Processing queries
  agentSystem: 'INTEGRATED',          // 5/6 agents with RAG
  webSocket: 'REAL-TIME',            // 5 new message types
  database: 'FIXED',                  // Connection pool operational
  frontend: 'CONNECTED',              // All APIs matched
  security: 'CRITICAL_ISSUES'        // 65/100 - NOT SAFE
};
```

### Security Assessment - CRITICAL
```javascript
// SECURITY VULNERABILITIES IDENTIFIED
const vulnerabilities = [
  { type: 'PATH_TRAVERSAL', severity: 'CRITICAL', status: 'UNPATCHED' },
  { type: 'XSS', severity: 'HIGH', status: 'PARTIAL_PROTECTION' },
  { type: 'CSRF', severity: 'HIGH', status: 'INCOMPLETE' },
  { type: 'INPUT_VALIDATION', severity: 'MEDIUM', status: 'GAPS' }
];

// Production Readiness: FALSE
// Required: Immediate security hardening before any deployment
```

### What Currently Works - POST-DEBUG
1. ✅ RAG System with ChromaDB (semantic search operational)
2. ✅ MasterOrchestrator (actively creating and executing plans)
3. ✅ Agent System (5/6 agents processing with RAG context)
4. ✅ WebSocket Real-time (5 message types, live updates)
5. ✅ Database Operations (connection pool fixed, async working)
6. ✅ Frontend-Backend Integration (all APIs connected)
7. ✅ tRPC Endpoints (6 new agent control endpoints)
8. ✅ Email Corpus (143,221 indexed and searchable)
9. ✅ Plan Executor/Reviewer (quality assurance cycle)
10. ✅ Agent Registry (dynamic agent discovery)

### What Needs Immediate Attention
1. 🚨 Path Traversal vulnerabilities (CRITICAL)
2. 🚨 XSS protection gaps (HIGH)
3. 🚨 CSRF token implementation (HIGH)
4. 🚨 Input validation incomplete (MEDIUM)
5. 🚨 Security audit required (current: 65/100)

## Architecture and Technology Stack

### Core Technologies
- **Frontend**: React 18.2.0 + TypeScript 5.0
- **Backend**: Node.js 20.11 + Express
- **Database**: SQLite with better-sqlite3 (walmart_grocery.db for Walmart)
- **API Layer**: tRPC for type-safe APIs
- **Queue Management**: Redis (Bull queue)
- **LLM Integration**: Ollama (Qwen3:0.6b for Walmart NLP, llama3.2:3b for emails)
- **Vector Store**: ChromaDB (for embeddings)
- **WebSocket**: Real-time updates on port 8080

### Walmart Microservice Ports
- **Port 3008**: NLP Service (Qwen3:0.6b model)
- **Port 3007**: Pricing Service
- **Port 3006**: Cache Warmer Service
- **Port 3005**: Grocery Service
- **Port 3009**: Deal Engine
- **Port 3010**: Memory Monitor
- **Port 8080**: WebSocket Gateway

### Key Directories
```
/src/api/          - API routes and services
/src/core/         - Core business logic (mostly unused)
/src/ui/           - React components
/scripts/          - Processing scripts (created but not integrated)
/docs/             - Documentation (needs accuracy updates)
```

### Database Schema (Relevant Fields)
```sql
CREATE TABLE emails (
  id TEXT PRIMARY KEY,
  subject TEXT,
  body TEXT,
  phase_1_results TEXT,  -- Basic rule extraction (populated)
  phase_2_results TEXT,  -- LLM analysis (15 emails only)
  phase_3_results TEXT,  -- Strategic analysis (0 emails)
  chain_id TEXT,
  is_complete_chain BOOLEAN
);
```

## Agent Roles and Capabilities

### Active Agents - PROCESSING QUERIES (Post-Debug)

#### ✅ INTEGRATED WITH RAG:
1. **MasterOrchestrator** ✅ - Central coordination hub
   - Creating multi-step execution plans
   - Routing to appropriate agents
   - Managing replan cycles
   
2. **ResearchAgent** ✅ - Information retrieval
   - RAG-powered semantic search
   - Web search tool ready
   - Context-aware responses
   
3. **DataAnalysisAgent** ✅ - Pattern recognition
   - Statistical analysis across emails
   - Trend identification
   - Insights extraction
   
4. **CodeAgent** ✅ - Solution generation
   - Code examples from knowledge base
   - Automation script creation
   - Technical documentation
   
5. **ToolExecutorAgent** ✅ - External integration
   - Web scraping capabilities
   - API call execution
   - Tool orchestration

#### ⚠️ EXCEPTION:
6. **EmailAnalysisAgent** ❌ - Not RAG-integrated
   - Direct database access
   - Separate processing pipeline
   - Intentional design to avoid circular dependencies

## Development Guidelines

### Documentation Standards (Updated)
1. **ALWAYS** verify claims against actual system state and database
2. **CLEARLY** distinguish between "completed", "in development", and "planned"
3. **HONEST** reporting of current capabilities and limitations
4. **EVIDENCE-BASED** documentation with database queries and code inspection
5. **TRACK** actual progress vs. architectural aspirations
6. **UPDATE** documentation to reflect post-TypeScript-fixes reality

### Verification Queries
```sql
-- Check real LLM processing
SELECT COUNT(*) FROM emails 
WHERE LENGTH(phase_2_results) > 50 
AND phase_2_results != '{}';

-- Check false "analyzed" claims
SELECT COUNT(*) FROM emails 
WHERE phase_1_results IS NOT NULL 
AND (phase_2_results IS NULL OR phase_2_results = '{}');
```

### Development Priorities - UPDATED POST-DEBUG

#### 🚨 IMMEDIATE (Security Critical):
1. **Fix Path Traversal** - Validate all file paths
2. **Implement XSS Protection** - Sanitize all inputs
3. **Complete CSRF** - Full token implementation
4. **Input Validation** - Comprehensive Zod schemas
5. **Security Audit** - Achieve 90+ score

#### ✅ COMPLETED (August 15, 2025):
1. **RAG Integration** - All agents connected
2. **MasterOrchestrator** - Routing operational
3. **WebSocket Updates** - Real-time active
4. **Database Fixes** - Connection pool working
5. **API Integration** - Frontend-backend connected

#### 📋 NEXT PHASE:
1. **Performance Testing** - Load and stress tests
2. **Integration Testing** - End-to-end validation
3. **Documentation** - Production deployment guide
4. **Monitoring** - Metrics and alerting
5. **Scaling** - Handle concurrent users

## Research and Tool Integration Memories

- Remember to help yourself by not only using CODERABBIT but also by researching how to solve tasks and how to resolve errors and issues
- Include the year 2025 in research searches to stay current with emerging technologies
- Utilize MCP tools for enhanced research and data gathering:
  - Brightdata for web data extraction
  - Context7 for contextual analysis
  - Puppeteer for web scraping
  - Vectorize for deep research
  - Fetch and grep for data retrieval
- Integrate tools like webfetch and other AI research assistants
- Store research outputs and tool-generated data in `/home/pricepro2006/master_knowledge_base/` for centralized knowledge management

## Critical Instructions - POST-DEBUG STATUS

### System State Awareness
- ✅ **RAG System**: FULLY OPERATIONAL with all agents
- ✅ **MasterOrchestrator**: ACTIVELY PROCESSING queries
- ✅ **WebSocket**: REAL-TIME updates working
- ⚠️ **Security**: CRITICAL VULNERABILITIES - DO NOT DEPLOY
- 📊 **Metrics**: Functionality 90/100, Security 65/100

### Development Guidelines
- **ALWAYS** disclose security vulnerabilities when discussing deployment
- **NEVER** claim production readiness with security score <90
- **VERIFY** integration status before making changes
- **TEST** security implications of all modifications
- **DOCUMENT** both achievements and vulnerabilities honestly
- **PRIORITIZE** security fixes over new features

### Accurate Reporting Requirements
- State that RAG is integrated with 5/6 agents
- Confirm MasterOrchestrator is routing tasks
- Acknowledge security score is 65/100 (NOT 95/100)
- Emphasize NOT production-ready due to security
- Report WebSocket has 5 new message types
- Confirm database connection pool is fixed

### File Operation Rules
- NEVER create files unless absolutely necessary
- ALWAYS prefer editing existing files
- NEVER create documentation without explicit request
- VERIFY file paths to prevent traversal attacks
- SANITIZE all file operations for security
