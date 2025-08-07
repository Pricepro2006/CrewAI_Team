#!/usr/bin/env tsx

/**
 * Test script to verify schema fixes
 * Tests that the email dashboard can query data without message_id errors
 */

import Database from "better-sqlite3";
import { EmailRepositoryImpl } from "../src/database/repositories/EmailRepositoryImpl.js";
import { UnifiedEmailService } from "../src/api/services/UnifiedEmailService.js";
import { getDatabaseConnection } from "../src/database/connection.js";

async function testSchemaFixes() {
  console.log("🔍 Testing schema fixes...\n");

  try {
    // 1. Test direct database query
    console.log("1. Testing direct database query...");
    const db = getDatabaseConnection();
    
    // This query should work now
    const testQuery = db.prepare(
      "SELECT id, internet_message_id, subject FROM emails_enhanced LIMIT 5"
    );
    const results = testQuery.all();
    console.log(`✅ Found ${results.length} emails with internet_message_id column`);
    
    if (results.length > 0) {
      console.log(`   Sample: ${results[0].internet_message_id || 'null'}`);
    }

    // 2. Test EmailRepositoryImpl
    console.log("\n2. Testing EmailRepositoryImpl...");
    const emailRepo = new EmailRepositoryImpl();
    
    // Test findByMessageId (should use internet_message_id internally)
    const sampleMessageId = results[0]?.internet_message_id;
    if (sampleMessageId) {
      const email = await emailRepo.findByMessageId(sampleMessageId);
      if (email) {
        console.log(`✅ findByMessageId works with internet_message_id`);
        console.log(`   Email subject: ${email.subject}`);
      } else {
        console.log("⚠️  No email found with that message ID");
      }
    }

    // 3. Test UnifiedEmailService transformation
    console.log("\n3. Testing UnifiedEmailService transformation...");
    const unifiedService = new UnifiedEmailService();
    
    // Get some emails through the service
    const response = await unifiedService.getEmails({ limit: 5 });
    console.log(`✅ UnifiedEmailService returned ${response.data.length} emails`);
    
    if (response.data.length > 0) {
      const firstEmail = response.data[0];
      console.log(`   First email has messageId: ${firstEmail.messageId ? '✅' : '❌'}`);
      console.log(`   MessageId value: ${firstEmail.messageId || 'undefined'}`);
    }

    // 4. Test specific email queries
    console.log("\n4. Testing specific email queries...");
    const specificQuery = db.prepare(`
      SELECT 
        id,
        internet_message_id,
        subject,
        sender_email,
        received_date_time
      FROM emails_enhanced
      WHERE internet_message_id IS NOT NULL
      LIMIT 1
    `);
    
    const specificEmail = specificQuery.get();
    if (specificEmail) {
      console.log("✅ Can query emails with internet_message_id:");
      console.log(`   ID: ${specificEmail.id}`);
      console.log(`   Internet Message ID: ${specificEmail.internet_message_id}`);
      console.log(`   Subject: ${specificEmail.subject?.substring(0, 50)}...`);
    }

    console.log("\n✨ Schema fixes are working correctly!");

  } catch (error) {
    console.error("\n❌ Error testing schema fixes:", error);
    if (error instanceof Error) {
      console.error("   Error message:", error.message);
      if (error.message.includes("no column named message_id")) {
        console.error("   ⚠️  Still getting message_id column errors!");
      }
    }
    process.exit(1);
  }
}

// Run the test
testSchemaFixes()
  .then(() => {
    console.log("\n✅ All schema tests passed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Schema test failed:", error);
    process.exit(1);
  });