# Option C Implementation Checklist

## Pre-Implementation Verification

- [x] Pipeline saves data with INSERT OR REPLACE (fixed)
- [x] All 33,797 emails have analysis records in email_analysis table
- [x] JSON data structure documented from Stage 2 and Stage 3
- [ ] EmailStorageService schema requirements documented

## Phase 1: Create Core Types and Interfaces

### 1.1 Pipeline Data Types

- [ ] Create `/src/types/pipeline-analysis.ts`
  ```typescript
  export interface PipelineEmailAnalysis {
    id: number;
    email_id: string;
    pipeline_stage: number;
    pipeline_priority_score: number;
    llama_analysis: string | null;
    phi4_analysis: string | null;
    final_model_used: string;
    analysis_timestamp: string;
  }
  ```

### 1.2 Analysis Result Types

- [ ] Create `/src/types/analysis-results.ts`

  ```typescript
  export interface LlamaAnalysisData {
    workflow_state: string;
    business_process: string;
    intent: string;
    urgency_level: string;
    entities: {
      po_numbers: string[];
      quote_numbers: string[];
      case_numbers: string[];
      part_numbers: string[];
      companies: string[];
    };
    contextual_summary: string;
    action_items: Array<{
      task: string;
      priority: string;
      deadline?: string;
    }>;
    suggested_response?: string;
    quality_score: number;
  }

  export interface Phi4AnalysisData {
    executive_summary: string;
    business_impact: {
      revenue_impact?: number;
      customer_satisfaction: string;
      urgency_reason: string;
    };
    sla_assessment: string;
    deep_insights: string[];
    quality_score: number;
  }
  ```

## Phase 2: Implement JSON Parser Service

### 2.1 Create PipelineJsonParser

- [ ] Create `/src/services/PipelineJsonParser.ts`
- [ ] Implement safe JSON parsing with validation
- [ ] Add comprehensive error handling
- [ ] Create default value factories
- [ ] Add logging for parse failures

### 2.2 Parser Methods to Implement

- [ ] `parseLlamaAnalysis(jsonStr: string | null): Partial<LlamaAnalysisData>`
- [ ] `parsePhi4Analysis(jsonStr: string | null): Partial<Phi4AnalysisData>`
- [ ] `extractEntities(llamaData: Partial<LlamaAnalysisData>): EmailAnalysisResult['deep']['entities']`
- [ ] `mapWorkflowState(state: string): string`
- [ ] `mapPriorityScore(score: number): 'Critical' | 'High' | 'Medium' | 'Low'`

## Phase 3: Create Pipeline Adapter

### 3.1 Implement PipelineAnalysisAdapter

- [ ] Create `/src/adapters/PipelineAnalysisAdapter.ts`
- [ ] Implement `DatabaseAdapter<PipelineEmailAnalysis, EmailAnalysisResult>` interface
- [ ] Create mapping methods:
  - [ ] `mapQuickAnalysis(row: PipelineEmailAnalysis, llama?: LlamaAnalysisData): QuickAnalysis`
  - [ ] `mapDeepAnalysis(llama?: LlamaAnalysisData, phi4?: Phi4AnalysisData): DeepWorkflowAnalysis`
  - [ ] `mapProcessingMetadata(row: PipelineEmailAnalysis): ProcessingMetadata`

### 3.2 Field Mapping Implementation

- [ ] Map pipeline_stage to workflow states
- [ ] Map priority scores to priority levels
- [ ] Extract entities from JSON to structured format
- [ ] Convert action items to expected structure
- [ ] Handle missing data with sensible defaults

## Phase 4: Update EmailStorageService

### 4.1 Modify Database Queries

- [ ] Update `getEmailWithAnalysis()` to read from email_analysis table
- [ ] Remove references to email_analysis_compatible view
- [ ] Update JOIN clauses to use email_analysis directly

### 4.2 Integrate JSON Parser

- [ ] Add PipelineJsonParser as dependency
- [ ] Add PipelineAnalysisAdapter as dependency
- [ ] Update data retrieval methods:
  ```typescript
  private async getPipelineAnalysis(emailId: string): Promise<EmailAnalysisResult | null> {
    const row = this.db.prepare(`
      SELECT * FROM email_analysis WHERE email_id = ?
    `).get(emailId) as PipelineEmailAnalysis | undefined;

    if (!row) return null;

    return this.pipelineAdapter.fromDatabase(row);
  }
  ```

### 4.3 Update Batch Loading

- [ ] Modify `batchLoadEmailsWithAnalysis()` to use pipeline adapter
- [ ] Ensure parallel processing for performance
- [ ] Add error handling for individual parsing failures

## Phase 5: Performance Optimization

### 5.1 Create Database Indexes

