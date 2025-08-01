#!/usr/bin/env tsx
/**
 * Run Test Emails from Batch Files with Optimized Prompts
 * Uses actual emails from test_emails_batch_*.json files
 */

import Database from "better-sqlite3";
import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load optimized prompts
const LLAMA_PROMPT = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../prompts/optimized/llama32_3b_prompt.json'), 'utf-8')
).prompt;

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

async function callOllama(model: string, prompt: string, timeout: number = 120000) {
  try {
    const response = await axios.post(
      'http://localhost:11434/api/generate',
      {
        model,
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

async function analyzeEmail(email: any, phase: number) {
  const startTime = Date.now();
  
  try {
    let analysis: any;
    let model: string;
    let prompt: string;
    
    if (phase === 2) {
      // Phase 2: Llama 3.2:3b
      model = 'llama3.2:3b';
      prompt = LLAMA_PROMPT + `\n\nSubject: ${email.Subject}\n\nBody: ${email.BodyText || email.Body}`;
      console.log(`    🔍 Running Phase 2 analysis with ${model}...`);
    } else {
      // Phase 3: doomgrave/phi-4
      model = 'doomgrave/phi-4:14b-tools-Q3_K_S';
      const emailContent = `\n\nSubject: ${email.Subject}\n\nBody: ${email.BodyText || email.Body}`;
      prompt = PHI4_PROMPT.replace('Email to analyze:', `Email to analyze:${emailContent}`);
      console.log(`    🔬 Running Phase 3 analysis with ${model}...`);
    }
    
    analysis = await callOllama(model, prompt, phase === 3 ? 180000 : 60000);
    const processingTime = Date.now() - startTime;
    
    console.log(`    ✅ Analysis complete in ${(processingTime / 1000).toFixed(1)}s`);
    
    return {
      ...analysis,
      model,
      processing_time_ms: processingTime
    };
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`    ❌ Analysis failed after ${(processingTime / 1000).toFixed(1)}s`);
    throw error;
  }
}

async function processEmails() {
  console.log('🚀 Running Test Emails from Batch Files with Optimized Prompts\n');
  
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
  let phase2Count = 0;
  let phase3Count = 0;
  
  for (const [index, email] of testEmails.entries()) {
    const emailId = email.MessageID || email.id || `test-email-${index + 1}`;
    console.log(`\n[${index + 1}/${testEmails.length}] Processing ${emailId}`);
    console.log(`   📧 ${email.Subject?.substring(0, 60)}...`);
    
    try {
      // Phase 1: Quick Classification (rule-based)
      console.log(`   🏃 Running Phase 1 (rule-based) analysis...`);
      const quickAnalysis = {
        quick_workflow: email.Subject?.toLowerCase().includes('re:') ? 'IN_PROGRESS' : 'START_POINT',
        quick_priority: email.Subject?.toLowerCase().includes('urgent') ? 'HIGH' : 'MEDIUM',
        quick_intent: 'REQUEST',
        quick_urgency: email.Subject?.toLowerCase().includes('asap') ? 'HIGH' : 'MEDIUM',
        quick_confidence: 0.85,
        quick_suggested_state: 'NEW',
        quick_model: 'rule-based',
        quick_processing_time: 50
      };
      
      // Determine if email needs Phase 2/3
      const needsDeepAnalysis = quickAnalysis.quick_priority === 'HIGH' || 
                               quickAnalysis.quick_workflow === 'IN_PROGRESS';
      
      let deepAnalysis = null;
      let finalAnalysis = null;
      
      if (needsDeepAnalysis || index < 10) { // Force deep analysis for first 10 emails
        // Phase 2: Llama 3.2:3b
        try {
          deepAnalysis = await analyzeEmail(email, 2);
          phase2Count++;
          
          // Check if needs Phase 3 (critical emails or first 5)
          if (deepAnalysis.priority === 'CRITICAL' || deepAnalysis.priority === 'HIGH' || index < 5) {
            finalAnalysis = await analyzeEmail(email, 3);
            phase3Count++;
          }
        } catch (error) {
          console.error(`   ❌ Deep analysis failed: ${error}`);
        }
      }
      
      // Prepare database record
      const analysisId = uuidv4();
      const now = new Date().toISOString();
      
      // Check if record exists
      const existing = db.prepare('SELECT id FROM email_analysis WHERE email_id = ?').get(emailId) as any;
      const recordId = existing?.id || analysisId;
      
      // Use INSERT OR REPLACE
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO email_analysis (
          id, email_id, 
          quick_workflow, quick_priority, quick_intent, quick_urgency,
          quick_confidence, quick_suggested_state, quick_model, quick_processing_time,
          deep_workflow_primary, deep_priority, deep_entities, deep_action_items,
          deep_suggested_response, deep_confidence, deep_model, deep_processing_time,
          final_summary, final_entities, final_action_items, final_sla_status,
          final_business_impact, final_suggested_response, final_model, final_processing_time,
          created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
      `);
      
      stmt.run(
        recordId,
        emailId,
        // Quick analysis
        quickAnalysis.quick_workflow,
        quickAnalysis.quick_priority,
        quickAnalysis.quick_intent,
        quickAnalysis.quick_urgency,
        quickAnalysis.quick_confidence,
        quickAnalysis.quick_suggested_state,
        quickAnalysis.quick_model,
        quickAnalysis.quick_processing_time,
        // Deep analysis (Phase 2)
        deepAnalysis?.workflow_state || null,
        deepAnalysis?.priority || null,
        deepAnalysis ? JSON.stringify(deepAnalysis.entities || {}) : null,
        deepAnalysis ? JSON.stringify(deepAnalysis.action_items || []) : null,
        deepAnalysis?.suggested_response || null,
        deepAnalysis?.confidence || null,
        deepAnalysis?.model || null,
        deepAnalysis?.processing_time_ms || null,
        // Final analysis (Phase 3)
        finalAnalysis ? (finalAnalysis.executive_summary || finalAnalysis.contextual_summary) : null,
        finalAnalysis ? JSON.stringify(finalAnalysis.entities || {}) : null,
        finalAnalysis ? JSON.stringify(finalAnalysis.action_items || []) : null,
        finalAnalysis?.sla_status || null,
        finalAnalysis?.business_impact || null,
        finalAnalysis?.suggested_response || null,
        finalAnalysis?.model || null,
        finalAnalysis?.processing_time_ms || null,
        // Timestamps
        existing ? existing.created_at : now,
        now
      );
      
      console.log(`   ✅ Analysis saved (${existing ? 'REPLACED' : 'NEW'})`);
      successCount++;
      
      // Log key findings
      if (deepAnalysis) {
        console.log(`   📊 Phase 2 Results:`);
        console.log(`      - Workflow: ${deepAnalysis.workflow_state}`);
        console.log(`      - Priority: ${deepAnalysis.priority}`);
        const entityCount = Object.values(deepAnalysis.entities || {})
          .reduce((sum: number, arr: any) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
        console.log(`      - Entities: ${entityCount} found`);
      }
      
      if (finalAnalysis) {
        console.log(`   🔬 Phase 3 Results:`);
        console.log(`      - SLA Status: ${finalAnalysis.sla_status || 'N/A'}`);
        console.log(`      - Business Impact: ${finalAnalysis.business_impact ? 'Identified' : 'None'}`);
        console.log(`      - Confidence: ${finalAnalysis.confidence || 'N/A'}`);
      }
      
    } catch (error) {
      console.error(`   ❌ Failed to process email: ${error}`);
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('ANALYSIS COMPLETE');
  console.log('='.repeat(60));
  console.log(`Total emails processed: ${successCount}/${testEmails.length}`);
  console.log(`Phase 2 analyses (Llama 3.2:3b): ${phase2Count}`);
  console.log(`Phase 3 analyses (doomgrave/phi-4): ${phase3Count}`);
  console.log(`\nDatabase: crewai.db`);
  console.log(`Table: email_analysis`);
  
  // Show sample results
  console.log('\nSample Analysis Results:');
  const samples = db.prepare(`
    SELECT email_id, quick_priority, deep_priority, final_model
    FROM email_analysis
    WHERE deep_priority IS NOT NULL
    LIMIT 5
  `).all();
  
  samples.forEach((s: any) => {
    console.log(`- ${s.email_id}: Quick=${s.quick_priority}, Deep=${s.deep_priority}, Model=${s.final_model || 'Phase2'}`);
  });
  
  // Close database
  db.close();
}

// Run the analysis
processEmails().catch(console.error);