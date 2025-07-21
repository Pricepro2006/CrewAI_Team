# CrewAI Team Optimization Plan

**Date:** January 21, 2025  
**Priority:** High - System Performance & Functionality

---

## Overview
This plan addresses four critical areas for optimizing the CrewAI Team system:
1. Knowledge Base Population for 4-step MO RAG
2. ChromaDB v2 API Migration
3. Query Performance Optimization (15-19s → <5s)
4. Redis Integration for Caching

---

## 1. Knowledge Base Population Plan

### Objective
Populate the vector store with relevant documents to enable the 4-step MO RAG system to provide meaningful responses.

### Step-by-Step Implementation

#### Step 1.1: Start ChromaDB Service
**Time: 5 minutes**
```bash
# Check if ChromaDB is installed
docker ps -a | grep chroma

# If not installed, run:
docker run -d \
  --name chromadb \
  -p 8000:8000 \
  -v ~/master_knowledge_base/databases/chromadb:/chroma/chroma \
  chromadb/chroma:latest

# Verify it's running
curl http://localhost:8000/api/v1/heartbeat
```

#### Step 1.2: Create Knowledge Base Documents
**Time: 15 minutes**

Create essential documents in `~/master_knowledge_base/documents/`:
```bash
# System architecture docs
- system_architecture.md
- agent_descriptions.md
- api_documentation.md
- email_dashboard_guide.md
- troubleshooting_guide.md
```

#### Step 1.3: Create Document Ingestion Script
**Time: 20 minutes**

Create `/src/scripts/populate-knowledge-base.ts`:
```typescript
import { VectorStore } from '../core/rag/VectorStore';
import { DocumentProcessor } from '../core/rag/DocumentProcessor';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

async function populateKnowledgeBase() {
  const vectorStore = new VectorStore({
    path: 'http://localhost:8000',
    collectionName: 'crewai_knowledge'
  });
  
  const processor = new DocumentProcessor();
  const docsPath = join(process.env.HOME!, 'master_knowledge_base/documents');
  
  await vectorStore.initialize();
  
  const files = readdirSync(docsPath);
  for (const file of files) {
    if (file.endsWith('.md')) {
      const content = readFileSync(join(docsPath, file), 'utf-8');
      const chunks = await processor.processDocument({
        content,
        metadata: { source: file, type: 'documentation' }
      });
      
      await vectorStore.addDocuments(chunks);
      console.log(`✅ Processed: ${file}`);
    }
  }
}
```

#### Step 1.4: Run Population Script
**Time: 10 minutes**
```bash
npm run populate-kb
```

---

## 2. ChromaDB v2 API Migration Plan

### Objective
Update ChromaDB client from deprecated v1 to v2 API for better performance and stability.

### Step-by-Step Implementation

#### Step 2.1: Update ChromaDB Client Version
**Time: 5 minutes**

Update `package.json`:
```json
"chromadb": "^1.8.1"  // Latest version with v2 API support
```

Run: `npm install`

#### Step 2.2: Update VectorStore Implementation
**Time: 15 minutes**

Modify `/src/core/rag/VectorStore.ts`:
```typescript
// Update imports
import { ChromaClient } from "chromadb";

// Update client initialization
this.client = new ChromaClient({
  path: chromaPath,
  // Remove deprecated options
  // Add v2 specific options if needed
});

// Update API calls
// v1: await this.client.heartbeat()
// v2: await this.client.version()

// v1: await this.client.getOrCreateCollection()
// v2: await this.client.getCollection() || await this.client.createCollection()
```

#### Step 2.3: Update All ChromaDB API Calls
**Time: 20 minutes**

Search and replace deprecated methods:
- `heartbeat()` → `version()`
- `getOrCreateCollection()` → Separate get/create logic
- Update query methods to v2 format
- Update embedding format if changed

#### Step 2.4: Test Vector Operations
**Time: 10 minutes**
```bash
npm run test:rag
```

---

## 3. Query Performance Optimization Plan

### Objective
Reduce query processing time from 15-19 seconds to under 5 seconds.

### Step-by-Step Implementation

#### Step 3.1: Profile Current Performance
**Time: 15 minutes**

Add performance logging to MasterOrchestrator:
```typescript
// In processQuery method
const timings = {
  start: Date.now(),
  analysisTime: 0,
  agentSelectionTime: 0,
  processingTime: 0,
  responseTime: 0
};

// Log each phase
console.log('Performance breakdown:', timings);
```

#### Step 3.2: Implement Caching Layer
**Time: 30 minutes**

