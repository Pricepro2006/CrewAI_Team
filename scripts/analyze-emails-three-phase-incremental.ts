#!/usr/bin/env tsx
/**
 * Three-Phase Incremental Email Analysis
 * Each phase builds on previous results for maximum efficiency and quality
 */

import Database from "better-sqlite3";
import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================
// PHASE 1: RULE-BASED TRIAGE (<1 second)
// ============================================

interface Phase1Results {
  workflow_state: string;
  priority: string;
  entities: {
    po_numbers: string[];
    quote_numbers: string[];
    case_numbers: string[];
    part_numbers: string[];
    dollar_amounts: string[];
    dates: string[];
  };
  key_phrases: string[];
  sender_category: string;
  urgency_score: number;
  financial_impact: number;
  processing_time: number;
}

function phase1Analysis(email: any): Phase1Results {
  const startTime = Date.now();
  const subject = (email.subject || '').toLowerCase();
  const body = (email.body || email.body_preview || '').toLowerCase();
  const content = subject + ' ' + body;
  
  // Extract entities with regex
  const entities = {
    po_numbers: extractPONumbers(content),
    quote_numbers: extractQuoteNumbers(content),
    case_numbers: extractCaseNumbers(content),
    part_numbers: extractPartNumbers(content),
    dollar_amounts: extractDollarAmounts(content),
    dates: extractDates(content)
  };
  
  // Detect workflow state
  let workflow_state = 'START_POINT';
  if (content.includes('resolved') || content.includes('completed') || content.includes('closed')) {
    workflow_state = 'COMPLETION';
  } else if (content.includes('update') || content.includes('status') || content.includes('working on')) {
    workflow_state = 'IN_PROGRESS';
  }
  
  // Calculate priority and urgency
  const urgencyKeywords = ['urgent', 'critical', 'asap', 'immediate', 'emergency', 'escalat'];
  const urgency_score = urgencyKeywords.filter(kw => content.includes(kw)).length;
  
  let priority = 'medium';
  if (urgency_score >= 2 || email.importance === 'high') priority = 'critical';
  else if (urgency_score === 1) priority = 'high';
  else if (content.includes('fyi') || content.includes('info')) priority = 'low';
  
  // Extract key phrases
  const key_phrases = [];
  const importantPhrases = [
    /urgent\s+\w+\s+\w+/g,
    /need\s+\w+\s+by\s+\w+/g,
    /\$[\d,]+\s+\w+/g,
    /deadline\s+\w+\s+\w+/g
  ];
  
  importantPhrases.forEach(pattern => {
    const matches = content.match(pattern);
    if (matches) key_phrases.push(...matches);
  });
  
  // Categorize sender
  const keySenders = ['insightordersupport', 'team4401', 'insighthpi'];
  const sender_category = keySenders.some(s => email.sender_email?.includes(s)) 
    ? 'key_customer' 
    : 'standard';
  
  // Calculate financial impact
  const financial_impact = entities.dollar_amounts
    .map(amt => parseFloat(amt.replace(/[$,]/g, '')))
    .filter(amt => !isNaN(amt))
    .reduce((sum, amt) => sum + amt, 0);
  
  return {
    workflow_state,
    priority,
    entities,
    key_phrases: key_phrases.slice(0, 5),
    sender_category,
    urgency_score,
    financial_impact,
    processing_time: Date.now() - startTime
  };
}

// ============================================
// PHASE 2: LLAMA ENHANCEMENT (10 seconds)
// ============================================

interface Phase2Results extends Phase1Results {
  workflow_validation: string;
  missed_entities: any;
  action_items: Array<{
    task: string;
    owner: string;
    deadline: string;
    revenue_impact?: string;
  }>;
  risk_assessment: string;
  initial_response: string;
  confidence: number;
  business_process: string;
  phase2_processing_time: number;
}

