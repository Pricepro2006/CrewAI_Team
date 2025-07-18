# Migration Guide: From 6-Step Planning to Confidence-Scored RAG

## Overview

This guide helps you migrate from the existing 6-step planning approach to the new 4-step confidence-scored RAG system. The migration can be done gradually with minimal disruption to existing functionality.

## Migration Timeline

### Phase 1: Preparation (Week 1)
- Install new dependencies
- Deploy confidence components alongside existing system
- Set up monitoring for both systems

### Phase 2: Parallel Running (Weeks 2-3)
- Run both systems in parallel
- Compare results and performance
- Collect metrics for analysis

### Phase 3: Gradual Transition (Weeks 4-5)
- Route increasing percentage of queries to new system
- Monitor user feedback and system performance
- Adjust confidence thresholds based on data

### Phase 4: Full Migration (Week 6)
- Switch all traffic to confidence system
- Maintain old system as fallback
- Remove old system after stability confirmed

## Step-by-Step Migration

### 1. Update Dependencies

```bash
# Install new dependencies
pnpm add @xenova/transformers mathjs simple-statistics

# Update existing packages
pnpm update
```

### 2. Environment Configuration

Add to your `.env` file:

```env
# Confidence scoring configuration
CONFIDENCE_PROFILE=balanced
ENABLE_CONFIDENCE_SCORING=true
USE_PARALLEL_SYSTEMS=true
CONFIDENCE_ROUTING_PERCENTAGE=10

# Model configuration for confidence
CONFIDENCE_MODEL=qwen3:14b
AGENT_MODEL=qwen3:8b
EMBEDDING_MODEL=nomic-embed-text
```

### 3. Code Changes

#### Update Master Orchestrator Usage

**Old approach:**
```typescript
import { MasterOrchestrator } from './core/master-orchestrator/MasterOrchestrator';

const orchestrator = new MasterOrchestrator(config);
const result = await orchestrator.processQuery(query);
```

**New approach:**
```typescript
import { ConfidenceMasterOrchestrator } from './core/master-orchestrator/ConfidenceMasterOrchestrator';

const orchestrator = new ConfidenceMasterOrchestrator(config);
const result = await orchestrator.processQuery(query);

// Access confidence data
console.log('Confidence:', result.confidence);
console.log('Processing path:', result.processingPath);
console.log('Feedback ID:', result.feedbackId);
```

#### Update API Routes

**Old chat endpoint:**
```typescript
app.post('/api/chat', async (req, res) => {
  const result = await orchestrator.processQuery(req.body);
  res.json({ response: result.summary });
});
```

**New confidence-aware endpoint:**
```typescript
app.post('/api/chat', async (req, res) => {
  const result = await orchestrator.processQuery(req.body);
  res.json({
    response: result.deliveredResponse.content,
    confidence: result.confidence,
    feedbackId: result.feedbackId,
    metadata: result.deliveredResponse.metadata
  });
});

// Add feedback endpoint
app.post('/api/feedback/:feedbackId', async (req, res) => {
  orchestrator.captureFeedback(req.params.feedbackId, req.body);
  res.json({ success: true });
});
```

### 4. Database Schema Updates

If using a database, add these fields to your conversations table:

```sql
ALTER TABLE conversations ADD COLUMN confidence DECIMAL(3,2);
ALTER TABLE conversations ADD COLUMN processing_path VARCHAR(50);
ALTER TABLE conversations ADD COLUMN feedback_id VARCHAR(100);
ALTER TABLE conversations ADD COLUMN human_review_needed BOOLEAN DEFAULT FALSE;

CREATE TABLE feedback (
  id VARCHAR(100) PRIMARY KEY,
  conversation_id VARCHAR(100),
  helpful BOOLEAN,
  accurate BOOLEAN,
  comments TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 5. Frontend Updates

#### Add Confidence Display

```typescript
// React component example
function MessageWithConfidence({ message, confidence }) {
  return (
    <div className="message">
      <div className="content">{message}</div>
      {confidence && (
        <div className="confidence">
          <ConfidenceIndicator score={confidence.score} />
          <span>{confidence.display}</span>
        </div>
      )}
    </div>
  );
}
```

#### Add Feedback Component

```typescript
function FeedbackWidget({ feedbackId, onSubmit }) {
  const [feedback, setFeedback] = useState({});
  
  const handleSubmit = async () => {
    await fetch(`/api/feedback/${feedbackId}`, {
      method: 'POST',
      body: JSON.stringify(feedback)
    });
    onSubmit();
  };
  
  return (
    <div className="feedback">
      <button onClick={() => setFeedback({...feedback, helpful: true})}>
        👍 Helpful
      </button>
      <button onClick={() => setFeedback({...feedback, helpful: false})}>
        👎 Not Helpful
      </button>
    </div>
  );
}
```

### 6. A/B Testing Setup

```typescript
// Parallel system routing
async function routeQuery(query: Query) {
  const useNewSystem = Math.random() < (CONFIDENCE_ROUTING_PERCENTAGE / 100);
  
  if (useNewSystem) {
    // Track for analytics
    analytics.track('system_used', { system: 'confidence' });
    return await confidenceOrchestrator.processQuery(query);
  } else {
    analytics.track('system_used', { system: 'legacy' });
    return await legacyOrchestrator.processQuery(query);
  }
}
```

### 7. Monitoring Setup

```typescript
// Add monitoring for both systems
const monitoringMiddleware = (system: string) => {
  return async (req, res, next) => {
    const start = Date.now();
    
    res.on('finish', () => {
      metrics.record({
        system,
        duration: Date.now() - start,
        statusCode: res.statusCode,
        confidence: res.locals.confidence,
        path: req.path
      });
    });
    
    next();
  };
};
```

## Configuration Profiles

Choose the appropriate profile based on your use case:

```typescript
// Conservative - For critical applications
const conservativeConfig = {
  profile: 'conservative',
  complexityThresholds: { simple: 2, medium: 5 }
};

