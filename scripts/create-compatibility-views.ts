#!/usr/bin/env tsx

import Database from 'better-sqlite3';
import path from 'path';

console.log('Creating compatibility views for email dashboard...');

const dbPath = path.join(process.cwd(), 'data', 'crewai_enhanced.db');
const db = new Database(dbPath);

try {
  // Drop existing views if they exist
  console.log('Dropping existing views...');
  db.exec(`DROP VIEW IF EXISTS emails;`);
  db.exec(`DROP VIEW IF EXISTS email_analysis_view;`);
  
  // Create emails view that maps enhanced schema to original schema
  console.log('Creating emails view...');
  db.exec(`
    CREATE VIEW emails AS
    SELECT 
      id,
      id as graph_id,
      subject,
      sender_email as from_address,
      sender_name as from_name,
      (SELECT GROUP_CONCAT(email_address, ', ') 
       FROM email_recipients 
       WHERE email_id = emails_enhanced.id 
         AND recipient_type = 'to') as to_addresses,
      received_date_time,
      sent_date_time,
      CASE WHEN is_read = 'true' THEN 1 ELSE 0 END as is_read,
      CASE WHEN has_attachments = 'true' THEN 1 ELSE 0 END as has_attachments,
      body_preview,
      body_content as body,
      importance,
      categories,
      body_content as raw_content,
      created_at,
      analyzed_at as updated_at
    FROM emails_enhanced;
  `);
  
  // Create email_analysis view with different name to avoid conflict with table
  console.log('Creating email_analysis_view...');
  db.exec(`
    CREATE VIEW email_analysis_view AS
    SELECT
      id,
      id as email_id,
      
      -- Quick analysis (Phase 1)
      CASE 
        WHEN phase_completed >= 1 THEN workflow_type 
        ELSE 'unknown' 
      END as quick_workflow_primary,
      priority as quick_priority,
      workflow_type as quick_intent,
      CASE 
        WHEN priority IN ('critical', 'urgent') THEN 'critical'
        WHEN priority = 'high' THEN 'high'
        ELSE 'normal'
      END as quick_urgency,
      chain_completeness_score as quick_confidence,
      workflow_state as quick_suggested_state,
      
      -- Deep analysis (Phase 2/3)
      workflow_type as deep_workflow_primary,
      chain_completeness_score as deep_confidence,
      
      -- Entities (from extracted_entities JSON)
      extracted_entities as entities_po_numbers,
      null as entities_quote_numbers,
      null as entities_case_numbers,
      null as entities_part_numbers,
      null as entities_order_references,
      null as entities_contacts,
      
      -- Action items
      business_summary as action_summary,
      action_items as action_details,
      'on-track' as action_sla_status,
      
      -- Workflow state
      workflow_state,
      
      -- Timestamps
      created_at,
      analyzed_at as updated_at,
      phase_completed,
      phase_1_results,
      phase_2_results,
      phase_3_results
    FROM emails_enhanced;
  `);
  
  // Verify views were created
  const viewCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='view'").all();
  console.log('\n✅ Views created successfully:');
  viewCheck.forEach(v => console.log(`   - ${v.name}`));
  
  // Test the views
  const emailCount = db.prepare("SELECT COUNT(*) as count FROM emails_enhanced").get();
  console.log(`\n📊 Emails view contains ${emailCount.count} records`);
  
  const analysisCount = db.prepare("SELECT COUNT(*) as count FROM email_analysis_view").get();
  console.log(`📊 Email analysis view contains ${analysisCount.count} records`);
  
} catch (error) {
  console.error('❌ Error creating views:', error);
  process.exit(1);
} finally {
  db.close();
}

console.log('\n✨ Compatibility views created successfully!');