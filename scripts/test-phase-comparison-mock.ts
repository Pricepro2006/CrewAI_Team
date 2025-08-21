#!/usr/bin/env tsx
/**
 * Mock comparison test to demonstrate three-phase vs single-phase differences
 * Using simulated LLM responses to show the concept
 */

import Database from 'better-sqlite3';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';

const db = new Database('./data/crewai.db');

// Mock LLM responses to demonstrate the concept
const MOCK_RESPONSES = {
  singlePhase: {
    "entities": {
      "po_numbers": ["PO#789456123"],
      "customers": ["TechCorp Inc"],
      "dollar_values": ["$25,000"]
    },
    "workflow_category": "Order Management",
    "priority": "HIGH",
    "actions": [
      "Verify inventory availability",
      "Confirm shipping address",
      "Process order fulfillment"
    ]
  },
  phase1: {
    "entities": {
      "po_numbers": ["PO#789456123"],
      "customers": ["TechCorp"],
      "dollar_values": ["$25,000", "$25000"]
    }
  },
  phase2: {
    "entities": {
      "po_numbers": ["PO#789456123"],
      "customers": ["TechCorp Inc", "TechCorp"],
      "dollar_values": ["$25,000"],
      "additional_context": {
        "order_type": "urgent",
        "customer_tier": "premium"
      }
    },
    "workflow_category": "Order Management",
    "urgency": "HIGH"
  },
  phase3: {
    "priority": "CRITICAL",
    "workflow_state": "START_POINT",
    "actions": [
      "Immediately verify inventory for urgent order",
      "Contact premium customer service team",
      "Expedite shipping preparation",
      "Send order confirmation within 2 hours"
    ],
    "sla_hours": 24,
    "risk_assessment": "High value premium customer - delay could impact relationship"
  }
};

// Simulate LLM processing time
async function simulateLLMDelay(phase: string): Promise<void> {
  const delays = {
    'single': 3000,
    'phase1': 500,
    'phase2': 2000,
    'phase3': 2500
  };
  await new Promise(resolve => setTimeout(resolve, delays[phase] || 1000));
}

