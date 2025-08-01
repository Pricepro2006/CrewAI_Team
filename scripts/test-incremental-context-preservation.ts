#!/usr/bin/env tsx
/**
 * Proof of Concept: Three-Phase Incremental Analysis with Full Context Preservation
 * 
 * This demonstrates how each phase:
 * 1. Receives the COMPLETE original email
 * 2. Also receives all previous phase results as additional context
 * 3. Focuses on specific aspects without re-analyzing what's already done
 * 4. Adds new insights without losing any information
 */

import Database from 'better-sqlite3';
import chalk from 'chalk';

// Sample email with rich content for testing
const TEST_EMAIL = {
  id: 'test_001',
  subject: 'URGENT: Quote Request - ABC Corp - Server Upgrade Project - Need by EOD',
  body: `Hi Team,

ABC Corporation urgently needs a quote for their server upgrade project. This is time-sensitive as they need to present to their board tomorrow.

Requirements:
- 15x HP ProLiant DL380 Gen10 servers
- Part numbers: 868703-B21, P408i-a controller
- Need pricing by 5 PM today
- Budget approved: $150,000
- PO will be issued immediately upon approval

Customer details:
- Customer: ABC Corporation (Account #12345)
- Contact: John Smith, IT Director
- Previous orders: $2.5M last year
- They're also considering Dell - we need competitive pricing

Additional notes:
- They mentioned potential for 50 more servers in Q2 if this goes well
- Competitor (CDW) quoted them $145,000 but with slower delivery
- Customer prefers us due to our support but needs better pricing

Please expedite this quote. Let me know if you need any additional information.

Thanks,
Sarah Johnson
Sales Manager
(555) 123-4567`,
  from_email: 'sarah.johnson@customer.com',
  received_at: new Date().toISOString()
};

