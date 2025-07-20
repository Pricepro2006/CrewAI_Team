#!/usr/bin/env tsx
/**
 * Production database initialization script
 */

import { promises as fs } from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { ConversationService } from '../src/api/services/ConversationService';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'app.db');
const CHROMA_PATH = path.join(DATA_DIR, 'chroma');
const LOGS_PATH = path.join(DATA_DIR, 'logs');

async function ensureDirectories() {
  console.log('📁 Creating data directories...');
  
  const dirs = [DATA_DIR, CHROMA_PATH, LOGS_PATH];
  
  for (const dir of dirs) {
    try {
      await fs.mkdir(dir, { recursive: true });
      console.log(`✅ Created directory: ${dir}`);
    } catch (error) {
      console.error(`❌ Failed to create directory ${dir}:`, error);
    }
  }
}

async function initializeDatabase() {
  console.log('🗃️  Initializing SQLite database...');
  
  try {
    const db = new Database(DB_PATH);
    
    // Create conversations table
    db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        title TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create messages table
    db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
        content TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      )
    `);

    // Create indexes for better performance
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_messages_conversation_id 
      ON messages(conversation_id)
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_messages_timestamp 
      ON messages(timestamp)
    `);

    // Create agent_executions table for tracking
    db.exec(`
      CREATE TABLE IF NOT EXISTS agent_executions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id TEXT,
        agent_type TEXT NOT NULL,
        task TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed')),
        result TEXT,
        error TEXT,
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        metadata TEXT,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      )
    `);

    // Create system_health table for monitoring
    db.exec(`
      CREATE TABLE IF NOT EXISTS system_health (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        component TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('healthy', 'degraded', 'unhealthy')),
        message TEXT,
        checked_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ Database initialized successfully');
    console.log('📊 Database path:', DB_PATH);
    
    db.close();
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}

async function createLogFiles() {
  console.log('📝 Creating log files...');
  
  const logFiles = [
    'app.log',
    'error.log',
    'debug.log',
    'agent-activity.log',
    'system-health.log'
  ];

  for (const logFile of logFiles) {
    const logPath = path.join(LOGS_PATH, logFile);
    try {
      await fs.writeFile(logPath, '', { flag: 'a' });
      console.log(`✅ Created log file: ${logPath}`);
    } catch (error) {
      console.error(`❌ Failed to create log file ${logPath}:`, error);
    }
  }
}

async function createConfigFiles() {
  console.log('⚙️  Creating configuration files...');
  
  const gitignoreUpdate = `
# Data directories
/data/
/logs/
*.db
*.db-journal
*.db-shm
*.db-wal

# ChromaDB
/chroma/
/vectordb/

# Environment
.env.local
.env.production
`;

  try {
    const gitignorePath = path.join(process.cwd(), '.gitignore');
    let gitignoreContent = '';
    
    try {
      gitignoreContent = await fs.readFile(gitignorePath, 'utf-8');
    } catch {
      // File doesn't exist, we'll create it
    }
    
    if (!gitignoreContent.includes('/data/')) {
      await fs.appendFile(gitignorePath, gitignoreUpdate);
      console.log('✅ Updated .gitignore with data directories');
    }
    
  } catch (error) {
    console.error('❌ Failed to update .gitignore:', error);
  }
}

async function testDatabaseConnection() {
  console.log('🔄 Testing database connection...');
  
  try {
    const conversationService = new ConversationService();
    const conversation = await conversationService.create();
    
    await conversationService.addMessage(conversation.id, {
      role: 'user',
      content: 'Test message for database initialization'
    });
    
    const messages = await conversationService.getMessages(conversation.id);
    
    if (messages.length > 0) {
      console.log('✅ Database connection test successful');
    }
    
    // Clean up test data
    await conversationService.delete(conversation.id);
    
  } catch (error) {
    console.error('❌ Database connection test failed:', error);
    throw error;
  }
}

async function main() {
  console.log('🚀 Initializing CrewAI Team Production Database\n');
  
  try {
    await ensureDirectories();
    await initializeDatabase();
    await createLogFiles();
    await createConfigFiles();
    await testDatabaseConnection();
    
    console.log('\n🎉 Production database initialization completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Start Ollama: ollama serve');
    console.log('2. Pull models: ollama pull qwen3:14b && ollama pull qwen3:8b && ollama pull nomic-embed-text');
    console.log('3. Run integration tests: npm run test:integration');
    console.log('4. Start the application: npm run dev');
    
  } catch (error) {
    console.error('\n❌ Production database initialization failed:', error);
    process.exit(1);
  }
}

// Run the initialization
main().catch(console.error);