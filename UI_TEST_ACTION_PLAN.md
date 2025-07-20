# CrewAI Team System - Action Plan for Critical Issues

**Created**: July 18, 2025  
**Based on**: UI Comprehensive Test Report  
**Priority**: URGENT - System Not Production Ready

## Executive Summary

The comprehensive UI testing revealed critical issues preventing the CrewAI Team system from functioning correctly. This action plan provides specific, actionable steps to resolve each issue, prioritized by impact and urgency.

## Critical Issue Resolution Plan

### 🔴 Priority 1: Fix Agent Routing (BLOCKING ALL FUNCTIONALITY)

**Issue**: All queries are incorrectly routed to WriterAgent regardless of query type.

#### Root Cause Analysis

Based on research and system behavior:

1. Query analysis is not properly identifying query intents/domains
2. Agent selection logic is defaulting to WriterAgent
3. No proper mapping between query types and specialized agents

#### Action Steps

1. **Review MasterOrchestrator Query Analysis**

   ```typescript
   // File: src/core/master-orchestrator/MasterOrchestrator.ts

   // Check analyzeQuery() method - ensure it properly identifies:
   - Research queries → domains: ['research']
   - Code queries → domains: ['code', 'programming']
   - Data queries → domains: ['data', 'analysis']
   - Writing queries → domains: ['writing', 'content']
   ```

2. **Fix Agent Router Mapping**

   ```typescript
   // File: src/core/master-orchestrator/AgentRouter.ts

   // Ensure proper agent mapping:
   const agentMapping = {
     research: "ResearchAgent",
     code: "CodeAgent",
     data: "DataAnalysisAgent",
     writing: "WriterAgent",
   };
   ```

3. **Implement Query Pattern Matching**

   ```typescript
   // Add keyword-based routing as fallback:
   const queryPatterns = {
     ResearchAgent:
       /research|investigate|explore|find out|latest|developments/i,
     CodeAgent:
       /code|function|implement|write.*program|python|javascript|fix bug/i,
     DataAnalysisAgent: /analyze|data|statistics|chart|graph|calculate/i,
     WriterAgent: /write|draft|compose|create content|blog|article/i,
   };
   ```

4. **Add Logging for Debugging**
   ```typescript
   logger.info("Query analysis result", {
     query,
     detectedIntent,
     identifiedDomains,
     selectedAgent,
     confidence,
   });
   ```

### 🔴 Priority 2: Fix WriterAgent Output Formatting

**Issue**: WriterAgent exposes internal thinking process with `<think>` tags instead of formatted responses.

#### Action Steps

1. **Review WriterAgent Response Processing**

   ```typescript
   // File: src/core/agents/specialized/WriterAgent.ts

   // Remove or filter internal processing:
   const cleanResponse = (rawOutput: string) => {
     // Remove <think> tags and content
     const cleaned = rawOutput.replace(/<think>[\s\S]*?<\/think>/g, "");

     // Extract only the final answer/content
     const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
     if (jsonMatch) {
       const parsed = JSON.parse(jsonMatch[0]);
       return parsed.content || parsed.answer || cleaned;
     }

     return cleaned.trim();
   };
   ```

2. **Implement Output Sanitization**

   ```typescript
   // Add to all agents' execute methods:
   const sanitizeOutput = (output: string) => {
     // Remove system prompts, thinking tags, JSON planning
     return output
       .replace(/<think>.*?<\/think>/gs, "")
       .replace(/\{[^}]*"contentType"[^}]*\}/g, "")
       .replace(/^system:.*$/gm, "")
       .trim();
   };
   ```

3. **Add Response Validation**
   ```typescript
   // Ensure responses are user-friendly:
   if (response.includes("<think>") || response.includes("contentType")) {
     throw new Error("Invalid response format - internal processing exposed");
   }
   ```

### 🔴 Priority 3: Implement Query Timeouts

**Issue**: Queries get stuck indefinitely with no timeout or error handling.

#### Action Steps

