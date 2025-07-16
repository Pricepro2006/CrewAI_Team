import Database from 'better-sqlite3';
import { ChromaClient } from 'chromadb';
import { config } from 'dotenv';
import { resolve } from 'path';
import { mkdir } from 'fs/promises';

// Load environment variables
config();

async function initializeDatabase() {
  console.log('🔧 Initializing AI Agent Team Database...');

  // Create data directories
  const dataDir = resolve('./data');
  const dirs = [
    dataDir,
    resolve(dataDir, 'vectordb'),
    resolve(dataDir, 'documents'),
    resolve(dataDir, 'logs')
  ];

  for (const dir of dirs) {
    await mkdir(dir, { recursive: true });
    console.log(`✓ Created directory: ${dir}`);
  }

  // Initialize SQLite database
  const dbPath = process.env.DATABASE_PATH || './data/app.db';
  const db = new Database(dbPath);

  console.log('📊 Creating database tables...');

  // Create conversations table
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      metadata TEXT,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_messages_conversation 
    ON messages(conversation_id);
  `);

  console.log('✓ Created conversations and messages tables');

  // Create tasks table
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      status TEXT NOT NULL,
      priority INTEGER DEFAULT 0,
      data TEXT NOT NULL,
      result TEXT,
      error TEXT,
      created_at TEXT NOT NULL,
      started_at TEXT,
      completed_at TEXT,
      duration INTEGER,
      metadata TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_created ON tasks(created_at);
  `);

  console.log('✓ Created tasks table');

  db.close();

  // Initialize ChromaDB
  console.log('🔍 Initializing vector database...');
  
  try {
    const chromaClient = new ChromaClient({
      path: process.env.CHROMA_HOST 
        ? `http://${process.env.CHROMA_HOST}:${process.env.CHROMA_PORT || 8000}`
        : 'http://localhost:8000'
    });

    // Test connection
    await chromaClient.heartbeat();
    console.log('✓ ChromaDB connection successful');

    // Create default collection
    try {
      await chromaClient.createCollection({
        name: 'agent-knowledge',
        metadata: { 
          description: 'Knowledge base for AI agents',
          created_at: new Date().toISOString()
        }
      });
      console.log('✓ Created default collection: agent-knowledge');
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        console.log('ℹ️  Collection agent-knowledge already exists');
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.warn('⚠️  ChromaDB not available. Make sure it\'s running for RAG features.');
  }

  // Create sample .env if it doesn't exist
  try {
    await mkdir('.env', { recursive: false });
  } catch {
    // .env might be a file, not a directory
  }

  console.log('\n✅ Database initialization complete!');
  console.log('\nNext steps:');
  console.log('1. Make sure Ollama is installed and running');
  console.log('2. Pull required models: ollama pull qwen3:14b qwen3:8b nomic-embed-text');
  console.log('3. Start the development server: pnpm run dev');
}

// Run initialization
initializeDatabase().catch(console.error);
