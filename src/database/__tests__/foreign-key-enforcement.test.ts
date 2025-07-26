/**
 * Test suite to verify foreign key enforcement in the database
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { join } from "path";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";

describe("Foreign Key Enforcement", () => {
  let db: Database.Database;
  let tempDir: string;

  beforeEach(() => {
    // Create a temporary database for testing
    tempDir = mkdtempSync(join(tmpdir(), "fk-test-"));
    const dbPath = join(tempDir, "test.db");
    db = new Database(dbPath);

    // Enable foreign keys
    db.pragma("foreign_keys = ON");

    // Create test tables with foreign key relationships
    db.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL
      );

      CREATE TABLE conversations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        content TEXT NOT NULL,
        processing_time INTEGER CHECK (processing_time >= 0),
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      );

      CREATE TABLE email_analysis (
        id TEXT PRIMARY KEY,
        email_id TEXT NOT NULL,
        quick_processing_time INTEGER CHECK (quick_processing_time >= 0),
        deep_processing_time INTEGER CHECK (deep_processing_time >= 0),
        total_processing_time INTEGER CHECK (total_processing_time >= 0),
        FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE CASCADE
      );

      CREATE TABLE emails (
        id TEXT PRIMARY KEY,
        subject TEXT NOT NULL
      );
    `);
  });

  afterEach(() => {
    // Close database and clean up
    db.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe("Foreign Key Constraints", () => {
    it("should enforce foreign key constraints on insert", () => {
      // Try to insert a conversation without a user
      expect(() => {
        db.prepare(
          "INSERT INTO conversations (id, user_id, title) VALUES (?, ?, ?)",
        ).run("conv1", "nonexistent-user", "Test Conversation");
      }).toThrow(/FOREIGN KEY constraint failed/);
    });

    it("should allow insert when foreign key exists", () => {
      // Insert a user first
      db.prepare("INSERT INTO users (id, email, name) VALUES (?, ?, ?)").run(
        "user1",
        "test@example.com",
        "Test User",
      );

      // Now insert a conversation
      const result = db
        .prepare(
          "INSERT INTO conversations (id, user_id, title) VALUES (?, ?, ?)",
        )
        .run("conv1", "user1", "Test Conversation");

      expect(result.changes).toBe(1);
    });

    it("should cascade delete when parent is deleted", () => {
      // Insert test data
      db.prepare("INSERT INTO users (id, email, name) VALUES (?, ?, ?)").run(
        "user1",
        "test@example.com",
        "Test User",
      );

      db.prepare(
        "INSERT INTO conversations (id, user_id, title) VALUES (?, ?, ?)",
      ).run("conv1", "user1", "Test Conversation");

      db.prepare(
        "INSERT INTO messages (id, conversation_id, content, processing_time) VALUES (?, ?, ?, ?)",
      ).run("msg1", "conv1", "Test message", 100);

      // Delete the user
      db.prepare("DELETE FROM users WHERE id = ?").run("user1");

      // Check that conversation and messages were deleted
      const conv = db
        .prepare("SELECT * FROM conversations WHERE id = ?")
        .get("conv1");
      const msg = db
        .prepare("SELECT * FROM messages WHERE id = ?")
        .get("msg1");

      expect(conv).toBeUndefined();
      expect(msg).toBeUndefined();
    });

    it("should verify foreign keys are enabled", () => {
      const result = db.pragma("foreign_keys", { simple: true });
      expect(result).toBe(1);
    });
  });

  describe("Check Constraints", () => {
    it("should prevent negative processing times", () => {
      // Insert required parent records
      db.prepare("INSERT INTO users (id, email, name) VALUES (?, ?, ?)").run(
        "user1",
        "test@example.com",
        "Test User",
      );

      db.prepare(
        "INSERT INTO conversations (id, user_id, title) VALUES (?, ?, ?)",
      ).run("conv1", "user1", "Test Conversation");

      // Try to insert negative processing time
      expect(() => {
        db.prepare(
          "INSERT INTO messages (id, conversation_id, content, processing_time) VALUES (?, ?, ?, ?)",
        ).run("msg1", "conv1", "Test message", -100);
      }).toThrow(/CHECK constraint failed/);
    });

    it("should allow zero and positive processing times", () => {
      // Insert required parent records
      db.prepare("INSERT INTO users (id, email, name) VALUES (?, ?, ?)").run(
        "user1",
        "test@example.com",
        "Test User",
      );

      db.prepare(
        "INSERT INTO conversations (id, user_id, title) VALUES (?, ?, ?)",
      ).run("conv1", "user1", "Test Conversation");

      // Insert with zero processing time
      const result1 = db
        .prepare(
          "INSERT INTO messages (id, conversation_id, content, processing_time) VALUES (?, ?, ?, ?)",
        )
        .run("msg1", "conv1", "Test message", 0);
      expect(result1.changes).toBe(1);

      // Insert with positive processing time
      const result2 = db
        .prepare(
          "INSERT INTO messages (id, conversation_id, content, processing_time) VALUES (?, ?, ?, ?)",
        )
        .run("msg2", "conv1", "Test message", 1000);
      expect(result2.changes).toBe(1);
    });

    it("should enforce multiple processing time constraints", () => {
      // Insert email
      db.prepare("INSERT INTO emails (id, subject) VALUES (?, ?)").run(
        "email1",
        "Test Email",
      );

      // Try to insert with negative quick_processing_time
      expect(() => {
        db.prepare(
          "INSERT INTO email_analysis (id, email_id, quick_processing_time, deep_processing_time, total_processing_time) VALUES (?, ?, ?, ?, ?)",
        ).run("analysis1", "email1", -100, 200, 300);
      }).toThrow(/CHECK constraint failed/);

      // Try to insert with negative deep_processing_time
      expect(() => {
        db.prepare(
          "INSERT INTO email_analysis (id, email_id, quick_processing_time, deep_processing_time, total_processing_time) VALUES (?, ?, ?, ?, ?)",
        ).run("analysis1", "email1", 100, -200, 300);
      }).toThrow(/CHECK constraint failed/);

      // Try to insert with negative total_processing_time
      expect(() => {
        db.prepare(
          "INSERT INTO email_analysis (id, email_id, quick_processing_time, deep_processing_time, total_processing_time) VALUES (?, ?, ?, ?, ?)",
        ).run("analysis1", "email1", 100, 200, -300);
      }).toThrow(/CHECK constraint failed/);

      // Valid insert with all positive values
      const result = db
        .prepare(
          "INSERT INTO email_analysis (id, email_id, quick_processing_time, deep_processing_time, total_processing_time) VALUES (?, ?, ?, ?, ?)",
        )
        .run("analysis1", "email1", 100, 200, 300);
      expect(result.changes).toBe(1);
    });
  });

  describe("Database Integrity", () => {
    it("should maintain referential integrity", () => {
      // Insert test data
      db.prepare("INSERT INTO users (id, email, name) VALUES (?, ?, ?)").run(
        "user1",
        "test@example.com",
        "Test User",
      );

      db.prepare(
        "INSERT INTO conversations (id, user_id, title) VALUES (?, ?, ?)",
      ).run("conv1", "user1", "Test Conversation");

      // Run foreign key check
      const fkCheck = db.pragma("foreign_key_check");
      expect(fkCheck).toEqual([]);
    });

    it("should detect foreign key violations with pragma foreign_key_check", () => {
      // Temporarily disable foreign keys to insert invalid data
      db.pragma("foreign_keys = OFF");

      // Insert conversation without user
      db.prepare(
        "INSERT INTO conversations (id, user_id, title) VALUES (?, ?, ?)",
      ).run("conv1", "nonexistent-user", "Test Conversation");

      // Re-enable foreign keys
      db.pragma("foreign_keys = ON");

      // Run foreign key check
      const fkCheck = db.pragma("foreign_key_check");
      expect(fkCheck.length).toBeGreaterThan(0);
      expect(fkCheck[0]).toMatchObject({
        table: "conversations",
        rowid: expect.any(Number),
        parent: "users",
      });
    });
  });
});