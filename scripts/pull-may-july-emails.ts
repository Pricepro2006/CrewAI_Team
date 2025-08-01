#!/usr/bin/env tsx
/**
 * Pull May-July 2025 Emails in Batches
 * Prepare for 90% llama / 10% phi-4 analysis
 */

import Database from "better-sqlite3";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function pullMayJulyEmails() {
  console.log('📧 Pulling May-July 2025 Emails\n');
  
  const db = new Database('./data/crewai.db');
  
  // Query for May-July 2025 emails
  const emails = db.prepare(`
    SELECT 
      id,
      graph_id,
      subject,
      body,
      body_preview,
      sender_email,
      sender_name,
      to_addresses,
      received_at,
      has_attachments,
      importance
    FROM emails
    WHERE date(received_at) >= '2025-05-01'
      AND date(received_at) <= '2025-07-31'
    ORDER BY received_at DESC
  `).all() as any[];
  
  console.log(`Found ${emails.length} emails from May-July 2025\n`);
  
  // Create batches of 100 emails each
  const batchSize = 100;
  const batches = [];
  
  for (let i = 0; i < emails.length; i += batchSize) {
    batches.push(emails.slice(i, i + batchSize));
  }
  
  console.log(`Creating ${batches.length} batches of ~${batchSize} emails each\n`);
  
  // Save batches
  const batchDir = path.join(__dirname, '../data/email-batches/may-july-2025');
  fs.mkdirSync(batchDir, { recursive: true });
  
  batches.forEach((batch, index) => {
    const batchFile = path.join(batchDir, `batch_${index + 1}.json`);
    fs.writeFileSync(batchFile, JSON.stringify(batch, null, 2));
    console.log(`✅ Saved batch ${index + 1}: ${batch.length} emails`);
  });
  
  // Create analysis plan (90% llama, 10% phi-4)
  const analysisMap = emails.map((email, index) => {
    // Use phi-4 for:
    // 1. Emails marked as high importance
    // 2. Every 10th email
    // 3. Emails with specific keywords
    const usePhiFor = 
      email.importance === 'high' ||
      email.importance === 'critical' ||
      index % 10 === 0 ||
      (email.subject && (
        email.subject.toLowerCase().includes('urgent') ||
        email.subject.toLowerCase().includes('escalation') ||
        email.subject.toLowerCase().includes('critical')
      ));
    
    return {
      email_id: email.id,
      graph_id: email.graph_id,
      model: usePhiFor ? 'doomgrave/phi-4:14b-tools-Q3_K_S' : 'llama3.2:3b',
      batch: Math.floor(index / batchSize) + 1,
      index_in_batch: index % batchSize
    };
  });
  
  // Calculate distribution
  const llamaCount = analysisMap.filter(a => a.model.includes('llama')).length;
  const phiCount = analysisMap.filter(a => a.model.includes('phi')).length;
  
  console.log('\n📊 Analysis Distribution:');
  console.log(`   Llama 3.2:3b: ${llamaCount} emails (${(llamaCount/emails.length*100).toFixed(1)}%)`);
  console.log(`   Phi-4:        ${phiCount} emails (${(phiCount/emails.length*100).toFixed(1)}%)`);
  
  // Save analysis plan
  fs.writeFileSync(
    path.join(batchDir, 'analysis_plan.json'),
    JSON.stringify({
      total_emails: emails.length,
      batch_count: batches.length,
      batch_size: batchSize,
      llama_count: llamaCount,
      phi_count: phiCount,
      distribution: analysisMap
    }, null, 2)
  );
  
  console.log('\n✅ Analysis plan saved');
  
  // Create summary report
  const summary = {
    pull_date: new Date().toISOString(),
    date_range: {
      start: '2025-05-01',
      end: '2025-07-31'
    },
    total_emails: emails.length,
    batches: batches.length,
    batch_size: batchSize,
    model_distribution: {
      'llama3.2:3b': {
        count: llamaCount,
        percentage: (llamaCount/emails.length*100).toFixed(1) + '%'
      },
      'doomgrave/phi-4': {
        count: phiCount,
        percentage: (phiCount/emails.length*100).toFixed(1) + '%'
      }
    },
    importance_breakdown: emails.reduce((acc, email) => {
      const importance = email.importance || 'normal';
      acc[importance] = (acc[importance] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  };
  
  fs.writeFileSync(
    path.join(batchDir, 'pull_summary.json'),
    JSON.stringify(summary, null, 2)
  );
  
  console.log('\n📋 Summary Report:');
  console.log(JSON.stringify(summary, null, 2));
  
  db.close();
  
  return {
    emails: emails.length,
    batches: batches.length,
    batchDir
  };
}

// Run it
pullMayJulyEmails().catch(console.error);