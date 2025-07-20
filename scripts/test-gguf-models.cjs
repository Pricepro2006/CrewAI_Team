#!/usr/bin/env node
/**
 * GGUF Model Testing
 * Tests GGUF models on real TD SYNNEX emails
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// GGUF models to test
const ggufModels = [
  {
    name: 'hf.co/bartowski/Meta-Llama-3.1-8B-Instruct-GGUF:latest',
    alias: 'llama3.1-8b-gguf'
  },
  {
    name: 'hf.co/unsloth/DeepSeek-R1-0528-Qwen3-8B-GGUF:latest',
    alias: 'deepseek-r1-gguf'
  }
];

// Compare with best non-GGUF model
const comparisonModel = 'granite3.3:2b';

async function loadRealEmails() {
  const dataPath = path.join(process.cwd(), 'data', 'sample_email_data.json');
  const data = fs.readFileSync(dataPath, 'utf-8');
  const parsed = JSON.parse(data);
  return parsed.email_dashboard_data.emails;
}

async function analyzeWithOllama(model, prompt) {
  try {
    const response = await axios.post('http://localhost:11434/api/generate', {
      model: model,
      prompt: prompt,
      format: 'json',
      stream: false,
      options: {
        temperature: 0.1,
        num_predict: 200
      }
    }, {
      timeout: 30000 // 30 second timeout for GGUF models
    });
    
    return JSON.parse(response.data.response);
  } catch (error) {
    console.error(`Error with ${model}:`, error.message);
    return null;
  }
}

async function testGGUFModels() {
  console.log('🔧 GGUF MODEL TESTING ON REAL EMAILS\n');
  
  // Load emails
  const emails = await loadRealEmails();
  console.log(`Loaded ${emails.length} real TD SYNNEX emails`);
  
  // Get test set
  const criticalEmails = emails.filter(e => e.priority === 'Critical').slice(0, 3);
  const highEmails = emails.filter(e => e.priority === 'High').slice(0, 2);
  const testEmails = [...criticalEmails, ...highEmails];
  
  console.log(`\nTest Set: ${criticalEmails.length} Critical + ${highEmails.length} High priority emails\n`);
  
  const results = [];
  
  // Test comparison model first
  console.log(`Baseline: Testing ${comparisonModel}...`);
  console.log('='.repeat(80));
  
  let baselineCorrect = 0;
  const baselineTimes = [];
  
  for (const email of testEmails) {
    const prompt = `Analyze this TD SYNNEX business email priority.

Subject: ${email.subject}
Content: ${email.summary}

Classify the priority as: Critical, High, Medium, or Low

Respond with JSON: {"priority": "...", "confidence": 0.0-1.0}`;
    
    const startTime = Date.now();
    const result = await analyzeWithOllama(comparisonModel, prompt);
    const endTime = Date.now();
    
    if (result) {
      const correct = result.priority === email.priority;
      if (correct) baselineCorrect++;
      baselineTimes.push(endTime - startTime);
      
      const icon = correct ? '✅' : '❌';
      console.log(`${icon} ${email.subject.substring(0, 50)}...`);
      console.log(`   Expected: ${email.priority}, Got: ${result.priority} (${endTime - startTime}ms)`);
    }
  }
  
  const baselineAccuracy = (baselineCorrect / testEmails.length * 100).toFixed(0);
  const baselineAvgTime = baselineTimes.reduce((a, b) => a + b, 0) / baselineTimes.length;
  
  results.push({
    model: comparisonModel,
    type: 'Standard',
    accuracy: parseInt(baselineAccuracy),
    avgTime: baselineAvgTime,
    correct: baselineCorrect,
    total: testEmails.length
  });
  
  // Test GGUF models
  for (const ggufModel of ggufModels) {
    console.log(`\n\nGGUF Model: Testing ${ggufModel.alias}...`);
    console.log('='.repeat(80));
    
    let correctCount = 0;
    const times = [];
    const detailedResults = [];
    
    for (const email of testEmails) {
      const prompt = `Analyze this TD SYNNEX business email priority.

Subject: ${email.subject}
Content: ${email.summary}

Classify the priority as: Critical, High, Medium, or Low

Respond with JSON: {"priority": "...", "confidence": 0.0-1.0}`;
      
      console.log(`\nTesting: ${email.subject.substring(0, 50)}...`);
      const startTime = Date.now();
      const result = await analyzeWithOllama(ggufModel.name, prompt);
      const endTime = Date.now();
      
      if (result) {
        const correct = result.priority === email.priority;
        if (correct) correctCount++;
        times.push(endTime - startTime);
        
        detailedResults.push({
          subject: email.subject,
          expected: email.priority,
          detected: result.priority,
          confidence: result.confidence || 0,
          correct: correct,
          time: endTime - startTime
        });
        
        const icon = correct ? '✅' : '❌';
        console.log(`${icon} Expected: ${email.priority}, Got: ${result.priority}`);
        console.log(`   Confidence: ${((result.confidence || 0) * 100).toFixed(0)}%, Time: ${endTime - startTime}ms`);
      } else {
        console.log('❌ Failed to get response');
      }
    }
    
    const accuracy = (correctCount / testEmails.length * 100).toFixed(0);
    const avgTime = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
    
    results.push({
      model: ggufModel.alias,
      type: 'GGUF',
      accuracy: parseInt(accuracy),
      avgTime: avgTime,
      correct: correctCount,
      total: testEmails.length,
      details: detailedResults
    });
  }
  
  // Final comparison
  console.log('\n\n' + '='.repeat(100));
  console.log('📊 GGUF vs STANDARD MODEL COMPARISON');
  console.log('='.repeat(100));
  console.log('\nModel                    | Type     | Accuracy | Avg Time  | Performance');
  console.log('-'.repeat(100));
  
  results.forEach(r => {
    const model = r.model.padEnd(23);
    const type = r.type.padEnd(8);
    const accuracy = `${r.accuracy}%`.padStart(8);
    const avgTime = `${(r.avgTime / 1000).toFixed(1)}s`.padStart(9);
    const perf = r.accuracy >= 60 ? '✅ Good' : '❌ Poor';
    
    console.log(`${model} | ${type} | ${accuracy} | ${avgTime} | ${perf}`);
  });
  
  // Analysis
  console.log('\n\n🎯 GGUF MODEL ANALYSIS:');
  console.log('-'.repeat(50));
  
  const ggufResults = results.filter(r => r.type === 'GGUF');
  if (ggufResults.length > 0) {
    // Best GGUF
    const bestGGUF = ggufResults.sort((a, b) => b.accuracy - a.accuracy)[0];
    console.log(`\n✅ Best GGUF Model: ${bestGGUF.model}`);
    console.log(`   - Accuracy: ${bestGGUF.accuracy}%`);
    console.log(`   - Average Time: ${(bestGGUF.avgTime / 1000).toFixed(1)}s`);
    console.log(`   - Critical Email Detection: ${bestGGUF.correct}/${bestGGUF.total}`);
    
    // Comparison to baseline
    const baseline = results.find(r => r.model === comparisonModel);
    const accuracyDiff = bestGGUF.accuracy - baseline.accuracy;
    const timeDiff = ((bestGGUF.avgTime - baseline.avgTime) / baseline.avgTime * 100).toFixed(0);
    
    console.log(`\n📈 Compared to ${comparisonModel}:`);
    console.log(`   - Accuracy: ${accuracyDiff >= 0 ? '+' : ''}${accuracyDiff}%`);
    console.log(`   - Speed: ${timeDiff}% ${timeDiff > 0 ? 'slower' : 'faster'}`);
    
    // Show sample outputs
    if (bestGGUF.details && bestGGUF.details.length > 0) {
      console.log(`\n📋 Sample ${bestGGUF.model} Classifications:`);
      bestGGUF.details.slice(0, 3).forEach((d, idx) => {
        console.log(`\n${idx + 1}. ${d.subject.substring(0, 60)}...`);
        console.log(`   Expected: ${d.expected}, Got: ${d.detected} ${d.correct ? '✅' : '❌'}`);
        console.log(`   Confidence: ${(d.confidence * 100).toFixed(0)}%`);
      });
    }
  }
  
  // Recommendations
  console.log('\n\n💡 RECOMMENDATIONS:');
  console.log('-'.repeat(50));
  
  if (ggufResults.some(r => r.accuracy >= 80)) {
    console.log('✅ GGUF models show promise for email classification');
    console.log('✅ Consider using for higher-quality analysis when speed allows');
  } else if (ggufResults.some(r => r.accuracy >= 60)) {
    console.log('⚠️  GGUF models show moderate performance');
    console.log('⚠️  May be useful for specific use cases or with fine-tuning');
  } else {
    console.log('❌ GGUF models underperform compared to granite3.3:2b');
    console.log('❌ Recommend continuing with standard models for now');
  }
  
  console.log('\n📊 For production use:');
  console.log('   - Critical emails: Use multiple models for validation');
  console.log('   - High-volume: Stick with granite3.3:2b for speed');
  console.log('   - Quality focus: Consider GGUF models despite speed penalty');
  
  // Save results
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `gguf-model-test-results-${timestamp}.json`;
  fs.writeFileSync(filename, JSON.stringify({
    testDate: new Date().toISOString(),
    emailCount: emails.length,
    testSetSize: testEmails.length,
    results: results
  }, null, 2));
  
  console.log(`\n💾 Results saved to: ${filename}`);
}

// Execute
testGGUFModels()
  .then(() => {
    console.log('\n✅ GGUF model testing completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });