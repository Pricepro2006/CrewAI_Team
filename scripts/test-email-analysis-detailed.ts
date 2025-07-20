#!/usr/bin/env node
/**
 * Detailed Email Analysis Quality Test
 * Shows actual analysis output from each model
 * Tests categorization, entity extraction, and analysis quality
 */

import { EmailAnalysisAgent } from '../src/core/agents/specialized/EmailAnalysisAgent';
import { OllamaProvider } from '../src/core/llm/OllamaProvider';
import { logger } from '../src/utils/logger';
import { performance } from 'perf_hooks';
import fs from 'fs/promises';
import path from 'path';

// All models to test - comprehensive list
const allModels = [
  'qwen3:0.6b',       // 0.6B - Smallest
  'qwen3:1.7b',       // 1.7B
  'granite3.3:2b',    // 2B
  'granite3.3:8b',    // 8B
  'llama3.2:1b',      // 1B - if available
  'llama3.2:3b',      // 3B - if available
  'gemma2:2b',        // 2B - if available
  'phi3:3.8b',        // 3.8B - if available
];

// Complex test email for quality assessment
const complexTestEmail = {
  id: 'complex-test-email',
  subject: 'URGENT: Multiple Issues - Order PO #45791234, Quote CAS892456, and Case #INC789012 Need Immediate Attention',
  body: `Dear Partner,

This email requires IMMEDIATE ACTION on multiple fronts:

1. ORDER ISSUE (CRITICAL):
   - PO #45791234 for HP EliteBook 840 G9 (SKU: 5D5V8UT#ABA) - DELAYED
   - Original Order: ORD98765432 for Global Tech Solutions
   - New ETA: January 25, 2025
   - Tracking: 1Z999AA10123456784
   - Value: $45,750.00 USD
   - ACTION: Contact account manager TODAY or risk cancellation

2. QUOTE EXPIRING (HIGH PRIORITY):
   - Quote CAS892456 expires in 48 hours
   - Customer: Acme Corporation (Contact: John Smith - john.smith@acme.com)
   - Products: 50x Dell OptiPlex 7000 + 50x P2422H monitors
   - Total: $58,247.50 USD
   - Related quotes: TS123789, WQ456123
   - ACTION: Approve or modify by January 30, 2025

3. SUPPORT CASE UPDATE:
   - Case #INC789012 - RMA-2025-1234 approved
   - Return: 2x Lenovo ThinkPad X1 Carbon (damaged)
   - Refund pending: $4,567.89 USD
   - ACTION: Ship returns within 14 days

4. DEAL REGISTRATION WARNING:
   - DR-2025-5678 for HPE ProLiant servers expires tomorrow 5PM PST
   - Value at risk: $180,450.00 USD
   - ACTION: Update or lose protection

Please address ALL items urgently. System escalations will begin in 24 hours.

Best regards,
TD SYNNEX Multi-Channel Team
Priority: CRITICAL | Response Required: 2 hours`,
  bodyPreview: 'This email requires IMMEDIATE ACTION on multiple fronts',
  from: {
    emailAddress: {
      name: 'TD SYNNEX Multi-Channel',
      address: 'multichannel@tdsynnex.com'
    }
  },
  to: [{
    emailAddress: {
      name: 'Partner Company',
      address: 'partner@company.com'
    }
  }],
  receivedDateTime: new Date().toISOString(),
  isRead: false,
  categories: [],
  importance: 'high'
};

// Expected analysis results for comparison
const expectedAnalysis = {
  categories: {
    workflow: ['Order Management', 'Quote Processing', 'Customer Support', 'Deal Registration'],
    priority: 'Critical',
    intent: 'Action Required',
    urgency: 'Immediate'
  },
  entities: {
    poNumbers: ['45791234'],
    quoteNumbers: ['CAS892456', 'TS123789', 'WQ456123'],
    orderNumbers: ['ORD98765432'],
    trackingNumbers: ['1Z999AA10123456784'],
    caseNumbers: ['INC789012'],
    rmaNumbers: ['RMA-2025-1234'],
    dealRegistrations: ['DR-2025-5678'],
    customers: ['Global Tech Solutions', 'Acme Corporation'],
    contacts: ['John Smith'],
    products: ['HP EliteBook 840 G9', 'Dell OptiPlex 7000', 'P2422H monitors', 'Lenovo ThinkPad X1 Carbon', 'HPE ProLiant servers'],
    amounts: ['$45,750.00', '$58,247.50', '$4,567.89', '$180,450.00'],
    dates: ['January 25, 2025', 'January 30, 2025', 'tomorrow 5PM PST'],
    skus: ['5D5V8UT#ABA']
  },
  suggestedActions: [
    'Contact account manager for PO #45791234',
    'Review and approve quote CAS892456',
    'Process RMA return shipment',
    'Update deal registration DR-2025-5678'
  ]
};

