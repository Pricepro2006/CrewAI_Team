import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { EmailAnalyticsService } from '../../core/database/EmailAnalyticsService';
import Database from 'better-sqlite3';
import fs from 'fs';

describe('EmailAnalyticsService Simple Integration Tests', () => {
  let service: EmailAnalyticsService;
  let db: Database.Database;
  const testDbPath = './data/test-simple.db';
  
  beforeAll(() => {
    // Ensure test directory exists
    if (!fs.existsSync('./data')) {
      fs.mkdirSync('./data', { recursive: true });
    }
    
    // Create test database with sample data
    db = new Database(testDbPath);
    
    // Create tables
    db.exec(`
      CREATE TABLE IF NOT EXISTS emails (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_id TEXT UNIQUE NOT NULL,
        subject TEXT NOT NULL,
        sender TEXT NOT NULL,
        recipient TEXT NOT NULL,
        body TEXT,
        priority TEXT CHECK(priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        processed_at DATETIME
      );
      
      CREATE TABLE IF NOT EXISTS email_analysis (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email_id INTEGER NOT NULL,
        category TEXT,
        sentiment TEXT CHECK(sentiment IN ('positive', 'negative', 'neutral')),
        priority_score REAL,
        key_phrases TEXT,
        processing_time_ms INTEGER,
        workflow_state TEXT CHECK(workflow_state IN ('PENDING', 'PROCESSING', 'COMPLETE', 'ERROR')) DEFAULT 'PENDING',
        primary_workflow TEXT,
        analysis_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (email_id) REFERENCES emails(id)
      );
      
      -- Insert test data
      INSERT INTO emails (message_id, subject, sender, recipient, body, priority)
      VALUES 
        ('test-1', 'Test Email 1', 'test1@example.com', 'recipient@example.com', 'Test body 1', 'high'),
        ('test-2', 'Test Email 2', 'test2@example.com', 'recipient@example.com', 'Test body 2', 'medium'),
        ('test-3', 'Test Email 3', 'test3@example.com', 'recipient@example.com', 'Test body 3', 'low'),
        ('test-4', 'Test Email 4', 'test4@example.com', 'recipient@example.com', 'Test body 4', 'urgent'),
        ('test-5', 'Test Email 5', 'test5@example.com', 'recipient@example.com', 'Test body 5', 'medium');
        
      INSERT INTO email_analysis (email_id, category, sentiment, processing_time_ms, workflow_state, primary_workflow)
      VALUES 
        (1, 'inquiry', 'positive', 1200, 'COMPLETE', 'customer_support'),
        (2, 'feedback', 'negative', 1800, 'COMPLETE', 'feedback_analysis'),
        (3, 'inquiry', 'neutral', 1500, 'COMPLETE', 'customer_support');
    `);
    
    // Create service
    service = new EmailAnalyticsService(testDbPath);
  });
  
  afterAll(() => {
    service.close();
    db.close();
    
    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });
  
  describe('Basic Functionality', () => {
    it('should return correct total emails count', () => {
      const count = service.getTotalEmailsCount();
      expect(count).toBe(5);
    });
    
    it('should return correct processed emails count', () => {
      const count = service.getProcessedEmailsCount();
      expect(count).toBe(3);
    });
    
    it('should return correct pending emails count', () => {
      const count = service.getPendingEmailsCount();
      expect(count).toBe(2);
    });
    
    it('should calculate correct average processing time', () => {
      const avgTime = service.getAverageProcessingTime();
      expect(avgTime).toBe(1500); // (1200 + 1800 + 1500) / 3
    });
    
    it('should return comprehensive stats', async () => {
      const stats = await service.getStats();
      
      expect(stats).toMatchObject({
        totalEmails: 5,
        processedEmails: 3,
        pendingEmails: 2,
        averageProcessingTime: 1500
      });
      
      expect(stats.timestamp).toBeInstanceOf(Date);
    });
  });
});