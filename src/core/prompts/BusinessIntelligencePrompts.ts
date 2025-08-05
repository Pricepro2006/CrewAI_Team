/**
 * Business Intelligence Prompts - Claude Opus-level Insights
 * 
 * Advanced prompts designed to extract actionable business intelligence
 * from email analysis using optimized context management
 */

import type { BusinessContext, ContextFocusArea } from "../context/BusinessContextManager.js";
import type { Phase1Results, Phase2Results } from "../../types/AnalysisTypes.js";

// Business Intelligence Prompt Templates
export const BUSINESS_INTELLIGENCE_PROMPTS = {
  
  // Phase 2: Enhanced Business Analysis (Llama 3.2:3b)
  PHASE2_BUSINESS_ANALYSIS: `<|system|>
You are a TD SYNNEX business intelligence analyst. Extract actionable business insights from emails.
Output ONLY valid JSON - no explanatory text.

Focus on:
- Financial implications and revenue opportunities
- Workflow bottlenecks and process improvements
- Customer relationship dynamics
- Technical requirements and constraints
- Time-sensitive actions and deadlines

<|user|>
BUSINESS CONTEXT: {BUSINESS_CONTEXT}
PHASE 1 ANALYSIS: {PHASE1_RESULTS}
EMAIL CONTENT: {EMAIL_CONTENT}

Extract business intelligence in this EXACT JSON format:
{
  "business_intelligence": {
    "financial_impact": {
      "revenue_opportunity": "$amount or description",
      "cost_implications": "cost analysis",
      "budget_considerations": "budget factors",
      "payment_risk_level": "low|medium|high|critical"
    },
    "operational_insights": {
      "workflow_bottlenecks": ["bottleneck1", "bottleneck2"],
      "process_inefficiencies": ["inefficiency1", "inefficiency2"],
      "automation_opportunities": ["opportunity1", "opportunity2"],
      "resource_constraints": ["constraint1", "constraint2"]
    },
    "customer_intelligence": {
      "satisfaction_level": "high|medium|low|critical",
      "loyalty_indicators": ["indicator1", "indicator2"],
      "expansion_potential": "description",
      "churn_risk_factors": ["risk1", "risk2"]
    },
    "strategic_recommendations": {
      "immediate_actions": [
        {
          "action": "specific action",
          "owner": "responsible party",
          "deadline": "timeframe",
          "priority": "high|medium|low",
          "business_impact": "impact description"
        }
      ],
      "medium_term_initiatives": ["initiative1", "initiative2"],
      "long_term_opportunities": ["opportunity1", "opportunity2"]
    }
  },
  "risk_assessment": {
    "business_risks": ["risk1", "risk2"],
    "mitigation_strategies": ["strategy1", "strategy2"],
    "escalation_triggers": ["trigger1", "trigger2"]
  },
  "confidence_score": 0.0-1.0,
  "data_quality": "high|medium|low"
}`,

  // Phase 3: Strategic Executive Analysis (Phi-4)
  PHASE3_EXECUTIVE_ANALYSIS: `<|system|>
You are a TD SYNNEX executive business strategist. Provide strategic business intelligence and executive-level insights.
Output ONLY valid JSON - no explanatory text.

Analyze the complete business context for:
- Strategic market opportunities and threats
- Cross-functional process optimization
- Executive decision support
- Revenue maximization strategies
- Risk mitigation and competitive positioning

<|user|>
EXECUTIVE CONTEXT: {BUSINESS_CONTEXT}
PHASE 1 FOUNDATION: {PHASE1_RESULTS}
PHASE 2 ANALYSIS: {PHASE2_RESULTS}
EMAIL CHAIN CONTEXT: {CHAIN_CONTEXT}
HISTORICAL PATTERNS: {HISTORICAL_DATA}

Provide executive-level strategic analysis in this EXACT JSON format:
{
  "executive_summary": {
    "strategic_overview": "2-sentence executive summary",
    "key_business_driver": "primary business factor",
    "decision_urgency": "immediate|within_week|within_month|long_term",
    "executive_attention_required": true|false
  },
  "strategic_intelligence": {
    "market_opportunity": {
      "size": "$amount or percentage",
      "timeline": "timeframe",
      "competitive_advantage": "advantage",
      "market_risks": ["risk1", "risk2"]
    },
    "operational_excellence": {
      "process_optimization_value": "$amount or percentage improvement",
      "automation_roi": "roi calculation",
      "efficiency_gains": ["gain1", "gain2"],
      "cost_reduction_opportunities": ["opportunity1", "opportunity2"]
    },
    "customer_strategy": {
      "relationship_health": "strong|healthy|at_risk|critical",
      "lifetime_value_impact": "$amount or percentage",
      "retention_strategies": ["strategy1", "strategy2"],
      "upsell_opportunities": ["opportunity1", "opportunity2"]
    },
    "competitive_positioning": {
      "competitive_threats": ["threat1", "threat2"],
      "differentiation_opportunities": ["opportunity1", "opportunity2"],
      "market_share_implications": "impact description"
    }
  },
  "predictive_analytics": {
    "outcome_probability": {
      "successful_closure": 0.0-1.0,
      "timeline_achievement": 0.0-1.0,
      "customer_satisfaction": 0.0-1.0
    },
    "trend_analysis": {
      "similar_patterns": ["pattern1", "pattern2"],
      "success_factors": ["factor1", "factor2"],
      "failure_indicators": ["indicator1", "indicator2"]
    },
    "forecasting": {
      "revenue_projection": "$amount",
      "resource_requirements": ["requirement1", "requirement2"],
      "timeline_estimate": "timeframe"
    }
  },
  "executive_recommendations": {
    "strategic_decisions": [
      {
        "decision": "strategic decision required",
        "rationale": "business justification",
        "alternatives": ["alternative1", "alternative2"],
        "roi_impact": "$amount or percentage",
        "timeline": "implementation timeframe"
      }
    ],
    "resource_allocation": {
      "people": ["team assignments"],
      "budget": "$amount or percentage",
      "technology": ["tech requirements"]
    },
    "success_metrics": {
      "kpis": ["kpi1", "kpi2"],
      "milestones": ["milestone1", "milestone2"],
      "review_schedule": "review frequency"
    }
  },
  "governance": {
    "escalation_path": ["level1", "level2", "level3"],
    "approval_required": ["approval1", "approval2"],
    "compliance_considerations": ["consideration1", "consideration2"]
  }
}`,

  // Specialized prompts for different business contexts
  FINANCIAL_ANALYSIS_FOCUS: `
FINANCIAL INTELLIGENCE ENHANCEMENT:
- Calculate total deal value and profit margins
- Identify payment terms and cash flow impacts
- Assess competitive pricing pressures
- Evaluate budget authorization requirements
- Analyze financial risk factors and mitigation strategies
`,

  TECHNICAL_ANALYSIS_FOCUS: `
TECHNICAL INTELLIGENCE ENHANCEMENT:
- Extract product specifications and technical requirements
- Identify integration challenges and solutions
- Assess system compatibility and constraints
- Evaluate technical support requirements
- Analyze implementation complexity and timelines
`,

  RELATIONSHIP_ANALYSIS_FOCUS: `
RELATIONSHIP INTELLIGENCE ENHANCEMENT:
- Evaluate customer satisfaction and sentiment trends
- Identify key stakeholders and decision makers
- Assess relationship health and expansion opportunities
- Analyze communication patterns and preferences
- Evaluate loyalty indicators and churn risks
`,

  WORKFLOW_ANALYSIS_FOCUS: `
WORKFLOW INTELLIGENCE ENHANCEMENT:
- Map current process stage and workflow position
- Identify bottlenecks and process inefficiencies
- Evaluate automation opportunities and ROI
- Assess resource allocation and capacity constraints
- Analyze timeline adherence and schedule risks
`,

  ESCALATION_ANALYSIS_FOCUS: `
ESCALATION INTELLIGENCE ENHANCEMENT:
- Identify escalation triggers and severity levels
- Evaluate impact on customer relationships
- Assess resource requirements for resolution
- Analyze root cause and prevention strategies
- Evaluate communication and notification requirements
`
};

