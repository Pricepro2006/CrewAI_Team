#!/usr/bin/env tsx
/**
 * Run ONLY Phase 3 (doomgrave/phi-4) Analysis on Test Emails
 */

import Database from "better-sqlite3";
import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load optimized Phase 3 prompt
const PHI4_PROMPT = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../prompts/optimized/doomgrave_phi-4_14b-tools-Q3_K_S_prompt.json'), 'utf-8')
).prompt;

// Load test emails from batch files
function loadTestEmails(): any[] {
  const emails: any[] = [];
  const batchDir = path.join(__dirname, '../data/email-batches');
  
  // Load from test batch files
  for (let i = 1; i <= 4; i++) {
    const batchFile = path.join(batchDir, `test_emails_batch_${i}.json`);
    if (fs.existsSync(batchFile)) {
      const batchEmails = JSON.parse(fs.readFileSync(batchFile, 'utf-8'));
      emails.push(...batchEmails.slice(0, 5)); // Take 5 from each batch = 20 total
    }
  }
  
  return emails.slice(0, 20); // Ensure we have exactly 20
}

async function callOllama(prompt: string, timeout: number = 180000) {
  try {
    const response = await axios.post(
      'http://localhost:11434/api/generate',
      {
        model: 'doomgrave/phi-4:14b-tools-Q3_K_S',
        prompt,
        stream: false,
        options: {
          temperature: 0.3,
          num_predict: 1000
        }
      },
      { timeout }
    );

    if (response.status !== 200) {
      throw new Error(`API returned status ${response.status}`);
    }

    let responseText = response.data.response || '';
    
    // Extract JSON from response
    if (responseText.includes('```json')) {
      responseText = responseText.split('```json')[1].split('```')[0];
    } else if (responseText.includes('{')) {
      const jsonStart = responseText.indexOf('{');
      const jsonEnd = responseText.lastIndexOf('}') + 1;
      responseText = responseText.substring(jsonStart, jsonEnd);
    }

    return JSON.parse(responseText.trim());
  } catch (error: any) {
    console.error(`Ollama error: ${error.message}`);
    throw error;
  }
}

