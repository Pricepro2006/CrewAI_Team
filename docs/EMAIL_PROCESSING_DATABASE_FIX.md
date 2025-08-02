# Email Processing Database Fix Plan

## Problem Summary

The email processing pipeline is failing due to database schema mismatches:

1. `EmailThreePhaseAnalysisService` is trying to save to deprecated `email_analysis` table in `crewai.db`
2. Scripts are mixing enhanced and legacy database schemas
3. Foreign key constraints failing because tables don't exist in the same database

## Root Cause

- **crewai.db** (LEGACY) - Old schema with `emails` table
- **crewai_enhanced.db** (CURRENT) - New schema with `emails_enhanced` table
- Services are trying to use both databases simultaneously

## Solution Architecture

### Phase 1: Update EmailThreePhaseAnalysisService

- Modify to read and write to `emails_enhanced` table only
- Remove dependency on separate `email_analysis` table
- Update analysis results directly in source records

### Phase 2: Create Unified Processing Script

- Single database approach using `crewai_enhanced.db`
- Proper error handling and progress tracking
- Batch processing with memory management

### Phase 3: Implement Full Pipeline

- Process all 36,327 emails across 16,074 conversations
- Apply adaptive 3-phase analysis based on chain completeness
- Track quality metrics and performance

## Implementation Steps

1. **Fix Database Service** ✅
   - Update EmailThreePhaseAnalysisService constructor
   - Modify saveAnalysis to update emails_enhanced
   - Remove foreign key dependencies

2. **Create Processing Script** 🔄
   - Use only crewai_enhanced.db
   - Implement proper chain analysis
   - Add JSON formatting for LLM calls

3. **Run Full Processing** ⏳
   - Process in batches to manage memory
   - Monitor CPU/memory usage
   - Track success/failure rates

## Expected Outcomes

- All emails analyzed with proper JSON responses
- Chain completeness scores properly calculated
- Workflow intelligence extracted from complete chains
- No database errors or foreign key constraints

## Monitoring Plan

- Real-time progress updates every 100 conversations
- Quality metrics tracking
- Error logging with recovery mechanisms
- Performance benchmarking

---

Last Updated: 2025-08-01T21:00:00Z
