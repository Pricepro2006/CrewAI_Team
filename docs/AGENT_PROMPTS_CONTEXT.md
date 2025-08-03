# Agent Coordination Prompts and Context Management

## Architecture Reviewer Agent Prompt

```
You are reviewing the email pipeline production architecture for CrewAI Team. The system processes 60+ emails/minute through an adaptive 3-phase analysis pipeline.

Key Architecture Components to Review:
1. EmailIngestionService - Supports Manual, Auto-Pull, and Hybrid modes
2. QueueManager - Redis-based with priority handling
3. Adaptive Analysis - 3 phases based on chain completeness
4. Real-time Updates - WebSocket event streaming

Please review the EMAIL_PIPELINE_PRODUCTION_ARCHITECTURE.md and validate:
- Scalability of the design for 10K+ emails/hour
- Concurrent operation safety between modes
- Queue management efficiency
- Error recovery mechanisms
- Performance bottlenecks

Focus on architectural patterns, not implementation details. Provide specific recommendations for improvements.
```

## Backend Systems Architect Agent Prompt

```
You need to design the EmailIngestionService for the CrewAI email pipeline. This service manages email import from multiple sources and coordinates with the queue system.

Technical Requirements:
- Support 3 modes: Manual (JSON/DB import), Auto-Pull (MS Graph/Gmail), Hybrid
- Process 60+ emails/minute with Redis queue
- Implement priority-based processing (URGENT > HIGH > NORMAL > LOW)
- Handle deduplication by internet_message_id
- Emit real-time WebSocket events

Existing Infrastructure:
- Database: emails_enhanced table with full Microsoft Graph fields
- Analysis: EmailThreePhaseAnalysisService (already implemented)
- Queue: Redis with Bull.js (needs integration)

Design and provide TypeScript code for:
1. EmailIngestionService class with all methods
2. QueueManager implementation
3. Priority calculation algorithm
4. Error handling and retry logic

Use existing patterns from the codebase and maintain consistency with current architecture.
```

## Context Handoff Template

```
## Previous Agent Summary
Agent: [AGENT_NAME]
Task: [COMPLETED_TASK]
Key Findings:
- [FINDING_1]
- [FINDING_2]

## Current Context
Project State: [CURRENT_STATE]
Remaining Tasks: [TASK_LIST]
Dependencies: [DEPENDENCY_LIST]

## Next Agent Requirements
Agent: [NEXT_AGENT_NAME]
Task: [NEXT_TASK]
Required Context: [MINIMAL_CONTEXT]
Expected Output: [DELIVERABLES]
```

## Agent Call Sequence Plan

### Phase 1: Architecture Validation
1. **architecture-reviewer** → Validate overall design
2. **security-patches-expert** → Review security considerations
3. Store validation results in context

### Phase 2: Implementation Design
1. **backend-systems-architect** → Design EmailIngestionService
2. **backend-systems-architect** → Design QueueManager
3. **error-resolution-specialist** → Design error handling
4. Compile implementation specs

### Phase 3: Documentation Completion
1. **technical-writer** → Update PRODUCTION_ARCHITECTURE.md
2. **technical-writer** → Complete DEPLOYMENT_README.md
3. **architecture-reviewer** → Final review
4. Merge all documentation

### Phase 4: Code Implementation
1. **backend-systems-architect** → Implement services
2. **test-failure-debugger** → Create test suites
3. **git-version-control-expert** → Manage commits
4. Deploy to branch

## Context Compression Strategies

### 1. Incremental Summaries
- After each agent: Extract key decisions (< 500 tokens)
- Store in running summary document
- Reference previous decisions, not full outputs

### 2. Structured Context Objects
```typescript
interface AgentContext {
  previousDecisions: string[];     // Key decisions only
  currentTask: string;             // Single clear objective
  relevantCode: string[];          // File paths, not content
  constraints: string[];           // Critical requirements
  deliverables: string[];          // Expected outputs
}
```

### 3. Token Budget Management
- Architecture Review: 3K tokens max
- Implementation Design: 4K tokens max
- Documentation: 2K tokens max
- Code Implementation: 5K tokens max

### 4. Context Checkpoints
Save after each major milestone:
- Post-architecture validation
- Post-design completion
- Post-documentation update
- Post-implementation

## Error Recovery Context

If agent calls fail due to size:
1. Split task into smaller subtasks
2. Use file references instead of content
3. Summarize previous agent outputs
4. Focus on specific components only