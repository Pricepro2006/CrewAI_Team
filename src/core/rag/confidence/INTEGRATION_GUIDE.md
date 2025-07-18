# Confidence-Scored RAG Integration Guide

## Overview

This guide explains how to integrate the confidence-scored RAG system with the existing MasterOrchestrator and agent framework. The integration replaces the 6-step planning approach with a streamlined 4-step confidence-aware workflow.

## Architecture Overview

```
User Query → MasterOrchestrator → Confidence RAG Pipeline → Adaptive Delivery
                                           ↓
                                   1. Query Analysis & Retrieval
                                   2. Response Generation
                                   3. Multi-Modal Evaluation
                                   4. Adaptive Delivery
```

## Integration Points

### 1. MasterOrchestrator Modifications

```typescript
// src/core/master-orchestrator/MasterOrchestrator.ts

import {
  QueryComplexityAnalyzer,
  ConfidenceRAGRetriever,
  ConfidenceResponseGenerator,
  MultiModalEvaluator,
  AdaptiveDeliveryManager,
  ActionType
} from '../rag/confidence';

export class MasterOrchestrator {
  private confidenceRAG: {
    analyzer: QueryComplexityAnalyzer;
    retriever: ConfidenceRAGRetriever;
    generator: ConfidenceResponseGenerator;
    evaluator: MultiModalEvaluator;
    delivery: AdaptiveDeliveryManager;
  };

  constructor() {
    // Initialize confidence components
    this.confidenceRAG = {
      analyzer: new QueryComplexityAnalyzer(),
      retriever: new ConfidenceRAGRetriever(this.vectorStore),
      generator: new ConfidenceResponseGenerator(this.llmProvider),
      evaluator: new MultiModalEvaluator(),
      delivery: new AdaptiveDeliveryManager()
    };
  }

  async processQuery(query: string): Promise<OrchestratorResult> {
    // Step 1: Analyze query complexity
    const complexity = this.confidenceRAG.analyzer.assessComplexity(query);
    
    // Step 2: Use confidence-based routing
    if (complexity.score <= 3) {
      // Simple query - direct response
      return this.handleSimpleQuery(query);
    } else if (complexity.score <= 7) {
      // Medium complexity - confidence RAG
      return this.handleConfidenceRAG(query);
    } else {
      // High complexity - full agent orchestration
      return this.handleComplexAgentTask(query);
    }
  }

  private async handleConfidenceRAG(query: string): Promise<OrchestratorResult> {
    // Full confidence-scored RAG workflow
    const retrieval = await this.confidenceRAG.retriever.retrieve(query);
    const generation = await this.confidenceRAG.generator.generateWithConfidence({
      query,
      retrievedDocuments: retrieval.documents,
      complexity: retrieval.complexity
    });
    
    const evaluation = await this.confidenceRAG.evaluator.evaluate(
      query,
      generation.response,
      retrieval.documents,
      generation.tokenConfidence
    );
    
    const delivered = await this.confidenceRAG.delivery.deliver(evaluation);
    
    return {
      response: delivered.content,
      confidence: delivered.confidence.score,
      metadata: {
        action: delivered.metadata.action,
        processingPath: 'confidence-rag',
        humanReviewNeeded: delivered.metadata.humanReviewNeeded
      }
    };
  }
}
```

### 2. Agent Integration

Agents can leverage confidence scoring for their individual responses:

```typescript
// src/core/agents/base/BaseAgent.ts

export abstract class BaseAgent {
  protected confidenceScorer?: MultiModalEvaluator;

  async executeWithConfidence(task: AgentTask): Promise<AgentResult> {
    const result = await this.execute(task);
    
    if (this.confidenceScorer) {
      const evaluation = await this.confidenceScorer.quickEvaluate(
        task.input,
        result.output,
        0.7 // Base confidence
      );
      
      result.confidence = evaluation.overallConfidence;
      result.qualityMetrics = evaluation.qualityMetrics;
    }
    
    return result;
  }
}
```

### 3. API Endpoint Updates

```typescript
// src/api/routes/chat.router.ts

chatRouter.post('/message', async (req, res) => {
  const { message, includeConfidence = true } = req.body;
  
  const result = await orchestrator.processQuery(message);
  
  res.json({
    response: result.response,
    confidence: includeConfidence ? result.confidence : undefined,
    metadata: {
      processingPath: result.metadata.processingPath,
      requiresReview: result.metadata.humanReviewNeeded,
      feedbackId: result.feedbackId
    }
  });
});

// New endpoint for feedback
chatRouter.post('/feedback/:feedbackId', async (req, res) => {
  const { feedbackId } = req.params;
  const { helpful, accurate, comments } = req.body;
  
  orchestrator.captureFeedback(feedbackId, {
    helpful,
    accurate,
    comments
  });
  
  res.json({ success: true });
});
```

### 4. WebSocket Updates

```typescript
// src/api/websocket/confidence-updates.ts

export function setupConfidenceWebSocket(io: Server) {
  io.on('connection', (socket) => {
    // Emit confidence updates during processing
    orchestrator.on('confidence:update', (data) => {
      socket.emit('confidence-update', {
        stage: data.stage,
        confidence: data.confidence,
        details: data.details
      });
    });
    
    // Emit evaluation results
    orchestrator.on('evaluation:complete', (result) => {
      socket.emit('evaluation-result', {
        factuality: result.factualityScore,
        relevance: result.relevanceScore,
        coherence: result.coherenceScore,
        overall: result.overallConfidence,
        action: result.recommendedAction
      });
    });
  });
}
```

### 5. Configuration

