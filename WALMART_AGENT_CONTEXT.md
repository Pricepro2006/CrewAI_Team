# 🛒 Walmart Grocery Agent - Comprehensive Context Capture

## Project Overview
- **Project**: CrewAI Team - Walmart Grocery Agent
- **Location**: `/home/pricepro2006/CrewAI_Team`
- **Purpose**: Natural language grocery list building with live Walmart pricing
- **Current State**: Performance degradation issues requiring optimization
- **Date Captured**: 2025-08-06

## System Architecture

### Port Configuration
- **Walmart Agent UI**: Port 5178
- **Main App**: Port 5173  
- **API Server**: Port 3000
- **WebSocket**: wss://localhost:3000/walmart-prices

### Key Components
- **WalmartChatAgent.ts**: Main agent (1181 lines - GOD OBJECT anti-pattern)
- **WalmartPriceFetcher**: Handles Walmart API pricing calls
- **WalmartGroceryService**: Manages grocery list operations
- **SmartMatchingService**: Product matching and search
- **DealRecommendationEngine**: Deal suggestions
- **PreferenceLearningService**: User preference learning
- **PurchaseHistoryService**: Purchase history tracking

## Critical Performance Issues

### 1. Ollama LLM Bottleneck (SEVERE)
**Current Configuration**:
```bash
OLLAMA_NUM_PARALLEL=1  # Critical bottleneck
```

**Performance Degradation**:
- 1 operation: 1.5 seconds
- 2 operations: 3 seconds  
- 3 operations: 8 seconds
- 4+ operations: 15-30 seconds

**Model Issues**:
- Using phi-4:14b (6.5GB) for simple grocery parsing
- Should use smaller model like llama2:7b for faster response
- No dedicated queue for grocery NLP operations

### 2. Memory Management Issues
- **Current Usage**: 22GB/54GB RAM
- **Load Average**: 9.01 (high for grocery operations)
- **Memory Leaks Identified**:
  - Unbounded conversations map in WalmartChatAgent
  - Unbounded WebSocket event history
  - No cleanup of stale conversation contexts

### 3. WebSocket Problems
- No backpressure handling
- Unbounded event history accumulation
- Missing rate limiting
- No connection pooling
- Single connection for all users (bottleneck)

### 4. Missing Caching Layers
- No LLM response cache for common queries
- No product information cache
- No price cache (fetching from API every time)
- No grocery list template cache

## Identified Anti-Patterns

### God Object (WalmartChatAgent.ts)
- 1181 lines of code
- Too many responsibilities:
  - NLP processing
  - Price fetching
  - List management
  - Deal recommendations
  - Preference learning
  - Conversation management
  - WebSocket handling

### Singleton Services
- No request isolation
- Shared mutable state across all users
- Race conditions in concurrent operations
- No proper dependency injection

### Synchronous Processing Chain
- All operations are synchronous
- No streaming responses
- No async/await optimization
- Blocking I/O operations

## Current Performance Metrics

### Query Performance
- **Simple Query** ("add milk and eggs"): 2-3 seconds (target: <500ms)
- **With Queue Backup**: 5-15 seconds
- **Database Queries**: 15ms (excellent)
- **Price Lookup**: Unknown (needs measurement)
- **List Total Update**: Unknown (needs measurement)

### System Resources
- **CPU Usage**: High during NLP operations
- **Memory**: 22GB/54GB used
- **Disk I/O**: Normal
- **Network**: Normal except during Walmart API bursts

## Optimization Plan Summary

### Phase 1: Critical Fixes (3 hours)
1. **Implement GroceryNLPQueue**
   - Dedicated queue with 2-operation limit
   - Priority queue for active user input
   - Batch processing for bulk imports

2. **Add 3-Tier Price Caching**
   - L1: In-memory LRU cache (1000 items, 1-minute TTL)
   - L2: Redis cache (5-minute TTL)
   - L3: SQLite persistent cache
   - L4: Walmart API (fallback only)

3. **Fix Memory Leaks**
   - Implement conversation cleanup
   - Add TTL to conversation map
   - Bounded WebSocket event history

### Phase 2: Core Improvements (4 hours)
1. **Worker Pool for NLP**
   - Separate process for NLP operations
   - Non-blocking main thread
   - Better CPU utilization

2. **Queue Management**
   - Separate queues for:
     - NLP processing
     - Walmart API calls
     - Database operations
     - WebSocket broadcasts

3. **Circuit Breakers**
   - Walmart API circuit breaker
   - Ollama service circuit breaker
   - Automatic fallback mechanisms

