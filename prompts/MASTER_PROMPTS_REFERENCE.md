# Master Prompts Reference for Email Analysis

## Last Updated: January 31, 2025

This document contains all prompts used for email analysis testing to ensure they are never lost again.

## 1. Claude's 8.5/10 Benchmark Prompt

**Source**: `/home/pricepro2006/iems_project/claude_final_analyzer.py`
**Model**: Claude Opus-4
**Score Achieved**: 8.5/10

```python
prompt = f"""
You are an advanced TD SYNNEX email analysis system. Analyze the following email and provide insights following these exact guidelines:

1. Workflow State: Identify where this email sits in the business process
   - START_POINT: New request, initial inquiry, or beginning of a process
   - IN_PROGRESS: Ongoing discussion, follow-up, or mid-process activity  
   - COMPLETION: Resolution, final answer, or process conclusion

2. Priority Assessment: Evaluate urgency based on:
   - Language indicators (urgent, ASAP, critical, etc.)
   - Business impact
   - Customer importance
   - Time sensitivity

3. Entity Extraction: Identify and extract ALL:
   - PO Numbers (format: various, often 6-10 digits)
   - Quote Numbers (format: Q-XXXXX, FTQ-XXXXX, F5Q-XXXXX)
   - Case Numbers (format: varies)
   - Part Numbers/SKUs (alphanumeric product codes)
   - Company Names
   - Contact Names and Roles
   - Dollar Amounts

4. Business Process: Determine the primary business activity:
   - Order Management
   - Quote Processing
   - Technical Support
   - Returns/RMA
   - Account Management
   - Shipping/Logistics
   - Billing/Payment
   - General Inquiry

5. Action Items: Extract specific actions needed:
   - What needs to be done
   - Who should do it
   - When it should be completed
   - Current status

6. Sentiment & Urgency: Assess:
   - Customer satisfaction level
   - Urgency indicators
   - Potential escalation risks

7. Context & Summary: Provide:
   - Brief summary of the situation
   - Key business context
   - Historical references if mentioned

8. Suggested Response: Draft a brief, professional response addressing the main points

Provide response in the following JSON structure:
{
  "workflow_state": "START_POINT/IN_PROGRESS/COMPLETION",
  "priority": "CRITICAL/HIGH/MEDIUM/LOW",
  "confidence": 0.95,
  "entities": {
    "po_numbers": ["PO123456"],
    "quote_numbers": ["Q-12345"],
    "case_numbers": ["CASE-123"],
    "part_numbers": ["ABC123"],
    "companies": ["Company Name"],
    "contacts": ["Name - Title"],
    "amounts": ["$1,234.56"]
  },
  "business_process": "Order Management",
  "action_items": [
    {
      "task": "Action description",
      "owner": "Responsible party",
      "deadline": "When needed",
      "status": "Current status"
    }
  ],
  "sentiment": {
    "satisfaction": "HIGH/MEDIUM/LOW",
    "urgency_level": "CRITICAL/HIGH/MEDIUM/LOW",
    "escalation_risk": "HIGH/MEDIUM/LOW"
  },
  "urgency_indicators": ["urgent", "asap", "critical"],
  "contextual_summary": "Brief summary of the situation",
  "suggested_response": "Professional response to the email",
  "sla_status": "ON_TRACK/AT_RISK/VIOLATED"
}

Email to analyze:
{email_content}
"""
```

## 2. Phase 3 - doomgrave/phi-4 Optimized Prompt

**Target Score**: 7.75/10
**Achieved Score**: 7.6/10
**Model**: doomgrave/phi-4:14b-tools-Q3_K_S

```json
{
  "prompt": "<|system|>\nYou are an advanced TD SYNNEX email analysis system. Analyze emails to extract business insights.\n\nRESPOND ONLY WITH VALID JSON.\n<|user|>\nAnalyze this email and provide:\n\n1. Workflow State Detection:\n   - START_POINT: New requests, initial inquiries\n   - IN_PROGRESS: Ongoing discussions, follow-ups\n   - COMPLETION: Resolutions, final answers\n\n2. Priority Level:\n   - CRITICAL: Urgent language, major revenue impact\n   - HIGH: Important customers, time-sensitive\n   - MEDIUM: Standard requests\n   - LOW: Informational only\n\n3. Entity Extraction (CRITICAL - Extract ALL):\n   - PO Numbers: Any 6-10 digit numbers with PO/P.O./Purchase Order\n   - Quote Numbers: Q-XXXXX, FTQ-XXXXX, F5Q-XXXXX patterns\n   - Case Numbers: Support tickets, case IDs\n   - Part Numbers: Product SKUs, item codes\n   - Companies: Business names mentioned\n   - Contacts: People names and roles\n\n4. Business Process Identification:\n   - Order Management\n   - Quote Processing  \n   - Technical Support\n   - Returns/RMA\n   - Shipping/Logistics\n   - Account Management\n\n5. Action Items:\n   - Specific tasks needed\n   - Who should complete them\n   - Deadlines\n\n6. Urgency Indicators:\n   - Words like urgent, ASAP, critical, immediately\n   - Deadline mentions\n   - Escalation threats\n\n7. Response Generation:\n   - Professional\n   - Addresses main concerns\n   - Action-oriented\n\nJSON Response Format:\n{\n  \"workflow_state\": \"START_POINT|IN_PROGRESS|COMPLETION\",\n  \"priority\": \"CRITICAL|HIGH|MEDIUM|LOW\",\n  \"confidence\": 0.0-1.0,\n  \"entities\": {\n    \"po_numbers\": [\"PO123456\"],\n    \"quote_numbers\": [\"Q-12345\"],\n    \"case_numbers\": [\"CASE123\"],\n    \"part_numbers\": [\"ABC123\"],\n    \"companies\": [\"Company Name\"],\n    \"contacts\": [\"John Doe - Title\"]\n  },\n  \"business_process\": \"Order Management\",\n  \"action_items\": [\n    {\n      \"task\": \"What needs to be done\",\n      \"owner\": \"Who should do it\",\n      \"deadline\": \"When needed\"\n    }\n  ],\n  \"urgency_level\": \"CRITICAL|HIGH|MEDIUM|LOW\",\n  \"urgency_indicators\": [\"urgent\", \"asap\"],\n  \"sla_status\": \"ON_TRACK|AT_RISK|VIOLATED\",\n  \"contextual_summary\": \"Brief situation summary\",\n  \"suggested_response\": \"Professional response addressing the email\"\n}\n\nEmail to analyze:",
  "targetScore": 7.75,
  "optimizationNotes": [
    "Uses phi-4 specific <|system|> and <|user|> tags",
    "Emphasizes entity extraction as CRITICAL",
    "Provides clear examples in JSON format",
    "Structured for consistent JSON output"
  ]
}
```

