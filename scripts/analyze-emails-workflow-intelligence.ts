#!/usr/bin/env tsx
/**
 * Enhanced Three-Phase Email Workflow Intelligence System
 * Implements TD SYNNEX IEMS requirements for workflow tracking and task management
 */

import Database from "better-sqlite3";
import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================
// WORKFLOW CATEGORIES & STATUS MAPPINGS
// ============================================

const WORKFLOW_CATEGORIES = [
  'Order Management',      // 87.9% of emails
  'Shipping/Logistics',    // 83.2%
  'Quote Processing',      // 65.2%
  'Customer Support',      // 39.1%
  'Deal Registration',     // 17.6%
  'Approval Workflows',    // 11.9%
  'Renewal Processing',    // 2.2%
  'Vendor Management'      // 1.5%
];

// Status mapping for Red/Yellow/Green system
const STATUS_KEYWORDS = {
  RED: [
    'urgent', 'critical', 'escalation', 'emergency', 'asap',
    'immediately', 'overdue', 'expired', 'failed', 'blocked',
    'complaint', 'dissatisfied', 'cancel', 'at risk', 'deadline today',
    'past due', 'escalate', 'unhappy customer', 'threatening'
  ],
  YELLOW: [
    'working on', 'in progress', 'processing', 'pending',
    'waiting for', 'follow up', 'reminder', 'update needed',
    'questions', 'clarification', 'reviewing', 'investigating',
    'need information', 'awaiting', 'checking', 'verifying'
  ],
  GREEN: [
    'received', 'acknowledged', 'scheduled', 'on track',
    'confirmed', 'normal', 'standard', 'routine', 'proceeding',
    'will process', 'queued', 'thank you', 'noted'
  ],
  COMPLETED: [
    'completed', 'done', 'resolved', 'closed', 'finished',
    'delivered', 'shipped', 'approved', 'processed', 'fulfilled',
    'invoice sent', 'paid', 'finalized', 'implemented'
  ]
};

// ============================================
// PHASE 1: INTELLIGENT WORKFLOW TRIAGE
// ============================================

interface Phase1WorkflowResults {
  // Workflow Classification
  workflow_category: string;
  workflow_state: 'START_POINT' | 'IN_PROGRESS' | 'COMPLETION';
  task_status: 'RED' | 'YELLOW' | 'GREEN' | 'COMPLETED';
  
  // Priority Assessment
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'NORMAL';
  urgency_indicators: string[];
  sla_risk: boolean;
  
  // Entity Extraction
  entities: {
    po_numbers: string[];
    quote_numbers: string[];
    case_numbers: string[];
    order_references: string[];
    part_numbers: string[];
    contacts: {
      internal: string[];
      external: string[];
    };
    dollar_amounts: string[];
    dates: string[];
    companies: string[];
  };
  
  // Task Identification
  task_triggers: string[];
  ownership_indicators: string[];
  status_keywords: string[];
  
  // Metadata
  sender_category: 'key_customer' | 'internal' | 'vendor' | 'standard';
  conversation_position: 'thread_start' | 'reply' | 'forward';
  financial_impact: number;
  processing_time: number;
}

function phase1WorkflowAnalysis(email: any): Phase1WorkflowResults {
  const startTime = Date.now();
  const subject = (email.subject || '').toLowerCase();
  const body = (email.body || email.body_preview || '').toLowerCase();
  const content = subject + ' ' + body;
  
  // Detect workflow category
  const workflow_category = detectWorkflowCategory(email);
  
  // Detect workflow state
  const workflow_state = detectWorkflowState(content);
  
  // Detect task status (Red/Yellow/Green)
  const task_status = detectTaskStatus(content, email.importance);
  
  // Extract all entities
  const entities = {
    po_numbers: extractPONumbers(content),
    quote_numbers: extractQuoteNumbers(content),
    case_numbers: extractCaseNumbers(content),
    order_references: extractOrderReferences(content),
    part_numbers: extractPartNumbers(content),
    contacts: extractContacts(email),
    dollar_amounts: extractDollarAmounts(content),
    dates: extractDates(content),
    companies: extractCompanies(content)
  };
  
  // Detect urgency and priority
  const urgency_indicators = detectUrgencyIndicators(content);
  const priority = calculatePriority(urgency_indicators, task_status, entities.dollar_amounts);
  
  // Detect task triggers
  const task_triggers = detectTaskTriggers(content);
  
  // Detect ownership indicators
  const ownership_indicators = detectOwnershipIndicators(content);
  
  // Detect status keywords
  const status_keywords = detectStatusKeywords(content);
  
  // Calculate financial impact
  const financial_impact = calculateFinancialImpact(entities.dollar_amounts);
  
  // Detect sender category
  const sender_category = detectSenderCategory(email.sender_email);
  
  // Detect conversation position
  const conversation_position = detectConversationPosition(email.subject);
  
  // SLA risk assessment
  const sla_risk = assessSLARisk(task_status, urgency_indicators, workflow_state);
  
  return {
    workflow_category,
    workflow_state,
    task_status,
    priority,
    urgency_indicators,
    sla_risk,
    entities,
    task_triggers,
    ownership_indicators,
    status_keywords,
    sender_category,
    conversation_position,
    financial_impact,
    processing_time: Date.now() - startTime
  };
}

