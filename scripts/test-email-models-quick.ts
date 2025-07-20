#!/usr/bin/env node
/**
 * Quick Email Analysis Model Comparison Test
 * Tests key models on representative email samples
 * Part of Task #27: Test email analyzing capabilities for each model
 */

import { EmailAnalysisAgent } from '../src/core/agents/specialized/EmailAnalysisAgent';
import { OllamaProvider } from '../src/core/llm/OllamaProvider';
import { logger } from '../src/utils/logger';
import { performance } from 'perf_hooks';

// Key models to test (fastest to slowest)
const keyModels = [
  'qwen3:0.6b',    // Fastest
  'qwen3:1.7b',    // Balanced
  'granite3.3:2b', // Complex
];

// Representative test emails (subset of the full test)
const testEmails = [
  {
    id: 'urgent-order',
    subject: 'URGENT: Order PO #45791234 - Shipment Delayed',
    body: 'Order PO #45791234 containing HP EliteBook 840 G9 (SKU: 5D5V8UT#ABA) has been delayed. New delivery: January 25, 2025. Tracking: 1Z999AA10123456784. Please contact account manager.',
    bodyPreview: 'Order PO #45791234 containing HP EliteBook delayed',
    from: { emailAddress: { name: 'TD SYNNEX Fulfillment', address: 'fulfillment@tdsynnex.com' }},
    receivedDateTime: '2025-01-18T08:30:00Z',
    isRead: false,
    categories: [],
    importance: 'high',
    expected: { priority: 'Critical', workflow: ['Order Management'], entityCount: 4 }
  },
  {
    id: 'quote-ready',
    subject: 'Quote CAS892456 Ready for Review',
    body: 'Quote CAS892456 ready. 50x Dell OptiPlex 7000 - $899.99 each. Total: $45,750.00 USD. Valid until Feb 1. Customer: Acme Corp.',
    bodyPreview: 'Quote CAS892456 ready for review',
    from: { emailAddress: { name: 'TD SYNNEX Sales', address: 'sales@tdsynnex.com' }},
    receivedDateTime: '2025-01-18T10:15:00Z',
    isRead: true,
    categories: [],
    importance: 'normal',
    expected: { priority: 'Medium', workflow: ['Quote Processing'], entityCount: 3 }
  },
  {
    id: 'simple-update',
    subject: 'Weekly Inventory Update',
    body: 'Weekly inventory updated. HP products: Good availability. Dell: Limited stock. Check portal for details.',
    bodyPreview: 'Weekly inventory levels updated',
    from: { emailAddress: { name: 'Inventory Team', address: 'inventory@tdsynnex.com' }},
    receivedDateTime: '2025-01-18T09:00:00Z',
    isRead: true,
    categories: [],
    importance: 'normal',
    expected: { priority: 'Low', workflow: ['Vendor Management'], entityCount: 0 }
  }
];

interface QuickTestResult {
  model: string;
  avgTime: number;
  avgConfidence: number;
  successRate: number;
  totalEntities: number;
  qualityScore: number;
  errors: string[];
}

async function testModelQuick(modelName: string): Promise<QuickTestResult> {
  console.log(`\n🧠 Testing ${modelName}...`);
  
  const result: QuickTestResult = {
    model: modelName,
    avgTime: 0,
    avgConfidence: 0,
    successRate: 0,
    totalEntities: 0,
    qualityScore: 0,
    errors: []
  };

  const times: number[] = [];
  const confidences: number[] = [];
  let successCount = 0;
  let totalEntities = 0;

  // Create agent with specific model
  const agent = new EmailAnalysisAgent();
  (agent as any).ollamaProvider = new OllamaProvider({
    model: modelName,
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
  });

  try {
    await agent.initialize();

    for (const email of testEmails) {
      const startTime = performance.now();
      
      try {
        const analysis = await agent.analyzeEmail(email);
        const endTime = performance.now();
        
        times.push(endTime - startTime);
        confidences.push(analysis.confidence);
        successCount++;
        
        // Count entities
        const entities = analysis.entities;
        const entityCount = entities.poNumbers.length + entities.quoteNumbers.length + 
                          entities.orderNumbers.length + entities.trackingNumbers.length +
                          entities.caseNumbers.length + entities.customers.length +
                          entities.products.length + entities.amounts.length;
        totalEntities += entityCount;
        
        console.log(`  ✓ ${email.id}: ${(endTime - startTime).toFixed(0)}ms, confidence: ${(analysis.confidence * 100).toFixed(1)}%, entities: ${entityCount}`);
        
      } catch (error) {
        const endTime = performance.now();
        times.push(endTime - startTime);
        const errorMsg = error instanceof Error ? error.message : String(error);
        result.errors.push(`${email.id}: ${errorMsg}`);
        console.log(`  ✗ ${email.id}: FAILED - ${errorMsg}`);
      }
    }

    // Calculate metrics
    result.avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    result.avgConfidence = confidences.length > 0 ? confidences.reduce((a, b) => a + b, 0) / confidences.length : 0;
    result.successRate = successCount / testEmails.length;
    result.totalEntities = totalEntities;
    result.qualityScore = result.successRate * 0.6 + result.avgConfidence * 0.4;

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    result.errors.push(`Initialization failed: ${errorMsg}`);
    console.log(`  ✗ Model failed to initialize: ${errorMsg}`);
  }

  return result;
}

