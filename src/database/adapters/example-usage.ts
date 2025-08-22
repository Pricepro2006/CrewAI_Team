/**
 * Example usage of database adapters
 * Shows how to migrate existing repositories to use the adapter pattern
 */

import { DatabaseFactory } from './DatabaseFactory.js';
import { IDatabaseAdapter } from './DatabaseAdapter.interface.js';
import { SqlValue } from './types.js';

// Example: Email Repository using database adapter
interface EmailRecord {
  id: string;
  from_email: string;
  subject: string;
  body: string;
  received_at: string;
  processed: boolean;
  created_at: string;
  updated_at: string;
}

export class EmailRepositoryWithAdapter {
  private adapter: IDatabaseAdapter;
  private readonly tableName = 'emails';

  constructor(adapter: IDatabaseAdapter) {
    this.adapter = adapter;
  }

  /**
   * Create the emails table if it doesn't exist
   */
  async initialize(): Promise<void> {
    const sql = `
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        id TEXT PRIMARY KEY,
        from_email TEXT NOT NULL,
        subject TEXT,
        body TEXT,
        received_at DATETIME,
        processed BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    await this.adapter.execute(sql);
    
    // Create indexes
    await this.adapter.execute(`
      CREATE INDEX IF NOT EXISTS idx_emails_from_email 
      ON ${this.tableName}(from_email)
    `);
    
    await this.adapter.execute(`
      CREATE INDEX IF NOT EXISTS idx_emails_processed 
      ON ${this.tableName}(processed)
    `);
  }

  /**
   * Insert a new email
   */
  async create(email: Omit<EmailRecord, 'created_at' | 'updated_at'>): Promise<EmailRecord> {
    const sql = `
      INSERT INTO ${this.tableName} 
      (id, from_email, subject, body, received_at, processed)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    const params: SqlValue[] = [
      email.id,
      email.from_email,
      email.subject,
      email.body,
      email.received_at,
      email.processed ? 1 : 0
    ];
    
    await this.adapter.execute(sql, params);
    
    // Return the created record
    const created = await this.findById(email.id);
    if (!created) {
      throw new Error(`Failed to create email with id: ${email.id}`);
    }
    
    return created;
  }

  /**
   * Find email by ID
   */
  async findById(id: string): Promise<EmailRecord | null> {
    const sql = `SELECT * FROM ${this.tableName} WHERE id = ?`;
    const result = await this.adapter.queryOne<EmailRecord>(sql, [id]);
    
    if (result) {
      // Convert boolean from number
      result.processed = Boolean(result.processed);
    }
    
    return result;
  }

  /**
   * Find all unprocessed emails
   */
  async findUnprocessed(limit = 100): Promise<EmailRecord[]> {
    const sql = `
      SELECT * FROM ${this.tableName} 
      WHERE processed = 0 
      ORDER BY received_at ASC 
      LIMIT ?
    `;
    
    const results = await this.adapter.query<EmailRecord>(sql, [limit]);
    
    // Convert booleans
    return results.map(email => ({
      ...email,
      processed: Boolean(email.processed)
    }));
  }

  /**
   * Mark email as processed
   */
  async markAsProcessed(id: string): Promise<void> {
    const sql = `
      UPDATE ${this.tableName} 
      SET processed = 1, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `;
    
    const result = await this.adapter.execute(sql, [id]);
    
    if (result.changes === 0) {
      throw new Error(`Email not found: ${id}`);
    }
  }

  /**
   * Batch update emails in a transaction
   */
  async batchMarkAsProcessed(ids: string[]): Promise<void> {
    await this.adapter.transaction(async (tx) => {
      const sql = `
        UPDATE ${this.tableName} 
        SET processed = 1, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `;
      
      for (const id of ids) {
        await tx.execute(sql, [id]);
      }
    });
  }

