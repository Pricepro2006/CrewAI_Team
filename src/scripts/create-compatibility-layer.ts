/**
 * Create compatibility layer between pipeline results and EmailStorageService
 * Since the pipeline only saved scores (not full analysis), we'll create a view
 * that provides basic data for the UI to function
 */

import { getDatabaseConnection } from "../database/connection";
import { logger } from "../utils/logger";

export async function createCompatibilityLayer() {
  const db = getDatabaseConnection();

  try {
    // First, create a view that joins emails with available analysis data
    db.exec(`DROP VIEW IF EXISTS email_analysis_compatible`);

    db.exec(`
      CREATE VIEW email_analysis_compatible AS
      SELECT 
        ee.id as email_id,
        ee.id as id,
        
        -- Map priority scores to categories
        CASE 
          WHEN sr.priority_score >= 80 THEN 'critical'
          WHEN sr.priority_score >= 60 THEN 'high'
          WHEN sr.priority_score >= 40 THEN 'medium'
          ELSE 'low'
        END as quick_priority,
        
        -- Map business processes based on subject/content patterns
        CASE 
          WHEN ee.subject LIKE '%order%' OR ee.subject LIKE '%PO%' THEN 'Order Management'
          WHEN ee.subject LIKE '%quote%' OR ee.subject LIKE '%RFQ%' THEN 'Quote Processing'
          WHEN ee.subject LIKE '%ship%' OR ee.subject LIKE '%delivery%' THEN 'Shipping/Logistics'
          WHEN ee.subject LIKE '%support%' OR ee.subject LIKE '%help%' THEN 'Customer Service'
          ELSE 'General'
        END as quick_workflow,
        
        -- Derive workflow state from email metadata
        CASE 
          WHEN ee.status = 'completed' THEN 'COMPLETION'
          WHEN ee.status = 'in_progress' THEN 'IN_PROGRESS'
          ELSE 'START_POINT'
        END as workflow_state,
        
        -- Intent based on email patterns
        CASE
          WHEN ee.subject LIKE '%urgent%' OR ee.subject LIKE '%ASAP%' THEN 'Action Required'
          WHEN ee.subject LIKE '%FYI%' OR ee.subject LIKE '%info%' THEN 'Information'
          ELSE 'Request'
        END as quick_intent,
        
        -- Urgency based on patterns and scores
        CASE
          WHEN sr.priority_score >= 80 OR ee.subject LIKE '%urgent%' THEN 'CRITICAL'
          WHEN sr.priority_score >= 60 THEN 'HIGH'
          WHEN sr.priority_score >= 40 THEN 'MEDIUM'
          ELSE 'LOW'
        END as quick_urgency,
        
        -- Use the same for deep analysis (since we don't have actual deep analysis)
        CASE 
          WHEN ee.subject LIKE '%order%' OR ee.subject LIKE '%PO%' THEN 'Order Management'
          WHEN ee.subject LIKE '%quote%' OR ee.subject LIKE '%RFQ%' THEN 'Quote Processing'
          WHEN ee.subject LIKE '%ship%' OR ee.subject LIKE '%delivery%' THEN 'Shipping/Logistics'
          WHEN ee.subject LIKE '%support%' OR ee.subject LIKE '%help%' THEN 'Customer Service'
          ELSE 'General'
        END as deep_workflow_primary,
        
        -- Placeholder fields for missing analysis
        'Analysis pending - Stage ' || COALESCE(sr.stage, 1) || ' completed' as contextual_summary,
        'Based on email patterns, this appears to be a ' || 
        CASE 
          WHEN ee.subject LIKE '%order%' THEN 'purchase order request'
          WHEN ee.subject LIKE '%quote%' THEN 'quote request'
          WHEN ee.subject LIKE '%ship%' THEN 'shipping inquiry'
          ELSE 'general business communication'
        END as deep_summary,
        
        -- Entity placeholders (would need actual extraction)
        '[]' as entities_po_numbers,
        '[]' as entities_quote_numbers,
        '[]' as entities_case_numbers,
        '[]' as entities_part_numbers,
        '[]' as entities_order_references,
        '[]' as entities_contacts,
        
        -- Action items placeholder
        '[{"task": "Review email", "priority": "' || 
        CASE 
          WHEN sr.priority_score >= 60 THEN 'high'
          ELSE 'medium'
        END || '"}]' as action_items,
        
        -- Model and quality info
        COALESCE(sr.model_used, 'pattern') as analysis_model,
        COALESCE(sr.analysis_quality_score, sr.priority_score) as confidence_score,
        COALESCE(sr.stage, 1) as pipeline_stage,
        
        -- Timestamps
        ee.created_at,
        ee.updated_at,
        datetime('now') as analysis_timestamp,
        
        -- Additional fields for EmailStorageService
        'pending' as action_sla_status,
        'Please review this email and take appropriate action.' as suggested_response,
        null as deep_workflow_secondary,
        null as deep_workflow_related,
        COALESCE(sr.analysis_quality_score, 50) as deep_confidence,
        COALESCE(sr.analysis_quality_score, 50) as quick_confidence,
        ee.status as quick_suggested_state,
        'pattern' as quick_model,
        1.0 as quick_processing_time,
        COALESCE(sr.model_used, 'pattern') as deep_model,
        COALESCE(sr.processing_time_seconds, 1.0) as deep_processing_time,
        COALESCE(sr.processing_time_seconds, 1.0) as total_processing_time
        
      FROM emails_enhanced ee
      LEFT JOIN (
        -- Get the best stage result for each email
        SELECT 
          email_id,
          MAX(stage) as stage,
          MAX(priority_score) as priority_score,
          MAX(analysis_quality_score) as analysis_quality_score,
          MAX(processing_time_seconds) as processing_time_seconds,
          MAX(model_used) as model_used
        FROM stage_results
        GROUP BY email_id
      ) sr ON ee.id = sr.email_id
    `);

    logger.info("Created email_analysis_compatible view", "COMPATIBILITY");

    // Also create the email_entities from what we can extract
    db.exec(`
      CREATE TABLE IF NOT EXISTS email_entities_extracted (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email_id INTEGER,
        entity_type TEXT,
        entity_value TEXT,
        confidence_score REAL DEFAULT 0.5,
        extracted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (email_id) REFERENCES emails_enhanced(id)
      )
    `);

    // Extract basic entities from subjects and bodies
    const emails = db
      .prepare(
        `
      SELECT id, subject, body_text 
      FROM emails_enhanced 
      WHERE id NOT IN (SELECT DISTINCT email_id FROM email_entities_extracted)
      LIMIT 1000
    `,
      )
      .all() as Array<{ id: number; subject: string; body_text: string }>;

    const insertEntity = db.prepare(`
      INSERT INTO email_entities_extracted (email_id, entity_type, entity_value, confidence_score)
      VALUES (?, ?, ?, ?)
    `);

    for (const email of emails) {
      const text = `${email.subject} ${email.body_text || ""}`;

      // Extract PO numbers
      const poMatches = text.match(
        /\b(?:PO|P\.O\.?|Purchase Order)\s*[#:]?\s*(\d{6,})/gi,
      );
      if (poMatches) {
        for (const match of poMatches) {
          const poNumber = match.replace(/[^0-9]/g, "");
          if (poNumber.length >= 6) {
            insertEntity.run(email.id, "PO_NUMBER", poNumber, 0.8);
          }
        }
      }

      // Extract quote numbers
      const quoteMatches = text.match(
        /\b(?:Quote|RFQ|Q-)\s*[#:]?\s*([\w-]+)/gi,
      );
      if (quoteMatches) {
        for (const match of quoteMatches) {
          const quoteNumber = match.split(/[:#\s]/)[1];
          if (quoteNumber && quoteNumber.length > 3) {
            insertEntity.run(email.id, "QUOTE_NUMBER", quoteNumber, 0.7);
          }
        }
      }
    }

    logger.info(
      `Extracted entities from ${emails.length} emails`,
      "COMPATIBILITY",
    );

    return { success: true };
  } catch (error) {
    logger.error(
      "Failed to create compatibility layer",
      "COMPATIBILITY",
      error as Error,
    );
    throw error;
  }
}

// Run if executed directly
createCompatibilityLayer()
  .then(() => {
    logger.info("Compatibility layer created successfully", "COMPATIBILITY");
    process.exit(0);
  })
  .catch((error) => {
    logger.error(
      "Failed to create compatibility layer",
      "COMPATIBILITY",
      error,
    );
    process.exit(1);
  });
