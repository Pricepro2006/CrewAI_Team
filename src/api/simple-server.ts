/**
 * Simple Express server to serve analyzed emails directly from the enhanced database
 * Bypasses all TypeScript and service initialization issues
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Type definitions for database records
interface EmailRecord {
  id: string;
  subject: string | null;
  sender_email: string | null;
  sender_name: string | null;
  received_date_time: string | null;
  body_content: string | null;
  phase_completed: number | null;
  workflow_state: string | null;
  chain_completeness_score: number | null;
  extracted_entities: string | null;
  analyzed_at: string | null;
}

interface EmailStats {
  total_emails: number;
  analyzed_count: number;
  pending_count: number;
  phase1_count: number;
  phase2_count: number;
  phase3_count: number;
  avg_chain_score: number | null;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3210;

// Database path
const DB_PATH = path.join(__dirname, '../../data/crewai_enhanced.db');

// Middleware
app.use(cors());
app.use(express.json());

// Simple endpoint to get analyzed emails
app.get('/api/analyzed-emails', (req: Request, res: Response) => {
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
    `).all() as EmailRecord[];
    
    // Transform emails to match frontend expectations
    const transformedEmails = emails?.map((email: EmailRecord) => ({
      id: email.id,
      subject: email.subject || 'No Subject',
      from: email.sender_email || 'unknown@email.com',
      sender_name: email.sender_name || 'Unknown Sender',
      received_date: email.received_date_time,
      body_preview: (email.body_content || '').substring(0, 200) + '...',
      status: (email.phase_completed || 0) >= 2 ? 'analyzed' : 'pending',
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
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching analyzed emails:', error);
    res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
});

// Dashboard stats endpoint
app.get('/api/email-stats', (req: Request, res: Response) => {
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
    `).get() as EmailStats;
    
    db.close();
    
    res.json({
      success: true,
      stats
    });
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching email stats:', error);
    res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
});

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'simple-email-api' });
});

// Helper function to safely parse JSON
function parseJSON<T>(str: string | null, defaultValue: T): T {
  if (!str) return defaultValue;
  try {
    return JSON.parse(str) as T;
  } catch {
    return defaultValue;
  }
}

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Simple email API server running on http://localhost:${PORT}`);
  console.log(`📧 Analyzed emails: http://localhost:${PORT}/api/analyzed-emails`);
  console.log(`📊 Email stats: http://localhost:${PORT}/api/email-stats`);
});