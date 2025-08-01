#!/usr/bin/env tsx
/**
 * Simple comparison test: Three-phase vs Single-phase email analysis
 * Using the existing test implementation from test-20-emails-workflow.ts
 */

import Database from 'better-sqlite3';
import axios from 'axios';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';

const db = new Database('./data/crewai.db');
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';

// TD SYNNEX Workflow Categories
const WORKFLOW_CATEGORIES = [
  'Order Management',
  'Quote Processing', 
  'Shipping and Logistics',
  'Vendor Pricing Updates',
  'Returns and RMA',
  'Account Changes',
  'Deal Activations',
  'General Support'
];

// Call Ollama LLM
async function callOllama(prompt: string, model: string = 'llama3.2:3b'): Promise<string> {
  try {
    const response = await axios.post(`${OLLAMA_HOST}/api/generate`, {
      model,
      prompt,
      stream: false,
      temperature: 0.7,
      max_tokens: 2000
    });
    return response.data.response;
  } catch (error) {
    console.error(chalk.red('Ollama API error:'), error);
    return '';
  }
}

// Extract entities using regex patterns
function extractEntities(text: string): any {
  const patterns = {
    po_numbers: /\b(?:PO|P\.O\.|Purchase Order)[\s#:-]*(\d{6,12})\b/gi,
    quote_numbers: /\b(?:quote|Quote|Q-)[\s#:-]*(\d{6,10})\b/gi,
    order_numbers: /\b(?:order|Order|ORD)[\s#:-]*([A-Z0-9]{6,12})\b/gi,
    tracking_numbers: /\b(?:1Z|FEDEX|UPS)[\w\d]{10,35}\b/gi,
    customer_names: /(?:customer|Customer|CLIENT|Client)[\s:-]+([A-Z][A-Za-z\s&.,'-]+(?:Inc|LLC|Corp|Corporation|Ltd)?)/gi,
    dollar_values: /\$[\d,]+\.?\d{0,2}|\b\d+(?:,\d{3})*(?:\.\d{2})?\s*(?:USD|dollars?)\b/gi,
    dates: /\b(?:\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{4}[-/]\d{1,2}[-/]\d{1,2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{2,4})\b/gi
  };

  const entities: any = {};
  
  for (const [key, pattern] of Object.entries(patterns)) {
    const matches = text.match(pattern) || [];
    entities[key] = [...new Set(matches)];
  }
  
  return entities;
}

// Single-phase analysis (all in one comprehensive prompt)
async function singlePhaseAnalysis(email: any): Promise<any> {
  const startTime = Date.now();
  
  const prompt = `Analyze this TD SYNNEX email comprehensively in ONE pass. Extract ALL information:

Email Details:
- Subject: ${email.subject}
- From: ${email.from_email}
- Date: ${email.received_date}
- Body: ${email.body}

Required Analysis:
1. Extract ALL entities:
   - PO Numbers (format: PO#123456)
   - Quote Numbers 
   - Order Numbers
   - Customer Names
   - Dollar Values
   - Dates
   - Tracking Numbers

2. Determine workflow category from:
   ${WORKFLOW_CATEGORIES.join(', ')}

3. Assess priority and urgency:
   - Priority: CRITICAL, HIGH, MEDIUM, or LOW
   - SLA requirements
   - Risk factors

4. Identify required actions:
   - Next steps needed
   - Responsible parties
   - Deadlines

5. Business impact:
   - Revenue implications
   - Customer satisfaction risks
   - Operational impacts

Provide a comprehensive JSON response with all findings.`;

  const response = await callOllama(prompt);
  
  // Parse response and extract structured data
  let analysis = {
    approach: 'single-phase',
    entities: extractEntities(email.body + ' ' + email.subject),
    workflow_category: null,
    priority: 'MEDIUM',
    confidence: 0,
    actions: [],
    llm_calls: 1,
    processing_time: Date.now() - startTime,
    raw_response: response
  };

  // Try to parse JSON from response
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      analysis = { ...analysis, ...parsed };
    }
  } catch (e) {
    // Use regex extraction as fallback
    const categoryMatch = response.match(new RegExp(`(${WORKFLOW_CATEGORIES.join('|')})`, 'i'));
    if (categoryMatch) analysis.workflow_category = categoryMatch[1];
    
    const priorityMatch = response.match(/priority[:\s]*(CRITICAL|HIGH|MEDIUM|LOW)/i);
    if (priorityMatch) analysis.priority = priorityMatch[1].toUpperCase();
  }

  return analysis;
}

// Three-phase incremental analysis
async function threePhaseAnalysis(email: any): Promise<any> {
  const overallStart = Date.now();
  let totalLLMCalls = 0;

  // PHASE 1: Rule-based extraction + Basic categorization
  console.log(chalk.yellow('  Phase 1: Rule-based extraction...'));
  const phase1Start = Date.now();
  
  const phase1Results = {
    entities: extractEntities(email.body + ' ' + email.subject),
    keywords: [],
    patterns: {}
  };

  // Quick rule-based category detection
  const subjectLower = email.subject.toLowerCase();
  const bodyLower = email.body.toLowerCase();
  
  if (subjectLower.includes('order') || bodyLower.includes('purchase order')) {
    phase1Results.patterns.likely_category = 'Order Management';
  } else if (subjectLower.includes('quote') || bodyLower.includes('pricing')) {
    phase1Results.patterns.likely_category = 'Quote Processing';
  } else if (subjectLower.includes('ship') || bodyLower.includes('tracking')) {
    phase1Results.patterns.likely_category = 'Shipping and Logistics';
  }

  const phase1Time = Date.now() - phase1Start;
  console.log(chalk.gray(`    Completed in ${phase1Time}ms`));

  // PHASE 2: Enhanced understanding with Llama
  console.log(chalk.cyan('  Phase 2: AI enhancement...'));
  const phase2Start = Date.now();
  
  const phase2Prompt = `You are a TD SYNNEX workflow analyst. Enhance this initial analysis:

Phase 1 Found:
- Entities: ${JSON.stringify(phase1Results.entities, null, 2)}
- Likely Category: ${phase1Results.patterns.likely_category || 'Unknown'}

Original Email:
Subject: ${email.subject}
Body: ${email.body.substring(0, 500)}...

Tasks:
1. Verify and expand entity extraction
2. Confirm or correct workflow category (${WORKFLOW_CATEGORIES.join(', ')})
3. Identify business context and urgency
4. Note any missing critical information

Provide enhanced analysis in JSON format.`;

  const phase2Response = await callOllama(phase2Prompt);
  totalLLMCalls++;
  
  let phase2Results = { ...phase1Results };
  try {
    const jsonMatch = phase2Response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      phase2Results = { ...phase2Results, ...parsed };
    }
  } catch (e) {
    console.error(chalk.red('Phase 2 JSON parse error'));
  }

  const phase2Time = Date.now() - phase2Start;
  console.log(chalk.gray(`    Completed in ${phase2Time}ms`));

  // PHASE 3: Action intelligence
  console.log(chalk.magenta('  Phase 3: Action intelligence...'));
  const phase3Start = Date.now();
  
  const phase3Prompt = `Based on the enhanced analysis, determine specific actions:

Analysis so far:
${JSON.stringify(phase2Results, null, 2)}

Determine:
1. Priority level (CRITICAL/HIGH/MEDIUM/LOW)
2. Specific action items with owners
3. SLA requirements (hours until deadline)
4. Risk assessment
5. Workflow state (START_POINT/IN_PROGRESS/COMPLETION)

Context: This is for TD SYNNEX IEMS system.
Provide actionable intelligence in JSON format.`;

  const phase3Response = await callOllama(phase3Prompt);
  totalLLMCalls++;

  let finalResults = {
    approach: 'three-phase',
    phase1_results: phase1Results,
    phase2_results: phase2Results,
    entities: phase2Results.entities || phase1Results.entities,
    workflow_category: phase2Results.workflow_category || phase2Results.category,
    priority: 'MEDIUM',
    confidence: 0,
    actions: [],
    workflow_state: 'START_POINT',
    llm_calls: totalLLMCalls,
    processing_time: Date.now() - overallStart,
    phase_times: {
      phase1: phase1Time,
      phase2: phase2Time,
      phase3: 0
    }
  };

  try {
    const jsonMatch = phase3Response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      finalResults = { ...finalResults, ...parsed };
    }
  } catch (e) {
    console.error(chalk.red('Phase 3 JSON parse error'));
  }

  finalResults.phase_times.phase3 = Date.now() - phase3Start;
  console.log(chalk.gray(`    Completed in ${finalResults.phase_times.phase3}ms`));

  return finalResults;
}

// Phase 3 only analysis
async function phase3OnlyAnalysis(email: any): Promise<any> {
  const startTime = Date.now();
  
  const prompt = `Analyze this TD SYNNEX email for workflow intelligence and actions:

Email: ${email.subject}
From: ${email.from_email}
Body: ${email.body}

Focus on:
1. Workflow category (${WORKFLOW_CATEGORIES.join(', ')})
2. Priority and urgency
3. Required actions
4. Any critical entities mentioned

Provide actionable intelligence in JSON format.`;

  const response = await callOllama(prompt);
  
  let analysis = {
    approach: 'phase3-only',
    entities: extractEntities(email.body + ' ' + email.subject), // Basic extraction
    workflow_category: null,
    priority: 'MEDIUM',
    actions: [],
    llm_calls: 1,
    processing_time: Date.now() - startTime
  };

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      analysis = { ...analysis, ...parsed };
    }
  } catch (e) {
    // Fallback parsing
    const categoryMatch = response.match(new RegExp(`(${WORKFLOW_CATEGORIES.join('|')})`, 'i'));
    if (categoryMatch) analysis.workflow_category = categoryMatch[1];
  }

  return analysis;
}