```typescript
// src/config/confidence.config.ts

// Update existing config or create environment-specific configs
export const CONFIDENCE_PROFILES = {
  conservative: {
    retrieval: { minimum: 0.7, preferred: 0.85 },
    generation: { acceptable: 0.75, review: 0.5 },
    overall: { high: 0.85, medium: 0.7, low: 0.5 }
  },
  balanced: {
    retrieval: { minimum: 0.6, preferred: 0.75 },
    generation: { acceptable: 0.7, review: 0.4 },
    overall: { high: 0.8, medium: 0.6, low: 0.4 }
  },
  permissive: {
    retrieval: { minimum: 0.5, preferred: 0.65 },
    generation: { acceptable: 0.6, review: 0.3 },
    overall: { high: 0.7, medium: 0.5, low: 0.3 }
  }
};

// Use based on environment or user preference
const profile = process.env.CONFIDENCE_PROFILE || 'balanced';
export const activeConfig = CONFIDENCE_PROFILES[profile];
```

## Migration Strategy

### Phase 1: Parallel Implementation
1. Keep existing 6-step planning active
2. Implement confidence scoring in parallel
3. A/B test both approaches
4. Collect performance metrics

### Phase 2: Gradual Rollout
1. Route simple queries to confidence system
2. Monitor success rates and user feedback
3. Gradually increase query complexity threshold
4. Maintain fallback to old system

### Phase 3: Full Migration
1. Replace 6-step planning with confidence workflow
2. Optimize thresholds based on collected data
3. Remove legacy code
4. Document new patterns

## Performance Considerations

### 1. Caching Strategy
```typescript
const confidenceCache = new Map<string, CachedConfidenceResult>();

// Cache retrieval results
const cacheKey = hashQuery(query);
if (confidenceCache.has(cacheKey)) {
  const cached = confidenceCache.get(cacheKey);
  if (Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.result;
  }
}
```

### 2. Batch Processing
```typescript
// Process multiple queries efficiently
async function batchConfidenceRAG(queries: string[]) {
  const complexities = queries.map(q => analyzer.assessComplexity(q));
  const retrievals = await Promise.all(
    queries.map(q => retriever.retrieve(q))
  );
  // ... continue batch processing
}
```

### 3. Model Optimization
- Use smaller models for low-complexity queries
- Switch models based on confidence requirements
- Implement timeout handling for slow responses

## Monitoring & Analytics

### 1. Key Metrics
- Average confidence scores by query type
- Action distribution (Accept/Review/Regenerate/Fallback)
- User feedback correlation with confidence
- Processing time by confidence level
- Cache hit rates

### 2. Dashboard Integration
```typescript
// src/monitoring/confidence-metrics.ts

export class ConfidenceMetricsCollector {
  async collectMetrics() {
    return {
      avgConfidence: this.calculateAverageConfidence(),
      actionDistribution: this.getActionDistribution(),
      feedbackCorrelation: this.analyzeFeedbackCorrelation(),
      performanceByConfidence: this.getPerformanceMetrics()
    };
  }
}
```

### 3. Alerting
- Alert on confidence drift (average drops below threshold)
- Alert on high fallback rates
- Alert on negative feedback spikes

## Testing Strategy

### 1. Unit Tests
- Test each confidence component independently
- Mock LLM responses for predictability
- Test edge cases and error handling

### 2. Integration Tests
```typescript
// src/test/integration/confidence-rag.test.ts

describe('Confidence RAG Integration', () => {
  it('should handle simple queries with high confidence', async () => {
    const result = await orchestrator.processQuery('What is TypeScript?');
    expect(result.confidence).toBeGreaterThan(0.8);
    expect(result.metadata.action).toBe('ACCEPT');
  });
  
  it('should request review for uncertain responses', async () => {
    const result = await orchestrator.processQuery('Complex ambiguous query...');
    expect(result.confidence).toBeLessThan(0.6);
    expect(result.metadata.humanReviewNeeded).toBe(true);
  });
});
```

### 3. A/B Testing
```typescript
// Track both approaches
const oldApproachResult = await oldOrchestrator.process(query);
const newApproachResult = await confidenceOrchestrator.process(query);

analytics.track('approach_comparison', {
  query,
  oldConfidence: oldApproachResult.confidence,
  newConfidence: newApproachResult.confidence,
  oldTime: oldApproachResult.processingTime,
  newTime: newApproachResult.processingTime
});
```

## Best Practices

1. **Start Conservative**: Begin with higher confidence thresholds and gradually relax
2. **Monitor Closely**: Track all metrics during initial rollout
3. **Iterate Quickly**: Adjust thresholds based on real-world performance
4. **Maintain Fallbacks**: Always have a path for low-confidence scenarios
5. **Document Decisions**: Keep track of threshold changes and rationale
6. **User Education**: Help users understand confidence indicators
7. **Continuous Learning**: Use feedback to improve calibration

## Troubleshooting

### Common Issues

1. **Low Confidence Across All Queries**
   - Check retrieval quality and document coverage
   - Verify LLM temperature settings
   - Review calibration parameters

2. **High False Positive Rate**
   - Tighten confidence thresholds
   - Improve factuality checking
   - Add more validation steps

3. **Slow Response Times**
   - Implement caching
   - Optimize retrieval queries
   - Use model quantization

4. **Feedback Not Improving System**
   - Verify feedback capture
   - Check calibration training
   - Review learning algorithms

## Future Enhancements

1. **Conformal Prediction**: Implement prediction intervals
2. **Active Learning**: Identify queries that would most improve the system
3. **Multi-Model Ensemble**: Combine multiple models for robustness
4. **Explanation Generation**: Provide detailed confidence breakdowns
5. **Domain Adaptation**: Specialize confidence for different domains