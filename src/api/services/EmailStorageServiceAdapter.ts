/**
 * EmailStorageServiceAdapter
 * 
 * This adapter makes the enhanced database work with the existing EmailStorageService
 * by mapping column names between the two schemas.
 * 
 * Original schema: received_at, from_address, etc.
 * Enhanced schema: received_date_time, sender_email, etc.
 */

import Database from 'better-sqlite3';
import { logger } from '../../utils/logger.js';
import path from 'path';

export class EmailStorageServiceAdapter {
  private db: Database.Database;
  
  constructor() {
    // Use the enhanced database instead of the original
    const dbPath = path.join(process.cwd(), 'data', 'crewai_enhanced.db');
    this.db = new Database(dbPath);
    
    logger.info('EmailStorageServiceAdapter initialized with enhanced database', 'EMAIL_ADAPTER');
    
    // Create views that map enhanced schema to original schema
    this.createCompatibilityViews();
  }
  
  private createCompatibilityViews() {
    try {
      // Drop existing views if they exist
      this.db.exec(`
        DROP VIEW IF EXISTS emails;
        DROP VIEW IF EXISTS email_analysis;
      `);
      
      // Create emails view that maps enhanced schema to original schema
      this.db.exec(`
        CREATE VIEW emails AS
        SELECT 
          id,
          id as graph_id,  -- Enhanced DB doesn't have graph_id, use id
          subject,
          sender_email as from_address,
          sender_name as from_name,
          recipients as to_addresses,
          received_date_time as received_at,
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
      
      // Create email_analysis view that maps phase data to analysis structure
      this.db.exec(`
        CREATE VIEW email_analysis AS
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
          analyzed_at as workflow_state_updated_at,
          next_steps as workflow_suggested_next,
          null as workflow_estimated_completion,
          null as workflow_blockers,
          
          -- Business impact
          CAST(revenue_impact as REAL) as business_impact_revenue,
          'medium' as business_impact_satisfaction,
          urgency_reason as business_impact_urgency_reason,
          
          -- Context
          business_summary as contextual_summary,
          suggested_response,
          null as related_emails,
          0 as thread_position,
          
          -- Processing metadata
          CASE 
            WHEN phase_completed = 3 THEN 'phi-4'
            WHEN phase_completed = 2 THEN 'llama3.2'
            ELSE 'rule-based'
          END as deep_model,
          0 as deep_processing_time,
          0 as total_processing_time,
          
          -- Timestamps
          created_at,
          analyzed_at as updated_at
        FROM emails_enhanced
        WHERE phase_completed > 0;
      `);
      
      // Note: Indexes should be created on the underlying table, not on views
      // The enhanced database already has proper indexes
      
      logger.info('Compatibility views created successfully', 'EMAIL_ADAPTER');
      
    } catch (error) {
      logger.error('Failed to create compatibility views', 'EMAIL_ADAPTER', { error });
      throw error;
    }
  }
  
  getDatabase(): Database.Database {
    return this.db;
  }
  
  close() {
    this.db.close();
  }
}

// Export a singleton instance
export const emailStorageAdapter = new EmailStorageServiceAdapter();