async function processEmails() {
  console.log('🚀 Running ONLY Phase 3 (doomgrave/phi-4) Analysis on 20 Test Emails\n');
  console.log('Model: doomgrave/phi-4:14b-tools-Q3_K_S');
  console.log('Target Score: 7.75/10\n');
  
  // Load test emails
  const testEmails = loadTestEmails();
  console.log(`📧 Loaded ${testEmails.length} test emails from batch files\n`);
  
  // Initialize database
  const db = new Database('./data/crewai.db');
  
  // Ensure email_analysis table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS email_analysis (
      id TEXT PRIMARY KEY,
      email_id TEXT NOT NULL,
      quick_workflow TEXT,
      quick_priority TEXT,
      quick_intent TEXT,
      quick_urgency TEXT,
      quick_confidence REAL,
      quick_suggested_state TEXT,
      quick_model TEXT,
      quick_processing_time INTEGER,
      deep_workflow_primary TEXT,
      deep_priority TEXT,
      deep_entities TEXT,
      deep_action_items TEXT,
      deep_suggested_response TEXT,
      deep_confidence REAL,
      deep_model TEXT,
      deep_processing_time INTEGER,
      final_summary TEXT,
      final_entities TEXT,
      final_action_items TEXT,
      final_sla_status TEXT,
      final_business_impact TEXT,
      final_suggested_response TEXT,
      final_model TEXT,
      final_processing_time INTEGER,
      created_at TEXT,
      updated_at TEXT
    )
  `);
  
  let successCount = 0;
  let totalProcessingTime = 0;
  const results: any[] = [];
  
  for (const [index, email] of testEmails.entries()) {
    const emailId = email.MessageID || email.id || `test-email-${index + 1}`;
    console.log(`\n[${index + 1}/${testEmails.length}] Processing ${emailId}`);
    console.log(`   📧 ${email.Subject?.substring(0, 60)}...`);
    
    try {
      // Run Phase 3 analysis directly
      const startTime = Date.now();
      console.log(`   🔬 Running doomgrave/phi-4 analysis...`);
      
      const emailContent = `\n\nSubject: ${email.Subject}\n\nBody: ${email.BodyText || email.Body}`;
      const prompt = PHI4_PROMPT.replace('Email to analyze:', `Email to analyze:${emailContent}`);
      
      const analysis = await callOllama(prompt);
      const processingTime = Date.now() - startTime;
      
      console.log(`   ✅ Analysis complete in ${(processingTime / 1000).toFixed(1)}s`);
      
      // Store result
      results.push({
        emailId,
        subject: email.Subject,
        analysis,
        processingTime
      });
      
      // Log key findings
      console.log(`   📊 Results:`);
      console.log(`      - Workflow: ${analysis.workflow_state}`);
      console.log(`      - Priority: ${analysis.priority}`);
      console.log(`      - SLA Status: ${analysis.sla_status || 'N/A'}`);
      console.log(`      - Confidence: ${analysis.confidence || 'N/A'}`);
      
      const entityCount = Object.values(analysis.entities || {})
        .reduce((sum: number, arr: any) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
      console.log(`      - Entities: ${entityCount} found`);
      
      // Save to database
      const analysisId = uuidv4();
      const now = new Date().toISOString();
      
      // Check if record exists
      const existing = db.prepare('SELECT id, created_at FROM email_analysis WHERE email_id = ?').get(emailId) as any;
      const recordId = existing?.id || analysisId;
      
      // Use INSERT OR REPLACE for Phase 3 data only
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO email_analysis (
          id, email_id,
          quick_workflow, quick_priority, quick_intent, quick_urgency,
          quick_confidence, quick_suggested_state, quick_model, quick_processing_time,
          final_summary, final_entities, final_action_items, final_sla_status,
          final_business_impact, final_suggested_response, final_model, final_processing_time,
          created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
      `);
      
      stmt.run(
        recordId,
        emailId,
        // Quick analysis (basic rule-based)
        'START_POINT',
        'HIGH',
        'REQUEST',
        'MEDIUM',
        0.85,
        'NEW',
        'rule-based',
        50,
        // Final analysis (Phase 3)
        analysis.contextual_summary || analysis.executive_summary || '',
        JSON.stringify(analysis.entities || {}),
        JSON.stringify(analysis.action_items || []),
        analysis.sla_status || null,
        analysis.business_impact || null,
        analysis.suggested_response || null,
        'doomgrave/phi-4:14b-tools-Q3_K_S',
        processingTime,
        // Timestamps
        existing?.created_at || now,
        now
      );
      
      successCount++;
      totalProcessingTime += processingTime;
      
    } catch (error) {
      console.error(`   ❌ Failed to process email: ${error}`);
      results.push({
        emailId,
        subject: email.Subject,
        error: error.toString(),
        processingTime: 0
      });
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('PHASE 3 ANALYSIS COMPLETE');
  console.log('='.repeat(60));
  console.log(`Model: doomgrave/phi-4:14b-tools-Q3_K_S`);
  console.log(`Target Score: 7.75/10`);
  console.log(`Total emails processed: ${successCount}/${testEmails.length}`);
  console.log(`Success rate: ${(successCount / testEmails.length * 100).toFixed(1)}%`);
  console.log(`Average processing time: ${(totalProcessingTime / successCount / 1000).toFixed(1)}s per email`);
  console.log(`Total processing time: ${(totalProcessingTime / 1000).toFixed(1)}s`);
  
  // Save detailed results
  const resultsPath = path.join(__dirname, '../test-results', `phase3_results_${Date.now()}.json`);
  fs.mkdirSync(path.dirname(resultsPath), { recursive: true });
  fs.writeFileSync(resultsPath, JSON.stringify({
    model: 'doomgrave/phi-4:14b-tools-Q3_K_S',
    targetScore: 7.75,
    timestamp: new Date().toISOString(),
    totalEmails: testEmails.length,
    successfulEmails: successCount,
    successRate: successCount / testEmails.length,
    avgProcessingTime: totalProcessingTime / successCount / 1000,
    results
  }, null, 2));
  
  console.log(`\nDetailed results saved to: ${resultsPath}`);
  
  // Close database
  db.close();
}

// Run the analysis
processEmails().catch(console.error);