- [ ] Add index on email_analysis.email_id
- [ ] Add index on email_analysis.pipeline_stage
- [ ] Add functional index on JSON fields:
  ```sql
  CREATE INDEX idx_llama_workflow ON email_analysis(
    json_extract(llama_analysis, '$.workflow_state')
  ) WHERE llama_analysis IS NOT NULL;
  ```

### 5.2 Implement Caching Layer

- [ ] Add LRU cache for parsed analysis results
- [ ] Set appropriate TTL (5 minutes suggested)
- [ ] Add cache invalidation on updates
- [ ] Monitor cache hit rates

### 5.3 Optimize JSON Parsing

- [ ] Implement lazy parsing for large JSON fields
- [ ] Use streaming JSON parser for very large documents
- [ ] Add connection pooling for database queries

## Phase 6: Testing

### 6.1 Unit Tests

- [ ] Test PipelineJsonParser with various JSON inputs
- [ ] Test PipelineAnalysisAdapter field mappings
- [ ] Test error handling and fallback scenarios
- [ ] Test edge cases (null, empty, malformed JSON)

### 6.2 Integration Tests

- [ ] Test EmailStorageService with real pipeline data
- [ ] Test batch loading performance
- [ ] Test compatibility with existing UI components
- [ ] Verify all expected fields are populated

### 6.3 Performance Tests

- [ ] Measure JSON parsing latency
- [ ] Test with 1000+ concurrent requests
- [ ] Verify memory usage is stable
- [ ] Benchmark against current implementation

## Phase 7: Migration

### 7.1 Pre-Migration Checks

- [ ] Verify all emails have analysis records
- [ ] Test rollback procedure
- [ ] Create database backup
- [ ] Document current performance baseline

### 7.2 Migration Execution

- [ ] Deploy code with feature flag disabled
- [ ] Enable for 1% of traffic
- [ ] Monitor error rates and performance
- [ ] Gradually increase to 100%

### 7.3 Post-Migration Validation

- [ ] Verify all UI features work correctly
- [ ] Check data consistency
- [ ] Monitor performance metrics
- [ ] Document any issues found

## Phase 8: Documentation Updates

### 8.1 Update Technical Documentation

- [ ] Update PDR-Database-Architecture.md
- [ ] Update README.md with new architecture
- [ ] Update CLAUDE.md with integration details
- [ ] Create migration guide

### 8.2 API Documentation

- [ ] Document new data flow
- [ ] Update field mappings
- [ ] Add troubleshooting guide
- [ ] Create performance tuning guide

### 8.3 Operational Documentation

- [ ] Update runbooks
- [ ] Document monitoring queries
- [ ] Create alert thresholds
- [ ] Update deployment procedures

## Phase 9: Monitoring and Alerting

### 9.1 Implement Metrics

- [ ] JSON parse success rate
- [ ] Parse latency percentiles
- [ ] Cache hit rate
- [ ] Error rate by field

### 9.2 Create Alerts

- [ ] Parse failure rate > 1%
- [ ] Latency p99 > 100ms
- [ ] Memory usage > 80%
- [ ] Database connection pool exhaustion

### 9.3 Create Dashboards

- [ ] Real-time performance dashboard
- [ ] Data quality dashboard
- [ ] Error analysis dashboard
- [ ] System health overview

## Phase 10: Cleanup

### 10.1 Remove Old Code

- [ ] Remove compatibility view creation
- [ ] Remove old schema references
- [ ] Clean up unused imports
- [ ] Archive old migration scripts

### 10.2 Optimize Further

- [ ] Review slow queries
- [ ] Optimize based on usage patterns
- [ ] Consider JSONB migration for SQLite 3.45+
- [ ] Plan for future enhancements

## Success Criteria Checklist

- [ ] All emails display correctly in UI
- [ ] No increase in error rates
- [ ] Performance meets or exceeds baseline
- [ ] All tests passing
- [ ] Documentation complete
- [ ] Monitoring in place
- [ ] Team trained on new architecture
- [ ] Rollback plan tested

## Timeline

- **Week 1 (Days 1-5)**: Phases 1-4 (Core Implementation)
- **Week 2 (Days 6-10)**: Phases 5-7 (Optimization & Migration)
- **Week 3 (Days 11-14)**: Phases 8-10 (Documentation & Cleanup)

## Risk Register

| Risk                    | Impact   | Mitigation              |
| ----------------------- | -------- | ----------------------- |
| JSON parsing failures   | High     | Comprehensive fallbacks |
| Performance degradation | Medium   | Caching and indexes     |
| UI compatibility issues | High     | Thorough testing        |
| Data loss               | Critical | Backups and validation  |

## Notes

- Keep feature flag for quick rollback
- Monitor closely for first 48 hours
- Have on-call engineer during migration
- Prepare communication for stakeholders
