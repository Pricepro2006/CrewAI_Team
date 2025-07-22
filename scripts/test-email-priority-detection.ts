#!/usr/bin/env node
/**
 * Email Priority Detection Test
 * Tests if models can correctly identify email priority levels
 */

import { OllamaProvider } from '../src/core/llm/OllamaProvider';
import { performance } from 'perf_hooks';

const priorityTestEmails = [
  {
    id: 'critical-1',
    subject: 'URGENT: System Down - Immediate Action Required',
    preview: 'Production system is completely down. All orders halted. Need immediate response.',
    expectedPriority: 'Critical',
    expectedUrgency: 'Immediate'
  },
  {
    id: 'critical-2', 
    subject: 'CRITICAL: Deal Registration Expires in 2 Hours',
    preview: 'Your $180K deal registration expires today at 5PM. Act now or lose protection.',
    expectedPriority: 'Critical',
    expectedUrgency: 'Immediate'
  },
  {
    id: 'high-1',
    subject: 'Important: Quote Review Needed by EOD',
    preview: 'Please review and approve quote CAS892456 by end of business today.',
    expectedPriority: 'High',
    expectedUrgency: '24 Hours'
  },
  {
    id: 'medium-1',
    subject: 'Order Update: Shipment Scheduled for Next Week',
    preview: 'Your order ORD12345 has been scheduled for shipment next Tuesday.',
    expectedPriority: 'Medium',
    expectedUrgency: '72 Hours'
  },
  {
    id: 'low-1',
    subject: 'Weekly Inventory Report Available',
    preview: 'The weekly inventory report for January 18 is now available in the portal.',
    expectedPriority: 'Low',
    expectedUrgency: 'No Rush'
  }
];

const testModels = ['qwen3:0.6b', 'qwen3:1.7b', 'granite3.3:2b', 'granite3.3:8b'];

async function testPriorityDetection(model: string, email: any) {
  const provider = new OllamaProvider({
    model: model,
    baseUrl: 'http://localhost:11434'
  });

  const prompt = `Analyze this email and determine its priority level.

Subject: ${email.subject}
Preview: ${email.preview}

Respond with ONLY a JSON object in this exact format:
{
  "priority": "Critical|High|Medium|Low",
  "urgency": "Immediate|24 Hours|72 Hours|No Rush",
  "reasoning": "brief explanation"
}`;

  try {
    const startTime = performance.now();
    const response = await provider.generate(prompt, {
      temperature: 0.1,
      format: 'json'
    });
    const endTime = performance.now();

    const result = JSON.parse(response);
    const correct = result.priority === email.expectedPriority;
    
    return {
      model,
      emailId: email.id,
      expected: email.expectedPriority,
      detected: result.priority,
      urgency: result.urgency,
      correct,
      time: endTime - startTime,
      reasoning: result.reasoning
    };
  } catch (error) {
    return {
      model,
      emailId: email.id,
      expected: email.expectedPriority,
      detected: 'ERROR',
      urgency: 'ERROR',
      correct: false,
      time: 0,
      reasoning: error instanceof Error ? error.message : 'Failed'
    };
  }
}

async function runPriorityTest() {
  console.log('🎯 EMAIL PRIORITY DETECTION TEST\n');
  
  const results: any[] = [];
  
  for (const model of testModels) {
    console.log(`\nTesting ${model}...`);
    console.log('-'.repeat(50));
    
    for (const email of priorityTestEmails) {
      const result = await testPriorityDetection(model, email);
      results.push(result);
      
      const icon = result.correct ? '✅' : '❌';
      console.log(`${icon} ${email.id}: Expected ${email.expectedPriority}, Got ${result.detected} (${result.time.toFixed(0)}ms)`);
      if (!result.correct && result.reasoning !== 'Failed') {
        console.log(`   Reasoning: ${result.reasoning}`);
      }
    }
  }
  
  // Calculate accuracy
  console.log('\n📊 ACCURACY SUMMARY:');
  console.log('='.repeat(60));
  
  for (const model of testModels) {
    const modelResults = results.filter(r => r.model === model);
    const correct = modelResults.filter(r => r.correct).length;
    const accuracy = (correct / modelResults.length * 100).toFixed(0);
    const avgTime = modelResults.reduce((sum, r) => sum + r.time, 0) / modelResults.length;
    
    console.log(`${model.padEnd(15)} Accuracy: ${accuracy}% (${correct}/${modelResults.length}) Avg: ${avgTime.toFixed(0)}ms`);
  }
  
  // Show critical email performance
  console.log('\n🚨 CRITICAL EMAIL DETECTION:');
  console.log('-'.repeat(60));
  
  const criticalResults = results.filter(r => r.expected === 'Critical');
  for (const model of testModels) {
    const modelCritical = criticalResults.filter(r => r.model === model);
    const correct = modelCritical.filter(r => r.correct).length;
    const accuracy = (correct / modelCritical.length * 100).toFixed(0);
    
    console.log(`${model.padEnd(15)} Critical Detection: ${accuracy}% (${correct}/${modelCritical.length})`);
  }
}

// Run test
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  runPriorityTest()
    .then(() => {
      console.log('\n✅ Priority detection test completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test failed:', error);
      process.exit(1);
    });
}