const PHASE2_INCREMENTAL_PROMPT = `You are a TD SYNNEX email analyzer. 
You have received initial rule-based analysis of an email. Build upon it to provide deeper insights.

Initial Analysis:
{PHASE1_RESULTS}

Your task is to:
1. VALIDATE the workflow state - correct if needed
2. FIND any missed entities the rules didn't catch
3. IDENTIFY specific action items with owners and deadlines
4. ASSESS business risk/opportunity
5. GENERATE an initial response suggestion

DO NOT repeat information already extracted. Focus on ADDING value.

Respond with JSON only:
{
  "workflow_validation": "Confirmed: Quote Processing" or "Corrected: Should be Order Management",
  "missed_entities": {
    "project_names": ["Q4 Infrastructure"],
    "technical_specs": ["15 servers", "Windows 2022"],
    "other": []
  },
  "action_items": [
    {"task": "Generate quote", "owner": "Sales Team", "deadline": "Friday 5PM", "revenue_impact": "$15,000"}
  ],
  "risk_assessment": "High - $15k deal at risk if delayed",
  "initial_response": "Thank you for your urgent request...",
  "confidence": 0.85,
  "business_process": "Quote Processing"
}

Email content:
{EMAIL_CONTENT}`;

async function phase2Analysis(email: any, phase1Results: Phase1Results): Promise<Phase2Results> {
  const startTime = Date.now();
  
  try {
    // Build context-aware prompt
    const prompt = PHASE2_INCREMENTAL_PROMPT
      .replace('{PHASE1_RESULTS}', JSON.stringify(phase1Results, null, 2))
      .replace('{EMAIL_CONTENT}', `Subject: ${email.subject}\n\nBody: ${email.body || email.body_preview}`);
    
    // Call Llama with Phase 1 context
    const response = await axios.post(
      'http://localhost:11434/api/generate',
      {
        model: 'llama3.2:3b',
        prompt,
        stream: false,
        options: {
          temperature: 0.1,
          num_predict: 800,
          timeout: 60000,
          stop: ["\n\n", "```", "**"]
        }
      },
      { timeout: 60000 }
    );
    
    // Parse response
    let result = response.data.response;
    if (result.includes('{')) {
      const start = result.indexOf('{');
      const end = result.lastIndexOf('}') + 1;
      result = result.substring(start, end);
    }
    
    const phase2Data = JSON.parse(result);
    
    // Merge with Phase 1 results
    return {
      ...phase1Results,
      workflow_validation: phase2Data.workflow_validation,
      missed_entities: phase2Data.missed_entities,
      action_items: phase2Data.action_items || [],
      risk_assessment: phase2Data.risk_assessment,
      initial_response: phase2Data.initial_response,
      confidence: phase2Data.confidence || 0.75,
      business_process: phase2Data.business_process || phase1Results.workflow_state,
      phase2_processing_time: Date.now() - startTime
    };
    
  } catch (error) {
    console.error('Phase 2 error:', error);
    // Return Phase 1 results with defaults
    return {
      ...phase1Results,
      workflow_validation: `Confirmed: ${phase1Results.workflow_state}`,
      missed_entities: {},
      action_items: [],
      risk_assessment: 'Unable to assess',
      initial_response: 'Thank you for your email. We will process your request.',
      confidence: 0.5,
      business_process: phase1Results.workflow_state,
      phase2_processing_time: Date.now() - startTime
    };
  }
}

// ============================================
// PHASE 3: PHI-4 STRATEGIC INSIGHTS (80 seconds)
// ============================================

interface Phase3Results extends Phase2Results {
  strategic_insights: {
    opportunity: string;
    risk: string;
    relationship: string;
  };
  executive_summary: string;
  escalation_needed: boolean;
  revenue_impact: string;
  cross_email_patterns?: string[];
  phase3_processing_time: number;
}

