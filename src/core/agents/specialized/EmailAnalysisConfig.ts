/**
 * Email Analysis Configuration
 * Based on comprehensive testing results
 */

export interface EmailAnalysisModelConfig {
  primaryModel: string;
  criticalBackup?: string;
  entityExtraction?: string;
  temperature: number;
  maxTokens: number;
  timeout: number;
}

export interface TDSynnexPriorityRules {
  patterns: Array<{
    pattern: RegExp | string;
    priority: 'Critical' | 'High' | 'Medium' | 'Low';
    confidence: number;
  }>;
  workflowRules: Array<{
    workflow: string;
    condition: (email: any) => boolean;
    priority: 'Critical' | 'High' | 'Medium' | 'Low';
  }>;
}

/**
 * Production configuration based on testing results
 * granite3.3:2b identified as best overall model
 */
export const PRODUCTION_EMAIL_CONFIG: EmailAnalysisModelConfig = {
  primaryModel: 'granite3.3:2b',     // 80% accuracy, 100% critical detection in tests
  criticalBackup: 'granite3.3:8b',   // For critical validation if needed
  entityExtraction: 'qwen3:0.6b',    // Fast entity-only extraction (optional)
  temperature: 0.1,                  // Low temperature for consistency
  maxTokens: 500,                    // Sufficient for email analysis
  timeout: 10000                     // 10 second timeout
};

/**
 * TD SYNNEX-specific priority rules based on real email analysis
 */
export const TD_SYNNEX_PRIORITY_RULES: TDSynnexPriorityRules = {
  patterns: [
    // Critical patterns
    {
      pattern: /return request/i,
      priority: 'Critical',
      confidence: 0.9
    },
    {
      pattern: /urgent|asap|immediate|critical/i,
      priority: 'Critical',
      confidence: 0.85
    },
    {
      pattern: /system down|outage|failure/i,
      priority: 'Critical',
      confidence: 0.95
    },
    {
      pattern: /deal (expires?|expiring|deadline)/i,
      priority: 'Critical',
      confidence: 0.9
    },
    // High priority patterns
    {
      pattern: /important|high priority|eod|end of (day|business)/i,
      priority: 'High',
      confidence: 0.8
    },
    {
      pattern: /quote request|po\s*#?\s*\d+/i,
      priority: 'High',
      confidence: 0.75
    },
    // Medium priority patterns
    {
      pattern: /order update|shipment|scheduled/i,
      priority: 'Medium',
      confidence: 0.7
    },
    // Low priority patterns
    {
      pattern: /report|newsletter|update available|fyi/i,
      priority: 'Low',
      confidence: 0.8
    }
  ],
  workflowRules: [
    {
      workflow: 'License Renewal',
      condition: (email) => {
        const daysUntilExpiry = email.daysUntilExpiry || 
          extractDaysFromText(email.subject + ' ' + email.summary);
        return daysUntilExpiry < 7;
      },
      priority: 'Critical'
    },
    {
      workflow: 'Escalation',
      condition: () => true,
      priority: 'High'
    },
    {
      workflow: 'Order Management',
      condition: (email) => {
        const text = (email.subject + ' ' + email.summary).toLowerCase();
        return text.includes('issue') || text.includes('problem');
      },
      priority: 'High'
    }
  ]
};

/**
 * Extract days until expiry from email text
 */
function extractDaysFromText(text: string): number {
  const patterns = [
    /(\d+)\s*days?\s*(until|before|to)\s*expir/i,
    /expir\w*\s*in\s*(\d+)\s*days?/i,
    /(\d+)\s*days?\s*remaining/i
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const matchValue = match[1] || match[2];
      return matchValue ? parseInt(matchValue, 10) : 999;
    }
  }
  
  return 999; // Default to non-critical if not found
}

/**
 * Enhanced priority detection using TD SYNNEX rules
 */
export function enhancePriorityDetection(
  email: any,
  modelPrediction: string
): { priority: string; confidence: number; source: string } {
  // Check pattern-based rules first
  for (const rule of TD_SYNNEX_PRIORITY_RULES.patterns) {
    const text = email.subject + ' ' + email.summary;
    const matches = typeof rule.pattern === 'string' 
      ? text.toLowerCase().includes(rule.pattern.toLowerCase())
      : rule.pattern.test(text);
      
    if (matches) {
      return {
        priority: rule.priority,
        confidence: rule.confidence,
        source: 'pattern-rule'
      };
    }
  }
  
  // Check workflow-based rules
  if (email.workflow_type) {
    for (const rule of TD_SYNNEX_PRIORITY_RULES.workflowRules) {
      if (email.workflow_type.toLowerCase().includes(rule.workflow.toLowerCase()) &&
          rule.condition(email)) {
        return {
          priority: rule.priority,
          confidence: 0.85,
          source: 'workflow-rule'
        };
      }
    }
  }
  
  // Fall back to model prediction
  return {
    priority: modelPrediction,
    confidence: 0.7,
    source: 'model'
  };
}

/**
 * Configuration for different analysis scenarios
 */
export const ANALYSIS_SCENARIOS = {
  // High-volume processing
  highVolume: {
    ...PRODUCTION_EMAIL_CONFIG,
    primaryModel: 'qwen3:0.6b',  // Fastest model for high volume
    maxTokens: 200,
    timeout: 5000
  },
  
  // Quality-focused analysis
  qualityFocus: {
    ...PRODUCTION_EMAIL_CONFIG,
    primaryModel: 'granite3.3:8b',  // Larger model for better quality
    maxTokens: 1000,
    timeout: 15000
  },
  
  // Balanced approach (recommended)
  balanced: PRODUCTION_EMAIL_CONFIG
};

export default {
  PRODUCTION_EMAIL_CONFIG,
  TD_SYNNEX_PRIORITY_RULES,
  enhancePriorityDetection,
  ANALYSIS_SCENARIOS
};