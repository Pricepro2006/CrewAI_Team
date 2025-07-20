# Confidence-Scored RAG Implementation Plan

**Created:** July 18, 2025  
**Phase:** 7 - Confidence-Scored RAG System  
**Timeline:** 8 weeks

---

## Executive Summary

This document provides a detailed, step-by-step implementation plan for transitioning from the failing 6-step planning approach to a simplified 4-step confidence-scored RAG system. The plan is based on comprehensive research of 2025 best practices and addresses the model reliability issues discovered during testing.

---

## Implementation Phases

### Week 1-2: Foundation & Infrastructure

#### Step 1: Project Setup & Dependencies

**Day 1-2: Dependency Installation**
```bash
# Core dependencies
pnpm add @xenova/transformers  # For BERT-based re-ranking
pnpm add mathjs  # For confidence calculations
pnpm add simple-statistics  # For calibration algorithms

# Development dependencies
pnpm add -D @types/simple-statistics
```

**Day 3-4: Create Base Interfaces**
```typescript
// src/core/rag/confidence/types.ts
export interface ConfidenceConfig {
  retrieval: {
    minimum: number;
    preferred: number;
  };
  generation: {
    acceptable: number;
    review: number;
  };
  overall: {
    high: number;
    medium: number;
    low: number;
  };
}

export interface ScoredDocument {
  id: string;
  content: string;
  retrievalScore: number;
  confidenceScore: number;
  source: string;
  metadata: DocumentMetadata;
}

export interface TokenConfidence {
  token: string;
  logProbability: number;
  confidence: number;
  position: number;
}
```

**Day 5: Configuration Setup**
```typescript
// src/config/confidence.config.ts
export const confidenceConfig: ConfidenceConfig = {
  retrieval: {
    minimum: 0.6,
    preferred: 0.75
  },
  generation: {
    acceptable: 0.7,
    review: 0.4
  },
  overall: {
    high: 0.8,
    medium: 0.6,
    low: 0.4
  }
};
```

#### Step 2: Modify Ollama Provider

**Day 6-7: Add Log Probability Support**
```typescript
// src/core/llm/OllamaProvider.ts
interface OllamaGenerateOptions {
  prompt: string;
  extractLogProbs?: boolean;
  temperature?: number;
  topK?: number;
}

interface OllamaGenerateResponse {
  text: string;
  tokens?: string[];
  logProbs?: number[];
  metadata?: GenerationMetadata;
}

async generateWithLogProbs(options: OllamaGenerateOptions): Promise<OllamaGenerateResponse> {
  const response = await this.ollama.generate({
    model: this.model,
    prompt: options.prompt,
    options: {
      temperature: options.temperature || 0.7,
      top_k: options.topK || 40,
      // Enable log probability extraction
      logprobs: options.extractLogProbs || false,
      num_logprobs: 5
    }
  });
  
  return {
    text: response.response,
    tokens: response.tokens,
    logProbs: response.logprobs,
    metadata: {
      model: this.model,
      duration: response.eval_duration,
      tokenCount: response.eval_count
    }
  };
}
```

**Day 8-10: Create Confidence Extractor**
```typescript
// src/core/rag/confidence/ConfidenceExtractor.ts
export class ConfidenceExtractor {
  extractTokenConfidence(
    tokens: string[], 
    logProbs: number[]
  ): TokenConfidence[] {
    return tokens.map((token, index) => ({
      token,
      logProbability: logProbs[index],
      confidence: this.logProbToConfidence(logProbs[index]),
      position: index
    }));
  }
  
  private logProbToConfidence(logProb: number): number {
    // Convert log probability to confidence score (0-1)
    return Math.exp(logProb);
  }
  
  aggregateConfidence(tokenConfidence: TokenConfidence[]): number {
    // Use harmonic mean for conservative aggregation
    const confidences = tokenConfidence.map(tc => tc.confidence);
    return confidences.length / confidences.reduce((sum, c) => sum + (1/c), 0);
  }
}
```

### Week 2-3: Query Processing & Retrieval

#### Step 3: Implement Confidence RAG Retriever