interface DetailedAnalysisResult {
  model: string;
  success: boolean;
  processingTime: number;
  analysis: any;
  evaluation: {
    categoriesScore: number;
    entitiesScore: number;
    confidenceScore: number;
    summaryQuality: number;
    actionsQuality: number;
    overallScore: number;
  };
  error?: string;
}

async function evaluateAnalysisQuality(analysis: any): Promise<any> {
  const evaluation = {
    categoriesScore: 0,
    entitiesScore: 0,
    confidenceScore: analysis?.confidence || 0,
    summaryQuality: 0,
    actionsQuality: 0,
    overallScore: 0
  };

  // Evaluate categories
  if (analysis?.categories) {
    const cats = analysis.categories;
    if (cats.workflow?.length > 0) evaluation.categoriesScore += 0.25;
    if (cats.priority === 'Critical' || cats.priority === 'High') evaluation.categoriesScore += 0.25;
    if (cats.intent === 'Action Required') evaluation.categoriesScore += 0.25;
    if (cats.urgency === 'Immediate' || cats.urgency === '24 Hours') evaluation.categoriesScore += 0.25;
  }

  // Evaluate entities extraction
  if (analysis?.entities) {
    const entities = analysis.entities;
    let entityCount = 0;
    let expectedCount = 20; // Approximate expected entities
    
    entityCount += entities.poNumbers?.length || 0;
    entityCount += entities.quoteNumbers?.length || 0;
    entityCount += entities.orderNumbers?.length || 0;
    entityCount += entities.trackingNumbers?.length || 0;
    entityCount += entities.caseNumbers?.length || 0;
    entityCount += entities.customers?.length || 0;
    entityCount += entities.products?.length || 0;
    entityCount += entities.amounts?.length || 0;
    
    evaluation.entitiesScore = Math.min(1, entityCount / expectedCount);
  }

  // Evaluate summary quality
  if (analysis?.summary) {
    const summary = analysis.summary.toLowerCase();
    if (summary.includes('urgent') || summary.includes('critical')) evaluation.summaryQuality += 0.33;
    if (summary.includes('multiple') || summary.includes('several')) evaluation.summaryQuality += 0.33;
    if (summary.length > 50) evaluation.summaryQuality += 0.34;
  }

  // Evaluate suggested actions
  if (analysis?.suggestedActions?.length > 0) {
    evaluation.actionsQuality = Math.min(1, analysis.suggestedActions.length / 4);
  }

  // Calculate overall score
  evaluation.overallScore = (
    evaluation.categoriesScore * 0.25 +
    evaluation.entitiesScore * 0.25 +
    evaluation.confidenceScore * 0.20 +
    evaluation.summaryQuality * 0.15 +
    evaluation.actionsQuality * 0.15
  );

  return evaluation;
}

