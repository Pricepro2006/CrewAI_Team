import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const TEST_DIR = './test-email-batches';
const BATCH_SIZE = 5;
const TOTAL_EMAILS = 20;

interface EmailRecord {
  MessageID: string;
  Subject: string;
  SenderEmail: string;
  SenderName: string;
  Recipients: string;
  ReceivedTime: string;
  FolderPath: string;
  BodyText: string;
  HasAttachments: number;
  Importance: string;
  MailboxSource: string;
  ThreadID: string;
  ConversationID: string;
  BodyHTML: string | null;
  IsRead: number;
  ExtractedAt: string;
  AnalyzedAt: string | null;
  SuggestedThemes: string | null;
  SuggestedCategory: string | null;
  KeyPhrases: string | null;
  FullAnalysis: string | null;
  IsSynthetic: number;
  workflow_state: string | null;
}

async function testEmailBatching() {
  console.log('🚀 Starting Email Batch Processing Test\n');
  
  // Create test directory
  if (!fs.existsSync(TEST_DIR)) {
    fs.mkdirSync(TEST_DIR, { recursive: true });
  }
  
  // Connect to database
  const db = new Database('./data/crewai.db', { readonly: true });
  
  try {
    // Get 20 emails from the database
    const emails = db.prepare(`
      SELECT 
        id as MessageID,
        subject as Subject,
        sender_email as SenderEmail,
        sender_name as SenderName,
        to_addresses as Recipients,
        received_at as ReceivedTime,
        'Inbox' as FolderPath,
        COALESCE(body, body_preview, '') as BodyText,
        has_attachments as HasAttachments,
        COALESCE(importance, 'normal') as Importance,
        'T119889C@TDSynnex.com' as MailboxSource,
        id as ThreadID,
        '' as ConversationID,
        null as BodyHTML,
        is_read as IsRead,
        created_at as ExtractedAt,
        null as AnalyzedAt,
        null as SuggestedThemes,
        null as SuggestedCategory,
        null as KeyPhrases,
        null as FullAnalysis,
        0 as IsSynthetic,
        null as workflow_state
      FROM emails
      ORDER BY received_at DESC
      LIMIT ?
    `).all(TOTAL_EMAILS) as EmailRecord[];
    
    console.log(`✅ Retrieved ${emails.length} emails from database\n`);
    
    // Process emails in batches
    let batchNumber = 1;
    for (let i = 0; i < emails.length; i += BATCH_SIZE) {
      const batch = emails.slice(i, i + BATCH_SIZE);
      
      // Format Recipients field to match expected JSON structure
      batch.forEach(email => {
        try {
          // Parse to_addresses if it's a JSON string
          const toAddresses = JSON.parse(email.Recipients || '[]');
          email.Recipients = JSON.stringify({
            to: Array.isArray(toAddresses) ? toAddresses : [toAddresses],
            cc: []
          });
        } catch {
          // If parsing fails, create default structure
          email.Recipients = JSON.stringify({
            to: [email.Recipients || ''],
            cc: []
          });
        }
      });
      
      // Save batch to file
      const filename = path.join(TEST_DIR, `test_emails_batch_${batchNumber}.json`);
      fs.writeFileSync(filename, JSON.stringify(batch, null, 2));
      
      console.log(`📁 Created batch ${batchNumber}: ${filename}`);
      console.log(`   - Contains ${batch.length} emails`);
      console.log(`   - First email: "${batch[0]?.Subject?.substring(0, 50)}..."`);
      
      batchNumber++;
    }
    
    console.log('\n✅ Email batching test completed successfully!');
    console.log(`📊 Created ${batchNumber - 1} batches in ${TEST_DIR}/`);
    
    // Compare with existing batch structure
    console.log('\n🔍 Comparing with existing batch format...');
    const existingBatchPath = '/home/pricepro2006/iems_project/db_backups/email_batches/emails_batch_1.json';
    if (fs.existsSync(existingBatchPath)) {
      const existingBatch = JSON.parse(fs.readFileSync(existingBatchPath, 'utf-8'));
      const testBatch = JSON.parse(fs.readFileSync(path.join(TEST_DIR, 'test_emails_batch_1.json'), 'utf-8'));
      
      console.log('\nField comparison:');
      const existingFields = Object.keys(existingBatch[0] || {}).sort();
      const testFields = Object.keys(testBatch[0] || {}).sort();
      
      console.log(`Existing batch fields (${existingFields.length}):`, existingFields.slice(0, 5).join(', '), '...');
      console.log(`Test batch fields (${testFields.length}):`, testFields.slice(0, 5).join(', '), '...');
      
      // Check for missing fields
      const missingFields = existingFields.filter(f => !testFields.includes(f));
      const extraFields = testFields.filter(f => !existingFields.includes(f));
      
      if (missingFields.length === 0 && extraFields.length === 0) {
        console.log('\n✅ Field structure matches perfectly!');
      } else {
        if (missingFields.length > 0) {
          console.log('\n⚠️  Missing fields:', missingFields);
        }
        if (extraFields.length > 0) {
          console.log('\n⚠️  Extra fields:', extraFields);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error during email batching test:', error);
  } finally {
    db.close();
  }
}

// Run the test
testEmailBatching().catch(console.error);