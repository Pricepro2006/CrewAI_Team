# 🤖 Agent System Recovery Plan - Getting 0/7 Agents to 7/7 Functional

## Current Status
- **Working Agents:** 0/7
- **LLM Backend:** llama.cpp with Llama-3.2-3B-Instruct-Q4_K_M.gguf
- **Issue:** llama.cpp hangs in interactive mode, preventing all agent functionality

## Phase 1: LLM Infrastructure Diagnosis (Day 1 Morning)

### Step 1.1: Diagnose llama.cpp Issues
```bash
# Check if model file exists and is valid
ls -la ./models/Llama-3.2-3B-Instruct-Q4_K_M.gguf

# Test llama.cpp directly in batch mode (non-interactive)
./llama.cpp/main -m ./models/Llama-3.2-3B-Instruct-Q4_K_M.gguf -p "Hello" -n 10 --no-display-prompt

# Check current llama.cpp configuration
cat .env | grep LLAMA

# Review SafeLlamaCppProvider.ts for hanging issues
cat src/core/llm/SafeLlamaCppProvider.ts | grep -A 10 "interactive"
```

### Step 1.2: Identify Root Causes
- Document the interactive mode hanging issue in SafeLlamaCppProvider.ts
- Check for blocking I/O operations
- Review process spawn options
- Document all TypeScript syntax errors preventing compilation

## Phase 2: Fix LLM Infrastructure (Day 1 Afternoon)

### Step 2.1: Fix llama.cpp Integration
```typescript
// In SafeLlamaCppProvider.ts, change:
// FROM: '--interactive' flag causing hangs
// TO: Batch mode processing with proper stdin/stdout handling

// Key changes needed:
// 1. Remove '--interactive' flag
// 2. Add '--no-display-prompt' flag
// 3. Implement proper process.stdin.end() after input
// 4. Add timeout mechanism (30 seconds max)
// 5. Use spawn with proper stdio configuration
```

### Step 2.2: Create Fallback Provider
```typescript
// Create SimpleLLMProvider.ts as temporary fallback
class SimpleLLMProvider implements LLMProvider {
  async generate(prompt: string): Promise<string> {
    // Template-based responses for testing
    if (prompt.includes("analyze")) {
      return "Analysis complete: Found 3 key patterns...";
    }
    if (prompt.includes("summarize")) {
      return "Summary: Key points identified...";
    }
    // Add more templates for each agent type
  }
}
```

### Step 2.3: Fix TypeScript Syntax Errors
```typescript
// Fix all instances in agent files:
// WRONG: this?.config?.model = value;
// RIGHT: if (this.config) { this.config.model = value; }

// Files to fix:
// - src/core/agents/specialized/EmailAnalysisAgentEnhanced.ts
// - src/core/agents/specialized/ResearchAgent.ts
// - src/core/agents/specialized/DataAnalysisAgent.ts
// - src/core/agents/specialized/CodeAgent.ts
// - src/core/agents/specialized/WriterAgent.ts
// - src/core/agents/specialized/ToolExecutorAgent.ts
```

## Phase 3: Agent-by-Agent Recovery (Days 2-3)

### Step 3.1: MasterOrchestrator (Priority 1)
**Fix Location:** `src/core/master-orchestrator/MasterOrchestrator.ts`

**Implementation:**
```typescript
// 1. Add fallback if LLM unavailable
if (!this.llmProvider.isAvailable()) {
  return this.createSimplePlan(query);
}

// 2. Implement createSimplePlan() method
private createSimplePlan(query: string) {
  // Rule-based plan creation
  const steps = [];
  if (query.includes("email")) steps.push("EmailAnalysisAgent");
  if (query.includes("research")) steps.push("ResearchAgent");
  // Return structured plan
}
```

**Test:**
```bash
# Test orchestration
npm run test:agent -- --name=MasterOrchestrator --query="Analyze my emails"
```

### Step 3.2: EmailAnalysisAgent (Priority 2)
**Fix Location:** `src/core/agents/specialized/EmailAnalysisAgent.ts`

**Implementation:**
```typescript
// 1. Fix syntax errors in cache module
// 2. Add pattern-based analysis without LLM
private analyzeWithoutLLM(email: Email) {
  return {
    sentiment: this.detectSentiment(email.body),
    entities: this.extractEntities(email.body),
    category: this.categorizeEmail(email.subject),
    priority: this.calculatePriority(email)
  };
}
```

**Test:**
```bash
# Test with sample emails
npm run test:agent -- --name=EmailAnalysisAgent --input=sample-emails.json
```

### Step 3.3: ResearchAgent (Priority 3)
**Fix Location:** `src/core/agents/specialized/ResearchAgent.ts`

**Implementation:**
```typescript
// 1. Use RAG system without LLM synthesis
// 2. Return raw ChromaDB search results
async research(query: string) {
  const ragResults = await this.chromaDB.search(query, 5);
  return this.formatResults(ragResults);
}
```

