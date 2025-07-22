import Database from 'better-sqlite3';
import { config } from 'dotenv';

// Load environment variables
config();

async function checkAndUpdateDatabase() {
  console.log('🔧 Checking and updating database schema...');

  const dbPath = process.env.DATABASE_PATH || './data/app.db';
  const db = new Database(dbPath);

  try {
    // Check if emails table exists
    const emailsTableExists = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='emails'
    `).get();

    if (!emailsTableExists) {
      console.log('❌ emails table does not exist. Please run init:db first.');
      return;
    }

    // Check if assignedTo column exists
    const columns = db.prepare("PRAGMA table_info(emails)").all();
    const hasAssignedTo = columns.some((col: any) => col.name === 'assignedTo');
    const hasLastUpdated = columns.some((col: any) => col.name === 'lastUpdated');

    if (!hasAssignedTo) {
      console.log('📝 Adding assignedTo column to emails table...');
      db.exec('ALTER TABLE emails ADD COLUMN assignedTo TEXT');
      console.log('✅ Added assignedTo column');
    } else {
      console.log('✓ assignedTo column already exists');
    }

    if (!hasLastUpdated) {
      console.log('📝 Adding lastUpdated column to emails table...');
      db.exec('ALTER TABLE emails ADD COLUMN lastUpdated TEXT');
      console.log('✅ Added lastUpdated column');
    } else {
      console.log('✓ lastUpdated column already exists');
    }

    // Check if activity_logs table exists
    const activityLogsExists = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='activity_logs'
    `).get();

    if (!activityLogsExists) {
      console.log('📝 Creating activity_logs table...');
      db.exec(`
        CREATE TABLE activity_logs (
          id TEXT PRIMARY KEY,
          email_id TEXT,
          action TEXT NOT NULL,
          user_id TEXT NOT NULL,
          details TEXT,
          timestamp TEXT NOT NULL,
          FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE CASCADE
        )
      `);
      
      // Create indexes
      db.exec(`
        CREATE INDEX idx_activity_logs_email_id ON activity_logs(email_id);
        CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id);
        CREATE INDEX idx_activity_logs_timestamp ON activity_logs(timestamp);
      `);
      
      console.log('✅ Created activity_logs table with indexes');
    } else {
      console.log('✓ activity_logs table already exists');
    }

    // Create indexes for assignedTo and lastUpdated if they don't exist
    const indexes = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='index'
    `).all();

    const indexNames = indexes.map((idx: any) => idx.name);

    if (!indexNames.includes('idx_emails_assignedTo')) {
      db.exec('CREATE INDEX idx_emails_assignedTo ON emails(assignedTo)');
      console.log('✅ Created index on assignedTo');
    }

    if (!indexNames.includes('idx_emails_lastUpdated')) {
      db.exec('CREATE INDEX idx_emails_lastUpdated ON emails(lastUpdated)');
      console.log('✅ Created index on lastUpdated');
    }

    console.log('\n✅ Database schema update complete!');
    
    // Show current schema
    console.log('\n📊 Current emails table schema:');
    const emailColumns = db.prepare("PRAGMA table_info(emails)").all();
    emailColumns.forEach((col: any) => {
      console.log(`  - ${col.name}: ${col.type}${col.notnull ? ' NOT NULL' : ''}${col.pk ? ' PRIMARY KEY' : ''}`);
    });

  } catch (error) {
    console.error('❌ Error updating database:', error);
    process.exit(1);
  } finally {
    db.close();
  }
}

// Run the check and update
checkAndUpdateDatabase().catch(console.error);