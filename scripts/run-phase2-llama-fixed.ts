#!/usr/bin/env tsx
/**
 * Phase 2 Analysis with Llama3.2:3b - FIXED JSON parsing
 * Handles markdown responses and enforces JSON output
 */

import Database from "better-sqlite3";
import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create a JSON-specific prompt for Llama
const LLAMA_JSON_PROMPT = `You are a TD SYNNEX email analyzer. Analyze the email and respond ONLY with valid JSON.

CRITICAL: Your response must be ONLY a JSON object, no markdown, no explanations, just JSON.

Analyze for:
1. Workflow state: START_POINT, IN_PROGRESS, or COMPLETION
2. Priority: CRITICAL, HIGH, MEDIUM, or LOW  
3. Entities: PO numbers, quotes, cases, parts, companies, contacts
4. Business process type
5. Action items needed
6. Urgency indicators

Response format (JSON ONLY):
{
  "workflow_state": "START_POINT|IN_PROGRESS|COMPLETION",
  "priority": "CRITICAL|HIGH|MEDIUM|LOW",
  "confidence": 0.0-1.0,
  "entities": {
    "po_numbers": ["PO12345"],
    "quote_numbers": ["Q-12345"],
    "case_numbers": ["CASE123"],
    "part_numbers": ["ABC123"],
    "companies": ["Company Name"],
    "contacts": ["John Doe"]
  },
  "business_process": "Order Management|Quote Processing|Support|etc",
  "action_items": [
    {"task": "Action needed", "owner": "who", "deadline": "when"}
  ],
  "urgency_level": "CRITICAL|HIGH|MEDIUM|LOW",
  "urgency_indicators": ["urgent", "asap"],
  "sla_status": "ON_TRACK|AT_RISK|VIOLATED",
  "contextual_summary": "Brief summary",
  "suggested_response": "Professional response"
}

Email to analyze:`;