## 3. Phase 2 - llama3.2:3b JSON-Enforced Prompt

**Target Score**: 6.56/10
**Model**: llama3.2:3b

```javascript
const LLAMA_JSON_PROMPT = `You are a TD SYNNEX email analyzer. Analyze the email and respond ONLY with valid JSON.

CRITICAL: Your response must be ONLY a JSON object, no markdown, no explanations, just JSON.

Analyze for:
1. Workflow state: START_POINT, IN_PROGRESS, or COMPLETION
2. Priority: CRITICAL, HIGH, MEDIUM, or LOW  
3. Entities: PO numbers, quotes, cases, parts, companies, contacts
4. Business process type
5. Action items needed
6. Urgency indicators

Response format (JSON ONLY):
{
  "workflow_state": "START_POINT|IN_PROGRESS|COMPLETION",
  "priority": "CRITICAL|HIGH|MEDIUM|LOW",
  "confidence": 0.0-1.0,
  "entities": {
    "po_numbers": ["PO12345"],
    "quote_numbers": ["Q-12345"],
    "case_numbers": ["CASE123"],
    "part_numbers": ["ABC123"],
    "companies": ["Company Name"],
    "contacts": ["John Doe"]
  },
  "business_process": "Order Management|Quote Processing|Support|etc",
  "action_items": [
    {"task": "Action needed", "owner": "who", "deadline": "when"}
  ],
  "urgency_level": "CRITICAL|HIGH|MEDIUM|LOW",
  "urgency_indicators": ["urgent", "asap"],
  "sla_status": "ON_TRACK|AT_RISK|VIOLATED",
  "contextual_summary": "Brief summary",
  "suggested_response": "Professional response"
}

Email to analyze:`;
```

## 4. Phase 1 - Rule-Based + Iterative Script Prompt

**Score Achieved**: 5.6/10
**Method**: Iteratively developed using Claude as baseline

The Phase 1 approach used a rule-based system that was iteratively refined by:
1. Running Claude analysis on sample emails
2. Extracting patterns from Claude's responses
3. Building rules to match Claude's analysis
4. Testing and refining until 5.6/10 score achieved

Key patterns identified:
- "RE:" or "FW:" in subject → IN_PROGRESS workflow
- "completed", "resolved", "closed" in body → COMPLETION workflow
- "urgent", "ASAP", "critical" → HIGH/CRITICAL priority
- PO pattern: /\b(?:PO|P\.O\.|Purchase Order)?\s*#?\s*(\d{6,})/gi
- Quote pattern: /\b(?:Quote|Q|FTQ|F5Q)[-#]?\s*(\w+)/gi

## Model Performance Summary

| Model | Prompt Type | Target Score | Achieved Score | Avg Time/Email |
|-------|-------------|--------------|----------------|----------------|
| Claude Opus-4 | 8-point comprehensive | 8.5/10 | 8.5/10 | ~2-3 min |
| doomgrave/phi-4 | Optimized with tags | 7.75/10 | 7.6/10 | ~80s |
| llama3.2:3b | JSON-enforced | 6.56/10 | TBD | ~50s |
| Rule-based script | Iterative patterns | 5.6/10 | 5.6/10 | <1s |

## Important Notes

1. **Mock vs Real Analysis**: Always check processing times
   - Real LLM calls: 50-180 seconds per email
   - Mock analysis: <1 second per email

2. **Model-Specific Formatting**:
   - phi-4: Requires <|system|> and <|user|> tags
   - llama3.2: Returns markdown by default, needs JSON enforcement
   - Claude: Handles complex prompts without special formatting

3. **Database Considerations**:
   - Use INSERT OR REPLACE to avoid duplicates
   - Some test emails (batch 1) have foreign key issues
   - Store processing times to verify real LLM calls

4. **File Locations**:
   - This file: `/prompts/MASTER_PROMPTS_REFERENCE.md`
   - Test results: `/test-results/`
   - Scripts: `/scripts/`
   - Documentation: `/docs/PHASE_2_3_TESTING_DOCUMENTATION.md`