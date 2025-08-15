# CrewAI Team - Claude Development Instructions

## ALWAYS TELL THE TRUTH ABOUT THE WORK DONE COMPARED TO THE REQUEST ASKED

## Project Overview

CrewAI Team is an enterprise AI agent framework with a **stable build foundation** and an adaptive three-phase email analysis system for intelligent email chain processing based on completeness scoring.

**Current Status:** ✅ BUILD STABLE - CORE FUNCTIONALITY IN DEVELOPMENT  
**Version:** v2.4.0  
**Last Updated:** August 15, 2025  
**Branch:** main

✅ **MAJOR UPDATES**: TypeScript build errors resolved (87.7% reduction), security hardening complete (95/100 score), foundation ready for core functionality development.

✅ **NEW**: Business Intelligence Dashboard fully integrated and operational
✅ **NEW**: Walmart NLP integration with Qwen3:0.6b model (87.5% accuracy)
✅ **COMPLETED (August 9, 2025)**: Walmart order import - 25 orders, 161 unique products, 229 line items in production database

### Verified Completed Work (August 15, 2025)

✅ **Build System & Development Foundation:**
- TypeScript compilation stabilized (2,119 → 263 errors, 87.7% reduction)
- Production-ready build system for both frontend and backend
- Secure development environment established
- Git workflows optimized for accurate progress tracking

✅ **Security Implementation:**
- Production-ready security score (95/100)
- Comprehensive input validation with Zod
- Secure authentication and session management
- Hardened WebSocket and API endpoints

✅ **Email Data Management:**
- 143,221 unique emails consolidated from multiple sources  
- 29,495 email chains analyzed with completeness scoring
- Database schema enhanced with proper indexes and chain fields
- Async database operations implemented

✅ **Framework Development:**
- Adaptive 3-phase processing pipeline **designed and partially implemented**
- LLM integration foundation **established** with 426 emails processed
- Business intelligence extraction framework **architected**
- Agent system framework **ready for integration**

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

### Email Pipeline Architecture (DESIGN)

The email processing pipeline **design** supports three operational modes:

1. **Manual Load Mode** - Batch import from JSON files or databases ✅ **IMPLEMENTED**
2. **Auto-Pull Mode** - Scheduled pulling from Microsoft Graph/Gmail APIs ❌ **PENDING**
3. **Hybrid Mode** - Concurrent manual and auto operations ❌ **PENDING**

**Designed Features (Implementation Status):**

- Adaptive 3-phase analysis (Rule-based → Llama 3.2 → Phi-4) ❌ **PENDING LLM INTEGRATION**
- Chain completeness scoring for workflow detection ✅ **ANALYSIS COMPLETE**
- Real-time UI updates via WebSocket ❌ **PENDING**
- Priority queue management ❌ **PENDING**
- Processing capability targets: 60+ emails/minute ❌ **UNTESTED**
- Unified model approach: Llama 3.2:3b for both LLM and embeddings ❌ **PENDING**

See `/docs/EMAIL_PIPELINE_PRODUCTION_ARCHITECTURE.md` for full details.

## Current System Assessment - August 15, 2025

### Database Processing Status
```sql
-- Emails with actual LLM processing: 426 (0.3%)
-- Emails with Phase 1 (rule-based): 143,221 (100%)
-- Phase 2 in active development - scaling from 426 to full backlog
-- Frontend shows honest metrics reflecting actual processing status
```

### Development Infrastructure Status
1. ✅ **Build System**: TypeScript compilation successful, production-ready
2. ✅ **Security Layer**: Comprehensive security implementation (95/100 score)
3. ✅ **Database Layer**: Async operations, proper indexing, stable connections
4. ✅ **Frontend**: React components build and run successfully
5. ✅ **API Layer**: tRPC endpoints functional with type safety

### What Currently Works
1. ✅ Email data consolidation (143,221 emails stored)
2. ✅ Chain completeness analysis (29,495 chains)
3. ✅ Rule-based entity extraction (100% coverage)
4. ✅ Database structure and async operations
5. ✅ Frontend UI with honest metrics
6. ✅ WebSocket infrastructure (real-time capable)
7. ✅ Security middleware and validation

### What's In Development
1. 🚧 LLM email processing (scaling from 426 to full backlog)
2. 🚧 Business intelligence extraction (foundation implemented)
3. 🚧 Agent system integration (MasterOrchestrator connection)
4. 🚧 Real-time processing pipeline
5. 🚧 Advanced analytics and insights

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

### Designed Agents (Not Processing Emails)
1. **MasterOrchestrator** - Supposed to coordinate email analysis
2. **EmailAnalysisAgent** - Should extract business intelligence
3. **ResearchAgent** - Intended for web research on entities
4. **DataAnalysisAgent** - Meant to find patterns across emails
5. **CodeAgent** - For generating automation scripts

### Current Reality
Agents exist as code structures but are not actively processing the email backlog. Only basic rule-based extraction is running.

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

### Development Priorities
1. ✅ **Completed**: Stabilized build system and security foundation
2. 🚧 **Active**: Scale LLM processing from 426 to full email backlog
3. 🚧 **Active**: Integrate Agent system with MasterOrchestrator routing
4. 📋 **Planned**: Real-time processing with WebSocket updates
5. 📋 **Planned**: Advanced business intelligence features

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

## Important Instruction Reminders
- Do what has been asked; nothing more, nothing less
- NEVER create files unless they're absolutely necessary for achieving your goal
- ALWAYS prefer editing an existing file to creating a new one
- NEVER proactively create documentation files (*.md) or README files unless explicitly requested
- ALWAYS verify database state before making claims about system functionality
- DISTINGUISH clearly between "designed", "created", and "operational" features
