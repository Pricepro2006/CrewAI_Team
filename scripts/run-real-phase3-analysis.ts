#!/usr/bin/env tsx
/**
 * REAL Phase 3 Analysis with Actual LLM Calls
 * This script ACTUALLY calls doomgrave/phi-4
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

async function callOllamaForReal(prompt: string): Promise<any> {
  console.log('      🔥 Actually calling Ollama API...');
  const startTime = Date.now();
  
  try {
    const response = await axios.post(
      'http://localhost:11434/api/generate',
      {
        model: 'doomgrave/phi-4:14b-tools-Q3_K_S',
        prompt,
        stream: false,
        options: {
          temperature: 0.3,
          num_predict: 1500,
          timeout: 300000 // 5 minutes
        }
      },
      { 
        timeout: 300000, // 5 minute timeout
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      }
    );

    const elapsed = (Date.now() - startTime) / 1000;
    console.log(`      ✅ LLM responded in ${elapsed.toFixed(1)}s`);

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

    try {
      return JSON.parse(responseText.trim());
    } catch (parseError) {
      console.error('      ❌ Failed to parse JSON response');
      console.log('      Raw response:', responseText.substring(0, 200) + '...');
      throw parseError;
    }

  } catch (error: any) {
    const elapsed = (Date.now() - startTime) / 1000;
    console.error(`      ❌ LLM call failed after ${elapsed.toFixed(1)}s: ${error.message}`);
    throw error;
  }
}

async function processTestBatches() {
  console.log('🚀 REAL Phase 3 Analysis with Actual doomgrave/phi-4 LLM Calls\n');
  console.log('⚠️  This will take 50-180 seconds per email!\n');
  
  const db = new Database('./data/crewai.db');
  
  // Load test emails from batches
  const allEmails: any[] = [];
  for (let i = 1; i <= 4; i++) {
    const batchFile = path.join(__dirname, `../data/email-batches/test_emails_batch_${i}.json`);
    if (fs.existsSync(batchFile)) {
      const emails = JSON.parse(fs.readFileSync(batchFile, 'utf-8'));
      allEmails.push(...emails);
    }
  }
  
  console.log(`📧 Loaded ${allEmails.length} test emails\n`);
  
  let successCount = 0;
  let totalProcessingTime = 0;
  
  // Process only first 5 emails as a test
  const emailsToProcess = allEmails.slice(0, 5);
  console.log(`🔬 Processing first ${emailsToProcess.length} emails as demonstration...\n`);
  
  for (const [index, email] of emailsToProcess.entries()) {
    const emailId = email.MessageID || email.id;
    console.log(`\n[${index + 1}/${emailsToProcess.length}] Processing ${emailId}`);
    console.log(`   📧 ${email.Subject?.substring(0, 60)}...`);
    
    try {
      // Build the prompt with email content
      const emailContent = `\n\nSubject: ${email.Subject}\n\nBody: ${email.BodyText || email.Body || 'No body content'}`;
      const fullPrompt = PHI4_PROMPT.replace('Email to analyze:', `Email to analyze:${emailContent}`);
      
      console.log('   🔬 Calling doomgrave/phi-4:14b-tools-Q3_K_S...');
      const startTime = Date.now();
      
      // ACTUALLY call the LLM
      const analysis = await callOllamaForReal(fullPrompt);
      
      const processingTime = Date.now() - startTime;
      totalProcessingTime += processingTime;
      
      console.log(`   ✅ Analysis complete in ${(processingTime / 1000).toFixed(1)}s`);
      
      // Log key results
      console.log(`   📊 Results:`);
      console.log(`      - Workflow: ${analysis.workflow_state || 'N/A'}`);
      console.log(`      - Priority: ${analysis.priority || 'N/A'}`);
      console.log(`      - Confidence: ${analysis.confidence || 'N/A'}`);
      
      const entityCount = Object.values(analysis.entities || {})
        .reduce((sum: number, arr: any) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
      console.log(`      - Entities found: ${entityCount}`);
      
      // Save to database
      const analysisId = `real_analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date().toISOString();
      
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO email_analysis (
          id, email_id, 
          quick_workflow, quick_priority, quick_intent, quick_urgency,
          quick_confidence, quick_suggested_state, quick_model, quick_processing_time,
          deep_workflow_primary, deep_workflow_secondary, deep_confidence,
          entities_po_numbers, entities_quote_numbers, entities_case_numbers,
          entities_part_numbers, entities_order_references, entities_contacts,
          action_summary, action_details, action_sla_status,
          business_impact_revenue, business_impact_satisfaction, business_impact_urgency_reason,
          contextual_summary, suggested_response,
          deep_model, deep_processing_time,
          created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
      `);
      
      stmt.run(
        analysisId,
        emailId,
        // Quick analysis (basic)
        analysis.workflow_state || 'START_POINT',
        analysis.priority || 'MEDIUM',
        'REQUEST',
        analysis.urgency_level || 'MEDIUM',
        0.85,
        'NEW',
        'rule-based',
        50,
        // Deep analysis (from LLM)
        analysis.workflow_state || analysis.business_process || null,
        null,
        analysis.confidence || 0.8,
        // Entities
        analysis.entities?.po_numbers?.join(',') || null,
        analysis.entities?.quote_numbers?.join(',') || null,
        analysis.entities?.case_numbers?.join(',') || null,
        analysis.entities?.part_numbers?.join(',') || null,
        null,
        analysis.entities?.contacts?.join(',') || null,
        // Actions
        analysis.action_items?.map((a: any) => a.task).join('; ') || null,
        JSON.stringify(analysis.action_items || []),
        analysis.sla_status || null,
        // Business impact
        null,
        analysis.urgency_level === 'CRITICAL' ? 'High' : 'Medium',
        analysis.urgency_indicators?.join(', ') || null,
        // Summary and response
        analysis.contextual_summary || analysis.executive_summary || null,
        analysis.suggested_response || null,
        // Metadata
        'doomgrave/phi-4:14b-tools-Q3_K_S',
        processingTime,
        now,
        now
      );
      
      console.log('   💾 Saved to database');
      successCount++;
      
    } catch (error) {
      console.error(`   ❌ Failed: ${error}`);
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('REAL PHASE 3 ANALYSIS COMPLETE');
  console.log('='.repeat(60));
  console.log(`Emails processed: ${successCount}/${emailsToProcess.length}`);
  console.log(`Average time per email: ${(totalProcessingTime / successCount / 1000).toFixed(1)}s`);
  console.log(`Total processing time: ${(totalProcessingTime / 1000).toFixed(1)}s`);
  console.log('\nThis was a demonstration with 5 emails.');
  console.log('Full 20-email analysis would take ~20-60 minutes.');
  
  db.close();
}

// Run it
processTestBatches().catch(console.error);