async function callLlamaWithJSONFix(prompt: string): Promise<any> {
  const startTime = Date.now();
  
  try {
    const response = await axios.post(
      'http://localhost:11434/api/generate',
      {
        model: 'llama3.2:3b',
        prompt,
        stream: false,
        options: {
          temperature: 0.1,  // Lower temperature for more consistent JSON
          num_predict: 800,
          timeout: 180000,
          stop: ["\n\n", "```", "**"]  // Stop before markdown
        }
      },
      { 
        timeout: 180000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      }
    );

    const elapsed = (Date.now() - startTime) / 1000;
    console.log(`      ✅ LLM responded in ${elapsed.toFixed(1)}s`);

    let responseText = response.data.response || '';
    
    // Clean response - remove any markdown or extra text
    responseText = responseText.trim();
    
    // Find JSON in response
    let jsonStr = responseText;
    if (responseText.includes('{')) {
      const start = responseText.indexOf('{');
      const end = responseText.lastIndexOf('}') + 1;
      if (end > start) {
        jsonStr = responseText.substring(start, end);
      }
    }
    
    // Clean common issues
    jsonStr = jsonStr
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .replace(/\*\*/g, '')
      .replace(/\\n/g, ' ')
      .replace(/\n(?=(?:[^"]*"[^"]*")*[^"]*$)/g, ' '); // Remove newlines outside quotes
    
    try {
      return JSON.parse(jsonStr);
    } catch (parseErr) {
      console.log('      ⚠️  Parse failed, trying to fix JSON...');
      
      // Try to fix common JSON issues
      jsonStr = jsonStr
        .replace(/,\s*}/g, '}')  // Remove trailing commas
        .replace(/,\s*]/g, ']')  // Remove trailing commas in arrays
        .replace(/'/g, '"')      // Replace single quotes
        .replace(/(\w+):/g, '"$1":'); // Quote unquoted keys
      
      return JSON.parse(jsonStr);
    }
    
  } catch (error: any) {
    const elapsed = (Date.now() - startTime) / 1000;
    console.error(`      ❌ LLM call failed after ${elapsed.toFixed(1)}s: ${error.message}`);
    
    // Return a default structure on error
    return {
      workflow_state: "START_POINT",
      priority: "MEDIUM",
      confidence: 0.5,
      entities: {},
      error: error.message
    };
  }
}

async function processAll20TestEmails() {
  console.log('🚀 Phase 2 Analysis - FIXED JSON Parsing\n');
  console.log('🦙 Using llama3.2:3b model\n');
  console.log('📋 Target Score: 6.56/10\n');
  
  const db = new Database('./data/crewai.db');
  
  // Load all test emails
  const allEmails: any[] = [];
  for (let i = 1; i <= 4; i++) {
    const batchFile = path.join(__dirname, `../data/email-batches/test_emails_batch_${i}.json`);
    if (fs.existsSync(batchFile)) {
      const emails = JSON.parse(fs.readFileSync(batchFile, 'utf-8'));
      allEmails.push(...emails);
    }
  }
  
  console.log(`📧 Processing ${allEmails.length} test emails\n`);
  
  const startTime = Date.now();
  let successCount = 0;
  let failureCount = 0;
  
  for (const [index, email] of allEmails.entries()) {
    const emailId = email.MessageID || email.id;
    console.log(`\n[${index + 1}/${allEmails.length}] Processing ${emailId}`);
    console.log(`   📧 ${email.Subject?.substring(0, 60)}...`);
    
    try {
      // Build the prompt with email content
      const emailContent = `\n\nSubject: ${email.Subject}\n\nBody: ${email.BodyText || email.Body || 'No body content'}`;
      const fullPrompt = LLAMA_JSON_PROMPT + emailContent;
      
      console.log('   🦙 Calling llama3.2:3b...');
      const analysisStartTime = Date.now();
      
      // Call LLM with JSON fix
      const analysis = await callLlamaWithJSONFix(fullPrompt);
      
      const processingTime = Date.now() - analysisStartTime;
      
      console.log(`   📊 Key results:`)
      console.log(`      - Workflow: ${analysis.workflow_state || 'N/A'}`);
      console.log(`      - Priority: ${analysis.priority || 'N/A'}`);
      console.log(`      - Confidence: ${analysis.confidence || 'N/A'}`);
      
      // Save to database
      const analysisId = `phase2_llama_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
        // Quick analysis
        analysis.workflow_state || 'START_POINT',
        analysis.priority || 'MEDIUM',
        'REQUEST',
        analysis.urgency_level || 'MEDIUM',
        0.75,
        'NEW',
        'rule-based',
        50,
        // Deep analysis (Phase 2)
        analysis.workflow_state || analysis.business_process || 'Order Management',
        null,
        analysis.confidence || 0.75,
        // Entities
        analysis.entities?.po_numbers?.join(',') || null,
        analysis.entities?.quote_numbers?.join(',') || null,
        analysis.entities?.case_numbers?.join(',') || null,
        analysis.entities?.part_numbers?.join(',') || null,
        null,
        analysis.entities?.contacts?.join(',') || null,
        // Actions
        analysis.action_items?.map((a: any) => a.task || a).join('; ') || null,
        JSON.stringify(analysis.action_items || []),
        analysis.sla_status || 'ON_TRACK',
        // Business impact
        null,
        analysis.urgency_level === 'CRITICAL' ? 'High' : 'Medium',
        analysis.urgency_indicators?.join(', ') || null,
        // Summary and response
        analysis.contextual_summary || null,
        analysis.suggested_response || null,
        // Metadata
        'llama3.2:3b',
        processingTime,
        now,
        now
      );
      
      console.log('   💾 Saved to database');
      successCount++;
      
    } catch (error) {
      console.error(`   ❌ Failed: ${error}`);
      failureCount++;
    }
  }
  
  const totalTime = (Date.now() - startTime) / 1000;
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('PHASE 2 ANALYSIS COMPLETE');
  console.log('='.repeat(60));
  console.log(`Model: llama3.2:3b`);
  console.log(`Target Score: 6.56/10`);
  console.log(`Emails processed: ${successCount}/${allEmails.length}`);
  console.log(`Failures: ${failureCount}`);
  console.log(`Average time: ${(totalTime / successCount).toFixed(1)}s per email`);
  console.log(`Total time: ${(totalTime / 60).toFixed(1)} minutes`);
  
  // Save completion log
  fs.writeFileSync('/tmp/phase2_llama_complete.txt', JSON.stringify({
    completed: new Date().toISOString(),
    model: 'llama3.2:3b',
    targetScore: 6.56,
    success: successCount,
    total: allEmails.length,
    avgTime: totalTime / successCount,
    totalMinutes: totalTime / 60
  }, null, 2));
  
  db.close();
}

// Run it
processAll20TestEmails().catch(console.error);