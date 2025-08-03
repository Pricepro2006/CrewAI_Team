# Three-Phase Incremental Analysis Plan

## Concept: Each Phase Builds on Previous Results

### Current Problem

Right now, each phase starts fresh and doesn't leverage previous analysis. This wastes time and potentially loses context.

### Proposed Solution: Incremental Analysis

## Phase Architecture

### Phase 1: Rule-Based Triage (< 1 second per email)

**Purpose**: Quick pattern matching and entity extraction
**Score**: 5.6/10 (from previous testing)

```typescript
// Phase 1 extracts:
{
  workflow_state: "Quote Processing",  // Based on keywords
  priority: "high",                    // Based on urgency markers
  entities: {
    po_numbers: ["12345678"],          // Regex extraction
    quote_numbers: ["Q-98765"],        // Pattern matching
    dollar_amounts: ["$15,000"]        // Currency detection
  },
  key_phrases: ["urgent quote", "need by Friday"],
  sender_category: "key_customer"      // Based on sender
}
```

### Phase 2: Llama Enhancement (10 seconds per email)

**Purpose**: Enrich Phase 1 results with AI understanding
**Score**: 7.5/10 (can achieve 6.56 target)

```typescript
// Phase 2 receives Phase 1 results and adds:
const phase2Prompt = `
You have initial analysis of an email:
${JSON.stringify(phase1Results)}

Now provide deeper insights:
1. Validate/correct the workflow state
2. Extract any missed entities
3. Identify specific action items
4. Assess business risk/opportunity
5. Generate initial response suggestion

Email content:
${emailContent}
`;

// Phase 2 adds:
{
  ...phase1Results,
  workflow_validation: "Confirmed: Quote Processing with urgency",
  missed_entities: {
    company_project: "Q4 Infrastructure Upgrade"
  },
  action_items: [
    { task: "Generate quote for 15 servers", deadline: "Friday 5PM" }
  ],
  risk_assessment: "High - $15k deal at risk if delayed",
  initial_response: "Thank you for your urgent request..."
}
```

### Phase 3: Phi-4 Deep Analysis (For High-Value Only)

**Purpose**: Maximum insight for critical emails
**Score**: 7.6/10 (close to 7.75 target)

```typescript
// Phase 3 receives Phase 1 + 2 results for context:
const phase3Prompt = `
<|system|>
You are reviewing an email that has been pre-analyzed. Use this context to provide executive-level insights.

Phase 1 Analysis (rule-based):
${JSON.stringify(phase1Results)}

Phase 2 Analysis (AI-enhanced):
${JSON.stringify(phase2Results)}

Now provide:
1. Strategic implications
2. Hidden opportunities/risks
3. Relationship impact assessment
4. Recommended escalation path
5. Executive summary

Focus on insights NOT already captured.
<|user|>
Email: ${emailContent}
`;

// Phase 3 adds strategic layer:
{
  ...phase2Results,
  strategic_insights: {
    opportunity: "Customer expanding - potential $200k annual",
    risk: "Competitor mentioned in email thread",
    relationship: "Key stakeholder showing frustration"
  },
  executive_summary: "Critical quote request with expansion opportunity...",
  escalation_needed: true,
  revenue_impact: "$15k immediate, $200k potential"
}
```

## Benefits of This Approach

### 1. **Time Efficiency**

- Phase 1: < 1 second (rule-based)
- Phase 2: ~10 seconds (builds on Phase 1)
- Phase 3: ~80 seconds (only for high-value emails)
- **Total for most emails**: 11 seconds (vs 10 seconds for llama alone)

### 2. **Quality Improvement**

- Each phase validates and enriches previous work
- No lost context between phases
- LLMs can focus on what they do best (not re-extracting PO numbers)

### 3. **Smart Resource Allocation**

- Phase 1 handles ALL emails (instant)
- Phase 2 for emails needing AI insight (~90%)
- Phase 3 only for critical/high-value (~10%)

## Implementation Strategy

### Step 1: Enhanced Phase 1 Rules

Improve pattern matching to achieve better base extraction:

- Financial indicators ($X,XXX patterns)
- Urgency scoring (weighted keywords)
- Sender importance (from mailbox list)
- Thread detection (RE:, FW:)

### Step 2: Context-Aware Phase 2

Llama prompt includes Phase 1 results:

- Validates extracted entities
- Focuses on missed insights
- Doesn't waste tokens on obvious extractions

### Step 3: Strategic Phase 3

Phi-4 gets full context and focuses on:

- Strategic implications
- Hidden patterns
- Cross-email insights
- Executive decisions

## Selection Logic

```typescript
function determinePhases(
  email: Email,
  phase1Results: Phase1Analysis,
): PhaseDecision {
  // All emails get Phase 1 (instant)

  // Skip Phase 2 if:
  // - Low priority + no entities + information only
  if (
    phase1Results.priority === "low" &&
    !hasEntities(phase1Results) &&
    phase1Results.intent === "information"
  ) {
    return { phases: [1], reason: "Low value email" };
  }

  // Phase 2 for most emails (90%)

  // Add Phase 3 if:
  // - Critical priority
  // - High dollar amount (>$10k)
  // - Key customer + urgent
  // - Multiple action items
  // - Risk indicators
  const needsPhase3 =
    phase1Results.priority === "critical" ||
    phase1Results.dollarAmount > 10000 ||
    (phase1Results.sender_category === "key_customer" &&
      phase1Results.urgency === "high") ||
    phase1Results.entities.action_items?.length > 3 ||
    phase1Results.risk_keywords.length > 0;

  return {
    phases: needsPhase3 ? [1, 2, 3] : [1, 2],
    reason: needsPhase3 ? "High value/risk email" : "Standard processing",
  };
}
```

## Feasibility Analysis

### Will We Lose Information?

**No, we'll gain quality:**

- Phase 1 provides consistent baseline
- Phase 2 validates and enriches (not replaces)
- Phase 3 adds strategic layer (not duplicates)
- Each phase has access to previous results

### Time Impact

- **Current 90/10 approach**: Average ~17 seconds/email
- **Three-phase approach**: Average ~15 seconds/email
- **Slightly faster AND better quality**

### Database Schema

Already supports this:

- `quick_*` fields = Phase 1
- `deep_*` fields = Phase 2
- Additional fields = Phase 3

## Next Steps

1. **Enhance Phase 1 rules** with better patterns
2. **Create context-aware prompts** for Phases 2 & 3
3. **Test on 100 emails** to verify quality improvement
4. **Roll out to full dataset**

This approach gives you the best of all worlds:

- Speed of rules
- Intelligence of AI
- Strategic insights for critical emails
- Better quality through validation
