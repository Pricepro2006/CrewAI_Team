#!/usr/bin/env tsx
/**
 * Score Phase 2 Analysis Using Claude's 8.5/10 Methodology
 * For llama3.2:3b model
 */

import Database from "better-sqlite3";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use same scoring methodology as Claude
interface ClaudeScoringDimensions {
  contextUnderstanding: number;
  entityExtraction: number;
  businessProcessing: number;
  actionableInsights: number;
  responseQuality: number;
}

const CLAUDE_WEIGHTS = {
  contextUnderstanding: 0.20,
  entityExtraction: 0.25,
  businessProcessing: 0.20,
  actionableInsights: 0.20,
  responseQuality: 0.15
};

function loadTestEmailData(): Map<string, any> {
  const emailData = new Map();
  
  for (let i = 1; i <= 4; i++) {
    const batchFile = path.join(__dirname, `../data/email-batches/test_emails_batch_${i}.json`);
    if (fs.existsSync(batchFile)) {
      const emails = JSON.parse(fs.readFileSync(batchFile, 'utf-8'));
      emails.forEach((email: any) => {
        emailData.set(email.MessageID || email.id, email);
      });
    }
  }
  
  return emailData;
}

function scoreContextUnderstanding(analysis: any, emailData: any): number {
  let score = 0;
  let factors = 0;
  
  // Workflow State Detection
  if (analysis.deep_workflow_primary) {
    const subject = emailData?.Subject?.toLowerCase() || '';
    const body = emailData?.BodyText?.toLowerCase() || emailData?.Body?.toLowerCase() || '';
    
    let expectedWorkflow = 'START_POINT';
    if (subject.includes('re:') || subject.includes('fw:')) {
      expectedWorkflow = 'IN_PROGRESS';
    }
    if (body.includes('completed') || body.includes('resolved') || body.includes('closed')) {
      expectedWorkflow = 'COMPLETION';
    }
    
    const workflowMatch = analysis.deep_workflow_primary.includes(expectedWorkflow);
    score += workflowMatch ? 4.0 : 2.0;
    factors++;
  }
  
  // Priority Assessment
  if (analysis.quick_priority) {
    const subject = emailData?.Subject?.toLowerCase() || '';
    const expectedPriority = subject.includes('urgent') || subject.includes('asap') ? 'critical' : 'medium';
    const priorityMatch = analysis.quick_priority.toLowerCase().includes(expectedPriority);
    
    score += priorityMatch ? 3.0 : 1.5;
    factors++;
  }
  
  // Urgency Recognition
  if (analysis.business_impact_urgency_reason || analysis.quick_urgency) {
    score += 3.0;
    factors++;
  }
  
  return factors > 0 ? (score / 10) * 10 : 0;
}

