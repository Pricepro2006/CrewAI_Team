# Implementation Plan - CrewAI Team Fixes

Based on REVISED_RECOMMENDATIONS_BASED_ON_TESTS.md, here's the systematic plan to fix all issues:

## Phase 1: Fix Core Issues (Priority)

### Task 1: Fix Agent Routing Logic ✅ CRITICAL
**File**: src/core/master-orchestrator/AgentRouter.ts
**Issue**: All queries incorrectly routed to WriterAgent
**Action**: Implement proper pattern matching for agent selection

### Task 2: Fix WriterAgent Output Sanitization ✅ CRITICAL  
**File**: src/core/agents/specialized/WriterAgent.ts
**Issue**: WriterAgent exposes internal thinking process with <think> tags
**Action**: Add output sanitization to remove internal processing

### Task 3: Add Query Timeouts ✅ CRITICAL
**File**: src/api/services/ChatService.ts
**Issue**: Queries get stuck indefinitely
**Action**: Implement 30-second timeout with proper error handling

### Task 4: Fix Rate Limiting ✅ HIGH
**Files**: 
- src/ui/hooks/useAgentStatus.ts (reduce polling frequency)
- src/config/app.config.ts (adjust rate limits)
**Issue**: UI polls every second causing 429 errors
**Action**: Reduce polling to 5 seconds, add endpoint-specific limits

### Task 5: Implement Simple Caching ✅ MEDIUM
**File**: src/core/llm/SimpleCache.ts (new)
**Issue**: No caching for repeated queries
**Action**: Create simple in-memory cache

## Phase 2: Optimize Performance

### Task 6: Update Ollama Environment Variables
**Action**: Set optimal configuration for AMD Ryzen 7

### Task 7: Test Model Performance
**Action**: Run test-model-performance.ts to verify improvements

## Implementation Order:
1. Fix Agent Routing (prevents all queries going to WriterAgent)
2. Fix WriterAgent Output (stops exposing internal thinking)
3. Add Timeouts (prevents hanging queries)
4. Fix Rate Limiting (stops 429 errors)
5. Add Caching (improves repeat query performance)

Let's start implementing each fix...