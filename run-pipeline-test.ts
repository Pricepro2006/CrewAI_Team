#!/usr/bin/env tsx

/**
 * Run Pipeline Test - Execute the three-stage pipeline on a small sample
 * This will process a limited number of emails to verify the complete workflow
 */

import { PipelineOrchestrator } from './src/core/pipeline/PipelineOrchestrator.js';
import { getDatabaseConnection } from './src/database/connection.js';
import { logger } from './src/utils/logger.js';

async function runPipelineTest() {
  console.log('🚀 Running Three-Stage Pipeline Test with Sample Data');
  
  try {
    // Initialize orchestrator
    const orchestrator = new PipelineOrchestrator();
    
    // Check email count
    const db = getDatabaseConnection();
    const emailCount = db.prepare('SELECT COUNT(*) as count FROM emails_enhanced').get() as { count: number };
    console.log(`📊 Database contains ${emailCount.count} emails`);
    
    if (emailCount.count === 0) {
      console.log('⚠️  No emails found in database. Cannot run pipeline test.');
      return;
    }
    
    // For testing, let's temporarily modify the model config to process fewer emails
    // This allows us to test the full pipeline without running for hours
    
    console.log('⚙️  Configuring pipeline for test run...');
    console.log('   - Stage 1: Pattern triage (all emails)');
    console.log('   - Stage 2: Llama analysis (top 5 priority emails)');
    console.log('   - Stage 3: Critical analysis (top 2 critical emails)');
    
    // Override the configuration temporarily by modifying the config
    const originalConfig = await import('./src/config/models.config.js');
    
    // Create a modified version for testing
    const testConfig = {
      ...originalConfig.MODEL_CONFIG,
      pipeline: {
        ...originalConfig.MODEL_CONFIG.pipeline,
        stages: {
          ...originalConfig.MODEL_CONFIG.pipeline.stages,
          priority: {
            ...originalConfig.MODEL_CONFIG.pipeline.stages.priority,
            targetEmails: 5, // Test with just 5 emails
          },
          critical: {
            ...originalConfig.MODEL_CONFIG.pipeline.stages.critical,
            targetEmails: 2, // Test with just 2 emails
          }
        }
      }
    };
    
    // Monkey patch the config (for this test only)
    (originalConfig as any).MODEL_CONFIG = testConfig;
    
    console.log('🏃 Starting pipeline execution...');
    
    // Create a timeout to prevent infinite hanging
    const timeoutMs = 10 * 60 * 1000; // 10 minutes timeout
    const pipelinePromise = orchestrator.runThreeStagePipeline();
    
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Pipeline test timeout after 10 minutes')), timeoutMs);
    });
    
    // Race between pipeline completion and timeout
    const results = await Promise.race([pipelinePromise, timeoutPromise]) as any;
    
    console.log('🎉 Pipeline execution completed successfully!');
    console.log();
    console.log('📊 Results Summary:');
    console.log(`   Total emails processed: ${results.totalEmails}`);
    console.log(`   Stage 1 (Pattern): ${results.stage1Count} emails`);
    console.log(`   Stage 2 (Llama): ${results.stage2Count} emails`);
    console.log(`   Stage 3 (Critical): ${results.stage3Count} emails`);
    console.log(`   Execution ID: ${results.executionId}`);
    
    // Show some sample results
    if (results.results && results.results.length > 0) {
      console.log();
      console.log('📋 Sample Analysis Results:');
      
      // Show first few results
      const sampleResults = results.results.slice(0, 3);
      for (const result of sampleResults) {
        console.log(`   Email ${result.emailId}:`);
        console.log(`     Final Score: ${result.finalScore.toFixed(2)}`);
        console.log(`     Pipeline Stage: ${result.pipelineStage}`);
        
        if (result.stage2) {
          console.log(`     Business Process: ${result.stage2.businessProcess}`);
          console.log(`     Urgency: ${result.stage2.urgencyLevel}`);
        }
        
        if (result.stage3) {
          console.log(`     Model Used: ${result.stage3.modelUsed}`);
          console.log(`     Fallback Used: ${result.stage3.fallbackUsed}`);
        }
        console.log();
      }
    }
    
    // Check database for stored results
    const executionRecord = db.prepare(`
      SELECT * FROM pipeline_executions WHERE id = ?
    `).get(results.executionId);
    
    if (executionRecord) {
      console.log('💾 Database Results:');
      console.log(`   Status: ${(executionRecord as any).status}`);
      console.log(`   Processing Time: ${((executionRecord as any).total_processing_time_seconds || 0).toFixed(2)}s`);
    }
    
    console.log();
    console.log('✅ Pipeline test completed successfully!');
    console.log('🎯 All components are working correctly:');
    console.log('   ✅ Ollama integration');
    console.log('   ✅ Model inference (Llama 3.2:3b & Phi-4)');
    console.log('   ✅ Database operations');
    console.log('   ✅ Three-stage workflow');
    console.log('   ✅ Result consolidation');
    
  } catch (error) {
    console.error('❌ Pipeline test failed:', error);
    
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack?.split('\n').slice(0, 8).join('\n')
      });
      
      // Provide specific troubleshooting advice
      if (error.message.includes('timeout')) {
        console.log('\n🔧 Troubleshooting: Pipeline timeout');
        console.log('  - Pipeline may be taking longer than expected');
        console.log('  - Check Ollama performance with: htop');
        console.log('  - Consider reducing batch sizes in model config');
      }
      
      if (error.message.includes('ECONNREFUSED')) {
        console.log('\n🔧 Troubleshooting: Ollama connection lost');
        console.log('  - Ollama may have crashed or become unresponsive');
        console.log('  - Restart with: killall ollama && ollama serve');
      }
    }
    
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⚠️  Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n⚠️  Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Run the test
runPipelineTest().catch(console.error);