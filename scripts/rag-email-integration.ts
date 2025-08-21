#!/usr/bin/env tsx

/**
 * RAG-Email Integration Script
 * Indexes existing emails into the RAG system for semantic search
 * Run this to connect the existing email database with the RAG system
 */

import { EmailRAGIntegration } from "../src/core/rag/EmailRAGIntegration.js";
import { RAGSystem } from "../src/core/rag/RAGSystem.js";
import { logger } from "../src/utils/logger.js";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface EmailRow {
  id: string;
  messageId: string;
  subject: string;
  body: string;
  sender?: string;
  recipients?: string;
  receivedDate: string;
  emailAlias?: string;
  status?: string;
  workflowType?: string;
  priority?: string;
  hasAttachments?: boolean;
  isRead?: boolean;
  chainId?: string;
}

async function main() {
  console.log("🚀 Starting RAG-Email Integration...");
  
  try {
    // Initialize RAG system with optimal email configuration
    const ragConfig = {
      vectorStore: {
        type: "adaptive" as const,
        baseUrl: process.env.CHROMADB_URL || "http://localhost:8001",
        collectionName: process.env.CHROMADB_COLLECTION || "email-rag-collection",
        dimension: 4096,
      },
      chunking: {
        size: 1000,
        overlap: 100,
        method: "sentence" as const,
        trimWhitespace: true,
        preserveFormatting: false,
      },
      retrieval: {
        topK: 10,
        minScore: 0.3,
        reranking: false,
        boostRecent: true,
      },
    };

    console.log("📚 Initializing RAG system...");
    const ragSystem = new RAGSystem(ragConfig);
    await ragSystem.initialize();

    const ragIntegration = new EmailRAGIntegration(ragSystem);
    await ragIntegration.initialize();

    console.log("✅ RAG system initialized successfully");

    // Connect to email database
    const dbPath = path.join(__dirname, "../data/emails.db");
    console.log(`📂 Connecting to email database: ${dbPath}`);
    
    let db: Database.Database;
    try {
      db = new Database(dbPath);
    } catch (error) {
      console.error("❌ Failed to connect to email database:", error);
      console.log("💡 Make sure the email database exists and is accessible");
      process.exit(1);
    }

    // Check if emails table exists
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='emails'").all();
    if (tables.length === 0) {
      console.error("❌ No 'emails' table found in database");
      console.log("💡 Make sure the email processing pipeline has been run first");
      process.exit(1);
    }

    // Get email count
    const countResult = db.prepare("SELECT COUNT(*) as count FROM emails").get() as { count: number };
    const totalEmails = countResult.count;
    
    console.log(`📧 Found ${totalEmails} emails in database`);

    if (totalEmails === 0) {
      console.log("ℹ️  No emails to index. Exiting.");
      process.exit(0);
    }

    // Check for existing indexed emails
    const stats = await ragIntegration.getIndexingStats();
    console.log(`📊 Current RAG stats: ${stats.emailDocuments} emails already indexed`);

    if (stats.emailDocuments >= totalEmails) {
      console.log("✅ All emails appear to be already indexed");
      console.log("🔍 Testing search functionality...");
      await testSearchFunctionality(ragIntegration);
      process.exit(0);
    }

    // Fetch emails in batches and index them
    const batchSize = 100;
    let processed = 0;
    let totalIndexed = 0;
    let totalFailed = 0;
    const errors: string[] = [];

    console.log(`🔄 Starting batch indexing (${batchSize} emails per batch)...`);

    for (let offset = 0; offset < totalEmails; offset += batchSize) {
      console.log(`📥 Processing batch ${Math.floor(offset / batchSize) + 1}/${Math.ceil(totalEmails / batchSize)}...`);
      
      // Fetch batch of emails
      const emailRows = db.prepare(`
        SELECT id, messageId, subject, body, sender, recipients, receivedDate,
               emailAlias, status, workflowType, priority, hasAttachments, isRead, chainId
        FROM emails 
        ORDER BY receivedDate DESC
        LIMIT ? OFFSET ?
      `).all(batchSize, offset) as EmailRow[];

      if (emailRows.length === 0) break;

      // Convert to EmailRecord format
      const emails = emailRows.map(row => ({
        id: row.id,
        messageId: row.messageId,
        subject: row.subject || 'No Subject',
        body: row.body || '',
        sender: row.sender,
        recipients: row.recipients,
        receivedDate: new Date(row.receivedDate),
        emailAlias: row.emailAlias,
        status: row.status as any,
        workflowType: row.workflowType,
        priority: row.priority as any,
        hasAttachments: row.hasAttachments,
        isRead: row.isRead,
        chainId: row.chainId,
      }));

      // Index batch
      try {
        const result = await ragIntegration.batchIndexEmails(emails);
        totalIndexed += result.indexed;
        totalFailed += result.failed;
        errors.push(...result.errors);
        
        processed += emailRows.length;
        const progress = ((processed / totalEmails) * 100).toFixed(1);
        
        console.log(`✅ Batch completed: ${result.indexed}/${emailRows.length} indexed (${progress}% total progress)`);
        
        if (result.failed > 0) {
          console.log(`⚠️  ${result.failed} emails failed in this batch`);
        }
      } catch (error) {
        console.error(`❌ Batch indexing failed:`, error);
        totalFailed += emailRows.length;
      }

      // Small delay to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Final statistics
    console.log("\n📊 Indexing Summary:");
    console.log(`✅ Successfully indexed: ${totalIndexed} emails`);
    console.log(`❌ Failed to index: ${totalFailed} emails`);
    console.log(`📧 Total processed: ${processed} emails`);

    if (errors.length > 0) {
      console.log(`\n⚠️  Errors encountered:`);
      errors.slice(0, 5).forEach(error => console.log(`   - ${error}`));
      if (errors.length > 5) {
        console.log(`   ... and ${errors.length - 5} more errors`);
      }
    }

    // Test search functionality
    if (totalIndexed > 0) {
      console.log("\n🔍 Testing search functionality...");
      await testSearchFunctionality(ragIntegration);
    }

    // Clean up
    db.close();
    console.log("\n🎉 RAG-Email integration completed successfully!");

  } catch (error) {
    console.error("❌ Integration failed:", error);
    process.exit(1);
  }
}

async function testSearchFunctionality(ragIntegration: EmailRAGIntegration) {
  const testQueries = [
    "urgent matters",
    "meeting schedule",
    "project update",
    "payment information",
    "delivery status"
  ];

  for (const query of testQueries) {
    try {
      const results = await ragIntegration.searchEmails(query, { limit: 3 });
      console.log(`🔍 "${query}": ${results.length} results found`);
      
      if (results.length > 0) {
        const topResult = results[0];
        console.log(`   📧 Top match: "${topResult.subject}" (score: ${topResult.score.toFixed(3)})`);
      }
    } catch (error) {
      console.log(`❌ Search failed for "${query}":`, error);
    }
  }
}

// Handle script execution
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("Script execution failed:", error);
    process.exit(1);
  });
}

export { main as runRAGEmailIntegration };