// Compare results
function compareResults(results: any[]): void {
  console.log(chalk.blue('\n=== COMPARISON RESULTS ===\n'));

  // Group by email
  const byEmail = results.reduce((acc, r) => {
    if (!acc[r.emailId]) acc[r.emailId] = {};
    acc[r.emailId][r.approach] = r;
    return acc;
  }, {});

  let totalComparisons = 0;
  let betterThreePhase = 0;
  let betterSinglePhase = 0;
  let betterPhase3Only = 0;

  // Detailed comparison for each email
  Object.entries(byEmail).forEach(([emailId, approaches]: [string, any]) => {
    totalComparisons++;
    
    const single = approaches['single-phase'];
    const three = approaches['three-phase'];
    const phase3 = approaches['phase3-only'];

    // Count entities found
    const singleEntities = Object.values(single.entities || {}).flat().length;
    const threeEntities = Object.values(three.entities || {}).flat().length;
    const phase3Entities = Object.values(phase3.entities || {}).flat().length;

    // Determine winner based on entity extraction
    if (threeEntities > singleEntities && threeEntities > phase3Entities) {
      betterThreePhase++;
    } else if (singleEntities > threeEntities && singleEntities > phase3Entities) {
      betterSinglePhase++;
    } else if (phase3Entities > singleEntities && phase3Entities > threeEntities) {
      betterPhase3Only++;
    }
  });

  // Summary statistics
  console.log(chalk.yellow('Entity Extraction Performance:'));
  console.log(`  Three-phase won: ${betterThreePhase}/${totalComparisons} (${(betterThreePhase/totalComparisons*100).toFixed(1)}%)`);
  console.log(`  Single-phase won: ${betterSinglePhase}/${totalComparisons} (${(betterSinglePhase/totalComparisons*100).toFixed(1)}%)`);
  console.log(`  Phase-3-only won: ${betterPhase3Only}/${totalComparisons} (${(betterPhase3Only/totalComparisons*100).toFixed(1)}%)`);

  // Processing time comparison
  const avgTimes = {
    'single-phase': 0,
    'three-phase': 0,
    'phase3-only': 0
  };

  results.forEach(r => {
    avgTimes[r.approach] += r.processing_time;
  });

  const emailCount = totalComparisons;
  console.log(chalk.yellow('\nAverage Processing Times:'));
  console.log(`  Single-phase: ${Math.round(avgTimes['single-phase'] / emailCount)}ms`);
  console.log(`  Three-phase: ${Math.round(avgTimes['three-phase'] / emailCount)}ms`);
  console.log(`  Phase-3-only: ${Math.round(avgTimes['phase3-only'] / emailCount)}ms`);

  // Category accuracy
  const categoryAccuracy = {
    'single-phase': 0,
    'three-phase': 0,
    'phase3-only': 0
  };

  results.forEach(r => {
    if (r.workflow_category && WORKFLOW_CATEGORIES.includes(r.workflow_category)) {
      categoryAccuracy[r.approach]++;
    }
  });

  console.log(chalk.yellow('\nWorkflow Category Detection:'));
  console.log(`  Single-phase: ${categoryAccuracy['single-phase']}/${emailCount} (${(categoryAccuracy['single-phase']/emailCount*100).toFixed(1)}%)`);
  console.log(`  Three-phase: ${categoryAccuracy['three-phase']}/${emailCount} (${(categoryAccuracy['three-phase']/emailCount*100).toFixed(1)}%)`);
  console.log(`  Phase-3-only: ${categoryAccuracy['phase3-only']}/${emailCount} (${(categoryAccuracy['phase3-only']/emailCount*100).toFixed(1)}%)`);

  // LLM usage
  console.log(chalk.yellow('\nLLM Call Efficiency:'));
  console.log(`  Single-phase: 1 call per email`);
  console.log(`  Three-phase: ${results.filter(r => r.approach === 'three-phase')[0]?.llm_calls || 2} calls per email`);
  console.log(`  Phase-3-only: 1 call per email`);
}

