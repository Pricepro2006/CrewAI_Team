# Script Inventory and Usage Documentation

## Executive Summary

This document provides a comprehensive inventory of all scripts in the CrewAI Team project, their intended purpose, actual usage status, and recommendations for implementing the designed email processing system.

**Key Finding**: Multiple sophisticated LLM processing scripts were created but never integrated into production. Only basic data import and chain analysis scripts were actually used.

## Script Categories

### 1. EMAIL DATA IMPORT SCRIPTS ✅ (USED IN PRODUCTION)

#### consolidate-all-emails.py
- **Location**: `/scripts/`
- **Purpose**: Consolidate emails from multiple JSON sources
- **Status**: ✅ USED - Successfully imported 143,850 emails
- **Output**: Unified email dataset in SQLite database
- **Usage**: 
  ```bash
  python scripts/consolidate-all-emails.py
  ```

#### consolidate-all-emails-preserve-format.py
- **Location**: `/scripts/`
- **Purpose**: Enhanced version preserving original JSON format
- **Status**: ✅ USED - Alternative consolidation approach
- **Usage**: Preserves Microsoft Graph API structure

#### import_chain_analysis_robust.py
- **Location**: `/scripts/`
- **Purpose**: Import chain analysis results to database
- **Status**: ✅ USED - Imported 29,495 chain analyses
- **Fields Updated**: chain_id, completeness_score, is_complete_chain

### 2. CHAIN ANALYSIS SCRIPTS ✅ (PARTIALLY USED)

#### simple_chain_summary.py
- **Location**: `/scripts/`
- **Purpose**: Analyze email chains and calculate completeness
- **Status**: ✅ USED - Analyzed 29,495 chains
- **Output**: Chain completeness scores (9.3% complete chains)
- **Key Metrics**:
  - Total chains: 29,495
  - Complete chains (>70%): 2,745
  - Average completeness: 31.2%

#### analyze-email-chains.py
- **Location**: `/scripts/`
- **Purpose**: Detailed chain analysis with workflow detection
- **Status**: ⚠️ CREATED but limited use
- **Features**: Workflow state detection, participant analysis

### 3. LLM PROCESSING SCRIPTS ❌ (CREATED BUT NOT USED)

#### claude_opus_llm_processor.py ⭐
- **Location**: `/scripts/`
- **Purpose**: Sophisticated business intelligence extraction
- **Status**: ❌ TESTED ON 15 EMAILS ONLY (0.011%)
- **Features**:
  - Business insights extraction
  - Action item identification
  - Financial impact analysis
  - Risk assessment
  - Workflow optimization recommendations
- **Sample Output**: High-quality structured JSON with comprehensive analysis
- **Why Not Used**: Never integrated into production pipeline

#### robust_llm_processor.py ⭐⭐
- **Location**: `/scripts/`
- **Purpose**: Production-ready LLM processing with error handling
- **Status**: ❌ NEVER USED IN PRODUCTION
- **Features**:
  - Batch processing capability
  - Error recovery and retries
  - Progress tracking
  - Quality validation
  - Database integration
- **Recommendation**: USE THIS for processing backlog

#### run_adaptive_pipeline.py
- **Location**: `/scripts/`
- **Purpose**: Implement 3-phase adaptive processing
- **Status**: ❌ DESIGN DOCUMENT in code form
- **Features**:
  - Phase selection based on chain completeness
  - Performance optimization
  - Parallel processing support

#### run_real_llm_pipeline.py
- **Location**: `/scripts/`
- **Purpose**: Real LLM integration with Ollama
- **Status**: ❌ CREATED but never executed at scale
- **Dependencies**: Requires Ollama with llama3.2:3b

#### deploy-claude-opus-processing.py
- **Location**: `/scripts/`
- **Purpose**: Deploy production processing pipeline
- **Status**: ❌ DEPLOYMENT SCRIPT never used
- **Features**: Orchestration, monitoring, scaling

### 4. MONITORING AND VALIDATION SCRIPTS ⚠️

#### monitor_processing.py
- **Location**: `/scripts/`
- **Purpose**: Monitor processing progress
- **Status**: ⚠️ CREATED but no processing to monitor
- **Features**: Real-time metrics, error tracking

#### validate_import_status.py
- **Location**: `/scripts/`
- **Purpose**: Validate email import quality
- **Status**: ⚠️ PARTIALLY USED
- **Output**: Import statistics and data quality metrics

#### claude-opus-status-monitor.py
- **Location**: `/scripts/`
- **Purpose**: Monitor Claude Opus-style processing
- **Status**: ❌ NO PROCESSING to monitor

### 5. DATABASE MANAGEMENT SCRIPTS ✅

#### database-admin-tools.ts
- **Location**: `/scripts/`
- **Purpose**: Database administration utilities
- **Status**: ✅ USED for schema management
- **Features**: Migration, indexing, optimization

#### update_schema.sql
- **Location**: `/scripts/`
- **Purpose**: SQL schema updates
- **Status**: ✅ APPLIED to database
- **Changes**: Added phase result columns, chain fields

