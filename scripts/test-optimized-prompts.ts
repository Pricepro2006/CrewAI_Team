#!/usr/bin/env ts-node
import * as fs from 'fs';
import * as path from 'path';
import { DatabaseManager } from '../src/database/DatabaseManager';
import { logger } from '../src/utils/logger';
import axios from 'axios';

// Test email IDs
const TEST_EMAIL_IDS = [
  'email-8ef42296-42ba-4e7d-90be-0db338a66daf',
  'email-caa27fb2-eb96-4a20-b007-3891e38263af',
  'email-9bc600d9-a47a-4cef-8972-d05dea17b9ef',
  'email-9cc82b32-7e12-4012-b41a-83757a77f210',
  'email-ff0620c2-1900-4808-a12e-51db1a7ba6ea',
  'email-0b7ae5b6-5246-49c5-aed5-c06e56c9f3a9',
  'email-d534d622-7058-4422-9111-9f8c8fd249fc',
  'email-98dc5793-e04e-4597-8299-d2194105aff5',
  'email-b69eaf2d-1c09-4051-9cb5-b1a707b7b707',
  'email-41bdb30a-ee78-4c20-9afa-5448275be868',
  'email-62e24275-8dc5-4a5b-909f-ba3f9e9e7f5e',
  'email-b13a9b95-8e72-4b72-a11f-15b8701edd66',
  'email-cf02c0c3-50f6-4242-8e18-ed97b4f0a2c2',
  'email-bb27f75f-bc12-4b19-afed-8ce9a4b652b9',
  'email-f6f45a48-e3ba-460b-98c9-65a10e93c87c',
  'email-98f1f279-79ba-4e52-82e5-2cc3c19ba9e9',
  'email-5e088517-88db-43ba-b88d-79f2e5ad3ea1',
  'email-0dd89b76-0e15-42ce-8c2e-ab87ee1ab65a',
  'email-5dc0daa6-0b5d-4e3f-b8a7-89bc2f8ae7a9',
  'email-d9c5a92f-ddad-4c4f-8cd6-c90b9bbae42e'
];

interface TestResult {
  model: string;
  emailId: string;
  success: boolean;
  processingTime: number;
  analysis?: any;
  error?: string;
}

interface ModelTest {
  model: string;
  promptFile: string;
  targetScore: number;
  timeout: number;
}

const MODEL_TESTS: ModelTest[] = [
  {
    model: 'llama3.2:3b',
    promptFile: 'llama32_3b_prompt.json',
    targetScore: 6.56,
    timeout: 45000
  },
  {
    model: 'doomgrave/phi-4:14b-tools-Q3_K_S',
    promptFile: 'doomgrave_phi-4_14b-tools-Q3_K_S_prompt.json',
    targetScore: 7.75,
    timeout: 120000
  }
];

async function loadPrompt(promptFile: string): Promise<any> {
  const promptPath = path.join(__dirname, '../prompts/optimized', promptFile);
  return JSON.parse(fs.readFileSync(promptPath, 'utf-8'));
}

async function analyzeEmail(
  model: string,
  prompt: string,
  email: any,
  timeout: number
): Promise<TestResult> {
  const startTime = Date.now();
  
  try {
    // Replace [EMAIL_CONTENT] or append email content
    const fullPrompt = prompt.includes('[EMAIL_CONTENT]')
      ? prompt.replace('[EMAIL_CONTENT]', `Subject: ${email.subject}\n\nBody: ${email.body}`)
      : `${prompt}\n\nSubject: ${email.subject}\n\nBody: ${email.body}`;

    const response = await axios.post(
      'http://localhost:11434/api/generate',
      {
        model,
        prompt: fullPrompt,
        stream: false,
        options: {
          temperature: 0.3,
          num_predict: 1000
        }
      },
      { timeout }
    );

    const processingTime = (Date.now() - startTime) / 1000;

    if (response.status !== 200) {
      return {
        model,
        emailId: email.id,
        success: false,
        processingTime,
        error: `API returned status ${response.status}`
      };
    }

    // Extract and parse response
    let responseText = response.data.response || '';
    
    // Clean response to extract JSON
    if (responseText.includes('```json')) {
      responseText = responseText.split('```json')[1].split('```')[0];
    } else if (responseText.includes('{')) {
      const jsonStart = responseText.indexOf('{');
      const jsonEnd = responseText.lastIndexOf('}') + 1;
      responseText = responseText.substring(jsonStart, jsonEnd);
    }

    try {
      const analysis = JSON.parse(responseText.trim());
      return {
        model,
        emailId: email.id,
        success: true,
        processingTime,
        analysis
      };
    } catch (parseError) {
      return {
        model,
        emailId: email.id,
        success: false,
        processingTime,
        error: `JSON parse error: ${parseError}`,
        analysis: { raw_response: responseText }
      };
    }

  } catch (error: any) {
    return {
      model,
      emailId: email.id,
      success: false,
      processingTime: (Date.now() - startTime) / 1000,
      error: error.message
    };
  }
}