**Day 11-12: Query Complexity Analyzer**
```typescript
// src/core/rag/confidence/QueryComplexityAnalyzer.ts
export class QueryComplexityAnalyzer {
  async assessComplexity(query: string): Promise<number> {
    const factors = {
      length: this.assessLength(query),
      technicalTerms: this.countTechnicalTerms(query),
      multiIntent: this.detectMultipleIntents(query),
      ambiguity: this.assessAmbiguity(query),
      domainSpecificity: this.assessDomainSpecificity(query)
    };
    
    // Weighted combination (1-10 scale)
    return Math.min(10, Math.max(1, 
      factors.length * 0.2 +
      factors.technicalTerms * 0.3 +
      factors.multiIntent * 0.2 +
      factors.ambiguity * 0.15 +
      factors.domainSpecificity * 0.15
    ));
  }
}
```

**Day 13-15: BERT-based Re-ranker**
```typescript
// src/core/rag/confidence/BERTRanker.ts
import { pipeline } from '@xenova/transformers';

export class BERTRanker {
  private reranker: any;
  
  async initialize() {
    this.reranker = await pipeline(
      'feature-extraction',
      'Xenova/ms-marco-MiniLM-L-6-v2'
    );
  }
  
  async rerank(
    query: string, 
    documents: ScoredDocument[]
  ): Promise<ScoredDocument[]> {
    const scores = await Promise.all(
      documents.map(async (doc) => {
        const similarity = await this.calculateSimilarity(query, doc.content);
        return {
          ...doc,
          confidenceScore: this.combineScores(
            doc.retrievalScore,
            similarity,
            doc.metadata.quality || 0.5
          )
        };
      })
    );
    
    return scores.sort((a, b) => b.confidenceScore - a.confidenceScore);
  }
  
  private combineScores(...scores: number[]): number {
    // Weighted geometric mean for balanced combination
    const weights = [0.4, 0.4, 0.2];
    return Math.pow(
      scores.reduce((prod, score, i) => prod * Math.pow(score, weights[i]), 1),
      1 / weights.reduce((sum, w) => sum + w, 0)
    );
  }
}
```

**Day 16-18: Confidence RAG Retriever Integration**
```typescript
// src/core/rag/confidence/ConfidenceRAGRetriever.ts
export class ConfidenceRAGRetriever {
  constructor(
    private vectorStore: VectorStore,
    private bertRanker: BERTRanker,
    private complexityAnalyzer: QueryComplexityAnalyzer,
    private config: ConfidenceConfig
  ) {}
  
  async retrieve(query: string): Promise<QueryProcessingResult> {
    // Step 1: Analyze query complexity
    const complexity = await this.complexityAnalyzer.assessComplexity(query);
    
    // Step 2: Adjust retrieval parameters based on complexity
    const retrievalCount = this.getRetrievalCount(complexity);
    
    // Step 3: Initial vector search
    const initialResults = await this.vectorStore.search(query, retrievalCount);
    
    // Step 4: Filter by minimum confidence
    const filtered = this.filterByConfidence(initialResults);
    
    // Step 5: BERT-based re-ranking
    const reranked = await this.bertRanker.rerank(query, filtered);
    
    // Step 6: Final selection
    const finalDocs = this.selectFinalDocuments(reranked);
    
    return {
      processedQuery: query,
      queryComplexity: complexity,
      expectedDomains: this.extractDomains(query),
      retrievalConfidence: this.calculateOverallConfidence(finalDocs),
      documents: finalDocs
    };
  }
}
```

### Week 3-4: Response Generation & Tracking

#### Step 4: Implement Confidence Response Generator

**Day 19-20: Context Builder**
```typescript
// src/core/rag/confidence/ConfidenceContextBuilder.ts
export class ConfidenceContextBuilder {
  buildContext(documents: ScoredDocument[]): string {
    // Order by confidence score
    const ordered = documents.sort((a, b) => b.confidenceScore - a.confidenceScore);
    
    // Build context with confidence indicators
    return ordered.map((doc, index) => {
      const confidenceLabel = this.getConfidenceLabel(doc.confidenceScore);
      return `[${confidenceLabel} Source ${index + 1}]:\n${doc.content}\n`;
    }).join('\n---\n');
  }
  
  private getConfidenceLabel(score: number): string {
    if (score >= 0.8) return 'HIGH CONFIDENCE';
    if (score >= 0.6) return 'MEDIUM CONFIDENCE';
    return 'LOW CONFIDENCE';
  }
}
```