// Context-Aware Prompt Builder
export class BusinessIntelligencePromptBuilder {
  
  /**
   * Build Phase 2 prompt with optimized business context
   */
  buildPhase2Prompt(
    businessContext: BusinessContext,
    phase1Results: Phase1Results,
    emailContent: string,
    focusAreas: ContextFocusArea[] = []
  ): string {
    let prompt = BUSINESS_INTELLIGENCE_PROMPTS.PHASE2_BUSINESS_ANALYSIS;
    
    // Inject business context
    prompt = prompt.replace("{BUSINESS_CONTEXT}", this.formatBusinessContext(businessContext, "compact"));
    prompt = prompt.replace("{PHASE1_RESULTS}", this.formatPhase1Results(phase1Results));
    prompt = prompt.replace("{EMAIL_CONTENT}", this.formatEmailContent(emailContent));
    
    // Add focus area enhancements
    if (focusAreas.length > 0) {
      prompt += this.buildFocusEnhancements(focusAreas);
    }
    
    return prompt;
  }

  /**
   * Build Phase 3 prompt with comprehensive strategic context
   */
  buildPhase3Prompt(
    businessContext: BusinessContext,
    phase1Results: Phase1Results,
    phase2Results: Phase2Results,
    chainContext?: string,
    historicalData?: any[]
  ): string {
    let prompt = BUSINESS_INTELLIGENCE_PROMPTS.PHASE3_EXECUTIVE_ANALYSIS;
    
    // Inject comprehensive context
    prompt = prompt.replace("{BUSINESS_CONTEXT}", this.formatBusinessContext(businessContext, "detailed"));
    prompt = prompt.replace("{PHASE1_RESULTS}", this.formatPhase1Results(phase1Results));
    prompt = prompt.replace("{PHASE2_RESULTS}", this.formatPhase2Results(phase2Results));
    prompt = prompt.replace("{CHAIN_CONTEXT}", chainContext || "No chain context available");
    prompt = prompt.replace("{HISTORICAL_DATA}", this.formatHistoricalData(historicalData));
    
    return prompt;
  }