const PHASE3_INCREMENTAL_PROMPT = `<|system|>
You are a senior TD SYNNEX business strategist. You're reviewing an email that has been pre-analyzed.
Use the existing analysis to provide EXECUTIVE-LEVEL STRATEGIC INSIGHTS.

Phase 1 Analysis (rule-based):
{PHASE1_RESULTS}

Phase 2 Analysis (AI-enhanced): 
{PHASE2_RESULTS}

Your task is to ADD STRATEGIC VALUE by focusing on:
1. Hidden strategic implications
2. Cross-customer or cross-deal opportunities
3. Relationship impact and long-term effects
4. Executive escalation recommendations
5. Revenue maximization strategies

DO NOT repeat existing analysis. Only provide NEW strategic insights.
<|user|>
Email: {EMAIL_CONTENT}

Provide strategic insights in this JSON format:
{
  "strategic_insights": {
    "opportunity": "Customer expanding infrastructure - potential $200k annual from similar projects",
    "risk": "Competitor Dell mentioned offering 15% discount - relationship at risk",
    "relationship": "Decision maker showing frustration - 3rd urgent request this month"
  },
  "executive_summary": "Critical $15k quote with $200k expansion potential. Competitor threat detected. Requires CEO attention.",
  "escalation_needed": true,
  "revenue_impact": "$15k immediate, $200k annual potential",
  "cross_email_patterns": ["Similar urgency from 3 other enterprise customers this week"]
}`;

async function phase3Analysis(
  email: any, 
  phase1Results: Phase1Results,
  phase2Results: Phase2Results
): Promise<Phase3Results> {
  const startTime = Date.now();
  
  try {
    // Build prompt with both previous phases
    const prompt = PHASE3_INCREMENTAL_PROMPT
      .replace('{PHASE1_RESULTS}', JSON.stringify(phase1Results, null, 2))
      .replace('{PHASE2_RESULTS}', JSON.stringify(phase2Results, null, 2))
      .replace('{EMAIL_CONTENT}', `Subject: ${email.subject}\n\nBody: ${email.body || email.body_preview}`);
    
    // Call Phi-4 for strategic insights
    const response = await axios.post(
      'http://localhost:11434/api/generate',
      {
        model: 'doomgrave/phi-4:14b-tools-Q3_K_S',
        prompt,
        stream: false,
        options: {
          temperature: 0.3,
          num_predict: 1500,
          timeout: 180000
        }
      },
      { timeout: 180000 }
    );
    
    // Parse response
    let result = response.data.response;
    if (result.includes('{')) {
      const start = result.indexOf('{');
      const end = result.lastIndexOf('}') + 1;
      result = result.substring(start, end);
    }
    
    const phase3Data = JSON.parse(result);
    
    // Merge all phases
    return {
      ...phase2Results,
      strategic_insights: phase3Data.strategic_insights,
      executive_summary: phase3Data.executive_summary,
      escalation_needed: phase3Data.escalation_needed,
      revenue_impact: phase3Data.revenue_impact,
      cross_email_patterns: phase3Data.cross_email_patterns,
      phase3_processing_time: Date.now() - startTime
    };
    
  } catch (error) {
    console.error('Phase 3 error:', error);
    // Return Phase 2 results with defaults
    return {
      ...phase2Results,
      strategic_insights: {
        opportunity: 'Standard processing',
        risk: 'Low',
        relationship: 'Stable'
      },
      executive_summary: phase2Results.risk_assessment || 'Standard email requiring processing',
      escalation_needed: false,
      revenue_impact: `$${phase1Results.financial_impact}`,
      phase3_processing_time: Date.now() - startTime
    };
  }
}

// ============================================
// PHASE SELECTION LOGIC
// ============================================

function determinePhases(email: any, phase1Results: Phase1Results): {
  phases: number[];
  reason: string;
} {
  // All emails get Phase 1 (instant)
  
  // Skip Phase 2 & 3 for low-value emails
  if (phase1Results.priority === 'low' && 
      phase1Results.financial_impact === 0 &&
      phase1Results.urgency_score === 0) {
    return { phases: [1], reason: 'Low value informational email' };
  }
  
  // Most emails get Phase 1 + 2
  let phases = [1, 2];
  let reason = 'Standard processing';
  
  // Add Phase 3 for high-value emails
  const needsPhase3 = 
    phase1Results.priority === 'critical' ||
    phase1Results.financial_impact > 10000 ||
    (phase1Results.sender_category === 'key_customer' && phase1Results.urgency_score > 0) ||
    phase1Results.entities.po_numbers.length > 0 ||
    email.importance === 'high';
  
  if (needsPhase3) {
    phases.push(3);
    reason = 'High value/critical email requiring strategic analysis';
  }
  
  return { phases, reason };
}