**Day 21-23: Response Generator with Tracking**
```typescript
// src/core/rag/confidence/ConfidenceResponseGenerator.ts
export class ConfidenceResponseGenerator {
  constructor(
    private llm: OllamaProvider,
    private confidenceExtractor: ConfidenceExtractor,
    private contextBuilder: ConfidenceContextBuilder
  ) {}
  
  async generate(
    query: string,
    documents: ScoredDocument[]
  ): Promise<ResponseGenerationResult> {
    // Build confidence-aware context
    const context = this.contextBuilder.buildContext(documents);
    
    // Create prompt with confidence instructions
    const prompt = this.buildConfidenceAwarePrompt(query, context);
    
    // Generate with log probabilities
    const response = await this.llm.generateWithLogProbs({
      prompt,
      extractLogProbs: true,
      temperature: this.getTemperature(documents)
    });
    
    // Extract confidence metrics
    const tokenConfidence = this.confidenceExtractor.extractTokenConfidence(
      response.tokens || [],
      response.logProbs || []
    );
    
    // Detect uncertainty
    const uncertaintyMarkers = this.detectUncertaintyMarkers(
      response.text,
      tokenConfidence
    );
    
    return {
      response: response.text,
      tokenLevelConfidence: tokenConfidence,
      aggregatedConfidence: this.confidenceExtractor.aggregateConfidence(tokenConfidence),
      uncertaintyMarkers,
      generationMetrics: this.calculateGenerationMetrics(response)
    };
  }
}
```

### Week 4-5: Evaluation & Calibration

#### Step 5: Multi-Modal Evaluator

**Day 24-26: Quality Scorers**
```typescript
// src/core/rag/confidence/evaluators/FactualityChecker.ts
export class FactualityChecker {
  async check(
    response: string,
    sources: ScoredDocument[]
  ): Promise<number> {
    // Extract claims from response
    const claims = this.extractClaims(response);
    
    // Verify each claim against sources
    const verifications = await Promise.all(
      claims.map(claim => this.verifyClaim(claim, sources))
    );
    
    // Calculate factuality score
    return verifications.filter(v => v).length / claims.length;
  }
}

// src/core/rag/confidence/evaluators/RelevanceScorer.ts
export class RelevanceScorer {
  async score(query: string, response: string): Promise<number> {
    // Semantic similarity between query and response
    const semanticScore = await this.calculateSemanticSimilarity(query, response);
    
    // Key term coverage
    const termCoverage = this.calculateTermCoverage(query, response);
    
    // Intent fulfillment
    const intentScore = await this.assessIntentFulfillment(query, response);
    
    return (semanticScore * 0.4 + termCoverage * 0.3 + intentScore * 0.3);
  }
}
```

**Day 27-29: Confidence Calibrator**
```typescript
// src/core/rag/confidence/ConfidenceCalibrator.ts
import { SimpleStatistics } from 'simple-statistics';

export class ConfidenceCalibrator {
  private temperatureScalingFactor: number = 1.5;
  
  async calibrate(
    rawConfidence: number,
    options: CalibrationOptions
  ): Promise<number> {
    switch (options.method) {
      case 'temperature_scaling':
        return this.temperatureScaling(rawConfidence);
      
      case 'isotonic_regression':
        return this.isotonicRegression(rawConfidence);
      
      case 'platt_scaling':
        return this.plattScaling(rawConfidence);
      
      default:
        return rawConfidence;
    }
  }
  
  private temperatureScaling(confidence: number): number {
    // Apply temperature scaling to reduce overconfidence
    const logit = Math.log(confidence / (1 - confidence));
    const scaledLogit = logit / this.temperatureScalingFactor;
    return 1 / (1 + Math.exp(-scaledLogit));
  }
}
```