**Test:**
```bash
# Test RAG integration
npm run test:agent -- --name=ResearchAgent --query="email security"
```

### Step 3.4: DataAnalysisAgent (Priority 4)
**Fix Location:** `src/core/agents/specialized/DataAnalysisAgent.ts`

**Implementation:**
```typescript
// Add statistical analysis without LLM
analyze(emails: Email[]) {
  return {
    totalCount: emails.length,
    avgLength: this.calculateAvgLength(emails),
    topSenders: this.getTopSenders(emails),
    patterns: this.detectPatterns(emails),
    timeline: this.createTimeline(emails)
  };
}
```

### Step 3.5: CodeAgent (Priority 5)
**Fix Location:** `src/core/agents/specialized/CodeAgent.ts`

**Implementation:**
```typescript
// Use template library for common code patterns
private codeTemplates = {
  emailParser: `function parseEmail(raw) { ... }`,
  dataValidator: `function validate(data) { ... }`,
  // Add more templates
};
```

### Step 3.6: WriterAgent (Priority 6)
**Fix Location:** `src/core/agents/specialized/WriterAgent.ts`

**Implementation:**
```typescript
// Template-based writing
private templates = {
  professional: "Dear [NAME], Thank you for...",
  casual: "Hi [NAME], Just wanted to...",
  // Add more templates
};
```

### Step 3.7: ToolExecutorAgent (Priority 7)
**Fix Location:** `src/core/agents/specialized/ToolExecutorAgent.ts`

**Implementation:**
```typescript
// Fix tool initialization and add mock responses
async executeTool(toolName: string, params: any) {
  try {
    return await this.tools[toolName].execute(params);
  } catch (error) {
    return this.getMockResponse(toolName, params);
  }
}
```

## Phase 4: Integration Testing (Day 4)

### Step 4.1: Create Test Harness
```typescript
// Create test-agents.ts
import { MasterOrchestrator } from './src/core/master-orchestrator';
import { AgentRegistry } from './src/core/agents/registry';

async function testAgent(agentName: string, testQuery: string) {
  const agent = AgentRegistry.getAgent(agentName);
  const result = await agent.process(testQuery);
  console.log(`${agentName}: ${result.success ? 'PASS' : 'FAIL'}`);
  return result;
}

// Test all agents
const agents = ['MasterOrchestrator', 'EmailAnalysisAgent', ...];
for (const agent of agents) {
  await testAgent(agent, testQueries[agent]);
}
```

### Step 4.2: End-to-End Test Scenarios
```typescript
// Scenario 1: Email Processing Pipeline
const emailTest = async () => {
  const orchestrator = new MasterOrchestrator();
  const result = await orchestrator.process("Analyze my recent emails");
  assert(result.steps.length > 0);
  assert(result.agents.includes('EmailAnalysisAgent'));
};

// Scenario 2: Research Query
const researchTest = async () => {
  const result = await orchestrator.process("Research email best practices");
  assert(result.agents.includes('ResearchAgent'));
};
```

## Phase 5: Validation & Monitoring (Day 5)

### Step 5.1: Success Metrics
```typescript
// Each agent must meet these criteria:
const successCriteria = {
  responseTime: 2000, // ms
  errorRate: 0.05,    // 5% max
  outputValid: true,  // Returns expected structure
  gracefulFallback: true // Works without LLM
};
```

### Step 5.2: Monitoring Setup
```typescript
// Add to each agent
class AgentMonitor {
  logRequest(agent: string, query: string) { }
  logResponse(agent: string, success: boolean, time: number) { }
  logError(agent: string, error: Error) { }
}
```

### Step 5.3: Final Validation Checklist
- [ ] All 7 agents respond to test queries
- [ ] No TypeScript compilation errors
- [ ] llama.cpp works in batch mode (or fallback active)
- [ ] Each agent has fallback logic
- [ ] Response times under 2 seconds
- [ ] Error handling implemented
- [ ] Logging active for debugging

## Quick Test Commands

```bash
# After fixes, test each agent:
npm run dev:server  # Start the server

# In another terminal:
curl -X POST http://localhost:3001/api/agent/test \
  -H "Content-Type: application/json" \
  -d '{"agent": "MasterOrchestrator", "query": "Test query"}'

# Or use the test script:
npm run test:agents
```

## Expected Outcomes

By end of Day 5:
- **7/7 agents responding** (with or without LLM)
- **llama.cpp fixed** or proper fallback active
- **No TypeScript errors** in agent files
- **Basic functionality** for each agent type
- **Ready for enhancement** with better LLM integration

## Timeline
- **Day 1:** Fix llama.cpp and TypeScript errors
- **Day 2:** MasterOrchestrator + EmailAnalysisAgent 
- **Day 3:** Remaining 5 agents
- **Day 4:** Integration testing
- **Day 5:** Validation and optimization

Total: **5 days of focused development**