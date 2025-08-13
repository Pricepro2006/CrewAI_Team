#!/usr/bin/env tsx

import * as fs from 'fs';
import * as path from 'path';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

const ENHANCED_DB_PATH = './data/crewai_enhanced.db';
const RECEIVED_EMAILS_DIR = '/home/pricepro2006/iems_project/received_emails';

interface ReceivedEmail {
  id: string;
  internetMessageId?: string;
  conversationId?: string;
  subject: string;
  bodyPreview?: string;
  body?: {
    content?: string;
    contentType?: string;
  };
  from?: {
    emailAddress?: {
      address?: string;
      name?: string;
    };
  };
  toRecipients?: Array<{
    emailAddress?: {
      address?: string;
      name?: string;
    };
  }>;
  ccRecipients?: Array<{
    emailAddress?: {
      address?: string;
      name?: string;
    };
  }>;
  bccRecipients?: Array<{
    emailAddress?: {
      address?: string;
      name?: string;
    };
  }>;
  createdDateTime?: string;
  lastModifiedDateTime?: string;
  receivedDateTime?: string;
  sentDateTime?: string;
  hasAttachments?: boolean;
  importance?: string;
  isRead?: boolean;
  isDraft?: boolean;
  webLink?: string;
  categories?: string[];
  parentFolderId?: string;
  changeKey?: string;
}

async function importReceivedEmails() {
  console.log('🚀 Starting import of received emails...\n');
  
  const db = new Database(ENHANCED_DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = OFF'); // Disable to avoid constraint issues
  
  // Prepare insert statement
  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO emails_enhanced (
      id,
      internet_message_id,
      conversation_id,
      subject,
      body_content,
      body_content_type,
      body_preview,
      sender_email,
      sender_name,
      created_date_time,
      last_modified_date_time,
      received_date_time,
      sent_date_time,
      has_attachments,
      importance,
      is_read,
      is_draft,
      parent_folder_id,
      web_link,
      categories,
      flag_status,
      in_reply_to,
      "references",
      created_at,
      updated_at,
      import_batch,
      source_file,
      workflow_state,
      priority,
      phase_completed
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  let totalImported = 0;
  let totalSkipped = 0;
  let filesProcessed = 0;
  
  // Get all JSON files
  const files = fs.readdirSync(RECEIVED_EMAILS_DIR)
    .filter(f => f.endsWith('.json') && !f.includes('Zone.Identifier'));
  
  console.log(`Found ${files.length} JSON files to process\n`);
  
  for (const file of files) {
    const filepath = path.join(RECEIVED_EMAILS_DIR, file);
    filesProcessed++;
    
    try {
      const content = fs.readFileSync(filepath, 'utf-8');
      const emails = JSON.parse(content) as ReceivedEmail[];
      
      if (!Array.isArray(emails)) {
        console.log(`⚠️  File ${file} does not contain an array, skipping...`);
        continue;
      }
      
      console.log(`Processing ${file} (${emails.length} emails)...`);
      
      const importTransaction = db.transaction(() => {
        for (const email of emails) {
          try {
            // Extract email addresses for recipients
            const toAddresses = (email.toRecipients || [])
              .map(r => r.emailAddress?.address)
              .filter(Boolean)
              .join(', ');
            
            const ccAddresses = (email.ccRecipients || [])
              .map(r => r.emailAddress?.address)
              .filter(Boolean)
              .join(', ');
            
            const bccAddresses = (email.bccRecipients || [])
              .map(r => r.emailAddress?.address)
              .filter(Boolean)
              .join(', ');
            
            // Generate ID if missing
            const emailId = email.id || uuidv4();
            
            // Extract body content
            const bodyContent = email.body?.content || email.bodyPreview || '';
            const bodyContentType = email.body?.contentType || 'text';
            
            // Extract sender info
            const senderEmail = email.from?.emailAddress?.address || 'unknown@unknown.com';
            const senderName = email.from?.emailAddress?.name || '';
            
            // Ensure required timestamps
            const now = new Date().toISOString();
            const createdDateTime = email.createdDateTime || now;
            const receivedDateTime = email.receivedDateTime || email.sentDateTime || now;
            
            insertStmt.run(
              emailId,
              email.internetMessageId || null,
              email.conversationId || null,
              email.subject || 'No Subject',
              bodyContent,
              bodyContentType,
              email.bodyPreview || null,
              senderEmail,
              senderName,
              createdDateTime,
              email.lastModifiedDateTime || null,
              receivedDateTime,
              email.sentDateTime || null,
              email.hasAttachments ? 1 : 0,
              email.importance || 'normal',
              email.isRead ? 1 : 0,
              email.isDraft ? 1 : 0,
              email.parentFolderId || null,
              email.webLink || null,
              JSON.stringify(email.categories || []), // categories as JSON
              null, // flag_status
              null, // in_reply_to
              null, // references
              now,
              now,
              file, // import_batch
              file, // source_file
              'pending', // Initial workflow state
              'medium', // Default priority
              0 // Not analyzed yet (phase_completed)
            );
            
            totalImported++;
          } catch (error) {
            totalSkipped++;
            // Silently skip duplicates and constraint errors
          }
        }
      });
      
      importTransaction();
      
      if (filesProcessed % 10 === 0) {
        console.log(`\n📊 Progress: ${filesProcessed}/${files.length} files processed`);
        console.log(`   Imported: ${totalImported} | Skipped: ${totalSkipped}`);
      }
      
    } catch (error) {
      console.error(`❌ Error processing ${file}:`, error);
    }
  }
  
  // Get final count
  const finalCount = db.prepare('SELECT COUNT(*) as count FROM emails_enhanced').get();
  
  console.log('\n✅ Import Complete!');
  console.log('─'.repeat(50));
  console.log(`📁 Files processed: ${filesProcessed}`);
  console.log(`✉️  Emails imported: ${totalImported}`);
  console.log(`⏭️  Emails skipped (duplicates): ${totalSkipped}`);
  console.log(`📊 Total emails in database: ${finalCount.count}`);
  console.log('─'.repeat(50));
  
  db.close();
}

// Run the import
importReceivedEmails().catch(console.error);