async function testModelDetailed(modelName: string): Promise<DetailedAnalysisResult> {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🧠 Testing Model: ${modelName}`);
  console.log('='.repeat(80));

  const result: DetailedAnalysisResult = {
    model: modelName,
    success: false,
    processingTime: 0,
    analysis: null,
    evaluation: {
      categoriesScore: 0,
      entitiesScore: 0,
      confidenceScore: 0,
      summaryQuality: 0,
      actionsQuality: 0,
      overallScore: 0
    }
  };

  // Check if model exists
  try {
    const checkCommand = `ollama list | grep -q "${modelName}"`;
    const { execSync } = await import('child_process');
    try {
      execSync(checkCommand, { shell: true });
    } catch {
      console.log(`⚠️  Model ${modelName} not found. Skipping...`);
      result.error = 'Model not available';
      return result;
    }
  } catch (error) {
    console.log(`⚠️  Could not check model availability for ${modelName}`);
  }

  const agent = new EmailAnalysisAgent();
  
  // Override the model
  (agent as any).ollamaProvider = new OllamaProvider({
    model: modelName,
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
  });

  try {
    await agent.initialize();
    
    const startTime = performance.now();
    const analysis = await agent.analyzeEmail(complexTestEmail);
    const endTime = performance.now();
    
    result.success = true;
    result.processingTime = endTime - startTime;
    result.analysis = analysis;
    result.evaluation = await evaluateAnalysisQuality(analysis);

    // Display analysis results
    console.log('\n📊 ANALYSIS OUTPUT:');
    console.log('-'.repeat(60));
    
    console.log('\n📂 Categories:');
    console.log(`  • Workflow: ${analysis.categories.workflow.join(', ') || 'None'}`);
    console.log(`  • Priority: ${analysis.priority}`);
    console.log(`  • Intent: ${analysis.categories.intent}`);
    console.log(`  • Urgency: ${analysis.categories.urgency}`);
    
    console.log('\n🔍 Entities Extracted:');
    console.log(`  • PO Numbers: ${analysis.entities.poNumbers.join(', ') || 'None'}`);
    console.log(`  • Quote Numbers: ${analysis.entities.quoteNumbers.join(', ') || 'None'}`);
    console.log(`  • Order Numbers: ${analysis.entities.orderNumbers.join(', ') || 'None'}`);
    console.log(`  • Tracking: ${analysis.entities.trackingNumbers.join(', ') || 'None'}`);
    console.log(`  • Case Numbers: ${analysis.entities.caseNumbers.join(', ') || 'None'}`);
    console.log(`  • Customers: ${analysis.entities.customers.join(', ') || 'None'}`);
    console.log(`  • Products: ${analysis.entities.products.length} found`);
    console.log(`  • Amounts: ${analysis.entities.amounts.map(a => `${a.currency} ${a.value}`).join(', ') || 'None'}`);
    
    console.log('\n📝 Summary:');
    console.log(`  "${analysis.summary}"`);
    
    console.log('\n💡 Suggested Actions:');
    analysis.suggestedActions.forEach((action, i) => {
      console.log(`  ${i + 1}. ${action}`);
    });
    
    console.log('\n📈 Quality Metrics:');
    console.log(`  • Categories Score: ${(result.evaluation.categoriesScore * 100).toFixed(0)}%`);
    console.log(`  • Entity Extraction: ${(result.evaluation.entitiesScore * 100).toFixed(0)}%`);
    console.log(`  • Confidence: ${(analysis.confidence * 100).toFixed(0)}%`);
    console.log(`  • Summary Quality: ${(result.evaluation.summaryQuality * 100).toFixed(0)}%`);
    console.log(`  • Actions Quality: ${(result.evaluation.actionsQuality * 100).toFixed(0)}%`);
    console.log(`  • Overall Score: ${(result.evaluation.overallScore * 100).toFixed(0)}%`);
    
    console.log(`\n⏱️  Processing Time: ${result.processingTime.toFixed(0)}ms`);
    
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    console.log(`\n❌ Analysis failed: ${result.error}`);
  }

  return result;
}

async function runDetailedEmailAnalysisTest() {
  console.log('📧 DETAILED EMAIL ANALYSIS QUALITY TEST');
  console.log('Testing actual analysis capabilities across all models\n');
  
  const results: DetailedAnalysisResult[] = [];
  const startTime = performance.now();

  // Test each model
  for (const model of allModels) {
    const result = await testModelDetailed(model);
    results.push(result);
    
    // Small delay between models to avoid overload
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  const totalTime = performance.now() - startTime;

  // Generate comprehensive report
  console.log('\n' + '='.repeat(100));
  console.log('📊 COMPREHENSIVE EMAIL ANALYSIS QUALITY REPORT');
  console.log('='.repeat(100));
  console.log(`Total Test Time: ${(totalTime / 1000).toFixed(1)}s`);
  console.log(`Models Tested: ${results.filter(r => !r.error).length} of ${allModels.length}`);
  console.log(`Test Email: Complex multi-issue email with 4 critical items`);

  // Filter out unavailable models
  const validResults = results.filter(r => !r.error || r.error !== 'Model not available');
  
  // Sort by overall score
  validResults.sort((a, b) => b.evaluation.overallScore - a.evaluation.overallScore);

  console.log('\n🏆 MODEL RANKING BY ANALYSIS QUALITY:');
  console.log('-'.repeat(100));
  console.log('Rank | Model         | Overall | Categories | Entities | Confidence | Summary | Actions | Time');
  console.log('-'.repeat(100));

  validResults.forEach((result, index) => {
    if (result.success) {
      const rank = (index + 1).toString().padStart(4);
      const model = result.model.padEnd(13);
      const overall = `${(result.evaluation.overallScore * 100).toFixed(0)}%`.padStart(7);
      const categories = `${(result.evaluation.categoriesScore * 100).toFixed(0)}%`.padStart(10);
      const entities = `${(result.evaluation.entitiesScore * 100).toFixed(0)}%`.padStart(8);
      const confidence = `${(result.evaluation.confidenceScore * 100).toFixed(0)}%`.padStart(10);
      const summary = `${(result.evaluation.summaryQuality * 100).toFixed(0)}%`.padStart(7);
      const actions = `${(result.evaluation.actionsQuality * 100).toFixed(0)}%`.padStart(7);
      const time = `${(result.processingTime / 1000).toFixed(1)}s`.padStart(6);
      
      console.log(`${rank} | ${model} | ${overall} | ${categories} | ${entities} | ${confidence} | ${summary} | ${actions} | ${time}`);
    }
  });

  console.log('\n📋 DETAILED MODEL ANALYSIS:');
  console.log('='.repeat(100));

  // Show top 3 models in detail
  const topModels = validResults.filter(r => r.success).slice(0, 3);
  
  topModels.forEach((result, index) => {
    console.log(`\n${index + 1}. ${result.model.toUpperCase()}`);
    console.log('-'.repeat(50));
    console.log('Strengths:');
    
    if (result.evaluation.categoriesScore >= 0.75) {
      console.log('  ✅ Excellent categorization accuracy');
    }
    if (result.evaluation.entitiesScore >= 0.7) {
      console.log('  ✅ Strong entity extraction');
    }
    if (result.evaluation.confidenceScore >= 0.8) {
      console.log('  ✅ High confidence scoring');
    }
    if (result.processingTime < 5000) {
      console.log('  ✅ Fast processing time');
    }
    
    console.log('Weaknesses:');
    if (result.evaluation.categoriesScore < 0.5) {
      console.log('  ❌ Poor categorization');
    }
    if (result.evaluation.entitiesScore < 0.5) {
      console.log('  ❌ Weak entity extraction');
    }
    if (result.evaluation.summaryQuality < 0.5) {
      console.log('  ❌ Low quality summaries');
    }
    if (result.processingTime > 10000) {
      console.log('  ❌ Slow processing');
    }
    
    console.log(`\nExample Output Quality:`);
    if (result.analysis) {
      console.log(`  Priority Detection: ${result.analysis.priority}`);
      console.log(`  Entities Found: ${Object.values(result.analysis.entities).flat().length} total`);
      console.log(`  Actions Generated: ${result.analysis.suggestedActions.length}`);
    }
  });

  console.log('\n🎯 KEY FINDINGS:');
  console.log('-'.repeat(50));
  
  const bestOverall = validResults[0];
  const bestCategories = validResults.sort((a, b) => b.evaluation.categoriesScore - a.evaluation.categoriesScore)[0];
  const bestEntities = validResults.sort((a, b) => b.evaluation.entitiesScore - a.evaluation.entitiesScore)[0];
  const fastest = validResults.filter(r => r.success).sort((a, b) => a.processingTime - b.processingTime)[0];

  console.log(`🏆 Best Overall: ${bestOverall.model} (${(bestOverall.evaluation.overallScore * 100).toFixed(0)}% quality)`);
  console.log(`📂 Best Categorization: ${bestCategories.model} (${(bestCategories.evaluation.categoriesScore * 100).toFixed(0)}%)`);
  console.log(`🔍 Best Entity Extraction: ${bestEntities.model} (${(bestEntities.evaluation.entitiesScore * 100).toFixed(0)}%)`);
  console.log(`⚡ Fastest Processing: ${fastest.model} (${(fastest.processingTime / 1000).toFixed(1)}s)`);

  console.log('\n💡 RECOMMENDATIONS:');
  console.log('-'.repeat(50));
  console.log('• For production email analysis: Use the model with best overall score');
  console.log('• For real-time processing: Balance speed vs quality based on requirements');
  console.log('• For critical emails: Prioritize categorization and entity extraction accuracy');
  console.log('• Consider model ensemble for highest accuracy on complex emails');

  // Save detailed results
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `email-analysis-detailed-results-${timestamp}.json`;
  const filepath = path.join(process.cwd(), filename);
  
  await fs.writeFile(filepath, JSON.stringify({
    metadata: {
      testTimestamp: new Date().toISOString(),
      totalTime: totalTime,
      modelsTotal: allModels.length,
      modelsTested: validResults.length,
      testEmail: 'Complex multi-issue email'
    },
    results: results,
    expectedAnalysis: expectedAnalysis
  }, null, 2));
  
  console.log(`\n💾 Detailed results saved to: ${filename}`);

  return results;
}

// Execute test
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  runDetailedEmailAnalysisTest()
    .then(() => {
      console.log('\n✅ Detailed email analysis test completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test failed:', error);
      process.exit(1);
    });
}

export { runDetailedEmailAnalysisTest };