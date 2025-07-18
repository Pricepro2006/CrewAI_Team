# CrewAI Team - TODO List

This document contains a comprehensive list of all TODO comments and pending implementations found in the codebase.

## Source Code TODOs

### Core Components

#### 1. MultiModalEvaluator.ts
- **File**: `src/core/rag/confidence/MultiModalEvaluator.ts:94`
- **TODO**: Apply calibration (currently placeholder - will be implemented in ConfidenceCalibrator)
- **Context**: The calibration logic for confidence scores needs to be implemented
```typescript
const calibratedConfidence = rawConfidence; // TODO: Apply calibration
```

#### 2. Dashboard Component
- **File**: `src/ui/components/Dashboard/Dashboard.tsx:47`
- **TODO**: Implement agents.list endpoint
- **Context**: The agents list endpoint is not yet implemented, using mock data
```typescript
const agents = null; // TODO: Implement agents.list endpoint
```

### Placeholder Implementations

#### 1. MaestroFramework.ts
- **File**: `src/core/maestro/MaestroFramework.ts:162`
- **Note**: Returns a placeholder for agent task execution
- **Context**: Needs integration with the AgentRegistry
```typescript
// For now, return a placeholder
return {
  type: "agent",
  agentType: task.data.agentType,
  result: "Agent task completed",
};
```

#### 2. ServiceCleanupManager.ts
- **File**: `src/api/services/ServiceCleanupManager.ts:90`
- **Note**: Placeholder for tracking open connections
- **Context**: Actual implementation would track open connections

#### 3. Enhanced Router
- **File**: `src/api/trpc/enhanced-router.ts:311`
- **Note**: Placeholder for dynamic router configuration

## Documentation TODOs

### 1. CONFIDENCE_RAG_TODO_CHECKLIST.md
- **File**: `CONFIDENCE_RAG_TODO_CHECKLIST.md`
- **Description**: Contains the entire checklist for confidence-scored RAG implementation

### 2. PRODUCTION_MIGRATION_PLAN.md
- **File**: `PRODUCTION_MIGRATION_PLAN.md:15-18`
- **TODOs mentioned**:
  - Health check shows hardcoded "connected" status
  - TaskService.ts:89 - TODO: Implement cancellation (Note: This appears to be outdated as cancellation is implemented)
  - MaestroFramework.ts:149 - Returns placeholder data

### 3. Task Router Documentation
- **File**: `docs/production_migration/mock_replacement_strategy.md:65-66`
- **TODOs mentioned**:
  - Implement proper task cancellation
  - Add real MaestroFramework integration

## Project Status TODOs

From `PROJECT_STATUS.md:282`:
- Complete error recovery mechanisms
- Fix task router TODO implementations
- Clean up deprecated test files

## Next Priority Tasks (from CLAUDE.md)

1. **Implement confidence-scored RAG system (Phase 7)**
   - Query processing with confidence filtering
   - Token-level confidence extraction
   - Multi-modal evaluation and calibration
   - Adaptive response delivery

2. **Complete integration test updates to use real Ollama (no mocks)**

3. **Fix remaining legacy TypeScript files**
   - index.ts
   - memory-integration.ts

4. **Implement user authentication system with JWT**

5. **Add comprehensive error recovery mechanisms**

6. **Complete remaining TODO items in task router**

7. **Deploy to production environment**

## Test-Related TODOs

### Skipped or Pending Tests
Several test files contain references to `skipIfNoOllama` or `skip` patterns, indicating tests that need attention:
- `src/core/master-orchestrator/MasterOrchestrator.integration.test.ts`
- `src/core/master-orchestrator/MasterOrchestrator.basic.test.ts`
- `src/core/master-orchestrator/PlanExecutor.test.ts`

## Summary

**Total Active TODOs**: 
- Source code TODOs: 2
- Placeholder implementations: 3
- Documentation/planning TODOs: Multiple (mostly in phase planning documents)
- Test-related TODOs: Several skipped tests

**Priority Areas**:
1. Confidence-scored RAG implementation (Phase 7)
2. Agent list endpoint implementation
3. MaestroFramework agent/tool integration
4. Test coverage improvements

**Notes**:
- Some TODOs mentioned in documentation appear to be outdated (e.g., task cancellation is already implemented)
- Most placeholders are in integration points between major components
- The project is in active development with Phase 7 (Confidence-Scored RAG) being the current focus