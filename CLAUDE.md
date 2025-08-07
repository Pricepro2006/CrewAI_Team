# CrewAI Team - Claude Development Instructions

## ALWAYS TELL THE TRUTH ABOUT THE WORK DONE COMPARED TO THE REQUEST ASKED

## Project Overview

CrewAI Team is an enterprise AI agent framework with a **designed** adaptive three-phase email analysis system for intelligent email chain processing based on completeness scoring.

**Current Status:** ⚠️ FRAMEWORK READY - LLM INTEGRATION PENDING  
**Version:** v2.3.0  
**Last Updated:** August 7, 2025  
**Branch:** main-consolidated

⚠️ **ACCURACY NOTICE**: Previous false completion claims have been corrected. See `/docs/ACTUAL_PROJECT_STATUS_AUGUST_2025.md` for verified status.

✅ **NEW**: Business Intelligence Dashboard fully integrated and operational
✅ **NEW**: Walmart NLP integration with Qwen3:0.6b model (87.5% accuracy)

### Verified Completed Work (August 7, 2025)

✅ **Email Data Management:**
- 143,850 unique emails consolidated from multiple sources  
- 29,495 email chains analyzed with completeness scoring
- Database schema enhanced with proper indexes and chain fields

✅ **Framework Development:**
- Adaptive 3-phase processing pipeline **designed**
- LLM integration scripts **created** (claude_opus_llm_processor.py)
- Business intelligence extraction framework **architected**
- Git version control standards established for accuracy

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

## Critical Findings - August 5, 2025

### Database Reality Check
```sql
-- Emails with actual LLM processing: 15 (0.011%)
-- Emails with empty Phase 2: 31,674 (23.98%)
-- Emails with NULL Phase 2: ~100,000 (75.73%)
-- Frontend shows "analyzed": 132,084 (FALSE - only rule-based)
```

### Scripts Created but Not Used in Production
1. `claude_opus_llm_processor.py` - Tested on 15 emails only
2. `robust_llm_processor.py` - Never used
3. `run_adaptive_pipeline.py` - Design document in code form
4. `run_real_llm_pipeline.py` - Not integrated

### What Actually Works
1. Email data consolidation (143,850 emails stored)
2. Chain completeness analysis (29,495 chains)
3. Basic rule-based entity extraction
4. Database structure and indexes
5. Frontend UI (but showing false metrics)

### What Doesn't Work
1. LLM email processing (99.99% unprocessed)
2. Business intelligence extraction
3. Action item identification
4. Financial analysis
5. Strategic insights
6. Real-time processing pipeline
7. Accurate metrics in UI

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

### Accuracy Standards (Updated)
1. **ALWAYS** verify claims against database before documenting
2. **NEVER** claim features work without production evidence
3. **CLEARLY** distinguish between "designed" and "implemented"
4. **USE** verification queries to check actual processing status
5. **DOCUMENT** the difference between test runs and production

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

### Priority Actions
1. **Immediate**: Fix UI to show real metrics (15 processed, not 132k)
2. **Short-term**: Implement production LLM processing pipeline
3. **Long-term**: Actually deliver on the designed features

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