  /**
   * Format business context for prompt injection
   */
  private formatBusinessContext(context: BusinessContext, format: "compact" | "detailed"): string {
    const sections = [];
    
    if (context.financialContext) {
      const financial = format === "compact" 
        ? `Financial: $${context.financialContext.totalValue}, Risk: ${context.financialContext.riskLevel}, POs: ${context.financialContext.poNumbers.length}`
        : this.formatDetailedFinancialContext(context.financialContext);
      sections.push(financial);
    }
    
    if (context.workflowContext) {
      const workflow = format === "compact"
        ? `Workflow: Stage=${context.workflowContext.currentStage}, Bottlenecks: ${context.workflowContext.bottlenecks.length}`
        : this.formatDetailedWorkflowContext(context.workflowContext);
      sections.push(workflow);
    }
    
    if (context.relationshipContext) {
      const relationship = format === "compact"
        ? `Relationship: Sentiment=${context.relationshipContext.sentimentTrend}, Stakeholders: ${context.relationshipContext.stakeholders.length}`
        : this.formatDetailedRelationshipContext(context.relationshipContext);
      sections.push(relationship);
    }
    
    if (context.temporalContext) {
      const temporal = format === "compact"
        ? `Temporal: Deadlines=${context.temporalContext.deadlines.length}, Urgency=${context.temporalContext.urgencyFactors.length}`
        : this.formatDetailedTemporalContext(context.temporalContext);
      sections.push(temporal);
    }
    
    if (context.technicalContext) {
      const technical = format === "compact"
        ? `Technical: Products=${context.technicalContext.productSpecs.length}, Issues=${context.technicalContext.supportTickets.length}`
        : this.formatDetailedTechnicalContext(context.technicalContext);
      sections.push(technical);
    }
    
    return sections.join('\n');
  }

  /**
   * Format Phase 1 results for context
   */
  private formatPhase1Results(phase1: Phase1Results): string {
    return JSON.stringify({
      classification: phase1.basic_classification,
      entities: Object.entries(phase1.entities).reduce((acc, [key, value]) => {
        acc[key] = Array.isArray(value) ? value.length : value;
        return acc;
      }, {} as any),
      sentiment: phase1.sentiment,
      key_phrases: phase1.key_phrases.slice(0, 5)
    });
  }

