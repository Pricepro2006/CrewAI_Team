# Three-Stage Hybrid Pipeline Implementation Plan

## Executive Summary

This document outlines the step-by-step implementation plan for deploying a three-stage email analysis pipeline using Llama 3.2:3b as the primary model across all system components. The plan includes fallback strategies, model updates, and comprehensive integration steps.

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                   Three-Stage Pipeline                       │
├─────────────────────────────────────────────────────────────┤
│ Stage 1: Pattern-Based Triage (All 33,797 emails)          │
│ ├─ Tool: Iteration Script (90% entity extraction)          │
│ ├─ Time: 1 hour                                            │
│ └─ Output: Priority scores, basic entities, routing        │
├─────────────────────────────────────────────────────────────┤
│ Stage 2: Llama 3.2:3b Analysis (Top 5,000 emails)         │
│ ├─ Tool: Llama 3.2:3b via Ollama                          │
│ ├─ Time: 13 hours                                         │
│ └─ Output: Context, actions, business insights            │
├─────────────────────────────────────────────────────────────┤
│ Stage 3: Deep Analysis (Top 500 critical emails)          │
│ ├─ Primary: Phi-4 14B (with 60s timeout)                  │
│ ├─ Fallback: Llama 3.2:3b                                 │
│ ├─ Time: 7 hours                                          │
│ └─ Output: Executive summaries, critical insights         │
└─────────────────────────────────────────────────────────────┘
```

## Pre-Implementation Checklist

- [ ] Verify Llama 3.2:3b model is available in Ollama
- [ ] Confirm 64GB RAM availability
- [ ] Backup current database (app.db)
- [ ] Ensure disk space for analysis results (estimate: 2GB)
- [ ] Stop any running analysis processes

## Phase 1: Model Configuration Updates (2 hours)

### 1.1 Update Global Model Configuration
```typescript
// src/config/models.config.ts
export const MODEL_CONFIG = {
  primary: 'llama3.2:3b',
  fallback: 'llama3.2:3b', // Same model for consistency
  critical: 'doomgrave/phi-4:14b-tools-Q3_K_S',
  embedding: 'llama3.2:3b', // Use same model for embeddings
  
  timeouts: {
    pattern: 100,      // 0.1 seconds
    primary: 15000,    // 15 seconds (buffer over 9.35s avg)
    critical: 60000,   // 60 seconds for Phi-4
    fallback: 15000    // 15 seconds for Llama fallback
  },
  
  batchSizes: {
    pattern: 100,      // Process 100 emails at once
    primary: 10,       // Process 10 emails at once
    critical: 1        // Process 1 email at a time
  }
};
```

### 1.2 Update Agent Configurations
```typescript
// src/core/agents/BaseAgent.ts
export abstract class BaseAgent {
  protected model = MODEL_CONFIG.primary; // Now llama3.2:3b
  protected timeout = MODEL_CONFIG.timeouts.primary;
  
  // Update all agents to use new model
}
```

### 1.3 Update RAG System
```typescript
// src/core/rag/RAGService.ts
export class RAGService {
  private model = MODEL_CONFIG.primary;
  private embeddingModel = MODEL_CONFIG.embedding;
  
  // Update embedding generation to use Llama 3.2:3b
  async generateEmbedding(text: string): Promise<number[]> {
    // Implementation using Llama 3.2:3b
  }
}
```

### 1.4 Update Memory Optimization
```typescript
// src/core/memory/MemoryManager.ts
export class MemoryManager {
  // Llama 3.2:3b uses ~4GB RAM
  private readonly MODEL_MEMORY_USAGE = 4 * 1024 * 1024 * 1024;
  private readonly SAFE_MEMORY_LIMIT = 50 * 1024 * 1024 * 1024; // 50GB
}
```

## Phase 2: Pipeline Infrastructure (4 hours)

### 2.1 Create Pipeline Orchestrator
```typescript
// src/core/pipeline/PipelineOrchestrator.ts
export class PipelineOrchestrator {
  async runThreeStagePipeline(): Promise<PipelineResults> {
    // Stage 1: Pattern-based triage
    const triageResults = await this.runStage1();
    
    // Stage 2: Llama 3.2:3b for priority emails
    const priorityResults = await this.runStage2(triageResults);
    
    // Stage 3: Deep analysis for critical emails
    const criticalResults = await this.runStage3(priorityResults);
    
    return this.consolidateResults(triageResults, priorityResults, criticalResults);
  }
}
```

### 2.2 Implement Stage 1: Pattern Triage
```typescript
// src/core/pipeline/Stage1PatternTriage.ts
export class Stage1PatternTriage {
  async process(emails: Email[]): Promise<TriageResults> {
    const batchSize = MODEL_CONFIG.batchSizes.pattern;
    const results = [];
    
    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      const batchResults = await this.processBatch(batch);
      results.push(...batchResults);
      
      // Progress logging
      console.log(`Stage 1: Processed ${i + batch.length}/${emails.length} emails`);
    }
    