// Balanced - For general use
const balancedConfig = {
  profile: 'balanced',
  complexityThresholds: { simple: 3, medium: 7 }
};

// Permissive - For research/exploration
const permissiveConfig = {
  profile: 'permissive',
  complexityThresholds: { simple: 4, medium: 8 }
};
```

## Common Migration Issues

### Issue 1: Lower Confidence Scores Than Expected

**Solution:** Start with permissive profile and gradually increase thresholds:
```typescript
// Week 1: Permissive
process.env.CONFIDENCE_PROFILE = 'permissive';

// Week 3: Balanced
process.env.CONFIDENCE_PROFILE = 'balanced';

// Week 5: Production
process.env.CONFIDENCE_PROFILE = 'production';
```

### Issue 2: Increased Response Times

**Solution:** Implement caching and optimization:
```typescript
const cache = new Map();

async function cachedConfidenceQuery(query: string) {
  const cacheKey = createHash(query);
  
  if (cache.has(cacheKey)) {
    const cached = cache.get(cacheKey);
    if (Date.now() - cached.timestamp < 300000) { // 5 min TTL
      return cached.result;
    }
  }
  
  const result = await orchestrator.processQuery({ text: query });
  cache.set(cacheKey, { result, timestamp: Date.now() });
  return result;
}
```

### Issue 3: User Confusion About Confidence

**Solution:** Add user education and tooltips:
```typescript
const confidenceExplanations = {
  high: "This response is based on strong evidence and high-quality sources.",
  medium: "This response is reasonably confident but may benefit from verification.",
  low: "This response has lower confidence. Consider checking additional sources.",
  very_low: "Unable to provide a confident response. Please rephrase or provide more context."
};
```

## Rollback Plan

If issues arise, you can quickly rollback:

1. **Immediate Rollback:**
   ```bash
   # Disable confidence scoring
   ENABLE_CONFIDENCE_SCORING=false
   
   # Route all traffic to legacy system
   CONFIDENCE_ROUTING_PERCENTAGE=0
   ```

2. **Gradual Rollback:**
   ```typescript
   // Reduce confidence system usage gradually
   for (let percentage = 50; percentage >= 0; percentage -= 10) {
     process.env.CONFIDENCE_ROUTING_PERCENTAGE = percentage.toString();
     await sleep(3600000); // Wait 1 hour between reductions
   }
   ```

## Success Metrics

Monitor these metrics to ensure successful migration:

1. **Response Quality**
   - User satisfaction rate > 85%
   - Positive feedback rate > 70%
   - Low confidence responses < 20%

2. **Performance**
   - P95 response time < 3 seconds
   - CPU usage < 80%
   - Memory usage stable

3. **Reliability**
   - Error rate < 0.1%
   - Fallback usage < 5%
   - Uptime > 99.9%

## Post-Migration Optimization

After successful migration:

1. **Collect Calibration Data**
   ```typescript
   // Export feedback for calibration training
   const feedbackData = await orchestrator.exportFeedbackData();
   await trainCalibrationModel(feedbackData);
   ```

2. **Optimize Thresholds**
   ```typescript
   // Analyze performance by confidence level
   const analysis = await analyzeConfidencePerformance();
   const optimizedThresholds = calculateOptimalThresholds(analysis);
   ```

3. **Remove Legacy Code**
   ```bash
   # After 30 days of stable operation
   git rm -r src/core/master-orchestrator/legacy/
   git commit -m "Remove legacy 6-step planning system"
   ```

## Support Resources

- **Documentation**: `/docs/confidence-scoring.md`
- **API Reference**: `/docs/api/confidence-endpoints.md`
- **Troubleshooting**: `/docs/troubleshooting/confidence-issues.md`
- **Community**: Discord channel #confidence-scoring
- **Support**: confidence-support@example.com

## Conclusion

The migration to confidence-scored RAG provides:
- Better reliability through confidence tracking
- Improved user experience with adaptive responses
- Continuous improvement through feedback loops
- More efficient resource usage

Follow this guide carefully and monitor metrics throughout the migration. The gradual approach ensures minimal disruption while maximizing the benefits of the new system.