### Week 5-6: Adaptive Delivery

#### Step 6: Response Formatter

**Day 30-32: Adaptive Response Formatter**
```typescript
// src/core/rag/confidence/AdaptiveResponseFormatter.ts
export class AdaptiveResponseFormatter {
  format(options: FormatOptions): string {
    const { response, confidenceLevel } = options;
    
    switch (confidenceLevel) {
      case ConfidenceLevel.HIGH:
        return this.formatHighConfidence(response);
      
      case ConfidenceLevel.MEDIUM:
        return this.formatMediumConfidence(response);
      
      case ConfidenceLevel.LOW:
        return this.formatLowConfidence(response);
      
      case ConfidenceLevel.VERY_LOW:
        return this.formatVeryLowConfidence(response);
    }
  }
  
  private formatHighConfidence(response: string): string {
    return response; // Present as-is
  }
  
  private formatMediumConfidence(response: string): string {
    return `${response}\n\n*Note: This response is based on available information and may benefit from verification.*`;
  }
  
  private formatLowConfidence(response: string): string {
    return `Based on limited information:\n\n${response}\n\n⚠️ **Low Confidence**: Please verify this information from additional sources.`;
  }
  
  private formatVeryLowConfidence(response: string): string {
    return `⚠️ **Very Low Confidence Response**\n\n${response}\n\n🔍 **Human Review Recommended**: This response has very low confidence and should be reviewed by a human expert.`;
  }
}
```

**Day 33-35: Feedback System**
```typescript
// src/core/rag/confidence/FeedbackCollector.ts
export class FeedbackCollector {
  async initialize(options: FeedbackOptions): Promise<FeedbackData> {
    const feedbackId = this.generateFeedbackId();
    
    await this.db.feedbacks.create({
      id: feedbackId,
      responseId: options.responseId,
      confidenceLevel: options.confidenceLevel,
      expectedType: options.expectedFeedbackType,
      status: 'pending',
      createdAt: new Date()
    });
    
    return {
      id: feedbackId,
      collectUrl: `/api/feedback/${feedbackId}`,
      expectedType: options.expectedFeedbackType
    };
  }
  
  async collectFeedback(
    feedbackId: string, 
    feedback: UserFeedback
  ): Promise<void> {
    await this.db.feedbacks.update({
      where: { id: feedbackId },
      data: {
        ...feedback,
        status: 'collected',
        collectedAt: new Date()
      }
    });
    
    // Queue for learning
    await this.learningQueue.enqueue({
      type: 'feedback_collected',
      feedbackId,
      priority: this.getPriority(feedback)
    });
  }
}
```

### Week 6-7: Integration & Testing

#### Step 7: System Integration

**Day 36-38: Update Master Orchestrator**
```typescript
// src/core/master-orchestrator/MasterOrchestrator.ts
export class MasterOrchestrator {
  private confidenceRAG: ConfidenceScoredRAGSystem;
  
  async processQuery(query: Query): Promise<ExecutionResult> {
    // Use confidence-scored RAG instead of 6-step planning
    const ragResult = await this.confidenceRAG.process(query.text);
    
    // Check confidence level
    if (ragResult.confidence.overall >= 0.8) {
      // High confidence - execute directly
      return this.executeHighConfidence(ragResult);
    } else if (ragResult.confidence.overall >= 0.6) {
      // Medium confidence - execute with verification
      return this.executeMediumConfidence(ragResult);
    } else {
      // Low confidence - trigger alternative flow
      return this.executeLowConfidence(ragResult);
    }
  }
}
```

**Day 39-41: API Endpoint Updates**
```typescript
// src/api/routes/chat.router.ts
export const chatRouter = router({
  message: publicProcedure
    .input(z.object({
      conversationId: z.string(),
      message: z.string(),
      includeConfidence: z.boolean().optional()
    }))
    .mutation(async ({ input, ctx }) => {
      const result = await ctx.masterOrchestrator.processQuery({
        text: input.message,
        conversationId: input.conversationId
      });
      
      return {
        response: result.response,
        confidence: input.includeConfidence ? result.confidence : undefined,
        sources: result.sources,
        metadata: result.metadata
      };
    })
});
```