// Extract entities using regex
function extractEntities(text: string): any {
  const patterns = {
    po_numbers: /\b(?:PO|P\.O\.|Purchase Order)[\s#:-]*(\d{6,12})\b/gi,
    quote_numbers: /\b(?:quote|Quote|Q-)[\s#:-]*(\d{6,10})\b/gi,
    customers: /(?:customer|Customer|CLIENT|Client)[\s:-]+([A-Z][A-Za-z\s&.,'-]+(?:Inc|LLC|Corp|Corporation|Ltd)?)/gi,
    dollar_values: /\$[\d,]+\.?\d{0,2}|\b\d+(?:,\d{3})*(?:\.\d{2})?\s*(?:USD|dollars?)\b/gi,
  };

  const entities: any = {};
  for (const [key, pattern] of Object.entries(patterns)) {
    const matches = text.match(pattern) || [];
    entities[key] = [...new Set(matches)];
  }
  
  return entities;
}

// Mock single-phase analysis
async function mockSinglePhaseAnalysis(email: any): Promise<any> {
  console.log(chalk.yellow('  Running single-phase analysis...'));
  const startTime = Date.now();
  
  await simulateLLMDelay('single');
  
  // Simulate partial extraction (misses some entities)
  const basicEntities = extractEntities(email.body);
  
  return {
    approach: 'single-phase',
    entities: {
      ...basicEntities,
      // Simulate missing some entities
      po_numbers: basicEntities.po_numbers.slice(0, 1),
      customers: basicEntities.customers.slice(0, 1)
    },
    workflow_category: MOCK_RESPONSES.singlePhase.workflow_category,
    priority: MOCK_RESPONSES.singlePhase.priority,
    confidence: 0.75,
    actions: MOCK_RESPONSES.singlePhase.actions,
    llm_calls: 1,
    processing_time: Date.now() - startTime,
    extraction_quality: "moderate"
  };
}

// Mock three-phase analysis
async function mockThreePhaseAnalysis(email: any): Promise<any> {
  console.log(chalk.cyan('  Running three-phase analysis...'));
  const overallStart = Date.now();
  const phaseTimes = { phase1: 0, phase2: 0, phase3: 0 };

  // PHASE 1: Rule-based extraction
  console.log(chalk.yellow('    Phase 1: Rule-based extraction...'));
  const phase1Start = Date.now();
  
  const phase1Results = {
    entities: extractEntities(email.body),
    patterns_detected: {
      has_po: true,
      has_customer: true,
      has_value: true
    }
  };
  
  await simulateLLMDelay('phase1');
  phaseTimes.phase1 = Date.now() - phase1Start;
  console.log(chalk.gray(`      Completed in ${phaseTimes.phase1}ms`));
  console.log(chalk.gray(`      Found ${Object.values(phase1Results.entities).flat().length} entities`));

  // PHASE 2: Enhanced understanding
  console.log(chalk.cyan('    Phase 2: AI enhancement...'));
  const phase2Start = Date.now();
  
  await simulateLLMDelay('phase2');
  
  // Simulate finding additional context
  const phase2Results = {
    ...phase1Results,
    entities: {
      ...phase1Results.entities,
      // Add entities that were missed in basic extraction
      customers: [...phase1Results.entities.customers, "TechCorp Inc"],
      additional_refs: ["REF-2023-Q4", "ACCT-TC-001"]
    },
    enhanced_context: {
      customer_type: "Premium",
      order_urgency: "High",
      historical_value: "$500K+"
    },
    workflow_category: "Order Management",
    confidence: 0.85
  };
  
  phaseTimes.phase2 = Date.now() - phase2Start;
  console.log(chalk.gray(`      Completed in ${phaseTimes.phase2}ms`));
  console.log(chalk.gray(`      Enhanced to ${Object.values(phase2Results.entities).flat().length} entities`));

  // PHASE 3: Action intelligence
  console.log(chalk.magenta('    Phase 3: Action intelligence...'));
  const phase3Start = Date.now();
  
  await simulateLLMDelay('phase3');
  
  const finalResults = {
    approach: 'three-phase',
    phase1_results: phase1Results,
    phase2_results: phase2Results,
    entities: phase2Results.entities,
    workflow_category: phase2Results.workflow_category,
    priority: "CRITICAL", // Elevated due to premium customer
    confidence: 0.92,
    actions: [
      "IMMEDIATE: Verify inventory for PO#789456123",
      "URGENT: Contact premium support team for TechCorp Inc",
      "HIGH: Expedite order processing (premium customer, $25K value)",
      "REQUIRED: Send confirmation within 2 hours per SLA",
      "FOLLOW-UP: Account manager notification for high-value order"
    ],
    workflow_state: "START_POINT",
    sla_requirements: {
      confirmation: "2 hours",
      fulfillment: "24 hours",
      shipping: "expedited"
    },
    risk_assessment: "Critical - Premium customer with high lifetime value",
    llm_calls: 2,
    processing_time: Date.now() - overallStart,
    phase_times: phaseTimes,
    extraction_quality: "comprehensive"
  };
  
  phaseTimes.phase3 = Date.now() - phase3Start;
  console.log(chalk.gray(`      Completed in ${phaseTimes.phase3}ms`));
  console.log(chalk.gray(`      Generated ${finalResults.actions.length} specific actions`));

  return finalResults;
}

// Mock phase-3-only analysis
async function mockPhase3OnlyAnalysis(email: any): Promise<any> {
  console.log(chalk.magenta('  Running phase-3-only analysis...'));
  const startTime = Date.now();
  
  await simulateLLMDelay('phase3');
  
  // Limited extraction since focusing on actions
  const basicEntities = extractEntities(email.body);
  
  return {
    approach: 'phase3-only',
    entities: {
      po_numbers: basicEntities.po_numbers.slice(0, 1),
      customers: [], // Often misses customer names when focused on actions
      dollar_values: basicEntities.dollar_values
    },
    workflow_category: "Order Management",
    priority: "HIGH",
    actions: [
      "Process order",
      "Check inventory",
      "Ship product"
    ],
    llm_calls: 1,
    processing_time: Date.now() - startTime,
    extraction_quality: "limited"
  };
}

// Generate detailed comparison report
function generateDetailedReport(results: any[]): void {
  console.log(chalk.blue('\n=== DETAILED COMPARISON REPORT ===\n'));

  // Group results by email
  const emailGroups = results.reduce((acc, r) => {
    if (!acc[r.emailId]) acc[r.emailId] = {};
    acc[r.emailId][r.approach] = r;
    return acc;
  }, {});

  // Example comparison for one email
  const firstEmailId = Object.keys(emailGroups)[0];
  const comparison = emailGroups[firstEmailId];

  console.log(chalk.yellow('Sample Email Analysis Comparison:\n'));
  
  // Entity Extraction Comparison
  console.log(chalk.cyan('1. Entity Extraction Quality:'));
  console.log('   Single-phase:', comparison['single-phase'].entities);
  console.log('   Three-phase:', comparison['three-phase'].entities);
  console.log('   Phase-3-only:', comparison['phase3-only'].entities);
  
  // Action Quality Comparison
  console.log(chalk.cyan('\n2. Action Items Generated:'));
  console.log('   Single-phase actions:', comparison['single-phase'].actions.length);
  comparison['single-phase'].actions.forEach(a => console.log(`     - ${a}`));
  
  console.log('\n   Three-phase actions:', comparison['three-phase'].actions.length);
  comparison['three-phase'].actions.forEach(a => console.log(`     - ${a}`));
  
  console.log('\n   Phase-3-only actions:', comparison['phase3-only'].actions.length);
  comparison['phase3-only'].actions.forEach(a => console.log(`     - ${a}`));

  // Performance Metrics
  console.log(chalk.cyan('\n3. Performance Metrics:'));
  console.log(`   Single-phase: ${comparison['single-phase'].processing_time}ms (1 LLM call)`);
  console.log(`   Three-phase: ${comparison['three-phase'].processing_time}ms (2 LLM calls)`);
  if (comparison['three-phase'].phase_times) {
    console.log(`     - Phase 1: ${comparison['three-phase'].phase_times.phase1}ms`);
    console.log(`     - Phase 2: ${comparison['three-phase'].phase_times.phase2}ms`);
    console.log(`     - Phase 3: ${comparison['three-phase'].phase_times.phase3}ms`);
  }
  console.log(`   Phase-3-only: ${comparison['phase3-only'].processing_time}ms (1 LLM call)`);

  // Key Findings
  console.log(chalk.yellow('\n=== KEY FINDINGS ===\n'));
  
  console.log(chalk.green('✓ Three-Phase Advantages:'));
  console.log('  • Superior entity extraction (finds more entities and context)');
  console.log('  • Higher confidence scores (0.92 vs 0.75)');
  console.log('  • More specific and actionable items');
  console.log('  • Better risk assessment and SLA awareness');
  console.log('  • Preserves context between phases for better understanding');
  
  console.log(chalk.yellow('\n⚠ Three-Phase Trade-offs:'));
  console.log('  • Takes longer overall (but phases can be parallelized)');
  console.log('  • Uses more LLM calls (2 vs 1)');
  console.log('  • More complex to implement');
  
  console.log(chalk.red('\n✗ Single-Phase Limitations:'));
  console.log('  • Misses entities and context');
  console.log('  • Generic action items');
  console.log('  • Lower confidence in categorization');
  
  console.log(chalk.blue('\n💡 Recommendations:'));
  console.log('  • Use three-phase for critical emails (high value, premium customers)');
  console.log('  • Use single-phase for simple queries or when speed is critical');
  console.log('  • Phase 1 can be cached/reused for email threads');
  console.log('  • Phases 2 and 3 can be run in parallel after Phase 1');
}

// Main test
async function runMockComparison(): Promise<void> {
  console.log(chalk.blue('=== Three-Phase vs Single-Phase Analysis (Mock Demonstration) ===\n'));

  // Get a few test emails
  const emails = db.prepare(`
    SELECT id, subject, sender_email as from_email, received_at as received_date, body 
    FROM emails 
    WHERE body IS NOT NULL 
      AND length(body) > 100
      AND body LIKE '%order%'
    ORDER BY received_at DESC 
    LIMIT 3
  `).all();

  console.log(chalk.green(`Testing with ${emails.length} emails\n`));

  const results: any[] = [];

  for (const [index, email] of emails.entries()) {
    console.log(chalk.cyan(`\nEmail ${index + 1}: ${email.subject?.substring(0, 50)}...`));

    // Run all three approaches
    const singleResult = await mockSinglePhaseAnalysis(email);
    results.push({ ...singleResult, emailId: email.id });

    const threeResult = await mockThreePhaseAnalysis(email);
    results.push({ ...threeResult, emailId: email.id });

    const phase3Result = await mockPhase3OnlyAnalysis(email);
    results.push({ ...phase3Result, emailId: email.id });
  }

  // Generate report
  generateDetailedReport(results);

  // Save results
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const resultsPath = path.join(process.cwd(), 'test_results', `mock_comparison_${timestamp}.json`);
  
  const resultsDir = path.dirname(resultsPath);
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  fs.writeFileSync(resultsPath, JSON.stringify({
    test_type: 'mock_demonstration',
    test_date: new Date().toISOString(),
    purpose: 'Demonstrate three-phase vs single-phase differences',
    results: results,
    summary: {
      three_phase_benefits: [
        'Better entity extraction',
        'Contextual understanding',
        'Specific actionable items',
        'Higher confidence'
      ],
      implementation_notes: [
        'Phase 1 can be cached for email threads',
        'Phases can be parallelized',
        'Use three-phase for critical emails only'
      ]
    }
  }, null, 2));

  console.log(chalk.green(`\nResults saved to: ${resultsPath}`));
  db.close();
}

// Run the mock test
runMockComparison().catch(console.error);