/**
 * Simple API endpoint to serve analyzed emails from the enhanced database
 * This bypasses TypeScript compilation issues to provide immediate functionality
 */

import express from 'express';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const { Router } = express;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

// Database path
const DB_PATH = path.join(__dirname, '../../../data/crewai_enhanced.db');

// Simple endpoint to get analyzed emails
router.get('/api/analyzed-emails', (req, res) => {
  try {
    const db = new Database(DB_PATH, { readonly: true });
    
    // Query for emails that have been analyzed (phase_completed >= 2)
    const emails = db.prepare(`
      SELECT 
        id,
        subject,
        sender_email,
        sender_name,
        received_date_time,
        body_content,
        phase_completed,
        workflow_state,
        chain_completeness_score,
        extracted_entities,
        analyzed_at
      FROM emails_enhanced
      WHERE phase_completed >= 2
      ORDER BY analyzed_at DESC
      LIMIT 100
    `).all();
    
    // Transform emails to match frontend expectations
    const transformedEmails = emails?.map((email: any) => ({
      id: email.id,
      subject: email.subject || 'No Subject',
      from: email.sender_email || 'unknown@email.com',
      sender_name: email.sender_name || 'Unknown Sender',
      received_date: email.received_date_time,
      body_preview: (email.body_content || '').substring(0, 200) + '...',
      status: email.phase_completed >= 2 ? 'analyzed' : 'pending',
      workflow_state: email.workflow_state || 'unknown',
      chain_score: email.chain_completeness_score || 0,
      entities: parseJSON(email.extracted_entities, []),
      analyzed_at: email.analyzed_at,
      phase: email.phase_completed
    }));
    
    db.close();
    
    res.json({
      success: true,
      count: transformedEmails?.length || 0,
      emails: transformedEmails
    });
    
  } catch (error: any) {
    console.error('Error fetching analyzed emails:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Dashboard stats endpoint
router.get('/api/email-stats', (req, res) => {
  try {
    const db = new Database(DB_PATH, { readonly: true });
    
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total_emails,
        COUNT(CASE WHEN phase_completed >= 2 THEN 1 END) as analyzed_count,
        COUNT(CASE WHEN phase_completed = 0 THEN 1 END) as pending_count,
        COUNT(CASE WHEN phase_completed = 1 THEN 1 END) as phase1_count,
        COUNT(CASE WHEN phase_completed = 2 THEN 1 END) as phase2_count,
        COUNT(CASE WHEN phase_completed = 3 THEN 1 END) as phase3_count,
        AVG(chain_completeness_score) as avg_chain_score
      FROM emails_enhanced
    `).get();
    
    db.close();
    
    res.json({
      success: true,
      stats
    });
    
  } catch (error: any) {
    console.error('Error fetching email stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Helper function to safely parse JSON
function parseJSON(str: string | null, defaultValue: any): any {
  if (!str) return defaultValue;
  try {
    return JSON.parse(str);
  } catch {
    return defaultValue;
  }
}

export default router;