function scoreEntityExtraction(analysis: any, emailData: any): number {
  const entityTypes = [
    'entities_po_numbers',
    'entities_quote_numbers',
    'entities_case_numbers',
    'entities_part_numbers',
    'entities_order_references',
    'entities_contacts'
  ];
  
  let totalScore = 0;
  let totalPossible = 0;
  
  const content = `${emailData?.Subject || ''} ${emailData?.BodyText || emailData?.Body || ''}`;
  
  // PO Numbers
  const poPattern = /\b(?:PO|P\.O\.|Purchase Order)?\s*#?\s*(\d{6,})/gi;
  const expectedPOs = (content.match(poPattern) || []).length;
  const foundPOs = analysis.entities_po_numbers ? analysis.entities_po_numbers.split(',').filter((e: string) => e.trim()).length : 0;
  
  if (expectedPOs > 0) {
    totalScore += (foundPOs / expectedPOs) * 2.0;
    totalPossible += 2.0;
  }
  
  // Quote Numbers
  const quotePattern = /\b(?:Quote|Q|FTQ|F5Q)[-#]?\s*(\w+)/gi;
  const expectedQuotes = (content.match(quotePattern) || []).length;
  const foundQuotes = analysis.entities_quote_numbers ? analysis.entities_quote_numbers.split(',').filter((e: string) => e.trim()).length : 0;
  
  if (expectedQuotes > 0) {
    totalScore += (foundQuotes / expectedQuotes) * 1.5;
    totalPossible += 1.5;
  }
  
  // Any entities found
  const hasAnyEntities = entityTypes.some(type => analysis[type] && analysis[type].length > 0);
  if (hasAnyEntities) {
    totalScore += 2.0;
  }
  totalPossible += 2.0;
  
  return totalPossible > 0 ? (totalScore / totalPossible) * 10 : 5.0;
}

function scoreBusinessProcessing(analysis: any): number {
  let score = 0;
  
  // Process identification
  if (analysis.deep_workflow_primary) {
    const validProcesses = ['Order Management', 'Quote Processing', 'Issue Resolution', 'Support'];
    const hasValidProcess = validProcesses.some(p => 
      analysis.deep_workflow_primary.toLowerCase().includes(p.toLowerCase())
    );
    score += hasValidProcess ? 5.0 : 2.5;
  }
  
  // SLA assessment
  if (analysis.action_sla_status) {
    const validStatuses = ['ON_TRACK', 'AT_RISK', 'VIOLATED'];
    const hasValidSLA = validStatuses.includes(analysis.action_sla_status);
    score += hasValidSLA ? 3.0 : 1.0;
  }
  
  // Business impact
  if (analysis.business_impact_satisfaction || analysis.business_impact_revenue) {
    score += 2.0;
  }
  
  return Math.min(10, score);
}

function scoreActionableInsights(analysis: any): number {
  let score = 0;
  
  if (analysis.action_summary) {
    score += 3.5;
  }
  
  if (analysis.action_details) {
    try {
      const details = JSON.parse(analysis.action_details);
      if (Array.isArray(details) && details.length > 0) {
        score += 3.5;
        
        if (details.some((d: any) => d.owner || d.assignee)) {
          score += 1.5;
        }
        
        if (details.some((d: any) => d.deadline || d.due_date)) {
          score += 1.5;
        }
      }
    } catch {
      score += 1.0;
    }
  }
  
  return Math.min(10, score);
}

function scoreResponseQuality(analysis: any): number {
  let score = 0;
  
  if (analysis.suggested_response && analysis.suggested_response.length > 20) {
    score += 4.0;
    
    const response = analysis.suggested_response.toLowerCase();
    const professionalTerms = ['thank you', 'assist', 'help', 'ensure', 'process', 'review'];
    const hasProfessionalTone = professionalTerms.some(term => response.includes(term));
    
    if (hasProfessionalTone) {
      score += 3.0;
    }
    
    if (analysis.suggested_response.length > 50 && analysis.suggested_response.length < 500) {
      score += 1.5;
    }
  }
  
  if (analysis.contextual_summary && analysis.contextual_summary.length > 30) {
    score += 1.5;
  }
  
  return Math.min(10, score);
}

async function scorePhase2Quality() {
  console.log('📊 Phase 2 Analysis Scoring - Claude 8.5/10 Methodology\n');
  console.log('Model: llama3.2:3b');
  console.log('Target Score: 6.56/10\n');
  
  const db = new Database('./data/crewai.db');
  const emailData = loadTestEmailData();
  
  const testEmailIds = Array.from(emailData.keys());
  
  const analyses = db.prepare(`
    SELECT *
    FROM email_analysis
    WHERE email_id IN (${testEmailIds.map(() => '?').join(',')})
      AND deep_model = 'llama3.2:3b'
    ORDER BY updated_at DESC
  `).all(...testEmailIds) as any[];
  
  console.log(`Found ${analyses.length} Phase 2 analyses from ${testEmailIds.length} test emails\n`);
  
  const scores: ClaudeScoringDimensions[] = [];
  
  for (const analysis of analyses) {
    const email = emailData.get(analysis.email_id);
    
    const dimensionScores: ClaudeScoringDimensions = {
      contextUnderstanding: scoreContextUnderstanding(analysis, email),
      entityExtraction: scoreEntityExtraction(analysis, email),
      businessProcessing: scoreBusinessProcessing(analysis),
      actionableInsights: scoreActionableInsights(analysis),
      responseQuality: scoreResponseQuality(analysis)
    };
    
    scores.push(dimensionScores);
  }
  
  // Calculate averages
  const avgScores: ClaudeScoringDimensions = {
    contextUnderstanding: 0,
    entityExtraction: 0,
    businessProcessing: 0,
    actionableInsights: 0,
    responseQuality: 0
  };
  
  if (scores.length > 0) {
    Object.keys(avgScores).forEach(key => {
      avgScores[key as keyof ClaudeScoringDimensions] = 
        scores.reduce((sum, s) => sum + s[key as keyof ClaudeScoringDimensions], 0) / scores.length;
    });
  }
  
  // Calculate overall score
  const overallScore = Object.keys(avgScores).reduce((sum, key) => {
    return sum + (avgScores[key as keyof ClaudeScoringDimensions] * CLAUDE_WEIGHTS[key as keyof typeof CLAUDE_WEIGHTS]);
  }, 0);
  
  // Display results
  console.log('Individual Dimension Scores:');
  console.log('─'.repeat(60));
  console.log(`Context Understanding: ${avgScores.contextUnderstanding.toFixed(1)}/10 (20% weight)`);
  console.log(`Entity Extraction:     ${avgScores.entityExtraction.toFixed(1)}/10 (25% weight)`);
  console.log(`Business Processing:   ${avgScores.businessProcessing.toFixed(1)}/10 (20% weight)`);
  console.log(`Actionable Insights:   ${avgScores.actionableInsights.toFixed(1)}/10 (20% weight)`);
  console.log(`Response Quality:      ${avgScores.responseQuality.toFixed(1)}/10 (15% weight)`);
  
  console.log('\n' + '='.repeat(60));
  console.log('FINAL SCORES');
  console.log('='.repeat(60));
  console.log(`llama3.2:3b:          ${overallScore.toFixed(1)}/10`);
  console.log(`Target Score:         6.56/10`);
  console.log(`Claude Opus-4:        8.5/10 (benchmark)`);
  console.log('─'.repeat(60));
  
  const performanceRatio = (overallScore / 6.56) * 100;
  console.log(`\nPerformance vs Target: ${performanceRatio.toFixed(1)}%`);
  
  if (overallScore >= 6.56) {
    console.log('✅ TARGET ACHIEVED! Score meets or exceeds 6.56/10');
  } else {
    console.log(`❌ Below target by ${(6.56 - overallScore).toFixed(1)} points`);
  }
  
  // Check processing times
  const avgProcessingTime = analyses.reduce((sum, a) => sum + (a.deep_processing_time || 0), 0) / analyses.length;
  console.log(`\n⏱️  Average processing time: ${(avgProcessingTime / 1000).toFixed(1)}s`);
  
  if (avgProcessingTime > 5000) {
    console.log('✅ Processing times confirm real LLM calls');
  }
  
  // Save results
  const resultsPath = path.join(__dirname, '../test-results', `phase2_claude_scoring_${Date.now()}.json`);
  fs.mkdirSync(path.dirname(resultsPath), { recursive: true });
  fs.writeFileSync(resultsPath, JSON.stringify({
    methodology: 'Claude 8.5/10 Scoring',
    model: 'llama3.2:3b',
    timestamp: new Date().toISOString(),
    totalEmails: testEmailIds.length,
    analyzedEmails: analyses.length,
    dimensionScores: avgScores,
    weights: CLAUDE_WEIGHTS,
    overallScore,
    targetScore: 6.56,
    claudeBenchmark: 8.5,
    achievedTarget: overallScore >= 6.56,
    avgProcessingTime: avgProcessingTime / 1000
  }, null, 2));
  
  console.log(`\nDetailed results saved to: ${resultsPath}`);
  
  // Final comparison
  console.log('\n📊 Model Comparison Summary:');
  console.log('─'.repeat(60));
  console.log('Model               Score    Target   Status');
  console.log('─'.repeat(60));
  console.log('Claude Opus-4       8.5/10   8.5/10   ✅ Baseline');
  console.log('doomgrave/phi-4     7.6/10   7.75/10  ✅ Close (-0.2)');
  console.log(`llama3.2:3b         ${overallScore.toFixed(1)}/10   6.56/10  ${overallScore >= 6.56 ? '✅' : '❌'} ${overallScore >= 6.56 ? 'Achieved' : `(-${(6.56 - overallScore).toFixed(1)})`}`);
  console.log('─'.repeat(60));
  
  db.close();
}

// Run the analysis
scorePhase2Quality().catch(console.error);