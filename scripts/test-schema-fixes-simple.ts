#!/usr/bin/env tsx

/**
 * Simple test script to verify schema fixes
 * Tests database schema directly without complex imports
 */

import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "crewai_enhanced.db");

function testSchemaFixes() {
  console.log("🔍 Testing schema fixes...\n");

  try {
    const db = new Database(DB_PATH, { readonly: true });

    // 1. Test that internet_message_id column exists
    console.log("1. Checking if internet_message_id column exists...");
    const tableInfo = db.prepare("PRAGMA table_info(emails_enhanced)").all();
    const hasInternetMessageId = tableInfo.some((col: any) => col.name === "internet_message_id");
    const hasMessageId = tableInfo.some((col: any) => col.name === "message_id");
    
    console.log(`   internet_message_id column: ${hasInternetMessageId ? '✅ EXISTS' : '❌ MISSING'}`);
    console.log(`   message_id column: ${hasMessageId ? '⚠️  EXISTS (old column)' : '✅ NOT FOUND (correct)'}`);

    // 2. Test querying with internet_message_id
    console.log("\n2. Testing query with internet_message_id...");
    try {
      const testQuery = db.prepare(
        "SELECT id, internet_message_id, subject FROM emails_enhanced WHERE internet_message_id IS NOT NULL LIMIT 5"
      );
      const results = testQuery.all();
      console.log(`   ✅ Query successful! Found ${results.length} emails`);
      
      if (results.length > 0) {
        console.log(`   Sample message ID: ${results[0].internet_message_id}`);
      }
    } catch (error) {
      console.error("   ❌ Query failed:", error);
    }

    // 3. Test that old message_id queries would fail
    console.log("\n3. Testing that old message_id queries fail (as expected)...");
    try {
      const oldQuery = db.prepare(
        "SELECT id, message_id FROM emails_enhanced LIMIT 1"
      );
      oldQuery.all();
      console.log("   ⚠️  Old query with message_id still works (column might exist)");
    } catch (error: any) {
      if (error.message.includes("no such column: message_id")) {
        console.log("   ✅ Old query correctly fails - message_id column doesn't exist");
      } else {
        console.error("   ❌ Unexpected error:", error.message);
      }
    }

    // 4. Show sample data structure
    console.log("\n4. Sample email data structure:");
    const sampleQuery = db.prepare(`
      SELECT 
        id,
        internet_message_id,
        subject,
        sender_email,
        received_date_time,
        workflow_state,
        phase_completed
      FROM emails_enhanced
      WHERE internet_message_id IS NOT NULL
      LIMIT 1
    `);
    
    const sample = sampleQuery.get();
    if (sample) {
      console.log("   ✅ Sample email:");
      Object.entries(sample).forEach(([key, value]) => {
        const displayValue = typeof value === 'string' && value.length > 50 
          ? value.substring(0, 50) + '...' 
          : value;
        console.log(`      ${key}: ${displayValue}`);
      });
    }

    db.close();
    console.log("\n✨ Schema verification complete!");

  } catch (error) {
    console.error("\n❌ Error:", error);
    process.exit(1);
  }
}

// Run the test
testSchemaFixes();