    return this.prioritizeEmails(results);
  }
  
  private prioritizeEmails(results: TriageResult[]): TriageResults {
    // Sort by priority score
    const sorted = results.sort((a, b) => b.priorityScore - a.priorityScore);
    
    return {
      all: sorted,
      top5000: sorted.slice(0, 5000),
      top500: sorted.slice(0, 500)
    };
  }
}
```

### 2.3 Implement Stage 2: Llama Analysis
```typescript
// src/core/pipeline/Stage2LlamaAnalysis.ts
export class Stage2LlamaAnalysis {
  private model = MODEL_CONFIG.primary;
  
  async process(emails: Email[]): Promise<LlamaAnalysisResults> {
    const results = [];
    const batchSize = MODEL_CONFIG.batchSizes.primary;
    
    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      
      // Process batch with Llama 3.2:3b
      const batchPromises = batch.map(email => 
        this.analyzeWithTimeout(email, MODEL_CONFIG.timeouts.primary)
      );
      
      const batchResults = await Promise.allSettled(batchPromises);
      results.push(...this.handleResults(batchResults));
      
      // Progress logging
      console.log(`Stage 2: Processed ${i + batch.length}/${emails.length} emails`);
    }
    
    return results;
  }
}
```

### 2.4 Implement Stage 3: Critical Analysis
```typescript
// src/core/pipeline/Stage3CriticalAnalysis.ts
export class Stage3CriticalAnalysis {
  async process(emails: Email[]): Promise<CriticalAnalysisResults> {
    const results = [];
    
    for (const email of emails) {
      // Try Phi-4 first
      try {
        const phi4Result = await this.analyzeWithPhi4(email);
        results.push(phi4Result);
      } catch (error) {
        // Fallback to Llama 3.2:3b
        console.log(`Phi-4 timeout for ${email.id}, falling back to Llama 3.2:3b`);
        const llamaResult = await this.analyzeWithLlama(email);
        results.push(llamaResult);
      }
      
      console.log(`Stage 3: Processed ${results.length}/${emails.length} emails`);
    }
    
    return results;
  }
}
```

## Phase 3: Database Schema Updates (2 hours)

### 3.1 Add Pipeline Tracking Tables
```sql
-- Create pipeline execution tracking
CREATE TABLE pipeline_executions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at DATETIME NOT NULL,
  completed_at DATETIME,
  stage1_count INTEGER,
  stage2_count INTEGER,
  stage3_count INTEGER,
  total_processing_time_seconds REAL,
  status TEXT CHECK(status IN ('running', 'completed', 'failed')),
  error_message TEXT
);

-- Create stage results tracking
CREATE TABLE stage_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  execution_id INTEGER REFERENCES pipeline_executions(id),
  email_id TEXT REFERENCES emails(id),
  stage INTEGER CHECK(stage IN (1, 2, 3)),
  priority_score REAL,
  processing_time_seconds REAL,
  model_used TEXT,
  analysis_quality_score REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 3.2 Update Email Analysis Table
```sql
-- Add pipeline-specific fields
ALTER TABLE email_analysis ADD COLUMN pipeline_stage INTEGER;
ALTER TABLE email_analysis ADD COLUMN pipeline_priority_score REAL;
ALTER TABLE email_analysis ADD COLUMN llama_analysis TEXT;
ALTER TABLE email_analysis ADD COLUMN phi4_analysis TEXT;
ALTER TABLE email_analysis ADD COLUMN final_model_used TEXT;
```

## Phase 4: Implementation Steps (8 hours)