### 6. UTILITY SCRIPTS ⚠️

#### reset_failed_emails.py
- **Location**: `/scripts/`
- **Purpose**: Reset failed email processing status
- **Status**: ⚠️ CREATED for error recovery
- **Usage**: Would reset processing flags for retry

#### import_and_process_emails.py
- **Location**: `/scripts/`
- **Purpose**: Combined import and process workflow
- **Status**: ❌ ATTEMPTED but failed due to missing LLM integration

## Script Execution Status Summary

| Category | Total Scripts | Used | Partially Used | Never Used |
|----------|--------------|------|----------------|------------|
| Data Import | 3 | 3 | 0 | 0 |
| Chain Analysis | 2 | 1 | 1 | 0 |
| LLM Processing | 5 | 0 | 1* | 4 |
| Monitoring | 3 | 0 | 1 | 2 |
| Database | 2 | 2 | 0 | 0 |
| Utility | 2 | 0 | 1 | 1 |
| **TOTAL** | **17** | **6** | **4** | **7** |

*claude_opus_llm_processor.py tested on 15 emails only

## Critical Scripts for Implementation

### Priority 1: Immediate Use
1. **robust_llm_processor.py** - Ready for production use
   - Handles batch processing
   - Includes error recovery
   - Database integrated
   - Quality validation built-in

### Priority 2: Integration Required
1. **run_adaptive_pipeline.py** - Needs connection to robust processor
2. **monitor_processing.py** - Essential for tracking progress
3. **deploy-claude-opus-processing.py** - For production deployment

### Priority 3: Enhancement Scripts
1. **analyze-email-chains.py** - For better chain intelligence
2. **validate_import_status.py** - For quality assurance

## Recommended Implementation Path

### Week 1: Foundation
```bash
# 1. Test robust processor on 100 emails
python scripts/robust_llm_processor.py --limit 100

# 2. Verify quality meets standards
python scripts/validate_import_status.py

# 3. Set up monitoring
python scripts/monitor_processing.py
```

### Week 2: Scale Up
```bash
# 1. Process 10,000 emails
python scripts/robust_llm_processor.py --limit 10000 --batch-size 100

# 2. Monitor progress and quality
python scripts/monitor_processing.py --real-time

# 3. Handle any failures
python scripts/reset_failed_emails.py
python scripts/robust_llm_processor.py --retry-failed
```

### Week 3-4: Full Deployment
```bash
# 1. Deploy production pipeline
python scripts/deploy-claude-opus-processing.py

# 2. Process remaining 122k emails
python scripts/run_adaptive_pipeline.py --all-emails

# 3. Continuous monitoring
python scripts/claude-opus-status-monitor.py
```

## Script Dependencies

### System Requirements
- Python 3.10+
- Node.js 20.11+
- SQLite 3.44+
- Redis (for queue management)
- Ollama with llama3.2:3b model

### Python Package Dependencies
```txt
pandas>=2.0.0
sqlite3 (built-in)
asyncio (built-in)
requests>=2.31.0
python-dotenv>=1.0.0
tqdm>=4.65.0
numpy>=1.24.0
```

### Environment Variables Required
```env
DATABASE_PATH=./data/crewai.db
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3.2:3b
REDIS_URL=redis://localhost:6379
LOG_LEVEL=INFO
BATCH_SIZE=100
MAX_WORKERS=4
```

## Common Issues and Solutions

### Issue 1: LLM Timeout
**Script**: robust_llm_processor.py  
**Error**: "LLM request timed out"  
**Solution**: Reduce batch size, increase timeout, or use simpler prompts

### Issue 2: Memory Overflow
**Script**: run_adaptive_pipeline.py  
**Error**: "Out of memory"  
**Solution**: Process in smaller batches, enable streaming mode

### Issue 3: Database Lock
**Script**: import_chain_analysis_robust.py  
**Error**: "Database is locked"  
**Solution**: Ensure single process access, use WAL mode

## Verification Queries

### Check Script Results
```sql
-- Verify import success
SELECT COUNT(*) as total_emails FROM emails;
-- Expected: 143,850

-- Check LLM processing
SELECT COUNT(*) FROM emails 
WHERE phase_2_results IS NOT NULL 
AND phase_2_results != '{}' 
AND LENGTH(phase_2_results) > 50;
-- Current: 15 (should be 132,084 after implementation)

-- Verify chain analysis
SELECT COUNT(DISTINCT chain_id) as total_chains FROM emails;
-- Expected: 29,495
```

## Conclusion

The CrewAI Team project has all necessary scripts created but lacks production integration. The immediate action is to use `robust_llm_processor.py` to process the 132,069 email backlog and implement proper monitoring to ensure accurate status reporting.

**Next Step**: Execute the Week 1 Foundation plan immediately.

---

**Document Version**: 1.0  
**Created**: August 5, 2025  
**Purpose**: Accurate script inventory for implementation team