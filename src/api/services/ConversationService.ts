import { v4 as uuidv4 } from 'uuid';
import Database from 'better-sqlite3';
import appConfig from '../../config/app.config';

export interface Conversation {
  id: string;
  title?: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
  metadata?: Record<string, any>;
}

export class ConversationService {
  private db: Database.Database;

  constructor() {
    this.db = new Database(appConfig.database.path);
    this.initializeDatabase();
  }

  private initializeDatabase(): void {
    this.db.exec(`
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
  }

  async create(): Promise<Conversation> {
    const id = uuidv4();
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO conversations (id, created_at, updated_at)
      VALUES (?, ?, ?)
    `);

    stmt.run(id, now, now);

    return {
      id,
      messages: [],
      createdAt: now,
      updatedAt: now
    };
  }

  async get(id: string): Promise<Conversation | null> {
    const conversation = this.db.prepare(`
      SELECT * FROM conversations WHERE id = ?
    `).get(id) as any;

    if (!conversation) {
      return null;
    }

    const messages = this.db.prepare(`
      SELECT * FROM messages 
      WHERE conversation_id = ?
      ORDER BY timestamp ASC
    `).all(id) as any[];

    return {
      id: conversation.id,
      title: conversation.title,
      messages: messages.map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
        metadata: m.metadata ? JSON.parse(m.metadata) : undefined
      })),
      createdAt: conversation.created_at,
      updatedAt: conversation.updated_at
    };
  }

  async list(limit: number = 20, offset: number = 0): Promise<Conversation[]> {
    const conversations = this.db.prepare(`
      SELECT * FROM conversations
      ORDER BY updated_at DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset) as any[];

    return Promise.all(
      conversations.map(c => this.get(c.id).then(conv => conv!))
    );
  }

  async addMessage(
    conversationId: string,
    message: Message
  ): Promise<void> {
    const messageId = uuidv4();
    const timestamp = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO messages (id, conversation_id, role, content, timestamp, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      messageId,
      conversationId,
      message.role,
      message.content,
      timestamp,
      message.metadata ? JSON.stringify(message.metadata) : null
    );

    // Update conversation timestamp
    this.db.prepare(`
      UPDATE conversations 
      SET updated_at = ?
      WHERE id = ?
    `).run(timestamp, conversationId);
  }

  async updateTitle(conversationId: string, title: string): Promise<void> {
    this.db.prepare(`
      UPDATE conversations 
      SET title = ?, updated_at = ?
      WHERE id = ?
    `).run(title, new Date().toISOString(), conversationId);
  }

  async delete(conversationId: string): Promise<void> {
    this.db.prepare(`
      DELETE FROM conversations WHERE id = ?
    `).run(conversationId);
  }

  async clearAll(): Promise<void> {
    this.db.prepare('DELETE FROM messages').run();
    this.db.prepare('DELETE FROM conversations').run();
  }
}
