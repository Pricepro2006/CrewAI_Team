/**
 * Optimized prompts for three-phase email analysis
 * Each prompt is carefully crafted for maximum extraction quality
 */

export const PHASE2_ENHANCED_PROMPT = `<|system|>
You are a JSON-only email analyzer. Output ONLY valid JSON with no other text.
<|user|>
Analyze email and output ONLY this JSON structure:

Phase1: {PHASE1_RESULTS}
Subject: {EMAIL_SUBJECT}
Body: {EMAIL_BODY}

{
  "workflow_validation": "string - workflow analysis",
  "missed_entities": {
    "project_names": [],
    "company_names": [],
    "people": [],
    "products": [],
    "technical_specs": [],
    "locations": [],
    "other_references": []
  },
  "action_items": [],
  "extracted_requirements": [],
  "risk_assessment": "string - risk analysis",
  "initial_response": "string - response",
  "confidence": 0.8,
  "business_process": "string - process name"
}`;

export const PHASE2_RETRY_PROMPT = `{
  "workflow_validation": "analyze workflow from email",
  "missed_entities": {
    "project_names": ["extract project names"],
    "company_names": ["extract company names"],
    "people": ["extract people names"],
    "products": ["extract product names"],
    "technical_specs": ["extract tech specs"],
    "locations": ["extract locations"],
    "other_references": ["other entities"]
  },
  "action_items": [{
    "task": "action required",
    "owner": "responsible party",
    "deadline": "when due",
    "priority": "high/medium/low"
  }],
  "extracted_requirements": ["list requirements"],
  "risk_assessment": "assess risks",
  "initial_response": "draft response",
  "confidence": 0.8,
  "business_process": "identify process"
}`;

export const PHASE3_STRATEGIC_PROMPT = `<|system|>
You are a TD SYNNEX executive. Output ONLY JSON for strategic analysis.
<|user|>
Phase 1: {PHASE1_RESULTS}
Phase 2: {PHASE2_RESULTS}
Email: {EMAIL_SUBJECT} - {EMAIL_BODY}

Return this JSON structure:
{
  "strategic_insights": {
    "opportunity": "revenue/partnership opportunity",
    "risk": "primary risk identified",
    "relationship": "customer relationship status"
  },
  "executive_summary": "2-sentence strategic summary",
  "escalation_needed": true/false,
  "revenue_impact": "$amount or range",
  "cross_email_patterns": ["pattern1", "pattern2"],
  "workflow_intelligence": {
    "predicted_next_steps": ["step1", "step2"],
    "bottleneck_risks": ["risk1", "risk2"],
    "optimization_opportunities": ["opportunity1"]
  }
}`;
  },
  "cross_email_patterns": [
    "Pattern 1: Similar urgency across enterprise accounts",
    "Pattern 2: Product shortage indicators",
    "Pattern 3: Competitive pressure increasing"
  ],
  "workflow_intelligence": {
    "predicted_next_steps": ["Detailed next actions in sequence"],
    "bottleneck_risks": ["Specific bottlenecks with % probability"],
    "optimization_opportunities": ["Process improvements with impact"],
    "automation_candidates": ["Tasks suitable for automation"]
  },
  "action_roadmap": {
    "immediate": ["Actions within 24 hours"],
    "short_term": ["Actions within 1 week"],
    "long_term": ["Strategic initiatives"]
  },
  "success_metrics": {
    "kpis": ["Specific KPIs to track"],
    "milestones": ["Key milestones to achieve"],
    "success_criteria": ["Definition of success"]
  }
}`;

// Specialized prompts for different email types
export const SPECIALIZED_PROMPTS = {
  // For order-related emails
  ORDER_FOCUSED: `Focus on order details, inventory availability, pricing accuracy, delivery timelines, and order dependencies.`,

  // For quote requests
  QUOTE_FOCUSED: `Extract all product specifications, quantities, target prices, competitive mentions, and decision criteria.`,

  // For escalations
  ESCALATION_FOCUSED: `Identify the core issue, impact assessment, stakeholders affected, resolution timeline, and prevention strategies.`,

  // For relationship emails
  RELATIONSHIP_FOCUSED: `Analyze sentiment trends, satisfaction indicators, loyalty signals, and expansion opportunities.`,

  // For technical support
  TECHNICAL_FOCUSED: `Extract technical issues, error details, system impacts, workaround needs, and resolution requirements.`,
};

interface EmailCharacteristics {
  hasOrderReferences: boolean;
  hasQuoteRequests: boolean;
  isEscalation: boolean;
  isFromKeyCustomer: boolean;
  hasTechnicalIssues: boolean;
  urgencyScore: number;
  financialImpact: number;
}

// Dynamic prompt enhancement based on email characteristics
export function enhancePromptForEmailType(
  basePrompt: string,
  emailCharacteristics: EmailCharacteristics,
): string {
  let enhancedPrompt = basePrompt;

  // Add JSON enforcement reminder before type-specific enhancements
  enhancedPrompt += JSON_ENFORCEMENT_PROMPTS.STRICT_JSON;

  // Add type-specific focus
  if (emailCharacteristics.hasOrderReferences) {
    enhancedPrompt += "\n\nORDER FOCUS: " + SPECIALIZED_PROMPTS.ORDER_FOCUSED;
  }

  if (emailCharacteristics.hasQuoteRequests) {
    enhancedPrompt += "\n\nQUOTE FOCUS: " + SPECIALIZED_PROMPTS.QUOTE_FOCUSED;
  }

  if (emailCharacteristics.isEscalation) {
    enhancedPrompt +=
      "\n\nESCALATION FOCUS: " + SPECIALIZED_PROMPTS.ESCALATION_FOCUSED;
  }

  if (emailCharacteristics.isFromKeyCustomer) {
    enhancedPrompt +=
      "\n\nRELATIONSHIP FOCUS: " + SPECIALIZED_PROMPTS.RELATIONSHIP_FOCUSED;
  }

  if (emailCharacteristics.hasTechnicalIssues) {
    enhancedPrompt +=
      "\n\nTECHNICAL FOCUS: " + SPECIALIZED_PROMPTS.TECHNICAL_FOCUSED;
  }

  // Add urgency emphasis
  if (emailCharacteristics.urgencyScore > 5) {
    enhancedPrompt +=
      "\n\nCRITICAL URGENCY: This email has high urgency. Ensure all time-sensitive elements are captured in your JSON response.";
  }

  // Add financial emphasis
  if (emailCharacteristics.financialImpact > 50000) {
    enhancedPrompt +=
      "\n\nHIGH VALUE: This email involves significant financial impact. Ensure all revenue implications are thoroughly analyzed in your JSON response.";
  }

  // Final JSON reminder
  enhancedPrompt +=
    "\n\n***REMEMBER: RESPOND WITH ONLY JSON - NO OTHER TEXT***";

  return enhancedPrompt;
}

// JSON parsing troubleshooting prompts
export const JSON_ENFORCEMENT_PROMPTS = {
  STRICT_JSON: `