  /**
   * Format Phase 2 results for Phase 3 context
   */
  private formatPhase2Results(phase2: Phase2Results): string {
    return JSON.stringify({
      enhanced_classification: phase2.enhanced_classification,
      action_items_count: phase2.action_items.length,
      contextual_insights: phase2.contextual_insights,
      confidence: phase2.enhanced_classification.confidence
    });
  }

  /**
   * Format email content for analysis
   */
  private formatEmailContent(content: string): string {
    // Clean and truncate email content for optimal token usage
    const cleaned = content
      .replace(/[\r\n]+/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/<[^>]*>/g, '')
      .trim();
    
    // Truncate to reasonable length while preserving important content
    return cleaned.length > 1000 ? cleaned.substring(0, 1000) + '...' : cleaned;
  }

  /**
   * Build focus area enhancements
   */
  private buildFocusEnhancements(focusAreas: ContextFocusArea[]): string {
    const enhancements = [];
    
    if (focusAreas.includes("financial")) {
      enhancements.push(BUSINESS_INTELLIGENCE_PROMPTS.FINANCIAL_ANALYSIS_FOCUS);
    }
    
    if (focusAreas.includes("technical")) {
      enhancements.push(BUSINESS_INTELLIGENCE_PROMPTS.TECHNICAL_ANALYSIS_FOCUS);
    }
    
    if (focusAreas.includes("relationship")) {
      enhancements.push(BUSINESS_INTELLIGENCE_PROMPTS.RELATIONSHIP_ANALYSIS_FOCUS);
    }
    
    if (focusAreas.includes("workflow")) {
      enhancements.push(BUSINESS_INTELLIGENCE_PROMPTS.WORKFLOW_ANALYSIS_FOCUS);
    }
    
    if (focusAreas.includes("escalation")) {
      enhancements.push(BUSINESS_INTELLIGENCE_PROMPTS.ESCALATION_ANALYSIS_FOCUS);
    }
    
    return enhancements.length > 0 ? '\n\nSPECIAL FOCUS:\n' + enhancements.join('\n') : '';
  }

  /**
   * Format historical data for context
   */
  private formatHistoricalData(historicalData?: any[]): string {
    if (!historicalData || historicalData.length === 0) {
      return "No historical data available";
    }
    
    // Summarize historical patterns
    return `Historical patterns from ${historicalData.length} similar cases`;
  }

  // Detailed formatting methods
  private formatDetailedFinancialContext(financial: any): string {
    return `Financial Analysis:
- Total Value: $${financial.totalValue}
- Risk Level: ${financial.riskLevel}
- PO Numbers: ${financial.poNumbers.join(', ')}
- Quote Numbers: ${financial.quoteNumbers.join(', ')}
- Competitive Pricing: ${financial.competitivePricing ? 'Yes' : 'No'}
- Urgent Orders: ${financial.urgentOrders ? 'Yes' : 'No'}`;
  }

  private formatDetailedWorkflowContext(workflow: any): string {
    return `Workflow Analysis:
- Current Stage: ${workflow.currentStage}
- Next Actions: ${workflow.nextActions.join(', ')}
- Bottlenecks: ${workflow.bottlenecks.join(', ')}
- Dependencies: ${workflow.dependencies.join(', ')}
- Automation Opportunities: ${workflow.automationOpportunities.join(', ')}`;
  }

  private formatDetailedRelationshipContext(relationship: any): string {
    return `Relationship Analysis:
- Sentiment Trend: ${relationship.sentimentTrend}
- Stakeholder Count: ${relationship.stakeholders.length}
- Satisfaction Indicators: ${relationship.satisfactionIndicators.join(', ')}
- Expansion Opportunities: ${relationship.expansionOpportunities.join(', ')}`;
  }

  private formatDetailedTemporalContext(temporal: any): string {
    return `Temporal Analysis:
- Critical Deadlines: ${temporal.deadlines.filter((d: any) => d.criticality === 'critical').length}
- Urgency Factors: ${temporal.urgencyFactors.join(', ')}
- Timeline Count: ${temporal.projectTimelines.length}`;
  }

