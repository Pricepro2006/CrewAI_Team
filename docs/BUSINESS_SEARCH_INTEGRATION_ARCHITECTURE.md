# Business Search Integration Architecture
## GROUP 2B WebSearch Enhancement

### Overview

This document describes the integration architecture for the Business Search Enhancement feature, which seamlessly adds WebSearch capabilities to the existing chat/model system without requiring changes to existing code.

### Architecture Principles

1. **Non-invasive Integration**: Uses proxy pattern to wrap existing OllamaProvider
2. **Feature Flag Control**: Gradual rollout with A/B testing capabilities
3. **Graceful Degradation**: Circuit breaker pattern for fault tolerance
4. **Performance Monitoring**: Built-in metrics and latency tracking
5. **Backward Compatibility**: Zero breaking changes to existing code

### Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        User Request                          │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│                    ConversationService                       │
│                 (No changes required)                        │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│                         Agent                                │
│                 (No changes required)                        │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│               BusinessSearchMiddleware                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ • Intercepts generate() calls                       │   │
│  │ • Checks feature flags                              │   │
│  │ • Analyzes query with BusinessQueryOptimizer        │   │
│  │ • Enhances prompt with BusinessSearchPromptEnhancer │   │
│  │ • Validates response with BusinessResponseValidator │   │
│  │ • Collects metrics                                  │   │
│  └─────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│                    OllamaProvider                            │
│              (Original, unmodified)                          │
└─────────────────────────────────────────────────────────────┘
```

### Integration Flow

1. **Initialization Phase**
   ```typescript
   // In agent initialization or factory
   const provider = new OllamaProvider(config);
   const middleware = new BusinessSearchMiddleware();
   const wrappedProvider = middleware.wrapProvider(provider);
   // Use wrappedProvider instead of provider
   ```

2. **Request Processing**
   - Request arrives at agent
   - Agent calls `wrappedProvider.generate(prompt)`
   - Middleware intercepts the call
   - Feature flag check determines if enhancement should occur
   - If enabled, prompt is analyzed and potentially enhanced
   - Enhanced prompt is passed to original provider
   - Response is validated for business information
   - Metrics are collected throughout

3. **Feature Flag Decision Tree**
   ```
   Is feature enabled globally?
   ├─ No → Pass through to original provider
   └─ Yes → Check user rollout percentage
           ├─ User not in rollout → Pass through
           └─ User in rollout → Check query type
                               ├─ Not business query → Pass through
                               └─ Business query → Enhance prompt
   ```

### Feature Flag Configuration

The system supports multiple configuration methods:

1. **Environment Variables**
   ```bash
   # Enable with percentage rollout
   FEATURE_FLAG_BUSINESS_SEARCH_ENHANCEMENT=50
   
   # Or simple on/off
   FEATURE_FLAG_BUSINESS_SEARCH_ENHANCEMENT=true
   ```

2. **Configuration File** (`feature-flags.json`)
   ```json
   {
     "flags": [{
       "name": "business-search-enhancement",
       "enabled": true,
       "rolloutPercentage": 25,
       "metadata": {
         "group": "2B",
         "component": "WebSearch"
       }
     }]
   }
   ```

3. **Runtime API**
   ```typescript
   const featureFlags = FeatureFlagService.getInstance();
   
   // Gradual rollout
   featureFlags.setRolloutPercentage('business-search-enhancement', 10);
   // Increase to 50%
   featureFlags.setRolloutPercentage('business-search-enhancement', 50);
   // Full rollout
   featureFlags.enableFlag('business-search-enhancement', 100);
   ```

### Graceful Degradation Strategy

The middleware implements multiple layers of fault tolerance:

1. **Circuit Breaker Pattern**
   - Monitors failure rate
   - Opens circuit after 5 consecutive failures
   - Bypasses middleware when open
   - Auto-recovers after 1-minute cooldown

2. **Performance Monitoring**
   - Tracks added latency
   - Warns if latency exceeds 2 seconds
   - Can disable feature if performance degrades

3. **Validation Failures**
   - Tracks validation success rate
   - Logs failures for analysis
   - Does not block response delivery

4. **Fallback Behavior**
   - If enhancement fails, original prompt is used
   - If validation fails, response is still delivered
   - If circuit breaker opens, system continues normally

### Metrics and Monitoring

The middleware provides comprehensive metrics:

```typescript
interface MiddlewareMetrics {
  totalRequests: number;          // Total requests processed
  enhancedRequests: number;       // Requests with enhanced prompts
  searchTriggeredRequests: number; // Business queries detected
  validatedResponses: number;      // Responses validated
  failedValidations: number;       // Validation failures
  averageLatency: number;          // Average added latency (ms)
  errors: number;                  // Total errors encountered
  circuitBreakerStatus: string;    // 'closed' | 'open' | 'half-open'
}
```

Access metrics:
```typescript
const metrics = middleware.getMetrics();
console.log(`Enhancement rate: ${(metrics.enhancedRequests / metrics.totalRequests * 100).toFixed(2)}%`);
console.log(`Average latency: ${metrics.averageLatency.toFixed(2)}ms`);
```

### Integration Points

1. **Agent Factory Integration**
   ```typescript
   // In AgentFactory or similar
   export function createAgent(config: AgentConfig): BaseAgent {
     const agent = new SomeAgent(config);
     
     // Wrap provider if feature is available
     if (agent.provider && BusinessSearchMiddleware) {
       const middleware = new BusinessSearchMiddleware();
       agent.provider = middleware.wrapProvider(agent.provider);
     }
     
     return agent;
   }
   ```

2. **Direct Integration**
   ```typescript
   // In specific agent implementation
   class EnhancedAgent extends BaseAgent {
     constructor() {
       super();
       this.provider = new OllamaProvider(config);
       
       // Apply middleware
       const middleware = new BusinessSearchMiddleware();
       this.provider = middleware.wrapProvider(this.provider);
     }
   }
   ```

3. **Conditional Integration**
   ```typescript
   // Based on configuration
   const provider = new OllamaProvider(config);
   
   if (appConfig.features?.businessSearch?.enabled) {
     const middleware = new BusinessSearchMiddleware({
       enhancementLevel: appConfig.features.businessSearch.level || 'standard'
     });
     return middleware.wrapProvider(provider);
   }
   
   return provider;
   ```

### Testing Strategy

1. **Unit Tests**: Test middleware in isolation with mocked providers
2. **Integration Tests**: Test with real providers and components
3. **A/B Testing**: Compare metrics between control and test groups
4. **Performance Tests**: Measure latency impact under load
5. **Failure Tests**: Verify graceful degradation scenarios

### Rollout Plan

1. **Phase 1: Internal Testing (0-5%)**
   - Deploy with 0% rollout
   - Enable for internal test accounts
   - Monitor metrics and logs

2. **Phase 2: Limited Beta (5-25%)**
   - Gradually increase percentage
   - Monitor performance impact
   - Collect user feedback

3. **Phase 3: Gradual Rollout (25-75%)**
   - Increase in 10% increments
   - Compare A/B test results
   - Optimize based on metrics

4. **Phase 4: Full Deployment (75-100%)**
   - Complete rollout
   - Keep feature flag for emergency rollback
   - Document learnings

### Emergency Procedures

1. **Immediate Disable**
   ```bash
   # Set environment variable
   export FEATURE_FLAG_BUSINESS_SEARCH_ENHANCEMENT=false
   # Or use API
   featureFlags.disableFlag('business-search-enhancement');
   ```

2. **Reset Circuit Breaker**
   ```typescript
   middleware.resetCircuitBreaker();
   ```

3. **Performance Issues**
   ```typescript
   // Reduce enhancement level
   middleware.updateConfig({ enhancementLevel: 'minimal' });
   // Or increase latency tolerance
   middleware.updateConfig({ maxLatencyMs: 5000 });
   ```

### Monitoring Dashboard

Key metrics to monitor:
- Enhancement rate (enhanced/total requests)
- Average added latency
- Validation success rate
- Circuit breaker trips
- Error rate
- User satisfaction metrics

### Future Enhancements

1. **Dynamic Model Selection**: Choose models based on query complexity
2. **Response Caching**: Cache enhanced responses for common queries
3. **Multi-language Support**: Enhance business queries in multiple languages
4. **Custom Enhancement Rules**: Per-tenant or per-user enhancement logic
5. **Machine Learning**: Learn from validation failures to improve enhancement