1. **Add Timeout to Chat Service**

   ```typescript
   // File: src/api/services/ChatService.ts

   const QUERY_TIMEOUT = 30000; // 30 seconds

   async processQuery(query: string, conversationId: string) {
     const timeoutPromise = new Promise((_, reject) =>
       setTimeout(() => reject(new Error('Query processing timeout')), QUERY_TIMEOUT)
     );

     try {
       return await Promise.race([
         this.orchestrator.processQuery(query, conversationId),
         timeoutPromise
       ]);
     } catch (error) {
       if (error.message === 'Query processing timeout') {
         // Return timeout error response
         return {
           success: false,
           error: 'Query processing timed out. Please try again.',
           conversationId
         };
       }
       throw error;
     }
   }
   ```

2. **Add Cancellation Support**

   ```typescript
   // Implement AbortController for cancellable queries
   const controller = new AbortController();

   // Pass signal to LLM calls
   await ollama.generate({
     model: "granite3.3:2b",
     prompt: query,
     signal: controller.signal,
   });
   ```

3. **Update UI to Show Timeout Status**
   ```typescript
   // In ChatInterface component:
   if (error?.message?.includes('timeout')) {
     return (
       <Alert type="error">
         Query timed out after 30 seconds.
         <Button onClick={retry}>Try Again</Button>
       </Alert>
     );
   }
   ```

### 🟡 Priority 4: Fix Rate Limiting for UI Polling

**Issue**: UI polls every second, hitting rate limit (10 req/60s) after ~10 seconds.

#### Action Steps

1. **Reduce Polling Frequency**

   ```typescript
   // File: src/ui/hooks/useAgentStatus.ts

   const POLL_INTERVAL = 5000; // 5 seconds instead of 1

   const { data, error } = trpc.agent.status.useQuery(undefined, {
     refetchInterval: POLL_INTERVAL,
     refetchIntervalInBackground: false,
     retry: (failureCount, error) => {
       if (error?.data?.code === "TOO_MANY_REQUESTS") {
         return false; // Don't retry rate limited requests
       }
       return failureCount < 3;
     },
   });
   ```

2. **Implement Exponential Backoff**

   ```typescript
   // Add intelligent polling with backoff:
   const useSmartPolling = () => {
     const [interval, setInterval] = useState(5000);

     const onError = (error) => {
       if (error?.data?.code === "TOO_MANY_REQUESTS") {
         setInterval((prev) => Math.min(prev * 2, 60000)); // Max 1 minute
       }
     };

     const onSuccess = () => {
       setInterval(5000); // Reset to normal
     };

     return { interval, onError, onSuccess };
   };
   ```

3. **Adjust Rate Limits for Status Endpoints**

   ```typescript
   // File: src/config/app.config.ts

   security: {
     rateLimiting: {
       windowMs: 60000,
       maxRequests: 10,
       // Add endpoint-specific limits:
       endpoints: {
         '/trpc/agent.status': {
           windowMs: 60000,
           maxRequests: 100 // Higher limit for status polling
         },
         '/trpc/chat.sendMessage': {
           windowMs: 60000,
           maxRequests: 10 // Keep strict for actual queries
         }
       }
     }
   }
   ```

### 🟡 Priority 5: Implement 4-Step RAG UI Components

**Issue**: No confidence scores or 4-step processing indicators visible.

#### Action Steps

1. **Add Confidence Display to Messages**

   ```tsx
   // File: src/ui/components/Chat/ConfidenceMessage.tsx

   interface MessageWithConfidence {
     content: string;
     confidence: {
       retrieval: number;
       generation: number;
       overall: number;
     };
     ragSteps: {
       retrieval: { status: "pending" | "complete"; score: number };
       generation: { status: "pending" | "complete"; score: number };
       evaluation: { status: "pending" | "complete"; score: number };
       delivery: { status: "pending" | "complete"; mode: string };
     };
   }

   // Visual confidence indicator
   const ConfidenceIndicator = ({ score }) => {
     const color = score > 0.8 ? "green" : score > 0.6 ? "yellow" : "red";
     return (
       <div className={`confidence-badge ${color}`}>
         {(score * 100).toFixed(0)}% confidence
       </div>
     );
   };
   ```