// Workflow category detection
function detectWorkflowCategory(email: any): string {
  const subject = (email.subject || '').toLowerCase();
  const body = (email.body || email.body_preview || '').toLowerCase();
  const content = subject + ' ' + body;
  
  // Priority-ordered detection based on TD SYNNEX patterns
  if (/\b(po#?|purchase order|p\.o\.)\s*\d+/i.test(content) || 
      content.includes('order status') || 
      content.includes('order confirmation')) {
    return 'Order Management';
  }
  
  if (content.includes('tracking') || content.includes('shipment') ||
      content.includes('delivery') || content.includes('shipped') ||
      content.includes('freight') || content.includes('carrier')) {
    return 'Shipping/Logistics';
  }
  
  if (content.includes('quote') || content.includes('pricing') ||
      content.includes('quotation') || /\bRFQ\b/i.test(content) ||
      content.includes('cost') || content.includes('discount')) {
    return 'Quote Processing';
  }
  
  if (content.includes('deal registration') || content.includes('opportunity') ||
      content.includes('lead') || content.includes('prospect')) {
    return 'Deal Registration';
  }
  
  if (content.includes('approval') || content.includes('approve') ||
      content.includes('authorization') || content.includes('sign off')) {
    return 'Approval Workflows';
  }
  
  if (content.includes('renewal') || content.includes('expir') ||
      content.includes('contract extension') || content.includes('renew')) {
    return 'Renewal Processing';
  }
  
  if (content.includes('vendor') || content.includes('supplier') ||
      content.includes('manufacturer')) {
    return 'Vendor Management';
  }
  
  // Default to Customer Support for general inquiries
  return 'Customer Support';
}

// Workflow state detection
function detectWorkflowState(content: string): 'START_POINT' | 'IN_PROGRESS' | 'COMPLETION' {
  // COMPLETION indicators
  if (STATUS_KEYWORDS.COMPLETED.some(kw => content.includes(kw))) {
    return 'COMPLETION';
  }
  
  // IN_PROGRESS indicators
  if (STATUS_KEYWORDS.YELLOW.some(kw => content.includes(kw)) ||
      content.includes('update') || content.includes('status')) {
    return 'IN_PROGRESS';
  }
  
  // Default to START_POINT for new requests
  return 'START_POINT';
}

// Task status detection (Red/Yellow/Green)
function detectTaskStatus(content: string, importance?: string): 'RED' | 'YELLOW' | 'GREEN' | 'COMPLETED' {
  // Check for completed first
  if (STATUS_KEYWORDS.COMPLETED.some(kw => content.includes(kw))) {
    return 'COMPLETED';
  }
  
  // Check for RED status
  if (STATUS_KEYWORDS.RED.some(kw => content.includes(kw)) || importance === 'high') {
    return 'RED';
  }
  
  // Check for YELLOW status
  if (STATUS_KEYWORDS.YELLOW.some(kw => content.includes(kw))) {
    return 'YELLOW';
  }
  
  // Default to GREEN
  return 'GREEN';
}

// Extract contacts with internal/external classification
function extractContacts(email: any): { internal: string[]; external: string[] } {
  const internal: string[] = [];
  const external: string[] = [];
  
  const internalDomains = ['@tdsynnex.com', '@compucom.com', '@techdata.com', '@synnex.com'];
  
  // Check sender
  if (email.sender_email) {
    if (internalDomains.some(domain => email.sender_email.includes(domain))) {
      internal.push(email.sender_email);
    } else {
      external.push(email.sender_email);
    }
  }
  
  // Check recipients
  const recipients = email.recipient_emails?.split(',') || [];
  recipients.forEach((recipient: string) => {
    const cleaned = recipient.trim();
    if (internalDomains.some(domain => cleaned.includes(domain))) {
      internal.push(cleaned);
    } else if (cleaned.includes('@')) {
      external.push(cleaned);
    }
  });
  
  return { internal: [...new Set(internal)], external: [...new Set(external)] };
}

// Enhanced entity extraction functions
function extractPONumbers(text: string): string[] {
  const patterns = [
    /\bPO\s*#?\s*(\d{7,12})\b/gi,
    /\bP\.O\.\s*#?\s*(\d{7,12})\b/gi,
    /\bPurchase\s+Order\s*#?\s*(\d{7,12})\b/gi
  ];
  
  const results = new Set<string>();
  patterns.forEach(pattern => {
    const matches = [...text.matchAll(pattern)];
    matches.forEach(m => results.add(m[1]));
  });
  
  return Array.from(results);
}

function extractQuoteNumbers(text: string): string[] {
  const patterns = [
    /\bQuote\s*#?\s*(\d{6,10})\b/gi,
    /\bQ-(\d{6,10})\b/gi,
    /\bCAS-(\d{6,10})\b/gi,
    /\bTS-(\d{6,10})\b/gi,
    /\bWQ(\d{6,10})\b/gi
  ];
  
  const results = new Set<string>();
  patterns.forEach(pattern => {
    const matches = [...text.matchAll(pattern)];
    matches.forEach(m => results.add(m[1]));
  });
  
  return Array.from(results);
}

function extractCaseNumbers(text: string): string[] {
  const patterns = [
    /\bCase\s*#?\s*(\d{6,10})\b/gi,
    /\bTicket\s*#?\s*(\d{6,10})\b/gi,
    /\bSR\s*#?\s*(\d{6,10})\b/gi,
    /\bINC(\d{6,10})\b/gi
  ];
  
  const results = new Set<string>();
  patterns.forEach(pattern => {
    const matches = [...text.matchAll(pattern)];
    matches.forEach(m => results.add(m[1]));
  });
  
  return Array.from(results);
}

function extractOrderReferences(text: string): string[] {
  const patterns = [
    /\bORD-(\d{6,10})\b/gi,
    /\bOrder\s*#?\s*(\d{6,10})\b/gi,
    /\bSO\s*#?\s*(\d{6,10})\b/gi
  ];
  
  const results = new Set<string>();
  patterns.forEach(pattern => {
    const matches = [...text.matchAll(pattern)];
    matches.forEach(m => results.add(m[1]));
  });
  
  return Array.from(results);
}

function extractCompanies(text: string): string[] {
  // Common company patterns
  const patterns = [
    /\b([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*)\s+(?:Inc|LLC|Corp|Corporation|Ltd|Company)\b/g,
    /\b(?:customer|client|account):\s*([A-Za-z\s]+?)(?:\s|,|\.)/gi
  ];
  
  const results = new Set<string>();
  patterns.forEach(pattern => {
    const matches = [...text.matchAll(pattern)];
    matches.forEach(m => {
      const company = m[1].trim();
      if (company.length > 2 && company.length < 50) {
        results.add(company);
      }
    });
  });
  
  return Array.from(results);
}

// Helper functions
function detectUrgencyIndicators(content: string): string[] {
  const indicators: string[] = [];
  const urgencyPatterns = [
    'urgent', 'asap', 'critical', 'emergency', 'immediately',
    'today', 'eod', 'end of day', 'cob', 'close of business',
    'high priority', 'expedite', 'rush', 'time sensitive'
  ];
  
  urgencyPatterns.forEach(pattern => {
    if (content.includes(pattern)) {
      indicators.push(pattern);
    }
  });
  
  return indicators;
}

function calculatePriority(urgencyIndicators: string[], status: string, dollarAmounts: string[]): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'NORMAL' {
  const maxAmount = Math.max(...dollarAmounts.map(amt => 
    parseFloat(amt.replace(/[$,]/g, '')) || 0
  ), 0);
  
  if (status === 'RED' || urgencyIndicators.length >= 3 || maxAmount > 50000) {
    return 'CRITICAL';
  }
  
  if (urgencyIndicators.length >= 1 || maxAmount > 10000) {
    return 'HIGH';
  }
  
  if (status === 'YELLOW' || maxAmount > 1000) {
    return 'MEDIUM';
  }
  
  return 'NORMAL';
}

function detectTaskTriggers(content: string): string[] {
  const triggers: string[] = [];
  const triggerPatterns = [
    'please', 'need', 'require', 'request', 'can you',
    'could you', 'would you', 'action required', 'response needed',
    'waiting for', 'follow up', 'reminder'
  ];
  
  triggerPatterns.forEach(pattern => {
    if (content.includes(pattern)) {
      triggers.push(pattern);
    }
  });
  
  return triggers;
}

function detectOwnershipIndicators(content: string): string[] {
  const indicators: string[] = [];
  const ownershipPatterns = [
    /assigned to (\w+)/gi,
    /owner: (\w+)/gi,
    /please contact (\w+)/gi,
    /forwarded to (\w+)/gi,
    /(\w+) will handle/gi,
    /(\w+) is working on/gi
  ];
  
  ownershipPatterns.forEach(pattern => {
    const matches = [...content.matchAll(pattern)];
    matches.forEach(m => indicators.push(m[0]));
  });
  
  return indicators;
}

function detectStatusKeywords(content: string): string[] {
  const keywords: string[] = [];
  
  Object.values(STATUS_KEYWORDS).forEach(statusList => {
    statusList.forEach(keyword => {
      if (content.includes(keyword)) {
        keywords.push(keyword);
      }
    });
  });
  
  return [...new Set(keywords)];
}

function calculateFinancialImpact(dollarAmounts: string[]): number {
  return dollarAmounts
    .map(amt => parseFloat(amt.replace(/[$,]/g, '')) || 0)
    .reduce((sum, amt) => sum + amt, 0);
}

function detectSenderCategory(senderEmail?: string): 'key_customer' | 'internal' | 'vendor' | 'standard' {
  if (!senderEmail) return 'standard';
  
  const email = senderEmail.toLowerCase();
  
  // Internal emails
  if (email.includes('@tdsynnex.com') || email.includes('@compucom.com')) {
    return 'internal';
  }
  
  // Key customer emails
  const keyCustomerDomains = [
    'insightordersupport@', 'team4401@', 'insighthpi@', 'insight3@'
  ];
  if (keyCustomerDomains.some(domain => email.includes(domain))) {
    return 'key_customer';
  }
  
  // Vendor emails
  const vendorDomains = ['@hp.com', '@dell.com', '@microsoft.com', '@cisco.com'];
  if (vendorDomains.some(domain => email.includes(domain))) {
    return 'vendor';
  }
  
  return 'standard';
}

function detectConversationPosition(subject: string): 'thread_start' | 'reply' | 'forward' {
  const lower = subject.toLowerCase();
  if (lower.startsWith('fw:') || lower.startsWith('fwd:')) {
    return 'forward';
  }
  if (lower.startsWith('re:')) {
    return 'reply';
  }
  return 'thread_start';
}

function assessSLARisk(status: string, urgencyIndicators: string[], workflowState: string): boolean {
  return (
    status === 'RED' ||
    urgencyIndicators.length > 2 ||
    (workflowState === 'IN_PROGRESS' && urgencyIndicators.length > 0)
  );
}

function extractPartNumbers(text: string): string[] {
  // TD SYNNEX part number patterns
  const pattern = /\b[A-Z0-9]{5,15}(?:[#\-\/\s]?[A-Z0-9]{1,5})?\b/g;
  const matches = text.toUpperCase().match(pattern) || [];
  
  // Filter out common false positives
  return matches.filter(m => 
    !m.match(/^(THE|AND|FOR|WITH|FROM|THIS|THAT|HAVE|WILL|BEEN|EMAIL|ORDER|QUOTE)$/) &&
    m.length >= 6
  ).slice(0, 20);
}

function extractDollarAmounts(text: string): string[] {
  const pattern = /\$[\d,]+(?:\.\d{2})?/g;
  return text.match(pattern) || [];
}

function extractDates(text: string): string[] {
  const patterns = [
    /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g,
    /\b\d{1,2}-\d{1,2}-\d{2,4}\b/g,
    /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}\b/gi,
    /\b(?:today|tomorrow|yesterday|next week|this week)\b/gi
  ];
  
  const results = new Set<string>();
  patterns.forEach(pattern => {
    const matches = text.match(pattern) || [];
    matches.forEach(m => results.add(m));
  });
  
  return Array.from(results);
}

// ============================================
// PHASE 2: AI-ENHANCED WORKFLOW ANALYSIS
// ============================================

interface Phase2WorkflowResults extends Phase1WorkflowResults {
  workflow_validation: {
    confirmed_state: string;
    state_confidence: number;
    state_reasoning: string;
  };
  ownership_analysis: {
    current_owner: string;
    owner_email: string;
    next_action_owner: string;
    ownership_transition: string;
  };
  task_details: {
    task_title: string;
    task_description: string;
    dependencies: string[];
    blockers: string[];
    estimated_completion: string;
  };
  missed_entities: any;
  workflow_prediction: {
    next_steps: string[];
    expected_timeline: string;
    escalation_risk: string;
  };
  sla_assessment: {
    sla_status: string;
    time_remaining: string;
    sla_deadline: string;
  };
  phase2_processing_time: number;
}

const PHASE2_WORKFLOW_PROMPT = `You are a TD SYNNEX workflow analyst. 
You have received initial rule-based analysis of an email. Your task is to enhance it with deeper workflow understanding.

Initial Analysis:
{PHASE1_RESULTS}

Your task is to ADD these workflow insights:
1. VALIDATE the workflow state and suggest transitions
2. IDENTIFY the current task owner and next action owner
3. FIND any missed entities or relationships
4. ASSESS task dependencies and blockers
5. PREDICT the next workflow steps
6. GENERATE actionable task descriptions

Focus on WORKFLOW PROGRESSION and OWNERSHIP CLARITY.

Respond with JSON only:
{
  "workflow_validation": {
    "confirmed_state": "IN_PROGRESS",
    "state_confidence": 0.95,
    "state_reasoning": "Email contains 'working on quote' indicating active processing"
  },
  "ownership_analysis": {
    "current_owner": "Sales Team - John Smith",
    "owner_email": "john.smith@tdsynnex.com",
    "next_action_owner": "Pricing Team",
    "ownership_transition": "After quote generation"
  },
  "task_details": {
    "task_title": "Generate Quote for PO#12345678",
    "task_description": "Customer ABC Corp requesting pricing for 15 servers",
    "dependencies": ["Vendor pricing confirmation", "Inventory check"],
    "blockers": [],
    "estimated_completion": "2025-02-01T17:00:00Z"
  },
  "missed_entities": {
    "customer_account": "ABC Corp - #A12345",
    "project_name": "Q1 Infrastructure Refresh",
    "related_quotes": ["Q-98765"],
    "stakeholders": ["jane.doe@abccorp.com"]
  },
  "workflow_prediction": {
    "next_steps": ["Obtain vendor pricing", "Generate formal quote", "Send for approval"],
    "expected_timeline": "24-48 hours",
    "escalation_risk": "Medium - customer mentioned urgency"
  },
  "sla_assessment": {
    "sla_status": "ON_TRACK",
    "time_remaining": "36 hours",
    "sla_deadline": "2025-02-02T09:00:00Z"
  }
}

Email content:
{EMAIL_CONTENT}`;

async function phase2WorkflowAnalysis(email: any, phase1Results: Phase1WorkflowResults): Promise<Phase2WorkflowResults> {
  const startTime = Date.now();
  
  try {
    const prompt = PHASE2_WORKFLOW_PROMPT
      .replace('{PHASE1_RESULTS}', JSON.stringify(phase1Results, null, 2))
      .replace('{EMAIL_CONTENT}', `Subject: ${email.subject}\n\nBody: ${email.body || email.body_preview}`);
    
    const response = await axios.post(
      'http://localhost:11434/api/generate',
      {
        model: 'llama3.2:3b',
        prompt,
        stream: false,
        options: {
          temperature: 0.1,
          num_predict: 1200,
          timeout: 60000
        }
      },
      { timeout: 60000 }
    );
    
    let result = response.data.response;
    if (result.includes('{')) {
      const start = result.indexOf('{');
      const end = result.lastIndexOf('}') + 1;
      result = result.substring(start, end);
    }
    
    const phase2Data = JSON.parse(result);
    
    return {
      ...phase1Results,
      ...phase2Data,
      phase2_processing_time: Date.now() - startTime
    };
    
  } catch (error) {
    console.error('Phase 2 error:', error);
    // Return enhanced Phase 1 with defaults
    const now = new Date();
    const deadline = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    
    return {
      ...phase1Results,
      workflow_validation: {
        confirmed_state: phase1Results.workflow_state,
        state_confidence: 0.7,
        state_reasoning: 'Based on keyword analysis'
      },
      ownership_analysis: {
        current_owner: 'Unassigned',
        owner_email: '',
        next_action_owner: 'Team Lead',
        ownership_transition: 'Requires assignment'
      },
      task_details: {
        task_title: `${phase1Results.workflow_category} Task`,
        task_description: email.subject || 'Email task',
        dependencies: [],
        blockers: [],
        estimated_completion: deadline.toISOString()
      },
      missed_entities: {},
      workflow_prediction: {
        next_steps: ['Review and assign', 'Process request'],
        expected_timeline: '48 hours',
        escalation_risk: phase1Results.priority === 'CRITICAL' ? 'High' : 'Low'
      },
      sla_assessment: {
        sla_status: phase1Results.sla_risk ? 'AT_RISK' : 'ON_TRACK',
        time_remaining: '48 hours',
        sla_deadline: deadline.toISOString()
      },
      phase2_processing_time: Date.now() - startTime
    };
  }
}

// ============================================
// PHASE 3: STRATEGIC TASK INTELLIGENCE
// ============================================

interface Phase3ExecutiveResults extends Phase2WorkflowResults {
  executive_summary: {
    headline: string;
    impact_level: string;
    executive_action_required: boolean;
  };
  cross_workflow_analysis: {
    related_workflows: string[];
    pattern_detected: string;
    trend_implication: string;
  };
  business_impact: {
    immediate_revenue: string;
    pipeline_impact: string;
    relationship_score_change: number;
    churn_risk: string;
  };
  strategic_recommendations: {
    immediate_actions: string[];
    process_improvements: string[];
  };
  dashboard_metrics: {
    workflow_efficiency_score: number;
    bottleneck_identified: string;
    automation_opportunity: string;
    roi_if_automated: string;
  };
  competitor_intelligence?: {
    competitor_mentioned: string;
    competitive_advantage: string;
    win_probability: number;
  };
  phase3_processing_time: number;
}

const PHASE3_EXECUTIVE_PROMPT = `<|system|>
You are a senior TD SYNNEX business strategist analyzing email workflows for executive visibility.
You have the complete analysis from previous phases. Provide STRATEGIC TASK INSIGHTS.

Phase 1 Analysis (rule-based):
{PHASE1_RESULTS}

Phase 2 Analysis (AI-enhanced):
{PHASE2_RESULTS}

Your task is to ADD EXECUTIVE-LEVEL INTELLIGENCE:
1. Cross-workflow impact analysis
2. Revenue and relationship implications
3. Risk assessment and mitigation strategies
4. Resource optimization recommendations
5. Pattern recognition across similar workflows
6. Executive dashboard metrics

Focus on STRATEGIC VALUE and ACTIONABLE INTELLIGENCE.
<|user|>
Email: {EMAIL_CONTENT}

Provide strategic insights in JSON format:
{
  "executive_summary": {
    "headline": "Critical $15k quote with expansion opportunity - competitor threat detected",
    "impact_level": "HIGH",
    "executive_action_required": true
  },
  "cross_workflow_analysis": {
    "related_workflows": ["ORD-98765 - Previous order", "Q-87654 - Competing quote"],
    "pattern_detected": "3rd urgent request from enterprise customers this week",
    "trend_implication": "Market demand surge - resource allocation needed"
  },
  "business_impact": {
    "immediate_revenue": "$15,000",
    "pipeline_impact": "$200,000",
    "relationship_score_change": -5,
    "churn_risk": "MEDIUM"
  },
  "strategic_recommendations": {
    "immediate_actions": [
      "Escalate to Sales VP for expedited processing",
      "Assign dedicated resource for enterprise quotes"
    ],
    "process_improvements": [
      "Implement express lane for >$10k quotes",
      "Create automated vendor pricing cache"
    ]
  },
  "dashboard_metrics": {
    "workflow_efficiency_score": 0.72,
    "bottleneck_identified": "Vendor pricing delays",
    "automation_opportunity": "HIGH",
    "roi_if_automated": "$50k annually"
  },
  "competitor_intelligence": {
    "competitor_mentioned": "Dell",
    "competitive_advantage": "Faster quote turnaround",
    "win_probability": 0.65
  }
}`;

async function phase3ExecutiveAnalysis(
  email: any,
  phase1Results: Phase1WorkflowResults,
  phase2Results: Phase2WorkflowResults
): Promise<Phase3ExecutiveResults> {
  const startTime = Date.now();
  
  try {
    const prompt = PHASE3_EXECUTIVE_PROMPT
      .replace('{PHASE1_RESULTS}', JSON.stringify(phase1Results, null, 2))
      .replace('{PHASE2_RESULTS}', JSON.stringify(phase2Results, null, 2))
      .replace('{EMAIL_CONTENT}', `Subject: ${email.subject}\n\nBody: ${email.body || email.body_preview}`);
    
    const response = await axios.post(
      'http://localhost:11434/api/generate',
      {
        model: 'doomgrave/phi-4:14b-tools-Q3_K_S',
        prompt,
        stream: false,
        options: {
          temperature: 0.3,
          num_predict: 2000,
          timeout: 180000
        }
      },
      { timeout: 180000 }
    );
    
    let result = response.data.response;
    if (result.includes('{')) {
      const start = result.indexOf('{');
      const end = result.lastIndexOf('}') + 1;
      result = result.substring(start, end);
    }
    
    const phase3Data = JSON.parse(result);
    
    return {
      ...phase2Results,
      ...phase3Data,
      phase3_processing_time: Date.now() - startTime
    };
    
  } catch (error) {
    console.error('Phase 3 error:', error);
    // Return Phase 2 with strategic defaults
    return {
      ...phase2Results,
      executive_summary: {
        headline: `${phase2Results.workflow_category} - ${phase2Results.priority} priority`,
        impact_level: phase2Results.priority === 'CRITICAL' ? 'HIGH' : 'MEDIUM',
        executive_action_required: phase2Results.priority === 'CRITICAL'
      },
      cross_workflow_analysis: {
        related_workflows: [],
        pattern_detected: 'Standard workflow',
        trend_implication: 'Continue monitoring'
      },
      business_impact: {
        immediate_revenue: `$${phase1Results.financial_impact}`,
        pipeline_impact: `$${phase1Results.financial_impact * 5}`,
        relationship_score_change: 0,
        churn_risk: 'LOW'
      },
      strategic_recommendations: {
        immediate_actions: ['Process as per standard workflow'],
        process_improvements: []
      },
      dashboard_metrics: {
        workflow_efficiency_score: 0.8,
        bottleneck_identified: 'None identified',
        automation_opportunity: 'LOW',
        roi_if_automated: '$0'
      },
      phase3_processing_time: Date.now() - startTime
    };
  }
}

// ============================================
// WORKFLOW TASK CREATION
// ============================================

interface WorkflowTask {
  // Core Task Information
  task_id: string;
  email_id: string;
  conversation_id: string;
  
  // Workflow Classification
  workflow_category: string;
  workflow_state: string;
  task_status: string;
  
  // Task Details
  title: string;
  description: string;
  priority: string;
  
  // Ownership
  current_owner: string;
  owner_email: string;
  assigned_date: string;
  
  // Entities
  entities: {
    po_numbers: string[];
    quote_numbers: string[];
    case_numbers: string[];
    customers: string[];
    dollar_value: number;
  };
  
  // Tracking
  created_at: string;
  updated_at: string;
  sla_deadline: string;
  completion_date?: string;
  
  // Grouping
  mailbox_source: string;
  category: string;
  group: string;
  
  // Analysis Metadata
  analysis_phases: number[];
  confidence_score: number;
  processing_time: number;
}

function createWorkflowTask(email: any, analysis: any, phases: number[]): WorkflowTask {
  const now = new Date().toISOString();
  
  return {
    // Core Task Information
    task_id: uuidv4(),
    email_id: email.id || email.message_id,
    conversation_id: email.conversation_id || email.id,
    
    // Workflow Classification
    workflow_category: analysis.workflow_category,
    workflow_state: analysis.workflow_state,
    task_status: analysis.task_status,
    
    // Task Details
    title: analysis.task_details?.task_title || 
           `${analysis.workflow_category}: ${email.subject?.substring(0, 100)}`,
    description: analysis.task_details?.task_description || 
                 email.body_preview || 
                 'Email task requiring action',
    priority: analysis.priority,
    
    // Ownership
    current_owner: analysis.ownership_analysis?.current_owner || 'Unassigned',
    owner_email: analysis.ownership_analysis?.owner_email || '',
    assigned_date: now,
    
    // Entities
    entities: {
      po_numbers: analysis.entities.po_numbers || [],
      quote_numbers: analysis.entities.quote_numbers || [],
      case_numbers: analysis.entities.case_numbers || [],
      customers: analysis.entities.companies || [],
      dollar_value: analysis.financial_impact || 0
    },
    
    // Tracking
    created_at: now,
    updated_at: now,
    sla_deadline: analysis.sla_assessment?.sla_deadline || 
                  new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    completion_date: analysis.task_status === 'COMPLETED' ? now : undefined,
    
    // Grouping
    mailbox_source: email.recipient_emails?.split(',')[0] || 'unknown',
    category: analysis.workflow_category,
    group: determineTaskGroup(analysis),
    
    // Analysis Metadata
    analysis_phases: phases,
    confidence_score: analysis.workflow_validation?.state_confidence || 0.8,
    processing_time: (analysis.processing_time + 
                     (analysis.phase2_processing_time || 0) + 
                     (analysis.phase3_processing_time || 0))
  };
}

function determineTaskGroup(analysis: any): string {
  // Group by workflow category and priority
  if (analysis.priority === 'CRITICAL' || analysis.task_status === 'RED') {
    return 'Critical Tasks';
  }
  
  if (analysis.workflow_category === 'Order Management') {
    return 'Order Processing';
  }
  
  if (analysis.workflow_category === 'Quote Processing') {
    return 'Sales Quotes';
  }
  
  if (analysis.workflow_category === 'Customer Support') {
    return 'Support Tickets';
  }
  
  return 'General Tasks';
}

// ============================================
// PHASE SELECTION LOGIC
// ============================================

function determineWorkflowPhases(email: any, phase1: Phase1WorkflowResults): {
  phases: number[];
  reason: string;
  estimatedTime: number;
} {
  // All emails get Phase 1 (instant classification)
  
  // Low-value completed emails stop at Phase 1
  if (phase1.priority === 'NORMAL' && 
      phase1.task_status === 'GREEN' &&
      phase1.workflow_state === 'COMPLETION' &&
      phase1.financial_impact < 1000) {
    return { 
      phases: [1], 
      reason: 'Completed low-value workflow',
      estimatedTime: 0.5
    };
  }
  
  // Most emails get Phase 1 + 2 for workflow tracking
  let phases = [1, 2];
  let reason = 'Standard workflow tracking';
  let estimatedTime = 10.5;
  
  // Add Phase 3 for strategic workflows
  const needsPhase3 = 
    // Critical business impact
    phase1.priority === 'CRITICAL' ||
    phase1.task_status === 'RED' ||
    
    // High-value workflows
    phase1.financial_impact > 10000 ||
    phase1.workflow_category === 'Deal Registration' ||
    phase1.workflow_category === 'Approval Workflows' ||
    
    // Key customer workflows
    (phase1.sender_category === 'key_customer' && phase1.urgency_indicators.length > 0) ||
    
    // Complex multi-stakeholder workflows
    phase1.entities.contacts.external.length > 3 ||
    
    // Stuck workflows needing attention
    (phase1.workflow_state === 'IN_PROGRESS' && phase1.sla_risk);
  
  if (needsPhase3) {
    phases.push(3);
    reason = 'Strategic workflow requiring executive visibility';
    estimatedTime = 90.5;
  }
  
  return { phases, reason, estimatedTime };
}

// ============================================
// DATABASE INTEGRATION
// ============================================

function saveWorkflowAnalysis(task: WorkflowTask, analysis: any, db: Database.Database) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO workflow_tasks (
      task_id, email_id, conversation_id,
      workflow_category, workflow_state, task_status,
      title, description, priority,
      current_owner, owner_email, assigned_date,
      po_numbers, quote_numbers, case_numbers,
      customers, dollar_value,
      created_at, updated_at, sla_deadline, completion_date,
      mailbox_source, category, group_name,
      analysis_phases, confidence_score, processing_time,
      full_analysis
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    task.task_id,
    task.email_id,
    task.conversation_id,
    task.workflow_category,
    task.workflow_state,
    task.task_status,
    task.title,
    task.description,
    task.priority,
    task.current_owner,
    task.owner_email,
    task.assigned_date,
    task.entities.po_numbers.join(','),
    task.entities.quote_numbers.join(','),
    task.entities.case_numbers.join(','),
    task.entities.customers.join(','),
    task.entities.dollar_value,
    task.created_at,
    task.updated_at,
    task.sla_deadline,
    task.completion_date,
    task.mailbox_source,
    task.category,
    task.group,
    JSON.stringify(task.analysis_phases),
    task.confidence_score,
    task.processing_time,
    JSON.stringify(analysis)
  );
}

// ============================================
// MAIN PROCESSING FUNCTION
// ============================================

async function processEmailWorkflow(email: any, db: Database.Database) {
  console.log(`\n📧 Processing: ${email.subject?.substring(0, 50)}...`);
  
  // Phase 1: Always run (instant)
  console.log('   🔍 Phase 1: Workflow triage...');
  const phase1Results = phase1WorkflowAnalysis(email);
  console.log(`   ✓ Category: ${phase1Results.workflow_category}`);
  console.log(`   ✓ State: ${phase1Results.workflow_state}`);
  console.log(`   ✓ Status: ${phase1Results.task_status} (${phase1Results.processing_time}ms)`);
  
  // Determine which phases to run
  const phaseDecision = determineWorkflowPhases(email, phase1Results);
  console.log(`   📊 Decision: ${phaseDecision.reason}`);
  
  let finalResults: any = phase1Results;
  
  // Phase 2: If needed
  if (phaseDecision.phases.includes(2)) {
    console.log('   🤖 Phase 2: AI workflow analysis...');
    const phase2Results = await phase2WorkflowAnalysis(email, phase1Results);
    finalResults = phase2Results;
    console.log(`   ✓ Owner: ${phase2Results.ownership_analysis.current_owner}`);
    console.log(`   ✓ SLA: ${phase2Results.sla_assessment.sla_status} (${phase2Results.phase2_processing_time}ms)`);
  }
  
  // Phase 3: If needed
  if (phaseDecision.phases.includes(3)) {
    console.log('   🎯 Phase 3: Executive intelligence...');
    const phase3Results = await phase3ExecutiveAnalysis(email, phase1Results, finalResults);
    finalResults = phase3Results;
    console.log(`   ✓ Impact: ${phase3Results.executive_summary.impact_level}`);
    console.log(`   ✓ Revenue: ${phase3Results.business_impact.immediate_revenue} (${phase3Results.phase3_processing_time}ms)`);
  }
  
  // Create workflow task
  const task = createWorkflowTask(email, finalResults, phaseDecision.phases);
  
  // Save to database
  saveWorkflowAnalysis(task, finalResults, db);
  
  const totalTime = finalResults.processing_time + 
    (finalResults.phase2_processing_time || 0) + 
    (finalResults.phase3_processing_time || 0);
  
  console.log(`   ⏱️  Total time: ${(totalTime/1000).toFixed(1)}s`);
  console.log(`   ✅ Task created: ${task.task_id}`);
  
  return { task, analysis: finalResults };
}

// ============================================
// DASHBOARD DATA AGGREGATION
// ============================================

async function generateDashboardData(db: Database.Database) {
  // Executive Dashboard Metrics
  const executiveMetrics = db.prepare(`
    SELECT 
      COUNT(*) as total_tasks,
      SUM(CASE WHEN task_status = 'RED' THEN 1 ELSE 0 END) as red_tasks,
      SUM(CASE WHEN task_status = 'YELLOW' THEN 1 ELSE 0 END) as yellow_tasks,
      SUM(CASE WHEN task_status = 'GREEN' THEN 1 ELSE 0 END) as green_tasks,
      SUM(CASE WHEN task_status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_tasks,
      SUM(CAST(dollar_value AS REAL)) as total_revenue_impact,
      COUNT(DISTINCT workflow_category) as active_workflows,
      AVG(confidence_score) as avg_confidence
    FROM workflow_tasks
    WHERE created_at > datetime('now', '-7 days')
  `).get() as any;
  
  // Workflow Category Breakdown
  const categoryBreakdown = db.prepare(`
    SELECT 
      workflow_category,
      COUNT(*) as count,
      SUM(CASE WHEN task_status = 'RED' THEN 1 ELSE 0 END) as critical_count,
      AVG(CAST(dollar_value AS REAL)) as avg_value
    FROM workflow_tasks
    GROUP BY workflow_category
    ORDER BY count DESC
  `).all();
  
  // SLA Performance
  const slaPerformance = db.prepare(`
    SELECT 
      workflow_category,
      COUNT(*) as total,
      SUM(CASE WHEN datetime(sla_deadline) < datetime('now') AND task_status != 'COMPLETED' THEN 1 ELSE 0 END) as overdue,
      AVG((julianday(completion_date) - julianday(created_at)) * 24) as avg_completion_hours
    FROM workflow_tasks
    WHERE completion_date IS NOT NULL
    GROUP BY workflow_category
  `).all();
  
  // Owner Workload
  const ownerWorkload = db.prepare(`
    SELECT 
      current_owner,
      COUNT(*) as active_tasks,
      SUM(CASE WHEN task_status = 'RED' THEN 1 ELSE 0 END) as critical_tasks,
      SUM(CAST(dollar_value AS REAL)) as total_value
    FROM workflow_tasks
    WHERE task_status != 'COMPLETED'
    GROUP BY current_owner
    ORDER BY active_tasks DESC
    LIMIT 10
  `).all();
  
  return {
    executive: executiveMetrics,
    categories: categoryBreakdown,
    sla: slaPerformance,
    workload: ownerWorkload,
    generated_at: new Date().toISOString()
  };
}

// ============================================
// MAIN EXECUTION
// ============================================

async function runWorkflowIntelligence() {
  console.log('🚀 TD SYNNEX Email Workflow Intelligence System');
  console.log('📊 Three-Phase Analysis with Task Management\n');
  
  const db = new Database('./data/crewai.db');
  
  // Create workflow tasks table if not exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS workflow_tasks (
      task_id TEXT PRIMARY KEY,
      email_id TEXT,
      conversation_id TEXT,
      workflow_category TEXT,
      workflow_state TEXT,
      task_status TEXT,
      title TEXT,
      description TEXT,
      priority TEXT,
      current_owner TEXT,
      owner_email TEXT,
      assigned_date TEXT,
      po_numbers TEXT,
      quote_numbers TEXT,
      case_numbers TEXT,
      customers TEXT,
      dollar_value REAL,
      created_at TEXT,
      updated_at TEXT,
      sla_deadline TEXT,
      completion_date TEXT,
      mailbox_source TEXT,
      category TEXT,
      group_name TEXT,
      analysis_phases TEXT,
      confidence_score REAL,
      processing_time REAL,
      full_analysis TEXT
    )
  `);
  
  // Get sample emails for testing
  const emails = db.prepare(`
    SELECT * FROM emails 
    WHERE received_at >= '2025-05-09'
    ORDER BY received_at DESC
    LIMIT 50
  `).all();
  
  console.log(`📧 Found ${emails.length} emails to analyze\n`);
  
  // Track statistics
  const stats = {
    total: 0,
    phase1Only: 0,
    phase2: 0,
    phase3: 0,
    byCategory: {} as Record<string, number>,
    byStatus: { RED: 0, YELLOW: 0, GREEN: 0, COMPLETED: 0 },
    totalRevenue: 0,
    avgProcessingTime: 0
  };
  
  // Process emails
  for (const email of emails.slice(0, 20)) {
    const result = await processEmailWorkflow(email, db);
    
    stats.total++;
    if (result.analysis.phase3_processing_time) stats.phase3++;
    else if (result.analysis.phase2_processing_time) stats.phase2++;
    else stats.phase1Only++;
    
    stats.byCategory[result.task.workflow_category] = 
      (stats.byCategory[result.task.workflow_category] || 0) + 1;
    
    stats.byStatus[result.task.task_status as keyof typeof stats.byStatus]++;
    stats.totalRevenue += result.task.entities.dollar_value;
    stats.avgProcessingTime += result.task.processing_time;
  }
  
  stats.avgProcessingTime /= stats.total;
  
  // Generate dashboard data
  const dashboardData = await generateDashboardData(db);
  
  // Save dashboard data
  fs.writeFileSync(
    path.join(__dirname, '../data/workflow-dashboard-data.json'),
    JSON.stringify(dashboardData, null, 2)
  );
  
  // Print summary
  console.log('\n' + '='.repeat(70));
  console.log('WORKFLOW INTELLIGENCE SUMMARY');
  console.log('='.repeat(70));
  console.log(`📊 Emails Analyzed: ${stats.total}`);
  console.log(`\n📈 Phase Distribution:`);
  console.log(`   Phase 1 only: ${stats.phase1Only}`);
  console.log(`   Phase 1+2: ${stats.phase2 - stats.phase3}`);
  console.log(`   All 3 phases: ${stats.phase3}`);
  console.log(`\n📂 Workflow Categories:`);
  Object.entries(stats.byCategory)
    .sort(([,a], [,b]) => b - a)
    .forEach(([category, count]) => {
      console.log(`   ${category}: ${count}`);
    });
  console.log(`\n🚦 Task Status Distribution:`);
  console.log(`   🔴 RED (Critical): ${stats.byStatus.RED}`);
  console.log(`   🟡 YELLOW (In Progress): ${stats.byStatus.YELLOW}`);
  console.log(`   🟢 GREEN (On Track): ${stats.byStatus.GREEN}`);
  console.log(`   ✅ COMPLETED: ${stats.byStatus.COMPLETED}`);
  console.log(`\n💰 Financial Impact:`);
  console.log(`   Total Revenue: $${stats.totalRevenue.toLocaleString()}`);
  console.log(`   Average per Task: $${(stats.totalRevenue / stats.total).toFixed(2)}`);
  console.log(`\n⏱️  Performance:`);
  console.log(`   Average Processing Time: ${(stats.avgProcessingTime / 1000).toFixed(1)}s`);
  console.log(`\n✅ Dashboard data saved to: workflow-dashboard-data.json`);
  
  db.close();
}

// Run the analysis
runWorkflowIntelligence().catch(console.error);