  /**
   * Search emails by subject
   */
  async searchBySubject(searchTerm: string): Promise<EmailRecord[]> {
    const sql = `
      SELECT * FROM ${this.tableName} 
      WHERE subject LIKE ? 
      ORDER BY received_at DESC 
      LIMIT 100
    `;
    
    const results = await this.adapter.query<EmailRecord>(sql, [`%${searchTerm}%`]);
    
    return results.map(email => ({
      ...email,
      processed: Boolean(email.processed)
    }));
  }

  /**
   * Get email statistics
   */
  async getStatistics(): Promise<{
    total: number;
    processed: number;
    unprocessed: number;
  }> {
    const sql = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN processed = 1 THEN 1 ELSE 0 END) as processed,
        SUM(CASE WHEN processed = 0 THEN 1 ELSE 0 END) as unprocessed
      FROM ${this.tableName}
    `;
    
    const result = await this.adapter.queryOne<{
      total: number;
      processed: number;
      unprocessed: number;
    }>(sql);
    
    return result || { total: 0, processed: 0, unprocessed: 0 };
  }

  /**
   * Use prepared statements for repeated queries
   */
  async processEmailBatch(batchSize = 10): Promise<EmailRecord[]> {
    // Get unprocessed emails
    const selectStmt = this.adapter.prepare<EmailRecord>(`
      SELECT * FROM ${this.tableName} 
      WHERE processed = 0 
      ORDER BY received_at ASC 
      LIMIT ?
    `);
    
    const emails = await selectStmt.all([batchSize]);
    
    // Process each email
    const updateStmt = this.adapter.prepare(`
      UPDATE ${this.tableName} 
      SET processed = 1, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    
    for (const email of emails) {
      await updateStmt.run([email.id]);
      email.processed = true;
    }
    
    // Clean up prepared statements
    selectStmt.finalize();
    updateStmt.finalize();
    
    return emails;
  }
}

// Example usage
async function exampleUsage(): Promise<void> {
  // Create database adapter based on environment
  const config = DatabaseFactory.createConfigFromEnv();
  const adapter = await DatabaseFactory.create(config);
  
  // Create repository with adapter
  const emailRepo = new EmailRepositoryWithAdapter(adapter);
  
  // Initialize table
  await emailRepo.initialize();
  
  // Create a new email
  const newEmail = await emailRepo.create({
    id: 'email_123',
    from_email: 'user@example.com',
    subject: 'Test Email',
    body: 'This is a test email body',
    received_at: new Date().toISOString(),
    processed: false
  });
  
  console.log('Created email:', newEmail);
  
  // Find unprocessed emails
  const unprocessed = await emailRepo.findUnprocessed();
  console.log(`Found ${unprocessed.length} unprocessed emails`);
  
  // Process emails in batch
  await emailRepo.batchMarkAsProcessed(unprocessed.map(e => e.id));
  
  // Get statistics
  const stats = await emailRepo.getStatistics();
  console.log('Email statistics:', stats);
  
  // Clean up
  await adapter.close();
}

// Migration helper for existing repositories
export class RepositoryMigrationHelper {
  /**
   * Migrate an existing repository to use database adapter
   */
  static async migrateRepository<T>(
    oldRepository: any,
    adapter: IDatabaseAdapter,
    tableName: string
  ): Promise<void> {
    // Example migration logic
    console.log(`Migrating ${tableName} to use database adapter...`);
    
    // 1. Export data from old repository
    const allData = await oldRepository.findAll();
    
    // 2. Create table in new database
    await adapter.execute(`
      CREATE TABLE IF NOT EXISTS ${tableName}_migrated 
      AS SELECT * FROM ${tableName}
    `);
    
    // 3. Copy data in batches
    await adapter.transaction(async (tx) => {
      for (const record of allData) {
        // Insert logic here
        console.log('Migrating record:', record.id);
      }
    });
    
    console.log(`Migration of ${tableName} complete`);
  }
}