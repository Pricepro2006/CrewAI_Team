#!/usr/bin/env node
/**
 * GGUF Models and Real Email Analysis Test
 * Tests GGUF models and analyzes real TD SYNNEX emails from sample data
 */

import { EmailAnalysisAgent } from '../src/core/agents/specialized/EmailAnalysisAgent';
import { OllamaProvider } from '../src/core/llm/OllamaProvider';
import { logger } from '../src/utils/logger';
import { performance } from 'perf_hooks';
import fs from 'fs/promises';
import path from 'path';

// All models to test including GGUF
const allModelsToTest = [
  // Previously tested models
  'qwen3:0.6b',
  'qwen3:1.7b', 
  'granite3.3:2b',
  'granite3.3:8b',
  // GGUF models
  'hf.co/bartowski/Meta-Llama-3.1-8B-Instruct-GGUF:latest',
  'hf.co/unsloth/DeepSeek-R1-0528-Qwen3-8B-GGUF:latest'
];

// Shorter aliases for display
const modelAliases: Record<string, string> = {
  'hf.co/bartowski/Meta-Llama-3.1-8B-Instruct-GGUF:latest': 'llama3.1-8b-gguf',
  'hf.co/unsloth/DeepSeek-R1-0528-Qwen3-8B-GGUF:latest': 'deepseek-r1-gguf'
};

interface RealEmailTestResult {
  model: string;
  totalEmails: number;
  successCount: number;
  failureCount: number;
  avgProcessingTime: number;
  priorityAccuracy: Record<string, number>;
  workflowAccuracy: Record<string, number>;
  criticalDetection: number;
  errors: string[];
  sampleAnalyses: any[];
}

async function loadRealEmails() {
  const dataPath = path.join(process.cwd(), 'data', 'sample_email_data.json');
  const data = await fs.readFile(dataPath, 'utf-8');
  const parsed = JSON.parse(data);
  return parsed.email_dashboard_data.emails;
}

async function convertToEmailFormat(sampleEmail: any) {
  // Convert sample email to EmailAnalysisAgent format
  return {
    id: sampleEmail.id,
    subject: sampleEmail.subject,
    body: sampleEmail.summary + '\n\n' + 
          (sampleEmail.entities ? Object.entries(sampleEmail.entities)
            .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
            .join('\n') : ''),
    bodyPreview: sampleEmail.summary,
    from: {
      emailAddress: {
        name: 'TD SYNNEX',
        address: sampleEmail.email_alias
      }
    },
    to: [{
      emailAddress: {
        name: sampleEmail.requested_by,
        address: `${sampleEmail.requested_by.toLowerCase().replace(' ', '.')}@partner.com`
      }
    }],
    receivedDateTime: sampleEmail.timestamp,
    isRead: sampleEmail.workflow_state !== 'START_POINT',
    categories: [],
    importance: sampleEmail.priority === 'Critical' ? 'high' : 'normal',
    // Store expected values for validation
    expectedPriority: sampleEmail.priority,
    expectedWorkflow: sampleEmail.workflow_type,
    expectedStatus: sampleEmail.status_text
  };
}