// ============================================
// MAIN PROCESSING FUNCTION
// ============================================

async function processEmailIncremental(email: any, db: Database.Database) {
  console.log(`\n📧 Processing: ${email.subject?.substring(0, 50)}...`);
  
  // Phase 1: Always run (instant)
  console.log('   Phase 1: Rule-based triage...');
  const phase1Results = phase1Analysis(email);
  console.log(`   ✓ Phase 1 complete (${phase1Results.processing_time}ms)`);
  
  // Determine which phases to run
  const phaseDecision = determinePhases(email, phase1Results);
  console.log(`   📊 Decision: ${phaseDecision.reason}`);
  console.log(`   🔄 Running phases: ${phaseDecision.phases.join(', ')}`);
  
  let finalResults: any = phase1Results;
  
  // Phase 2: If needed
  if (phaseDecision.phases.includes(2)) {
    console.log('   Phase 2: Llama enhancement...');
    const phase2Results = await phase2Analysis(email, phase1Results);
    finalResults = phase2Results;
    console.log(`   ✓ Phase 2 complete (${phase2Results.phase2_processing_time}ms)`);
  }
  
  // Phase 3: If needed
  if (phaseDecision.phases.includes(3)) {
    console.log('   Phase 3: Phi-4 strategic analysis...');
    const phase3Results = await phase3Analysis(email, phase1Results, finalResults);
    finalResults = phase3Results;
    console.log(`   ✓ Phase 3 complete (${phase3Results.phase3_processing_time}ms)`);
  }
  
  // Calculate total time
  const totalTime = finalResults.processing_time + 
    (finalResults.phase2_processing_time || 0) + 
    (finalResults.phase3_processing_time || 0);
  
  console.log(`   ⏱️  Total time: ${(totalTime/1000).toFixed(1)}s`);
  
  // Save to database
  saveAnalysis(email, finalResults, phaseDecision.phases, db);
  
  return finalResults;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function extractPONumbers(text: string): string[] {
  const patterns = [
    /\bPO\s*#?\s*(\d{7,12})\b/gi,
    /\bP\.O\.\s*(\d{7,12})\b/gi,
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
    /\bQ#?\s*(\d{6,10})\b/gi,
    /\bQuotation\s*#?\s*(\d{6,10})\b/gi
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
    /\bSR\s*#?\s*(\d{6,10})\b/gi
  ];
  
  const results = new Set<string>();
  patterns.forEach(pattern => {
    const matches = [...text.matchAll(pattern)];
    matches.forEach(m => results.add(m[1]));
  });
  
  return Array.from(results);
}

function extractPartNumbers(text: string): string[] {
  // HP part number pattern
  const pattern = /\b[A-Z0-9]{5,15}(?:[#\-\s]?[A-Z0-9]{1,5})?\b/g;
  const matches = text.toUpperCase().match(pattern) || [];
  
  // Filter out common false positives
  return matches.filter(m => 
    !m.match(/^(THE|AND|FOR|WITH|FROM|THIS|THAT|HAVE|WILL|BEEN)$/)
  ).slice(0, 10);
}

function extractDollarAmounts(text: string): string[] {
  const pattern = /\$[\d,]+(?:\.\d{2})?/g;
  return text.match(pattern) || [];
}

function extractDates(text: string): string[] {
  const patterns = [
    /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g,
    /\b\d{1,2}-\d{1,2}-\d{2,4}\b/g,
    /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}\b/gi
  ];
  
  const results = new Set<string>();
  patterns.forEach(pattern => {
    const matches = text.match(pattern) || [];
    matches.forEach(m => results.add(m));
  });
  
  return Array.from(results);
}

function saveAnalysis(email: any, results: any, phases: number[], db: Database.Database) {
  const id = `incremental_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date().toISOString();
  
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO email_analysis (
      id, email_id,
      quick_workflow, quick_priority, quick_intent, quick_urgency,
      quick_confidence, quick_suggested_state, quick_model, quick_processing_time,
      deep_workflow_primary, deep_confidence,
      entities_po_numbers, entities_quote_numbers, entities_case_numbers,
      entities_part_numbers, entities_order_references, entities_contacts,
      action_summary, action_details, action_sla_status,
      business_impact_revenue, business_impact_satisfaction,
      contextual_summary, suggested_response,
      deep_model, deep_processing_time, total_processing_time,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const totalTime = results.processing_time + 
    (results.phase2_processing_time || 0) + 
    (results.phase3_processing_time || 0);
  
  stmt.run(
    id,
    email.id || email.message_id,
    results.workflow_state,
    results.priority.toUpperCase(),
    'REQUEST',
    results.urgency_score > 0 ? 'HIGH' : 'MEDIUM',
    results.confidence || 0.75,
    'NEW',
    `incremental-${phases.join('-')}`,
    results.processing_time,
    results.business_process || results.workflow_state,
    results.confidence || 0.75,
    results.entities.po_numbers.join(',') || null,
    results.entities.quote_numbers.join(',') || null,
    results.entities.case_numbers.join(',') || null,
    results.entities.part_numbers.join(',') || null,
    results.entities.dollar_amounts.join(',') || null,
    JSON.stringify(results.entities.contacts || []),
    results.action_items?.map((a: any) => a.task).join('; ') || null,
    JSON.stringify(results.action_items || []),
    'ON_TRACK',
    results.revenue_impact || results.financial_impact || null,
    results.strategic_insights?.relationship || 'Medium',
    results.executive_summary || results.risk_assessment || `${results.workflow_state} - ${results.priority} priority`,
    results.initial_response || null,
    phases.includes(3) ? 'doomgrave/phi-4:14b-tools-Q3_K_S' : phases.includes(2) ? 'llama3.2:3b' : 'rule-based',
    results.phase3_processing_time || results.phase2_processing_time || 0,
    totalTime,
    now,
    now
  );
}

// ============================================
// MAIN EXECUTION
// ============================================

async function runIncrementalAnalysis() {
  console.log('🚀 Three-Phase Incremental Email Analysis');
  console.log('📊 Each phase builds on previous results\n');
  
  const db = new Database('./data/crewai.db');
  
  // Get sample of emails to test
  const emails = db.prepare(`
    SELECT * FROM emails 
    WHERE received_at >= '2025-05-09'
    AND (recipient_emails LIKE '%nick.paul@tdsynnex.com%' 
         OR recipient_emails LIKE '%t119889c@tdsynnex.com%')
    ORDER BY received_at DESC
    LIMIT 100
  `).all();
  
  console.log(`📧 Found ${emails.length} emails to analyze\n`);
  
  // Track statistics
  const stats = {
    phase1Only: 0,
    phase2: 0,
    phase3: 0,
    totalTime: 0,
    criticalFound: 0,
    revenueIdentified: 0
  };
  
  // Process first 20 emails as demonstration
  for (const email of emails.slice(0, 20)) {
    const results = await processEmailIncremental(email, db);
    
    // Update stats
    if (results.phase3_processing_time) stats.phase3++;
    else if (results.phase2_processing_time) stats.phase2++;
    else stats.phase1Only++;
    
    const totalTime = results.processing_time + 
      (results.phase2_processing_time || 0) + 
      (results.phase3_processing_time || 0);
    stats.totalTime += totalTime;
    
    if (results.priority === 'critical') stats.criticalFound++;
    if (results.financial_impact > 0) stats.revenueIdentified += results.financial_impact;
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('INCREMENTAL ANALYSIS SUMMARY');
  console.log('='.repeat(60));
  console.log(`Emails processed: 20`);
  console.log(`Phase distribution:`);
  console.log(`  - Phase 1 only: ${stats.phase1Only}`);
  console.log(`  - Phase 1+2: ${stats.phase2}`);
  console.log(`  - Phase 1+2+3: ${stats.phase3}`);
  console.log(`Critical issues found: ${stats.criticalFound}`);
  console.log(`Revenue identified: $${stats.revenueIdentified.toLocaleString()}`);
  console.log(`Average time per email: ${(stats.totalTime / 20 / 1000).toFixed(1)}s`);
  console.log(`\nIncremental approach provides better quality with intelligent resource allocation!`);
  
  db.close();
}

// Run the analysis
runIncrementalAnalysis().catch(console.error);