/**
 * Three-Phase Analysis Prompts for Email Processing
 */

export interface PhasePrompt {
  system: string;
  user: string;
}

export const PHASE_1_PROMPT: PhasePrompt = {
  system: `You are an expert email analyst. Extract key information from business emails.
Focus on identifying:
- Business entities (PO numbers, quotes, cases, etc.)
- Workflow type and state
- Action items and urgency
- Customer information
Return structured JSON with these fields.`,
  user: `Analyze this email and extract business intelligence:
Email: {email_content}`
};

export const PHASE_2_PROMPT: PhasePrompt = {
  system: `You are an advanced business intelligence analyst. 
Provide deep analysis of business communications including:
- Enhanced classification and categorization
- Detailed action items with priorities
- Contextual insights and relationships
- Business impact assessment
Return comprehensive structured JSON.`,
  user: `Perform deep business analysis on this email:
Email: {email_content}
Previous Analysis: {phase1_results}`
};

export const PHASE_3_PROMPT: PhasePrompt = {
  system: `You are a strategic business advisor.
Provide executive-level insights including:
- Strategic recommendations
- Revenue and customer impact
- Risk assessment
- Cross-functional implications
Return strategic analysis in structured JSON.`,
  user: `Provide strategic analysis for this business communication:
Email: {email_content}
Previous Analysis: {phase2_results}`
};

export interface AnalysisPromptConfig {
  phase1: PhasePrompt;
  phase2: PhasePrompt;
  phase3: PhasePrompt;
}

export const THREE_PHASE_PROMPTS: AnalysisPromptConfig = {
  phase1: PHASE_1_PROMPT,
  phase2: PHASE_2_PROMPT,
  phase3: PHASE_3_PROMPT
};

// Aliases for backward compatibility
export const PHASE2_ENHANCED_PROMPT = PHASE_2_PROMPT;
export const PHASE3_STRATEGIC_PROMPT = PHASE_3_PROMPT;

// Email characteristics interface
export interface EmailCharacteristics {
  hasAttachments?: boolean;
  hasLinks?: boolean;
  sentiment?: string;
  urgency?: string;
  category?: string;
  length?: number;
}

// Helper function to enhance prompts based on email type
export function enhancePromptForEmailType(
  basePrompt: PhasePrompt,
  characteristics: EmailCharacteristics
): PhasePrompt {
  // Simple implementation - can be enhanced later
  let enhancedSystem = basePrompt.system;
  
  if (characteristics.urgency === 'high') {
    enhancedSystem += '\nPrioritize urgent action items and time-sensitive information.';
  }
  
  if (characteristics.category) {
    enhancedSystem += `\nFocus on ${characteristics.category}-related analysis.`;
  }
  
  return {
    system: enhancedSystem,
    user: basePrompt.user
  };
}