// Main test function
async function runComparisonTest(): Promise<void> {
  console.log(chalk.blue('=== Three-Phase vs Single-Phase Analysis Comparison ===\n'));

  // Get test emails
  const emails = db.prepare(`
    SELECT id, subject, sender_email as from_email, received_at as received_date, body 
    FROM emails 
    WHERE body IS NOT NULL 
      AND length(body) > 100
    ORDER BY received_at DESC 
    LIMIT 5
  `).all();

  console.log(chalk.green(`Found ${emails.length} emails for testing\n`));

  const results: any[] = [];

  // Process each email with all three approaches
  for (const [index, email] of emails.entries()) {
    console.log(chalk.cyan(`\nEmail ${index + 1}/${emails.length}: ${email.subject?.substring(0, 50)}...`));

    try {
      // Single-phase analysis
      console.log(chalk.yellow('Running single-phase analysis...'));
      const singleResult = await singlePhaseAnalysis(email);
      results.push({ ...singleResult, emailId: email.id });

      // Three-phase analysis
      console.log(chalk.cyan('Running three-phase analysis...'));
      const threeResult = await threePhaseAnalysis(email);
      results.push({ ...threeResult, emailId: email.id });

      // Phase-3-only analysis
      console.log(chalk.magenta('Running phase-3-only analysis...'));
      const phase3Result = await phase3OnlyAnalysis(email);
      results.push({ ...phase3Result, emailId: email.id });

    } catch (error) {
      console.error(chalk.red(`Error processing email ${email.id}:`), error);
    }
  }

  // Compare and display results
  compareResults(results);

  // Save detailed results
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const resultsPath = path.join(__dirname, `../test_results/phase_comparison_${timestamp}.json`);
  
  // Create directory if it doesn't exist
  const resultsDir = path.dirname(resultsPath);
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  fs.writeFileSync(resultsPath, JSON.stringify({
    test_date: new Date().toISOString(),
    email_count: emails.length,
    results: results,
    summary: {
      total_tests: results.length,
      approaches_tested: ['single-phase', 'three-phase', 'phase3-only']
    }
  }, null, 2));

  console.log(chalk.green(`\nResults saved to: ${resultsPath}`));

  // Close database
  db.close();
}

// Run the test
runComparisonTest().catch(console.error);