**Day 42: Frontend Updates**
```typescript
// src/ui/components/Chat/ConfidenceIndicator.tsx
export const ConfidenceIndicator: React.FC<{ confidence: ConfidenceData }> = ({ confidence }) => {
  const getColor = (level: number) => {
    if (level >= 0.8) return 'green';
    if (level >= 0.6) return 'yellow';
    return 'red';
  };
  
  return (
    <div className="confidence-indicator">
      <div className="confidence-bar">
        <div 
          className="confidence-fill"
          style={{ 
            width: `${confidence.overall * 100}%`,
            backgroundColor: getColor(confidence.overall)
          }}
        />
      </div>
      <span className="confidence-label">
        Confidence: {(confidence.overall * 100).toFixed(0)}%
      </span>
    </div>
  );
};
```

### Week 7-8: Testing & Optimization

#### Step 8: Comprehensive Testing

**Day 43-45: Unit Tests**
```typescript
// src/test/unit/confidence/ConfidenceExtractor.test.ts
describe('ConfidenceExtractor', () => {
  it('should convert log probabilities to confidence scores', () => {
    const extractor = new ConfidenceExtractor();
    const tokens = ['Hello', 'world'];
    const logProbs = [-0.1, -0.5];
    
    const result = extractor.extractTokenConfidence(tokens, logProbs);
    
    expect(result[0].confidence).toBeCloseTo(0.905, 3);
    expect(result[1].confidence).toBeCloseTo(0.606, 3);
  });
  
  it('should aggregate confidence conservatively', () => {
    const extractor = new ConfidenceExtractor();
    const tokenConfidence = [
      { confidence: 0.9 },
      { confidence: 0.8 },
      { confidence: 0.7 }
    ];
    
    const aggregated = extractor.aggregateConfidence(tokenConfidence);
    expect(aggregated).toBeLessThan(0.8); // Harmonic mean is conservative
  });
});
```

**Day 46-48: Integration Tests**
```typescript
// src/test/integration/confidence/ConfidenceRAGSystem.test.ts
describe('ConfidenceScoredRAGSystem Integration', () => {
  let system: ConfidenceScoredRAGSystem;
  
  beforeEach(async () => {
    system = new ConfidenceScoredRAGSystem({
      ollama: { url: 'http://localhost:11434' },
      confidence: confidenceConfig
    });
    await system.initialize();
  });
  
  it('should process high-confidence queries correctly', async () => {
    const result = await system.process('What is TypeScript?');
    
    expect(result.confidence.overall).toBeGreaterThan(0.7);
    expect(result.response).toContain('TypeScript');
    expect(result.sources).toHaveLength(greaterThan(0));
  });
  
  it('should handle low-confidence queries appropriately', async () => {
    const result = await system.process('Explain quantum chromodynamics in detail');
    
    expect(result.confidence.overall).toBeLessThan(0.6);
    expect(result.response).toContain('Low Confidence');
    expect(result.humanReviewNeeded).toBe(true);
  });
});
```

#### Step 9: Performance Optimization

**Day 49-50: CPU Optimization**
```typescript
// src/core/rag/confidence/optimizations/CPUOptimizer.ts
export class CPUOptimizer {
  optimizeForCPU(config: SystemConfig): OptimizedConfig {
    return {
      ...config,
      // Use smaller batch sizes
      batchSize: 1,
      // Reduce concurrent operations
      maxConcurrency: 2,
      // Enable caching aggressively
      caching: {
        enabled: true,
        ttl: 3600,
        maxSize: 1000
      },
      // Use quantized models when possible
      modelConfig: {
        quantization: '4bit',
        threads: 8 // Utilize all CPU threads
      }
    };
  }
}
```