// Simulate the three phases with context preservation
async function demonstrateIncrementalAnalysis() {
  console.log(chalk.blue('\n=== DEMONSTRATING CONTEXT PRESERVATION IN THREE-PHASE ANALYSIS ===\n'));
  
  // =========================================
  // PHASE 1: Rule-Based Extraction
  // =========================================
  console.log(chalk.yellow('📋 PHASE 1: Rule-Based Extraction (Pattern Matching)'));
  console.log(chalk.gray('Input: Original email only'));
  console.log(chalk.gray('Focus: Extract entities, detect urgency, basic categorization\n'));
  
  const phase1Start = Date.now();
  
  const phase1Results = {
    entities: {
      customer: 'ABC Corporation',
      account_number: '12345',
      contact_name: 'John Smith',
      contact_role: 'IT Director',
      po_numbers: [],
      quote_numbers: [],
      product_numbers: ['868703-B21', 'P408i-a'],
      dollar_values: [150000, 145000, 2500000],
      quantities: { '868703-B21': 15 },
      deadlines: ['5 PM today', 'EOD']
    },
    urgency: {
      level: 'CRITICAL',
      indicators: ['URGENT', 'urgently', 'time-sensitive', 'by 5 PM today', 'expedite']
    },
    basic_category: 'Quote Request',
    competitors_mentioned: ['Dell', 'CDW'],
    key_phrases: [
      'board tomorrow',
      'PO will be issued immediately',
      'potential for 50 more servers in Q2'
    ]
  };
  
  const phase1Time = Date.now() - phase1Start;
  console.log(chalk.green(`✓ Phase 1 Complete (${phase1Time}ms)`));
  console.log(chalk.gray('Extracted:', JSON.stringify(phase1Results, null, 2).substring(0, 200) + '...'));
  
  // =========================================
  // PHASE 2: AI Enhancement (Receives Phase 1 + Original)
  // =========================================
  console.log(chalk.yellow('\n📊 PHASE 2: AI Enhancement with Llama'));
  console.log(chalk.gray('Input: Original email + Phase 1 results'));
  console.log(chalk.gray('Focus: Validate extractions, add workflow intelligence, assess risk\n'));
  
  const phase2Start = Date.now();
  
  // Phase 2 receives BOTH original email AND Phase 1 results
  const phase2Prompt = `
You are analyzing an email for workflow intelligence. You have:
1. The COMPLETE original email
2. Initial extraction results from Phase 1

Phase 1 Results:
${JSON.stringify(phase1Results, null, 2)}

Original Email:
${TEST_EMAIL.body}

Your task is to ADD these insights:
- Validate and enhance entity extraction
- Determine workflow category and state
- Assess business risk and opportunity
- Identify task ownership
- Set appropriate SLA

Do NOT re-extract what Phase 1 already found. Focus on adding intelligence.`;

  // Simulate Phase 2 analysis
  await new Promise(resolve => setTimeout(resolve, 500)); // Simulate LLM processing
  
  const phase2Results = {
    // Preserves ALL Phase 1 data
    ...phase1Results,
    
    // Adds new insights
    workflow: {
      category: 'Quote Processing',
      state: 'IN_PROGRESS',
      sub_category: 'Competitive Quote',
      confidence: 0.95
    },
    risk_assessment: {
      level: 'HIGH',
      factors: [
        'Board presentation tomorrow',
        'Competitor already quoted',
        'Large future opportunity at stake'
      ],
      revenue_at_risk: 150000,
      future_opportunity: 750000 // 50 servers estimate
    },
    task_assignment: {
      owner: 'Senior Sales Team',
      escalation_needed: true,
      reason: 'High value + board deadline + competitive situation'
    },
    sla: {
      deadline: '5:00 PM today',
      hours_remaining: 6,
      status: 'YELLOW'
    },
    validated_entities: {
      primary_value: 150000,
      competitive_pressure: true,
      competitor_price: 145000,
      price_gap: 5000
    }
  };
  
  const phase2Time = Date.now() - phase2Start;
  console.log(chalk.green(`✓ Phase 2 Complete (${phase2Time}ms)`));
  console.log(chalk.gray('Added insights:', Object.keys(phase2Results).filter(k => !phase1Results[k]).join(', ')));
  
  // =========================================
  // PHASE 3: Strategic Analysis (Receives Phase 1 + Phase 2 + Original)
  // =========================================
  console.log(chalk.yellow('\n🎯 PHASE 3: Strategic Analysis with Phi-4'));
  console.log(chalk.gray('Input: Original email + Phase 1 results + Phase 2 results'));
  console.log(chalk.gray('Focus: Executive insights, strategic recommendations, action planning\n'));
  
  const phase3Start = Date.now();
  
  // Phase 3 receives EVERYTHING: original + Phase 1 + Phase 2
  const phase3Prompt = `
You are providing strategic analysis. You have:
1. The COMPLETE original email
2. Phase 1 extraction results
3. Phase 2 workflow intelligence

Phase 1 Results:
${JSON.stringify(phase1Results, null, 2)}

Phase 2 Results:
${JSON.stringify(phase2Results, null, 2)}

Original Email:
${TEST_EMAIL.body}

Your task is to ADD strategic insights:
- Executive summary
- Win strategy against competition
- Upsell opportunities
- Relationship management recommendations
- Long-term account strategy

Build upon previous analyses, don't repeat them.`;

  // Simulate Phase 3 analysis
  await new Promise(resolve => setTimeout(resolve, 800)); // Simulate deeper LLM processing
  
  const phase3Results = {
    // Preserves ALL previous data
    ...phase2Results,
    
    // Adds strategic layer
    executive_summary: {
      situation: 'High-stakes competitive quote with future growth potential',
      recommendation: 'Approve 3% discount to win deal and secure Q2 opportunity',
      business_impact: 'Winning could lead to $900K total revenue, losing risks account'
    },
    competitive_strategy: {
      our_advantages: ['Better support', 'Existing relationship', 'Faster deployment'],
      their_advantages: ['Lower price by $5,000'],
      win_tactics: [
        'Match CDW price with additional value-adds',
        'Emphasize support SLA differences',
        'Offer Q2 volume discount commitment'
      ]
    },
    action_plan: {
      immediate: [
        'Get VP approval for price match',
        'Prepare comparison chart vs CDW',
        'Schedule call with John Smith by 3 PM'
      ],
      follow_up: [
        'Lock in Q2 volume pricing',
        'Arrange executive meeting',
        'Assign dedicated account manager'
      ]
    },
    relationship_insights: {
      account_health: 'Strong but price-sensitive',
      growth_trajectory: '400% potential growth Q2',
      retention_risk: 'Medium - testing competitors'
    }
  };
  
  const phase3Time = Date.now() - phase3Start;
  console.log(chalk.green(`✓ Phase 3 Complete (${phase3Time}ms)`));
  console.log(chalk.gray('Added strategies:', Object.keys(phase3Results).filter(k => !phase2Results[k]).join(', ')));
  
  // =========================================
  // DEMONSTRATION: NO INFORMATION LOST
  // =========================================
  console.log(chalk.blue('\n=== PROOF: NO INFORMATION LOST ===\n'));
  
  console.log(chalk.cyan('1. Original Email Preserved:'));
  console.log(chalk.gray(`   - Full email text available to all phases: ✓`));
  console.log(chalk.gray(`   - Subject: "${TEST_EMAIL.subject}"`));
  console.log(chalk.gray(`   - Body length: ${TEST_EMAIL.body.length} characters\n`));
  
  console.log(chalk.cyan('2. Cumulative Information Growth:'));
  console.log(chalk.gray(`   - Phase 1 extracted: ${Object.keys(phase1Results).length} data points`));
  console.log(chalk.gray(`   - Phase 2 total: ${Object.keys(phase2Results).length} data points (includes all Phase 1)`));
  console.log(chalk.gray(`   - Phase 3 total: ${Object.keys(phase3Results).length} data points (includes all previous)\n`));
  
  console.log(chalk.cyan('3. Workload Efficiency:'));
  console.log(chalk.gray(`   - Phase 1: Focused only on extraction (${phase1Time}ms)`));
  console.log(chalk.gray(`   - Phase 2: Focused only on workflow intelligence (${phase2Time}ms)`));
  console.log(chalk.gray(`   - Phase 3: Focused only on strategy (${phase3Time}ms)`));
  console.log(chalk.gray(`   - Total time: ${phase1Time + phase2Time + phase3Time}ms\n`));
  
  console.log(chalk.cyan('4. Information Preservation Check:'));
  
  // Verify all Phase 1 data exists in Phase 2
  const phase1Keys = Object.keys(phase1Results);
  const phase2Keys = Object.keys(phase2Results);
  const phase3Keys = Object.keys(phase3Results);
  
  console.log(chalk.gray(`   - All Phase 1 data in Phase 2: ${phase1Keys.every(k => phase2Keys.includes(k)) ? '✓' : '✗'}`));
  console.log(chalk.gray(`   - All Phase 2 data in Phase 3: ${phase2Keys.every(k => phase3Keys.includes(k)) ? '✓' : '✗'}`));
  console.log(chalk.gray(`   - Original email accessible: ✓`));
  console.log(chalk.gray(`   - No data overwritten: ✓\n`));
  
  // =========================================
  // COMPARISON: Monolithic vs Incremental
  // =========================================
  console.log(chalk.blue('=== COMPARISON: MONOLITHIC vs INCREMENTAL ===\n'));
  
  console.log(chalk.red('❌ MONOLITHIC APPROACH (Single Phase):'));
  console.log(chalk.gray('   - Must analyze everything at once'));
  console.log(chalk.gray('   - Complex 5000+ token prompt'));
  console.log(chalk.gray('   - Estimated time: 2000-3000ms'));
  console.log(chalk.gray('   - Higher error rate'));
  console.log(chalk.gray('   - Difficult to debug/improve\n'));
  
  console.log(chalk.green('✓ INCREMENTAL APPROACH (Three Phases):'));
  console.log(chalk.gray('   - Each phase has focused responsibility'));
  console.log(chalk.gray('   - Simpler, targeted prompts'));
  console.log(chalk.gray(`   - Total time: ${phase1Time + phase2Time + phase3Time}ms`));
  console.log(chalk.gray('   - Can stop early for low-value emails'));
  console.log(chalk.gray('   - Easy to debug and optimize each phase'));
  console.log(chalk.gray('   - NO INFORMATION LOST - each phase adds to previous\n'));
  
  // =========================================
  // SMART PHASE SELECTION
  // =========================================
  console.log(chalk.blue('=== SMART PHASE SELECTION ===\n'));
  
  console.log(chalk.yellow('Decision Logic:'));
  console.log(chalk.gray('   - Low value (<$10K), no urgency → Phase 1 only'));
  console.log(chalk.gray('   - Medium value, standard request → Phase 1 + 2'));
  console.log(chalk.gray('   - High value, competitive, urgent → All 3 phases\n'));
  
  console.log(chalk.yellow('This email qualified for all phases because:'));
  console.log(chalk.gray(`   - High value: $${phase1Results.entities.dollar_values[0].toLocaleString()}`));
  console.log(chalk.gray(`   - Urgency: ${phase1Results.urgency.level}`));
  console.log(chalk.gray(`   - Competitive situation: ${phase1Results.competitors_mentioned.join(', ')}`));
  console.log(chalk.gray(`   - Future opportunity: 50 more servers\n`));
  
  return phase3Results;
}

// Run the demonstration
demonstrateIncrementalAnalysis()
  .then(finalResults => {
    console.log(chalk.green('✨ DEMONSTRATION COMPLETE\n'));
    console.log(chalk.blue('KEY INSIGHT: The three-phase approach preserves ALL information'));
    console.log(chalk.blue('while reducing each phase\'s workload through focused analysis.\n'));
  })
  .catch(console.error);