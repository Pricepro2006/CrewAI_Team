# Agent Collaboration Workflow for Email Pipeline

## 🎭 Agent Team Composition

### 🏗️ Architecture & Design Team
```
backend-systems-architect (Lead)
    ├── database-optimizer
    ├── architecture-reviewer
    └── performance-engineer
```

### 💻 Implementation Team
```
python-expert-developer (Lead)
    ├── ai-engineer-llm
    ├── typescript-pro
    └── javascript-async-expert
```

### 🐛 Quality & Testing Team
```
error-resolution-specialist (Lead)
    ├── test-failure-debugger
    ├── performance-engineer
    └── security-patches-expert
```

### 🚀 Deployment Team
```
ml-production-engineer (Lead)
    ├── database-admin-ops
    ├── performance-engineer
    └── git-version-control-expert
```

---

## 📊 Agent Workflow by Phase

### Day 1-2: Architecture & Foundation
```mermaid
backend-systems-architect
    → Designs complete data flow
    → Hands off to →
    
database-optimizer
    → Optimizes 143k email queries
    → Creates indexes and views
    → Validates with →
    
performance-engineer
    → Benchmarks query performance
    → Reports metrics to →
    
architecture-reviewer
    → Reviews and approves design
```

### Day 3-5: LLM Implementation
```mermaid
ai-engineer-llm
    → Optimizes prompts for Llama/Phi
    → Provides templates to →
    
python-expert-developer
    → Implements batch processing
    → Fixes timeout issues
    → Collaborates with →
    
performance-engineer
    → Profiles LLM performance
    → Optimizes throughput
    
error-resolution-specialist
    → Debugs any failures
    → Ensures error recovery
```

### Day 6-7: Backend Integration
```mermaid
backend-systems-architect
    → Connects all services
    → Defines interfaces for →
    
typescript-pro
    → Fixes type issues
    → Ensures type safety
    
frontend-ui-ux-engineer
    → Implements API consumption
    → Creates UI components
    
javascript-async-expert
    → Handles WebSocket events
    → Manages real-time updates
```

### Day 8-9: Frontend & Testing
```mermaid
frontend-ui-ux-engineer
    → Builds email intelligence UI
    → Integrates with →
    
test-failure-debugger
    → Fixes broken tests
    → Creates new test cases
    
performance-engineer
    → Load tests UI
    → Optimizes rendering
```

### Day 10-13: Production Deployment
```mermaid
ml-production-engineer
    → Deploys LLM pipeline
    → Coordinates with →
    
database-admin-ops
    → Prepares production DB
    → Sets up monitoring
    
git-version-control-expert
    → Manages deployment branches
    → Documents releases
    
architecture-reviewer
    → Final approval
    → Signs off deployment
```

---

## 🔄 Continuous Agent Activities

### Throughout All Phases:

**context-manager**
- Maintains project state between agent handoffs
- Documents critical decisions
- Ensures knowledge transfer

**error-resolution-specialist**
- On-call for any blocking issues
- Investigates failures
- Provides workarounds

**performance-engineer**
- Monitors all metrics
- Identifies bottlenecks
- Suggests optimizations

---

## 💬 Agent Communication Protocol

### 1. Morning Standup (Virtual)
```
backend-systems-architect: "Here's today's architecture focus..."
python-expert-developer: "I need these APIs from backend..."
error-resolution-specialist: "Yesterday's blockers were..."
performance-engineer: "Current metrics show..."
```

### 2. Handoff Format
```
FROM: database-optimizer
TO: python-expert-developer
SUBJECT: Optimized queries ready

I've created the following optimized queries:
- Email batch query: 50ms average
- Status update query: 10ms average
- Indexes created on: status, chain_score, phase

Your turn to implement the batch processor.
```

### 3. Blocker Escalation
```
Level 1: Try error-resolution-specialist
Level 2: Engage architecture-reviewer
Level 3: Full team consultation
```

---

## 🎯 Agent Success Metrics

### backend-systems-architect
- ✅ Clean service boundaries
- ✅ No circular dependencies
- ✅ Clear data flow

### database-optimizer
- ✅ All queries <100ms
- ✅ Proper indexing strategy
- ✅ No N+1 problems

### python-expert-developer
- ✅ Clean, maintainable code
- ✅ Proper error handling
- ✅ 80%+ test coverage

### ai-engineer-llm
- ✅ Optimized token usage
- ✅ High-quality extractions
- ✅ Consistent responses

### frontend-ui-ux-engineer
- ✅ Responsive UI (<200ms)
- ✅ Intuitive data display
- ✅ Real-time updates working

### performance-engineer
- ✅ 60+ emails/minute
- ✅ <4GB memory usage
- ✅ <1% error rate

### ml-production-engineer
- ✅ Zero-downtime deployment
- ✅ Rollback capability
- ✅ Monitoring active

---

## 🚦 Go/No-Go Decision Points

### After Each Phase:
1. **Metrics Met?** → performance-engineer confirms
2. **Quality Approved?** → architecture-reviewer signs off
3. **Tests Passing?** → test-failure-debugger validates
4. **Production Ready?** → ml-production-engineer approves

---

## 📝 Agent Deliverables

### Documentation (all agents contribute):
- Architecture diagrams
- API documentation
- Performance benchmarks
- Deployment runbooks
- Troubleshooting guides

### Code Artifacts:
- Optimized SQL queries
- Python processing scripts
- TypeScript service updates
- React UI components
- Test suites

### Metrics & Reports:
- Daily performance metrics
- Error rate tracking
- Progress dashboards
- Final implementation report