2. **Add 4-Step Progress Indicator**

   ```tsx
   // Show RAG processing steps:
   const RAGProgress = ({ steps }) => (
     <div className="rag-progress">
       {Object.entries(steps).map(([step, data]) => (
         <div key={step} className={`step ${data.status}`}>
           <span className="step-name">{step}</span>
           {data.score && (
             <span className="score">{data.score.toFixed(2)}</span>
           )}
         </div>
       ))}
     </div>
   );
   ```

3. **Update WebSocket for Real-time Progress**
   ```typescript
   // Emit RAG step updates:
   wsService.emit("ragProgress", {
     conversationId,
     step: "retrieval",
     status: "complete",
     confidence: 0.75,
     details: {
       documentsRetrieved: 5,
       topScore: 0.89,
     },
   });
   ```

## Testing Strategy

### 1. Unit Tests for Fixed Components

```bash
# Test agent routing
pnpm test src/core/master-orchestrator/AgentRouter.test.ts

# Test output sanitization
pnpm test src/core/agents/specialized/WriterAgent.test.ts

# Test timeout handling
pnpm test src/api/services/ChatService.test.ts
```

### 2. Integration Tests

```bash
# Test full query flow with different query types
pnpm test:integration query-routing

# Test rate limiting behavior
pnpm test:integration rate-limiting
```

### 3. Manual Testing Checklist

- [ ] Submit research query → Verify ResearchAgent selected
- [ ] Submit code query → Verify CodeAgent selected
- [ ] Submit simple query → Verify appropriate simple model used
- [ ] Verify clean responses without internal processing
- [ ] Test query timeout after 30 seconds
- [ ] Monitor rate limiting - no 429 errors in normal usage
- [ ] Verify confidence scores displayed
- [ ] Check 4-step RAG progress indicators

## Implementation Timeline

### Day 1 (Immediate)

- [ ] Fix agent routing logic (4 hours)
- [ ] Fix WriterAgent output formatting (2 hours)
- [ ] Add query timeouts (2 hours)

### Day 2

- [ ] Fix rate limiting configuration (2 hours)
- [ ] Reduce polling frequency (1 hour)
- [ ] Add exponential backoff (2 hours)
- [ ] Initial testing (3 hours)

### Day 3

- [ ] Implement confidence UI components (4 hours)
- [ ] Add RAG progress indicators (3 hours)
- [ ] WebSocket updates (1 hour)

### Day 4

- [ ] Comprehensive testing (4 hours)
- [ ] Bug fixes (2 hours)
- [ ] Documentation updates (2 hours)

## Success Criteria

The system will be considered fixed when:

1. **Agent Routing**: 95%+ queries routed to correct agent
2. **Response Quality**: No internal processing exposed
3. **Performance**: All queries complete within 30 seconds
4. **Stability**: No rate limiting errors during normal usage
5. **Transparency**: Confidence scores and RAG steps visible
6. **User Experience**: Clear feedback at every stage

## Additional Recommendations

### Quick Wins

1. Update Ollama status display to show actual connection state
2. Remove duplicate agent entries in monitoring panel
3. Add loading spinners during query processing
4. Implement basic error boundaries for UI stability

### Long-term Improvements

1. Implement caching for repeated queries
2. Add query history and favorites
3. Build functional UIs for placeholder pages
4. Add user preferences for confidence thresholds
5. Implement A/B testing for routing algorithms

## Resources and References

- [IBM LLM Agent Orchestration Guide](https://www.ibm.com/think/tutorials/llm-agent-orchestration-with-langchain-and-granite)
- [Multi-Agent Collaboration Mechanisms Survey](https://arxiv.org/html/2501.06322v1)
- [AWS Multi-Agent Orchestrator Documentation](https://aws.amazon.com/blogs/machine-learning/introducing-multi-agent-orchestrator/)
- [tRPC Rate Limiting Best Practices](https://www.unkey.com/blog/ratelimit-trpc-routes)

## Conclusion

These fixes address the critical issues preventing the CrewAI Team system from functioning properly. By following this action plan systematically, the system should achieve production readiness within 4 days of focused development.

The most critical issue is agent routing - without fixing this, the system cannot demonstrate its multi-agent capabilities. This should be the absolute top priority.

**Remember**: Test each fix thoroughly before moving to the next. A working system with fewer features is better than a broken system with many features.
