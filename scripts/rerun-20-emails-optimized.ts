#!/usr/bin/env tsx
/**
 * Re-run 20 Test Emails with Optimized Prompts
 * This will REPLACE existing entries to avoid duplicates
 */

import Database from "better-sqlite3";
import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Load optimized prompts
const LLAMA_PROMPT = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../prompts/optimized/llama32_3b_prompt.json'), 'utf-8')
).prompt;

const PHI4_PROMPT = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../prompts/optimized/doomgrave_phi-4_14b-tools-Q3_K_S_prompt.json'), 'utf-8')
).prompt;

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
      prompt = LLAMA_PROMPT + `\n\nSubject: ${email.subject}\n\nBody: ${email.body}`;
      console.log(`    🔍 Running Phase 2 analysis with ${model}...`);
    } else {
      // Phase 3: doomgrave/phi-4
      model = 'doomgrave/phi-4:14b-tools-Q3_K_S';
      const emailContent = `\n\nSubject: ${email.subject}\n\nBody: ${email.body}`;
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
  console.log('🚀 Re-running 20 Test Emails with Optimized Prompts\n');
  console.log('⚠️  This will REPLACE existing entries to avoid duplicates\n');
  
  // Initialize database
  const db = new Database('./data/crewai.db');
  
  // Check for existing analysis records
  const existingCount = db.prepare(`
    SELECT COUNT(*) as count 
    FROM email_analysis 
    WHERE email_id IN (${TEST_EMAIL_IDS.map(() => '?').join(',')})
  `).get(...TEST_EMAIL_IDS) as { count: number };
  
  console.log(`📊 Found ${existingCount.count} existing analysis records for test emails`);
  console.log('   These will be REPLACED with new analysis\n');
  
  let successCount = 0;
  let phase2Count = 0;
  let phase3Count = 0;
  
  for (const [index, emailId] of TEST_EMAIL_IDS.entries()) {
    console.log(`\n[${index + 1}/20] Processing ${emailId}`);
    
    // Get email from database
    const email = db.prepare(`
      SELECT id, subject, body, sender_email, received_at
      FROM emails
      WHERE id = ?
    `).get(emailId) as any;
    
    if (!email) {
      console.log(`   ⚠️  Email not found in database`);
      continue;
    }
    
    console.log(`   📧 ${email.subject?.substring(0, 60)}...`);
    
    try {
      // Phase 1: Quick Classification (rule-based)
      console.log(`   🏃 Running Phase 1 (rule-based) analysis...`);
      const quickAnalysis = {
        quick_workflow: email.subject?.toLowerCase().includes('re:') ? 'IN_PROGRESS' : 'START_POINT',
        quick_priority: email.subject?.toLowerCase().includes('urgent') ? 'HIGH' : 'MEDIUM',
        quick_intent: 'REQUEST',
        quick_urgency: email.subject?.toLowerCase().includes('asap') ? 'HIGH' : 'MEDIUM',
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
      
      if (needsDeepAnalysis) {
        // Phase 2: Llama 3.2:3b
        try {
          deepAnalysis = await analyzeEmail(email, 2);
          phase2Count++;
          
          // Check if needs Phase 3 (critical emails)
          if (deepAnalysis.priority === 'CRITICAL' || deepAnalysis.priority === 'HIGH') {
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
      
      // Use INSERT OR REPLACE to overwrite existing records
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
      
      // First check if record exists to get the ID
      const existing = db.prepare('SELECT id FROM email_analysis WHERE email_id = ?').get(emailId) as any;
      const recordId = existing?.id || analysisId;
      
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
      
    } catch (error) {
      console.error(`   ❌ Failed to process email: ${error}`);
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('ANALYSIS COMPLETE');
  console.log('='.repeat(60));
  console.log(`Total emails processed: ${successCount}/20`);
  console.log(`Phase 2 analyses (Llama 3.2:3b): ${phase2Count}`);
  console.log(`Phase 3 analyses (doomgrave/phi-4): ${phase3Count}`);
  console.log(`\nAll entries were REPLACED - no duplicates created`);
  
  // Close database
  db.close();
}

// Run the analysis
processEmails().catch(console.error);