async function runQuickEmailModelTest() {
  console.log('⚡ Quick Email Analysis Model Comparison\n');
  console.log(`Testing ${keyModels.length} models on ${testEmails.length} representative emails...\n`);
  
  const results: QuickTestResult[] = [];
  const startTime = performance.now();

  // Test each model
  for (const model of keyModels) {
    const result = await testModelQuick(model);
    results.push(result);
  }

  const totalTime = performance.now() - startTime;

  // Generate comparison report
  console.log('\n' + '='.repeat(80));
  console.log('📊 EMAIL ANALYSIS MODEL COMPARISON RESULTS');
  console.log('='.repeat(80));
  console.log(`Total Test Time: ${(totalTime / 1000).toFixed(1)}s`);
  console.log(`Emails Tested: ${testEmails.length}`);
  console.log(`Models Tested: ${results.length}`);

  // Sort by quality score
  results.sort((a, b) => b.qualityScore - a.qualityScore);

  console.log('\n📈 PERFORMANCE RANKING:');
  console.log('-'.repeat(80));
  console.log('Rank | Model         | Quality | Success | Avg Time | Confidence | Entities | Errors');
  console.log('-'.repeat(80));

  results.forEach((result, index) => {
    const rank = (index + 1).toString().padStart(4);
    const model = result.model.padEnd(13);
    const quality = `${(result.qualityScore * 100).toFixed(1)}%`.padStart(7);
    const success = `${(result.successRate * 100).toFixed(0)}%`.padStart(7);
    const avgTime = `${result.avgTime.toFixed(0)}ms`.padStart(8);
    const confidence = `${(result.avgConfidence * 100).toFixed(1)}%`.padStart(10);
    const entities = result.totalEntities.toString().padStart(8);
    const errors = result.errors.length.toString().padStart(6);
    
    console.log(`${rank} | ${model} | ${quality} | ${success} | ${avgTime} | ${confidence} | ${entities} | ${errors}`);
  });

  console.log('\n🎯 MODEL RECOMMENDATIONS:');
  console.log('-'.repeat(50));

  const best = results[0];
  const fastest = results.sort((a, b) => a.avgTime - b.avgTime)[0];
  const mostAccurate = results.sort((a, b) => b.avgConfidence - a.avgConfidence)[0];

  console.log(`🏆 Best Overall: ${best.model} (Quality: ${(best.qualityScore * 100).toFixed(1)}%)`);
  console.log(`⚡ Fastest: ${fastest.model} (${fastest.avgTime.toFixed(0)}ms average)`);
  console.log(`🎯 Most Confident: ${mostAccurate.model} (${(mostAccurate.avgConfidence * 100).toFixed(1)}% confidence)`);

  console.log('\n💡 USAGE GUIDELINES:');
  console.log('• For real-time analysis: Use fastest model with acceptable accuracy');
  console.log('• For production workflows: Use best overall quality model');  
  console.log('• For critical emails: Use most confident model');
  console.log('• Balance speed vs quality based on specific requirements');

  // Show detailed analysis for best model
  if (best.successRate === 1.0) {
    console.log(`\n✅ ${best.model} achieved 100% success rate!`);
  }

  if (best.errors.length > 0) {
    console.log('\n❌ ERRORS ENCOUNTERED:');
    best.errors.forEach(error => console.log(`  • ${error}`));
  }

  console.log('\n🔄 NEXT STEPS:');
  console.log('• Configure production system to use recommended models');
  console.log('• Set up model switching based on email complexity');
  console.log('• Monitor performance metrics in production');
  console.log('• Consider model updates based on usage patterns');

  return results;
}

// Execute test
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  runQuickEmailModelTest()
    .then(() => {
      console.log('\n✅ Quick email model comparison completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test failed:', error);
      process.exit(1);
    });
}

export { runQuickEmailModelTest };