  private formatDetailedTechnicalContext(technical: any): string {
    return `Technical Analysis:
- Product Specifications: ${technical.productSpecs.length}
- Support Tickets: ${technical.supportTickets.join(', ')}
- Integration Requirements: ${technical.integrationRequirements.length}
- Performance Issues: ${technical.performanceIssues.length}`;
  }
}

// Enhanced JSON parsing for business intelligence responses
export class BusinessIntelligenceResponseParser {
  
  /**
   * Parse Phase 2 business intelligence response
   */
  parsePhase2Response(response: string): any {
    try {
      // Try direct JSON parsing first
      return JSON.parse(response);
    } catch (error) {
      // Apply intelligent parsing strategies
      return this.intelligentJsonParsing(response, 'phase2');
    }
  }

  /**
   * Parse Phase 3 executive analysis response
   */
  parsePhase3Response(response: string): any {
    try {
      return JSON.parse(response);
    } catch (error) {
      return this.intelligentJsonParsing(response, 'phase3');
    }
  }

  /**
   * Intelligent JSON parsing with business context awareness
   */
  private intelligentJsonParsing(response: string, phase: 'phase2' | 'phase3'): any {
    // Remove markdown formatting
    let cleaned = response.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    
    // Extract JSON object
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (e) {
        // Fix common JSON issues
        let fixed = jsonMatch[0]
          .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
          .replace(/(['"])?([a-zA-Z_][a-zA-Z0-9_]*)\1?\s*:/g, '"$2":') // Quote keys
          .replace(/:\s*'([^']*)'/g, ': "$1"'); // Single to double quotes
        
        try {
          return JSON.parse(fixed);
        } catch (e2) {
          // Return structured fallback
          return this.createFallbackResponse(phase);
        }
      }
    }
    
    return this.createFallbackResponse(phase);
  }

  /**
   * Create structured fallback response
   */
  private createFallbackResponse(phase: 'phase2' | 'phase3'): any {
    if (phase === 'phase2') {
      return {
        business_intelligence: {
          financial_impact: {
            revenue_opportunity: "Analysis incomplete",
            cost_implications: "Unknown",
            budget_considerations: "Requires review",
            payment_risk_level: "medium"
          },
          operational_insights: {
            workflow_bottlenecks: [],
            process_inefficiencies: [],
            automation_opportunities: [],
            resource_constraints: []
          },
          customer_intelligence: {
            satisfaction_level: "medium",
            loyalty_indicators: [],
            expansion_potential: "Unknown",
            churn_risk_factors: []
          },
          strategic_recommendations: {
            immediate_actions: [],
            medium_term_initiatives: [],
            long_term_opportunities: []
          }
        },
        risk_assessment: {
          business_risks: ["Incomplete analysis"],
          mitigation_strategies: ["Manual review required"],
          escalation_triggers: []
        },
        confidence_score: 0.3,
        data_quality: "low"
      };
    } else {
      return {
        executive_summary: {
          strategic_overview: "Analysis incomplete - manual review required",
          key_business_driver: "Unknown",
          decision_urgency: "long_term",
          executive_attention_required: false
        },
        strategic_intelligence: {
          market_opportunity: { size: "Unknown", timeline: "Unknown" },
          operational_excellence: { process_optimization_value: "Unknown" },
          customer_strategy: { relationship_health: "healthy" },
          competitive_positioning: { competitive_threats: [] }
        },
        predictive_analytics: {
          outcome_probability: { successful_closure: 0.5 },
          trend_analysis: { similar_patterns: [] },
          forecasting: { revenue_projection: "Unknown" }
        },
        executive_recommendations: {
          strategic_decisions: [],
          resource_allocation: { people: [], budget: "Unknown" },
          success_metrics: { kpis: [] }
        },
        governance: {
          escalation_path: ["Manual review"],
          approval_required: [],
          compliance_considerations: []
        }
      };
    }
  }
}

// Export instances
export const biPromptBuilder = new BusinessIntelligencePromptBuilder();
export const biResponseParser = new BusinessIntelligenceResponseParser();