### 4.1 Stage 1 Implementation (2 hours)
1. [ ] Create pattern triage script
2. [ ] Test on 100 sample emails
3. [ ] Optimize batch processing
4. [ ] Implement priority scoring algorithm
5. [ ] Save results to database

### 4.2 Stage 2 Implementation (3 hours)
1. [ ] Create Llama 3.2:3b analysis script
2. [ ] Implement batch processing with timeouts
3. [ ] Add progress tracking and resumability
4. [ ] Handle errors gracefully
5. [ ] Save enhanced analysis to database

### 4.3 Stage 3 Implementation (3 hours)
1. [ ] Create Phi-4 analysis script with 60s timeout
2. [ ] Implement Llama 3.2:3b fallback mechanism
3. [ ] Add critical email detection logic
4. [ ] Create executive summary generator
5. [ ] Save deep analysis results

## Phase 5: Monitoring and Validation (2 hours)

### 5.1 Create Monitoring Dashboard
```typescript
// src/scripts/monitor-pipeline.ts
export class PipelineMonitor {
  async getStatus(): Promise<PipelineStatus> {
    return {
      stage1: await this.getStageStatus(1),
      stage2: await this.getStageStatus(2),
      stage3: await this.getStageStatus(3),
      overall: await this.getOverallProgress(),
      estimatedCompletion: await this.estimateCompletion()
    };
  }
}
```

### 5.2 Quality Validation
```typescript
// src/scripts/validate-quality.ts
export class QualityValidator {
  async validateResults(): Promise<ValidationReport> {
    // Sample 100 emails from each stage
    // Compare entity extraction accuracy
    // Validate business logic consistency
    // Check for missing critical emails
  }
}
```

## Phase 6: Production Deployment (2 hours)

### 6.1 Pre-Deployment Checklist
- [ ] All tests passing
- [ ] Database backed up
- [ ] Models downloaded and verified
- [ ] Memory usage within limits
- [ ] Monitoring scripts ready

### 6.2 Deployment Steps
1. [ ] Stop current services
2. [ ] Deploy updated code
3. [ ] Run database migrations
4. [ ] Start pipeline execution
5. [ ] Monitor progress

### 6.3 Rollback Plan
```bash
# If issues occur:
1. Stop pipeline execution
2. Restore database backup
3. Revert code changes
4. Document issues for resolution
```

## Execution Timeline

| Phase | Duration | Start | End |
|-------|----------|-------|-----|
| Pre-Implementation | 30 min | Hour 0 | Hour 0.5 |
| Model Configuration | 2 hours | Hour 0.5 | Hour 2.5 |
| Pipeline Infrastructure | 4 hours | Hour 2.5 | Hour 6.5 |
| Database Updates | 2 hours | Hour 6.5 | Hour 8.5 |
| Implementation | 8 hours | Hour 8.5 | Hour 16.5 |
| Monitoring/Validation | 2 hours | Hour 16.5 | Hour 18.5 |
| Production Deployment | 2 hours | Hour 18.5 | Hour 20.5 |
| **Pipeline Execution** | **21 hours** | Hour 20.5 | Hour 41.5 |

**Total Time**: ~42 hours (1.75 days)

## Success Criteria

1. **Stage 1**: All 33,797 emails processed in under 1 hour
2. **Stage 2**: Top 5,000 emails analyzed with Llama 3.2:3b
3. **Stage 3**: Top 500 critical emails deep analyzed
4. **Quality**: Average accuracy score > 6.5/10
5. **Performance**: No memory errors or crashes
6. **Completeness**: 100% email coverage

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Phi-4 timeouts | Automatic Llama 3.2:3b fallback |
| Memory overflow | Batch size limits and monitoring |
| Process failure | Checkpoint/resume capability |
| Quality issues | Validation sampling at each stage |
| Data loss | Incremental saves and backups |

## Next Steps After Implementation

1. **Analyze Results**: Review quality metrics and performance
2. **Optimize**: Tune batch sizes and timeouts based on results
3. **Document**: Create user guide for pipeline operation
4. **Schedule**: Set up recurring pipeline runs
5. **Enhance**: Begin Advanced Email Analysis System implementation

---

This plan provides a complete roadmap for implementing the three-stage hybrid pipeline with Llama 3.2:3b as the primary model throughout the system.