### Phase 3: Architecture Refactor (2-3 weeks)
1. **Break Down God Object**
   - Separate services for each concern
   - Microservice architecture
   - Clear boundaries and interfaces

2. **Request-Scoped Context**
   - Eliminate global state
   - Per-request isolation
   - Proper dependency injection

3. **Event-Driven Architecture**
   - Event bus for component communication
   - Decoupled services
   - Better scalability

## Configuration Changes Needed

### Immediate Changes
```bash
# Change Ollama configuration
OLLAMA_NUM_PARALLEL=2  # From 1
WALMART_OLLAMA_CONCURRENCY=2
WALMART_OLLAMA_TIMEOUT=5s
WALMART_OLLAMA_MODEL=llama2:7b  # Smaller model

# Add caching configuration
WALMART_CACHE_TTL=60
REDIS_URL=redis://localhost:6379
```

### Database Schema Updates
```sql
-- Add indexes for performance
CREATE INDEX idx_grocery_items_list ON grocery_items(list_id);
CREATE INDEX idx_grocery_items_product ON grocery_items(product_id);
CREATE INDEX idx_price_history_product ON price_history(product_id, timestamp);
```

## Success Metrics

### Performance Targets
| Metric | Current | Target | Method |
|--------|---------|--------|--------|
| Simple Query | 2-3s | <500ms | NLP Queue + Cache |
| Price Lookup | Unknown | <50ms | 3-tier cache |
| List Update | Unknown | <10ms | Reactive state |
| Concurrent Ops | 15-30s | <2s | Queue management |
| Memory Usage | 22GB | <15GB | Leak fixes |

### Reliability Targets
- Zero memory leaks
- <1% error rate
- 99.9% uptime
- Graceful degradation

## Important Files

### Core Agent Files
- `/src/api/services/agents/WalmartChatAgent.ts` - Main agent (needs refactor)
- `/src/api/services/WalmartPriceFetcher.ts` - Price fetching
- `/src/api/services/WalmartGroceryService.ts` - List management
- `/src/api/services/SmartMatchingService.ts` - Product matching

### Configuration Files
- `.env` - Environment variables
- `package.json` - Dependencies and scripts
- `tsconfig.json` - TypeScript configuration

### Documentation
- `/WALMART_GROCERY_OPTIMIZATION_PLAN.md` - Detailed optimization plan
- `/CLEANUP_COMPLETE.md` - System cleanup documentation

## Historical Context

### Initial Over-Engineering
- Originally deployed on K8s cluster ($3000/month)
- Over-architected with unnecessary complexity
- Successfully simplified to local-first deployment ($0/month)

### Current Database State
- 143,221 emails in database (unrelated to Walmart agent)
- Database performance is excellent (15ms queries)
- SQLite handling load well

## Next Actions Required

### Immediate (Today)
1. Get user approval for Phase 1 implementation
2. Change OLLAMA_NUM_PARALLEL to 2
3. Implement GroceryNLPQueue
4. Add basic memory cache for prices

### Short-term (This Week)
1. Complete Phase 1 optimizations
2. Measure and document performance improvements
3. Begin Phase 2 queue management
4. Set up monitoring dashboard

### Long-term (Next Month)
1. Complete architecture refactor
2. Implement microservices pattern
3. Add comprehensive testing
4. Deploy production-ready version

## Critical Dependencies

### External Services
- Ollama LLM service (local)
- Walmart API (rate-limited)
- Redis (optional, for caching)

### Internal Dependencies
- SQLite database
- WebSocket server
- React frontend

## Risk Assessment

### High Risk
- Ollama bottleneck causing system-wide degradation
- Memory leaks causing crashes
- Walmart API rate limiting

### Medium Risk
- WebSocket connection instability
- Cache invalidation issues
- Concurrent operation conflicts

### Low Risk
- Database performance
- Frontend rendering
- Network connectivity

## Contact Points
- Project Owner: pricepro2006
- Last Updated: 2025-08-06
- Priority: HIGH - Performance critical

---

## Session Notes

### Key Decisions Made
1. Focus on Walmart Grocery Agent specifically (not general system)
2. Prioritize performance over features
3. Use simple, practical solutions (no over-engineering)
4. Local-first approach maintained

### Unresolved Questions
1. Exact Walmart API rate limits?
2. Redis deployment decision?
3. User acceptance testing plan?
4. Monitoring/alerting setup?

### Follow-up Required
1. Performance benchmarking after Phase 1
2. User feedback on response times
3. Load testing with concurrent users
4. Memory profiling after leak fixes

---

**END OF CONTEXT CAPTURE**

This context provides complete information for any future agent or session working on the Walmart Grocery Agent optimization project.