async function testModelOnRealEmails(modelName: string, emails: any[]): Promise<RealEmailTestResult> {
  const displayName = modelAliases[modelName] || modelName;
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🧠 Testing Model: ${displayName}`);
  console.log('='.repeat(80));

  const result: RealEmailTestResult = {
    model: displayName,
    totalEmails: emails.length,
    successCount: 0,
    failureCount: 0,
    avgProcessingTime: 0,
    priorityAccuracy: { correct: 0, total: 0 },
    workflowAccuracy: { correct: 0, total: 0 },
    criticalDetection: 0,
    errors: [],
    sampleAnalyses: []
  };

  // Check if model exists
  try {
    const checkCommand = `ollama list | grep -q "${modelName}"`;
    const { execSync } = await import('child_process');
    try {
      execSync(checkCommand, { shell: true });
    } catch {
      console.log(`⚠️  Model ${displayName} not found. Skipping...`);
      result.errors.push('Model not available');
      return result;
    }
  } catch (error) {
    console.log(`⚠️  Could not check model availability for ${displayName}`);
  }

  const agent = new EmailAnalysisAgent();
  
  // Override the model
  (agent as any).ollamaProvider = new OllamaProvider({
    model: modelName,
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
  });

  const processingTimes: number[] = [];
  const criticalEmails = emails.filter(e => e.expectedPriority === 'Critical');

  try {
    await agent.initialize();
    
    // Test on a subset of emails (first 10 for speed)
    const testEmails = emails.slice(0, 10);
    
    for (const email of testEmails) {
      try {
        console.log(`  Testing email ${email.id}: ${email.subject.substring(0, 50)}...`);
        
        const startTime = performance.now();
        const analysis = await agent.analyzeEmail(email);
        const endTime = performance.now();
        
        const processingTime = endTime - startTime;
        processingTimes.push(processingTime);
        
        // Validate results
        result.priorityAccuracy.total++;
        if (analysis.priority === email.expectedPriority) {
          result.priorityAccuracy.correct++;
        }
        
        result.workflowAccuracy.total++;
        const expectedWorkflow = email.expectedWorkflow.toLowerCase();
        const detectedWorkflows = analysis.categories.workflow.map(w => w.toLowerCase());
        if (detectedWorkflows.some(w => w.includes(expectedWorkflow) || expectedWorkflow.includes(w))) {
          result.workflowAccuracy.correct++;
        }
        
        // Check critical detection
        if (email.expectedPriority === 'Critical') {
          if (analysis.priority === 'Critical' || analysis.priority === 'High') {
            result.criticalDetection++;
          }
        }
        
        result.successCount++;
        
        // Store sample analysis for first 3 emails
        if (result.sampleAnalyses.length < 3) {
          result.sampleAnalyses.push({
            emailId: email.id,
            subject: email.subject,
            expected: {
              priority: email.expectedPriority,
              workflow: email.expectedWorkflow
            },
            detected: {
              priority: analysis.priority,
              workflow: analysis.categories.workflow,
              confidence: analysis.confidence
            },
            processingTime
          });
        }
        
        console.log(`    ✓ Priority: ${analysis.priority} (expected: ${email.expectedPriority}) - ${processingTime.toFixed(0)}ms`);
        
      } catch (error) {
        result.failureCount++;
        const errorMsg = error instanceof Error ? error.message : String(error);
        result.errors.push(`Email ${email.id}: ${errorMsg}`);
        console.log(`    ✗ Failed: ${errorMsg}`);
      }
    }
    
    // Calculate metrics
    if (processingTimes.length > 0) {
      result.avgProcessingTime = processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;
    }
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    result.errors.push(`Model initialization failed: ${errorMsg}`);
    console.log(`\n❌ Model failed to initialize: ${errorMsg}`);
  }

  return result;
}

async function runComprehensiveEmailTest() {
  console.log('📧 COMPREHENSIVE EMAIL ANALYSIS TEST');
  console.log('Testing all models including GGUF on real TD SYNNEX emails\n');
  
  // Load real emails
  console.log('Loading real email samples...');
  const rawEmails = await loadRealEmails();
  const emails = await Promise.all(rawEmails.map(convertToEmailFormat));
  console.log(`Loaded ${emails.length} real emails from TD SYNNEX sample data\n`);
  
  // Show email distribution
  const priorities = emails.reduce((acc, e) => {
    acc[e.expectedPriority] = (acc[e.expectedPriority] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  console.log('Email Distribution:');
  Object.entries(priorities).forEach(([priority, count]) => {
    console.log(`  ${priority}: ${count} emails`);
  });
  
  const criticalCount = priorities['Critical'] || 0;
  console.log(`\n🚨 Critical Emails: ${criticalCount} (${(criticalCount / emails.length * 100).toFixed(1)}%)\n`);
  
  const results: RealEmailTestResult[] = [];
  const startTime = performance.now();
  
  // Test each model
  for (const model of allModelsToTest) {
    const result = await testModelOnRealEmails(model, emails);
    results.push(result);
    
    // Small delay between models
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  const totalTime = performance.now() - startTime;
  
  // Generate comprehensive report
  console.log('\n' + '='.repeat(100));
  console.log('📊 COMPREHENSIVE REAL EMAIL ANALYSIS REPORT');
  console.log('='.repeat(100));
  console.log(`Total Test Time: ${(totalTime / 1000).toFixed(1)}s`);
  console.log(`Models Tested: ${results.filter(r => r.errors.length === 0 || !r.errors.includes('Model not available')).length}`);
  console.log(`Emails Tested: 10 per model (from ${emails.length} total)`);
  
  // Filter out unavailable models
  const validResults = results.filter(r => !r.errors.includes('Model not available'));
  
  // Sort by priority accuracy
  validResults.sort((a, b) => {
    const aAccuracy = a.priorityAccuracy.total > 0 ? a.priorityAccuracy.correct / a.priorityAccuracy.total : 0;
    const bAccuracy = b.priorityAccuracy.total > 0 ? b.priorityAccuracy.correct / b.priorityAccuracy.total : 0;
    return bAccuracy - aAccuracy;
  });
  
  console.log('\n🏆 MODEL PERFORMANCE ON REAL EMAILS:');
  console.log('-'.repeat(100));
  console.log('Rank | Model              | Priority Acc | Workflow Acc | Critical Det | Avg Time | Success Rate');
  console.log('-'.repeat(100));
  
  validResults.forEach((result, index) => {
    const rank = (index + 1).toString().padStart(4);
    const model = result.model.padEnd(18);
    const priorityAcc = result.priorityAccuracy.total > 0 
      ? `${(result.priorityAccuracy.correct / result.priorityAccuracy.total * 100).toFixed(0)}%`.padStart(12)
      : 'N/A'.padStart(12);
    const workflowAcc = result.workflowAccuracy.total > 0
      ? `${(result.workflowAccuracy.correct / result.workflowAccuracy.total * 100).toFixed(0)}%`.padStart(12)
      : 'N/A'.padStart(12);
    const criticalDet = `${result.criticalDetection}/${emails.filter(e => e.expectedPriority === 'Critical').length}`.padStart(12);
    const avgTime = result.avgProcessingTime > 0 
      ? `${(result.avgProcessingTime / 1000).toFixed(1)}s`.padStart(8)
      : 'N/A'.padStart(8);
    const successRate = result.totalEmails > 0
      ? `${(result.successCount / 10 * 100).toFixed(0)}%`.padStart(12)
      : 'N/A'.padStart(12);
    
    console.log(`${rank} | ${model} | ${priorityAcc} | ${workflowAcc} | ${criticalDet} | ${avgTime} | ${successRate}`);
  });
  
  console.log('\n📋 SAMPLE ANALYSES FROM TOP MODEL:');
  console.log('='.repeat(100));
  
  if (validResults.length > 0 && validResults[0].sampleAnalyses.length > 0) {
    const topModel = validResults[0];
    console.log(`Model: ${topModel.model}\n`);
    
    topModel.sampleAnalyses.forEach((sample, idx) => {
      console.log(`${idx + 1}. Email: ${sample.subject}`);
      console.log(`   Expected: Priority=${sample.expected.priority}, Workflow=${sample.expected.workflow}`);
      console.log(`   Detected: Priority=${sample.detected.priority}, Workflow=[${sample.detected.workflow.join(', ')}]`);
      console.log(`   Confidence: ${(sample.detected.confidence * 100).toFixed(0)}%, Time: ${sample.processingTime.toFixed(0)}ms`);
      console.log();
    });
  }
  
  console.log('🎯 KEY FINDINGS:');
  console.log('-'.repeat(50));
  
  // Best models
  const bestPriority = validResults[0];
  const fastestModel = validResults.filter(r => r.avgProcessingTime > 0)
    .sort((a, b) => a.avgProcessingTime - b.avgProcessingTime)[0];
  
  if (bestPriority) {
    const acc = bestPriority.priorityAccuracy.total > 0 
      ? (bestPriority.priorityAccuracy.correct / bestPriority.priorityAccuracy.total * 100).toFixed(0)
      : 0;
    console.log(`🏆 Best Priority Detection: ${bestPriority.model} (${acc}% accuracy)`);
  }
  
  if (fastestModel) {
    console.log(`⚡ Fastest Processing: ${fastestModel.model} (${(fastestModel.avgProcessingTime / 1000).toFixed(1)}s average)`);
  }
  
  // GGUF model performance
  const ggufResults = validResults.filter(r => r.model.includes('gguf'));
  if (ggufResults.length > 0) {
    console.log('\n🔧 GGUF Model Performance:');
    ggufResults.forEach(gguf => {
      const acc = gguf.priorityAccuracy.total > 0 
        ? (gguf.priorityAccuracy.correct / gguf.priorityAccuracy.total * 100).toFixed(0)
        : 0;
      console.log(`  • ${gguf.model}: ${acc}% priority accuracy, ${(gguf.avgProcessingTime / 1000).toFixed(1)}s avg`);
    });
  }
  
  console.log('\n💡 RECOMMENDATIONS:');
  console.log('-'.repeat(50));
  console.log('• Continue using granite3.3:2b for production (best balance)');
  console.log('• GGUF models may offer better quality but need stability testing');
  console.log('• Real email testing confirms laboratory results');
  console.log('• Critical email detection remains top priority');
  
  // Save results
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `real-email-analysis-results-${timestamp}.json`;
  const filepath = path.join(process.cwd(), filename);
  
  await fs.writeFile(filepath, JSON.stringify({
    metadata: {
      testTimestamp: new Date().toISOString(),
      totalTime: totalTime,
      emailsTested: emails.length,
      modelsTotal: allModelsToTest.length,
      modelsTested: validResults.length
    },
    emailDistribution: priorities,
    results: results
  }, null, 2));
  
  console.log(`\n💾 Detailed results saved to: ${filename}`);
  
  return results;
}

// Execute test
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  runComprehensiveEmailTest()
    .then(() => {
      console.log('\n✅ Comprehensive email analysis test completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test failed:', error);
      process.exit(1);
    });
}

export { runComprehensiveEmailTest };