Create `/src/core/cache/QueryCache.ts`:
```typescript
import Redis from 'ioredis';
import crypto from 'crypto';

export class QueryCache {
  private redis: Redis;
  
  constructor() {
    this.redis = new Redis({
      host: 'localhost',
      port: 6379,
      maxRetriesPerRequest: 3
    });
  }
  
  async get(query: string): Promise<any | null> {
    const key = this.generateKey(query);
    const cached = await this.redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }
  
  async set(query: string, response: any, ttl = 3600) {
    const key = this.generateKey(query);
    await this.redis.setex(key, ttl, JSON.stringify(response));
  }
  
  private generateKey(query: string): string {
    return `query:${crypto.createHash('md5').update(query).digest('hex')}`;
  }
}
```

#### Step 3.3: Optimize Agent Initialization
**Time: 20 minutes**

Implement agent pooling:
```typescript
export class AgentPool {
  private agents: Map<string, BaseAgent> = new Map();
  
  async getAgent(type: string): Promise<BaseAgent> {
    if (!this.agents.has(type)) {
      const agent = await this.createAgent(type);
      this.agents.set(type, agent);
    }
    return this.agents.get(type)!;
  }
}
```

#### Step 3.4: Parallel Processing
**Time: 15 minutes**

Update MasterOrchestrator to use parallel operations:
```typescript
// Instead of sequential
const analysis = await this.analyzeQuery(query);
const agent = await this.selectAgent(analysis);

// Use parallel where possible
const [analysis, availableAgents] = await Promise.all([
  this.analyzeQuery(query),
  this.getAvailableAgents()
]);
```

#### Step 3.5: Optimize Ollama Calls
**Time: 10 minutes**

- Use streaming responses
- Implement timeout handling
- Add connection pooling
- Use smaller context windows when possible

---

## 4. Redis Integration Plan

### Objective
Set up Redis for caching and session management to improve performance.

### Step-by-Step Implementation

#### Step 4.1: Install Redis via Docker
**Time: 5 minutes**
```bash
# Run Redis container
docker run -d \
  --name redis \
  -p 6379:6379 \
  -v ~/redis-data:/data \
  redis:7-alpine \
  redis-server --appendonly yes

# Verify connection
redis-cli ping
```

#### Step 4.2: Update Redis Configuration
**Time: 10 minutes**

Create `/src/config/redis.config.ts`:
```typescript
export const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  keyPrefix: 'crewai:',
  retryStrategy: (times: number) => {
    return Math.min(times * 50, 2000);
  }
};
```

#### Step 4.3: Implement Redis Services
**Time: 20 minutes**

Create caching services:
- Session cache for user sessions
- Query cache for repeated queries
- Agent state cache
- Analytics cache for dashboard

#### Step 4.4: Update Existing Services
**Time: 15 minutes**

Modify services to use Redis:
```typescript
// In EmailStorageService
async getAnalytics() {
  const cached = await this.cache.get('email:analytics');
  if (cached) return cached;
  
  const analytics = await this.calculateAnalytics();
  await this.cache.set('email:analytics', analytics, 300); // 5 min TTL
  return analytics;
}
```

---

## Implementation Schedule

### Phase 1: Foundation (Day 1)
1. **Hour 1-2**: Set up Redis and ChromaDB containers
2. **Hour 3-4**: Update ChromaDB to v2 API
3. **Hour 5-6**: Create and populate knowledge base

### Phase 2: Optimization (Day 2)
1. **Hour 1-2**: Implement caching layer
2. **Hour 3-4**: Optimize agent initialization
3. **Hour 5-6**: Performance testing and tuning

### Phase 3: Integration (Day 3)
1. **Hour 1-2**: Integrate Redis throughout system
2. **Hour 3-4**: Final testing of 4-step MO RAG
3. **Hour 5-6**: Documentation and cleanup

---

## Success Metrics

### Performance Targets
- **Query Response Time**: <5 seconds (from 15-19s)
- **Cache Hit Rate**: >60% for common queries
- **Agent Init Time**: <500ms (with pooling)
- **Vector Search**: <1 second

### Functional Targets
- **Knowledge Base**: 50+ documents indexed
- **ChromaDB**: Zero v1 API errors
- **Redis**: <10ms response time
- **4-Step RAG**: Meaningful responses

---

## Testing Plan

### 1. Unit Tests
```bash
npm run test:cache
npm run test:rag
npm run test:performance
```

### 2. Integration Tests
- Test full query flow with caching
- Verify vector search accuracy
- Test Redis failover handling

### 3. Load Tests
- 50 concurrent queries
- Measure response times
- Monitor resource usage

---

## Rollback Plan

If issues arise:
1. **Redis**: System works without it (graceful degradation)
2. **ChromaDB v2**: Keep v1 code in separate branch
3. **Knowledge Base**: Can revert to empty state
4. **Performance**: Disable caching temporarily

---

## Notes

- Redis MCP can be used for monitoring and management
- ChromaDB HTTP mode reduces file system dependencies
- Performance gains are cumulative - each optimization builds on others
- Monitor logs closely during rollout for any issues

---

**Approval Required Before Proceeding**