***ABSOLUTE REQUIREMENT: RESPOND WITH ONLY JSON***
- No explanatory text before or after JSON
- No markdown code blocks
- No comments or descriptions
- Start with { and end with }
- Validate JSON structure before responding
`,

  RETRY_EMPHASIS: `
***PREVIOUS ATTEMPT FAILED JSON PARSING***
This is a retry attempt. The previous response was not valid JSON.
You MUST respond with ONLY properly formatted JSON.
No text, no explanation, no markdown - ONLY JSON.
`,

  VALIDATION_REMINDER: `
Before responding, validate your JSON:
1. Starts with { and ends with }
2. All strings properly quoted
3. All arrays properly formatted
4. No trailing commas
5. No comments or extra text
`,
};

// Example usage instructions
export const PROMPT_USAGE_GUIDE = `
Three-Phase Prompt Optimization Guide:

1. Phase 1 (Rule-Based): No prompts needed, pure regex and pattern matching

2. Phase 2 (LLM Enhancement):
   - Use PHASE2_ENHANCED_PROMPT as the base
   - Use PHASE2_RETRY_PROMPT for retries after JSON parsing failures
   - Enhance with email-specific focuses using enhancePromptForEmailType()
   - Ensure Phase 1 results are properly injected
   - Temperature: 0.1 for consistency (0.05 for retries)
   - Max tokens: 1200-1500
   - Implement retry logic with enhanced JSON enforcement

3. Phase 3 (Strategic Analysis):
   - Use PHASE3_STRATEGIC_PROMPT for comprehensive analysis
   - Include both Phase 1 and Phase 2 results for context
   - Temperature: 0.3 for creative insights
   - Max tokens: 2000-3000

JSON Parsing Improvements:
- System/user message structure for better instruction following
- JSON-only responses with strict enforcement
- Retry logic with enhanced prompts
- Robust parsing with multiple extraction strategies
- Structured fallback responses

Key Principles:
- Each phase builds on previous results
- No information should be lost between phases
- Later phases should validate and enhance, not replace
- Focus on extracting EVERYTHING of business value
- Maintain consistency in entity extraction across phases
- Ensure all responses can be parsed as valid JSON
`;

// Validation schemas for each phase output
export const PHASE2_OUTPUT_SCHEMA = {
  required: [
    "workflow_validation",
    "missed_entities",
    "action_items",
    "extracted_requirements",
    "risk_assessment",
    "initial_response",
    "confidence",
    "business_process",
  ],
  missed_entities_required: [
    "project_names",
    "company_names",
    "people",
    "products",
    "technical_specs",
    "locations",
    "other_references",
  ],
  action_item_required: ["task", "owner", "deadline", "priority"],
};

// JSON parsing metrics tracking
export const PARSING_METRICS = {
  SUCCESS_RATE_TARGET: 0.95,
  MAX_RETRIES: 2,
  RETRY_DELAY_MS: 1000,
  FALLBACK_CONFIDENCE: 0.3,
  VALIDATION_TIMEOUT_MS: 5000,
};

export const PHASE3_OUTPUT_SCHEMA = {
  required: [
    "strategic_insights",
    "executive_summary",
    "escalation_needed",
    "revenue_impact",
    "workflow_intelligence",
    "action_roadmap",
  ],
  strategic_insights_required: ["opportunity", "risk", "relationship"],
  revenue_impact_required: ["immediate", "annual", "at_risk"],
};

// Common JSON parsing error patterns and fixes
export const JSON_ERROR_PATTERNS = {
  MARKDOWN_WRAPPER: /```json\s*([\s\S]*?)\s*```/gi,
  RESPONSE_PREFIX: /^.*?(?=\{)/s,
  RESPONSE_SUFFIX: /\}[^}]*$/s,
  UNQUOTED_KEYS: /([a-zA-Z_][a-zA-Z0-9_]*):(?=\\s*[^"\\d[{true|false|null])/g,
  TRAILING_COMMAS: /,(?=\s*[}\]])/g,
  SINGLE_QUOTES: /'/g,
};