**Day 51-52: Caching Implementation**
```typescript
// src/core/rag/confidence/ConfidenceCache.ts
export class ConfidenceCache {
  private cache: Map<string, CachedResult> = new Map();
  
  async get(key: string): Promise<CachedResult | null> {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    // Check if still valid
    if (Date.now() - cached.timestamp > cached.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return cached;
  }
  
  async set(
    key: string, 
    result: ConfidenceResult, 
    ttl: number = 3600000
  ): Promise<void> {
    this.cache.set(key, {
      ...result,
      timestamp: Date.now(),
      ttl
    });
    
    // Implement LRU eviction if needed
    if (this.cache.size > 1000) {
      this.evictOldest();
    }
  }
}
```

### Week 8: Documentation & Deployment

#### Step 10: Documentation

**Day 53-54: API Documentation**
```typescript
/**
 * @api {post} /api/chat/message Send Message with Confidence Scoring
 * @apiName SendMessage
 * @apiGroup Chat
 * 
 * @apiParam {String} conversationId Conversation identifier
 * @apiParam {String} message User message
 * @apiParam {Boolean} [includeConfidence=false] Include confidence scores
 * 
 * @apiSuccess {String} response AI response
 * @apiSuccess {Object} [confidence] Confidence scores
 * @apiSuccess {Number} confidence.overall Overall confidence (0-1)
 * @apiSuccess {Number} confidence.retrieval Retrieval confidence
 * @apiSuccess {Number} confidence.generation Generation confidence
 * @apiSuccess {Object[]} sources Source documents with scores
 */
```

**Day 55-56: User Guide**
```markdown
# Confidence-Scored RAG System User Guide

## Understanding Confidence Levels

### High Confidence (80-100%)
- Response is reliable and well-supported
- Multiple high-quality sources confirm the information
- Safe to use for critical decisions

### Medium Confidence (60-80%)
- Response is likely accurate but may benefit from verification
- Some uncertainty in source quality or coverage
- Suitable for general use with awareness

### Low Confidence (40-60%)
- Response should be treated as preliminary
- Limited or conflicting sources
- Verify before using for important tasks

### Very Low Confidence (<40%)
- Human review recommended
- Significant uncertainty or gaps in knowledge
- Use only as a starting point for research
```

---

## Success Metrics

### Technical Metrics
- Confidence-accuracy correlation > 0.8
- Response time < 3s (CPU-only)
- False positive rate < 5%
- System uptime > 99.9%

### User Metrics
- User trust score > 4.5/5
- Positive feedback rate > 80%
- Human review override rate < 10%
- Average session length increase > 20%

### Business Metrics
- Support ticket reduction > 30%
- User retention improvement > 25%
- Query success rate > 90%
- Cost per query < $0.001

---

## Risk Mitigation

### Technical Risks
1. **Log probability unavailability**
   - Mitigation: Implement fallback confidence estimation
   - Use response coherence and consistency metrics

2. **Performance degradation**
   - Mitigation: Aggressive caching strategy
   - Progressive enhancement based on available resources

3. **Calibration drift**
   - Mitigation: Continuous monitoring and adjustment
   - A/B testing for threshold optimization

### Operational Risks
1. **User confusion about confidence**
   - Mitigation: Clear UI/UX design
   - Educational tooltips and documentation

2. **Over-reliance on high confidence**
   - Mitigation: Periodic confidence audits
   - User education on limitations

---

## Monitoring & Maintenance

### Daily Monitoring
- Confidence accuracy metrics
- Response time percentiles
- Error rates by confidence level
- User feedback trends

### Weekly Reviews
- Calibration performance
- Threshold effectiveness
- Cache hit rates
- Model performance metrics

### Monthly Optimization
- Threshold adjustments based on data
- Model updates if available
- Performance tuning
- User satisfaction surveys

---

## Next Steps

1. **Immediate Actions**
   - Set up development environment
   - Install dependencies
   - Create project structure

2. **Week 1 Goals**
   - Complete foundation setup
   - Implement basic confidence extraction
   - Test Ollama log probability support

3. **First Milestone**
   - Working prototype with basic confidence scoring
   - Integration with existing chat interface
   - Initial performance benchmarks

---

This implementation plan provides a clear roadmap for transitioning to the confidence-scored RAG system. The modular approach allows for incremental development and testing while maintaining system stability.