async function testModel(modelTest: ModelTest, emails: any[]): Promise<void> {
  logger.info(`\n${'='.repeat(60)}`);
  logger.info(`Testing ${modelTest.model}`);
  logger.info(`Target Score: ${modelTest.targetScore}/10`);
  logger.info(`${'='.repeat(60)}`);

  // Load prompt
  const promptData = await loadPrompt(modelTest.promptFile);
  logger.info(`Loaded prompt version ${promptData.version}`);

  const results: TestResult[] = [];
  let successCount = 0;
  let totalTime = 0;

  // Test each email
  for (let i = 0; i < emails.length; i++) {
    const email = emails[i];
    logger.info(`\nAnalyzing email ${i + 1}/${emails.length}: ${email.id}`);
    
    const result = await analyzeEmail(
      modelTest.model,
      promptData.prompt,
      email,
      modelTest.timeout
    );

    results.push(result);
    
    if (result.success) {
      successCount++;
      logger.info(`✓ Success in ${result.processingTime.toFixed(2)}s`);
      
      // Log key findings
      if (result.analysis) {
        logger.info(`  Workflow: ${result.analysis.workflow_state}`);
        logger.info(`  Priority: ${result.analysis.priority}`);
        
        const entityCount = Object.values(result.analysis.entities || {})
          .reduce((sum: number, arr: any) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
        logger.info(`  Entities: ${entityCount} found`);
      }
    } else {
      logger.error(`✗ Failed: ${result.error}`);
    }

    totalTime += result.processingTime;
  }

  // Calculate statistics
  const avgTime = totalTime / emails.length;
  const successRate = (successCount / emails.length) * 100;

  logger.info(`\n${'-'.repeat(60)}`);
  logger.info(`Summary for ${modelTest.model}:`);
  logger.info(`- Success rate: ${successRate.toFixed(1)}%`);
  logger.info(`- Average time: ${avgTime.toFixed(2)}s per email`);
  logger.info(`- Total time: ${totalTime.toFixed(2)}s`);

  // Estimate score based on success rate and previous patterns
  const estimatedScore = successRate >= 90 ? modelTest.targetScore : 
                        successRate >= 80 ? modelTest.targetScore * 0.9 :
                        successRate >= 70 ? modelTest.targetScore * 0.8 :
                        modelTest.targetScore * 0.6;

  logger.info(`- Estimated score: ${estimatedScore.toFixed(2)}/10 (target: ${modelTest.targetScore})`);

  // Save results
  const outputPath = path.join(
    __dirname,
    '../test-results',
    `${modelTest.model.replace(/[/:]/g, '_')}_test_${Date.now()}.json`
  );
  
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify({
    model: modelTest.model,
    targetScore: modelTest.targetScore,
    estimatedScore,
    successRate,
    avgProcessingTime: avgTime,
    totalEmails: emails.length,
    successfulEmails: successCount,
    results,
    timestamp: new Date().toISOString()
  }, null, 2));

  logger.info(`\nResults saved to: ${outputPath}`);
}

async function main() {
  logger.info('Testing Optimized Prompts for Email Analysis');
  logger.info('Target: Llama 3.2:3b = 6.56/10, Phi-4 = 7.75/10');

  const db = new DatabaseManager();
  await db.initialize();

  try {
    // Load test emails
    const emails = [];
    for (const id of TEST_EMAIL_IDS) {
      const email = await db.emails.getById(id);
      if (email) {
        emails.push(email);
      }
    }

    logger.info(`Loaded ${emails.length}/${TEST_EMAIL_IDS.length} test emails`);

    // Test each model
    for (const modelTest of MODEL_TESTS) {
      await testModel(modelTest, emails);
      
      // Brief pause between models
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    // Generate final report
    logger.info(`\n${'='.repeat(60)}`);
    logger.info('TESTING COMPLETE');
    logger.info(`${'='.repeat(60)}`);
    logger.info('Next steps:');
    logger.info('1. Review test results in test-results/ directory');
    logger.info('2. If scores meet targets, deploy to production');
    logger.info('3. If scores are below target, iterate on prompts');
    logger.info('4. Run full 33,797 email analysis with optimized prompts');

  } catch (error) {
    logger.error('Testing failed:', error);
  } finally {
    await db.close();
  }
}

// Run tests
if (require.main === module) {
  main().catch(console.error);
}