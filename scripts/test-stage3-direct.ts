#!/usr/bin/env tsx
/**
 * Direct test of Stage 3 Critical Analysis with Phi-4
 */

import { Stage3CriticalAnalysis } from '../src/core/pipeline/Stage3CriticalAnalysis.js';
import fs from 'fs';

async function testStage3Direct() {
  console.log('🚀 Testing Stage 3 Critical Analysis with Phi-4\n');
  
  try {
    // Load 3 test emails
    const testBatch = JSON.parse(
      fs.readFileSync('/home/pricepro2006/CrewAI_Team/data/email-batches/test_emails_batch_1.json', 'utf-8')
    );
    
    // Take first 3 emails
    const testEmails = testBatch.slice(0, 3).map((email: any, index: number) => ({
      id: email.MessageID || `test_${index}`,
      subject: email.Subject || '',
      body: email.BodyText || '',
      sender_email: email.SenderEmail || 'unknown@email.com'
    }));
    
    console.log(`📧 Testing with ${testEmails.length} emails:\n`);
    testEmails.forEach((email: any, i: number) => {
      console.log(`${i + 1}. ${email.subject.substring(0, 50)}...`);
    });
    
    // Create Stage 3 analyzer
    const stage3 = new Stage3CriticalAnalysis();
    
    console.log('\n🔬 Running Phi-4 critical analysis...\n');
    
    // Process emails
    const startTime = Date.now();
    const results = await stage3.process(testEmails);
    
    const totalTime = (Date.now() - startTime) / 1000;
    
    console.log('\n✅ Stage 3 Analysis Complete!');
    console.log(`⏱️  Total time: ${totalTime.toFixed(1)}s`);
    console.log(`📊 Results:\n`);
    
    results.forEach((result: any, i: number) => {
      console.log(`Email ${i + 1}:`);
      console.log(`  - Model used: ${result.modelUsed}`);
      console.log(`  - Quality score: ${result.qualityScore}/10`);
      console.log(`  - Processing time: ${result.processingTime.toFixed(1)}s`);
      console.log(`  - Executive summary: ${result.executiveSummary.substring(0, 100)}...`);
      console.log(`  - Recommendations: ${result.recommendedActions.length} actions`);
      console.log();
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testStage3Direct().catch(console.error);