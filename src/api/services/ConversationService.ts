import { v4 as uuidv4 } from "uuid";
import { getDatabase, OptimizedQueryExecutor } from "../../database/index.js";
import Database from "better-sqlite3";
import appConfig from "../../config/app.config.js";

export interface Conversation {
  id: string;
  title?: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id?: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: string;
  metadata?: Record<string, any>;
}

export class ConversationService {
  private db: OptimizedQueryExecutor;

  constructor() {
    this.db = getDatabase(appConfig?.database?.path);
    this.initializeDatabase();
  }

  private initializeDatabase(): void {
    // Enable foreign keys and performance optimizations
    this?.db?.pragma("foreign_keys = ON");
    this?.db?.pragma("journal_mode = WAL");
    this?.db?.pragma("synchronous = NORMAL");
    this?.db?.pragma("cache_size = 10000");
    this?.db?.pragma("temp_store = MEMORY");
    
    this?.db?.exec(`
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

    const stmt = this?.db?.prepare(`
      INSERT INTO conversations (id, created_at, updated_at)
      VALUES (?, ?, ?)
    `);

    stmt.run(id, now, now);

    return {
      id,
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
  }

  async get(id: string): Promise<Conversation | null> {
    const conversation = this.db
      .prepare(
        `
      SELECT * FROM conversations WHERE id = ?
    `,
      )
      .get(id) as any;

    if (!conversation) {
      return null;
    }

    const messages = this.db
      .prepare(
        `
      SELECT * FROM messages 
      WHERE conversation_id = ?
      ORDER BY timestamp ASC
    `,
      )
      .all(id) as any[];

    return {
      id: conversation.id,
      title: conversation.title,
      messages: messages?.map((m: any) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
        metadata: m.metadata ? JSON.parse(m.metadata) : undefined,
      })),
      createdAt: conversation.created_at,
      updatedAt: conversation.updated_at,
    };
  }

  async list(limit: number = 20, offset: number = 0): Promise<Conversation[]> {
    const conversations = this.db
      .prepare(
        `
      SELECT * FROM conversations
      ORDER BY updated_at DESC
      LIMIT ? OFFSET ?
    `,
      )
      .all(limit, offset) as any[];

    return Promise.all(
      conversations?.map((c: any) => this.get(c.id).then((conv: any) => conv!)),
    );
  }

  async addMessage(conversationId: string, message: Message): Promise<void> {
    const messageId = uuidv4();
    const timestamp = new Date().toISOString();

    const stmt = this?.db?.prepare(`
      INSERT INTO messages (id, conversation_id, role, content, timestamp, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      messageId,
      conversationId,
      message.role,
      message.content,
      timestamp,
      message.metadata ? JSON.stringify(message.metadata) : null,
    );

    // Update conversation timestamp
    this.db
      .prepare(
        `
      UPDATE conversations 
      SET updated_at = ?
      WHERE id = ?
    `,
      )
      .run(timestamp, conversationId);
  }

  async updateTitle(conversationId: string, title: string): Promise<void> {
    this.db
      .prepare(
        `
      UPDATE conversations 
      SET title = ?, updated_at = ?
      WHERE id = ?
    `,
      )
      .run(title, new Date().toISOString(), conversationId);
  }

  async delete(conversationId: string): Promise<void> {
    this.db
      .prepare(
        `
      DELETE FROM conversations WHERE id = ?
    `,
      )
      .run(conversationId);
  }

  async clearAll(): Promise<void> {
    this?.db?.prepare("DELETE FROM messages").run();
    this?.db?.prepare("DELETE FROM conversations").run();
  }

  async search(query: string, limit: number = 20): Promise<Conversation[]> {
    // Search in conversation titles and message content
    const searchQuery = `%${query}%`;

    // First, find conversations with matching titles
    const titleMatches = this.db
      .prepare(
        `
      SELECT DISTINCT c.id 
      FROM conversations c
      WHERE c.title LIKE ?
      ORDER BY c.updated_at DESC
      LIMIT ?
    `,
      )
      .all(searchQuery, limit) as any[];

    // Then, find conversations with matching messages
    const messageMatches = this.db
      .prepare(
        `
      SELECT DISTINCT c.id
      FROM conversations c
      JOIN messages m ON c.id = m.conversation_id
      WHERE m.content LIKE ?
      ORDER BY c.updated_at DESC
      LIMIT ?
    `,
      )
      .all(searchQuery, limit) as any[];

    // Combine and deduplicate conversation IDs
    const conversationIds = new Set([
      ...titleMatches?.map((t: any) => t.id),
      ...messageMatches?.map((m: any) => m.id),
    ]);

    // Fetch full conversations
    const conversations = await Promise.all(
      Array.from(conversationIds)
        .slice(0, limit)
        .map((id: any) => this.get(id)),
    );

    return conversations?.filter((c: any) => c !== null) as Conversation[];
  }

  async getRecentConversations(
    days: number = 7,
    limit: number = 50,
  ): Promise<Conversation[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const conversations = this.db
      .prepare(
        `
      SELECT * FROM conversations
      WHERE updated_at >= ?
      ORDER BY updated_at DESC
      LIMIT ?
    `,
      )
      .all(cutoffDate.toISOString(), limit) as any[];

    return Promise.all(
      conversations?.map((c: any) => this.get(c.id).then((conv: any) => conv!)),
    );
  }

  async getConversationStats(): Promise<{
    totalConversations: number;
    totalMessages: number;
    averageMessagesPerConversation: number;
    recentActivity: { date: string; count: number }[];
  }> {
    const totalConversations = (
      this.db
        .prepare(
          `
      SELECT COUNT(*) as count FROM conversations
    `,
        )
        .get() as any
    ).count;

    const totalMessages = (
      this.db
        .prepare(
          `
      SELECT COUNT(*) as count FROM messages
    `,
        )
        .get() as any
    ).count;

    const averageMessagesPerConversation =
      totalConversations > 0 ? totalMessages / totalConversations : 0;

    // Get activity for the last 7 days
    const recentActivity = this.db
      .prepare(
        `
      SELECT 
        DATE(timestamp) as date,
        COUNT(*) as count
      FROM messages
      WHERE timestamp >= datetime('now', '-7 days')
      GROUP BY DATE(timestamp)
      ORDER BY date DESC
    `,
      )
      .all() as any[];

    return {
      totalConversations,
      totalMessages,
      averageMessagesPerConversation:
        Math.round(averageMessagesPerConversation * 10) / 10,
      recentActivity: recentActivity?.map((a: any) => ({
        date: a.date,
        count: a.count,
      })),
    };
  }

  async exportConversation(
    conversationId: string,
    format: "json" | "markdown" = "json",
  ): Promise<string> {
    const conversation = await this.get(conversationId);

    if (!conversation) {
      throw new Error("Conversation not found");
    }

    if (format === "json") {
      return JSON.stringify(conversation, null, 2);
    }

    // Markdown format
    let markdown = `# Conversation: ${conversation.title || conversation.id}\n\n`;
    markdown += `**Created:** ${conversation.createdAt}\n`;
    markdown += `**Updated:** ${conversation.updatedAt}\n\n`;
    markdown += `---\n\n`;

    for (const message of conversation.messages) {
      const role = message?.role?.charAt(0).toUpperCase() + message?.role?.slice(1);
      markdown += `### ${role}\n`;
      markdown += `*${message.timestamp}*\n\n`;
      markdown += `${message.content}\n\n`;
      markdown += `---\n\n`;
    }

    return markdown;
  }

  async exportAllConversations(
    format: "json" | "csv" = "json",
  ): Promise<string> {
    const conversations = await this.list(1000, 0); // Get up to 1000 conversations

    if (format === "json") {
      return JSON.stringify(conversations, null, 2);
    }

    // CSV format - flatten the structure
    let csv =
      "Conversation ID,Title,Created At,Updated At,Message ID,Role,Content,Timestamp\n";

    for (const conversation of conversations) {
      for (const message of conversation.messages) {
        const row = [
          conversation.id,
          conversation.title || "",
          conversation.createdAt,
          conversation.updatedAt,
          message.id || "",
          message.role,
          `"${message?.content?.replace(/"/g, '""')}"`, // Escape quotes
          message.timestamp || "",
        ].join(",");

        csv += row + "\n";
      }
    }

    return csv;
  }
}
