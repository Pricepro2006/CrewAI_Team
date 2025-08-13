#!/usr/bin/env tsx
/**
 * Verify Email Extraction Coverage
 * Check if all emails from Nick Paul's mailboxes were properly extracted
 */

import Database from "better-sqlite3";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load mailbox and distribution list configurations
const mailboxes = JSON.parse(
  fs.readFileSync("/home/pricepro2006/iems_project/mailboxes.json", "utf-8"),
);

const distributionLists = JSON.parse(
  fs.readFileSync(
    "/home/pricepro2006/iems_project/distribution_list.json",
    "utf-8",
  ),
);

// All email addresses to check
const allEmailAddresses = [
  // Primary mailboxes
  ...mailboxes.map((m: any) => m.email.toLowerCase()),
  // Distribution lists
  ...distributionLists.map((d: any) => d.email.toLowerCase()),
  // Variations
  "t119889c@tdsynnex.com",
  "nick.paul@tdsynnex.com",
];

function analyzeEmailCoverage() {
  console.log("📊 Email Extraction Coverage Analysis\n");
  console.log("Checking emails from May-July 2025\n");

  const db = new Database("./data/crewai.db");

  // 1. Check total emails in database
  const totalEmails = db
    .prepare(
      "SELECT COUNT(*) as count FROM emails WHERE date(received_at) >= '2025-05-01' AND date(received_at) <= '2025-07-31'",
    )
    .get() as any;

  console.log(`Total emails in database: ${totalEmails.count}\n`);

  // 2. Check emails TO each mailbox
  console.log("📧 Emails TO Nick Paul's mailboxes:\n");

  let totalToMailboxes = 0;
  const coverageDetails: any[] = [];

  for (const email of allEmailAddresses) {
    const count = db
      .prepare(
        `SELECT COUNT(*) as count FROM emails 
       WHERE date(received_at) >= '2025-05-01' 
       AND date(received_at) <= '2025-07-31'
       AND LOWER(to_addresses) LIKE ?`,
      )
      .get(`%${email}%`) as any;

    if (count.count > 0) {
      console.log(`   ${email}: ${count.count} emails`);
      totalToMailboxes += count.count;
      coverageDetails.push({ email, count: count.count, type: "TO" });
    }
  }

  console.log(
    `\n   Total TO mailboxes: ${totalToMailboxes} (${((totalToMailboxes / totalEmails.count) * 100).toFixed(1)}%)\n`,
  );

  // 3. Check emails FROM Nick Paul
  console.log("📤 Emails FROM Nick Paul:\n");

  const fromEmails = db
    .prepare(
      `SELECT COUNT(*) as count FROM emails 
     WHERE date(received_at) >= '2025-05-01' 
     AND date(received_at) <= '2025-07-31'
     AND (LOWER(sender_email) = 'nick.paul@tdsynnex.com' 
          OR LOWER(sender_email) = 't119889c@tdsynnex.com')`,
    )
    .get() as any;

  console.log(`   From Nick Paul: ${fromEmails.count} emails\n`);

  // 4. Check for CC/BCC (if captured in to_addresses)
  console.log("📋 Checking for CC/BCC coverage:\n");

  const sampleEmails = db
    .prepare(
      `SELECT to_addresses FROM emails 
     WHERE date(received_at) >= '2025-05-01' 
     AND date(received_at) <= '2025-07-31'
     LIMIT 10`,
    )
    .all() as any[];

  console.log("   Sample to_addresses format:");
  sampleEmails.forEach((e, i) => {
    try {
      const parsed = JSON.parse(e.to_addresses);
      const types = [...new Set(parsed.map((r: any) => r.type))];
      console.log(`   Email ${i + 1}: ${types.join(", ")} recipients`);
    } catch {
      console.log(`   Email ${i + 1}: Unable to parse`);
    }
  });

  // 5. Check unique senders to understand data source
  console.log("\n📮 Top 10 email senders in database:\n");

  const topSenders = db
    .prepare(
      `SELECT sender_email, COUNT(*) as count 
     FROM emails 
     WHERE date(received_at) >= '2025-05-01' 
     AND date(received_at) <= '2025-07-31'
     GROUP BY sender_email 
     ORDER BY count DESC 
     LIMIT 10`,
    )
    .all() as any[];

  topSenders.forEach((s) => {
    console.log(`   ${s.sender_email}: ${s.count} emails`);
  });

  // 6. Check date distribution
  console.log("\n📅 Email distribution by month:\n");

  const monthlyDist = db
    .prepare(
      `SELECT 
       strftime('%Y-%m', received_at) as month,
       COUNT(*) as count
     FROM emails 
     WHERE date(received_at) >= '2025-05-01' 
     AND date(received_at) <= '2025-07-31'
     GROUP BY month
     ORDER BY month`,
    )
    .all() as any[];

  monthlyDist.forEach((m) => {
    console.log(`   ${m.month}: ${m.count} emails`);
  });

  // 7. Estimate missing emails
  console.log("\n⚠️  Coverage Analysis:\n");

  const uniqueToAddresses = totalToMailboxes;
  const coverage = (uniqueToAddresses / totalEmails.count) * 100;

  console.log(
    `   Emails TO Nick Paul's mailboxes: ${uniqueToAddresses} (${coverage.toFixed(1)}%)`,
  );
  console.log(`   Emails FROM Nick Paul: ${fromEmails.count}`);
  console.log(
    `   Other emails in database: ${totalEmails.count - uniqueToAddresses - fromEmails.count}`,
  );

  if (coverage < 50) {
    console.log("\n❌ WARNING: Low coverage detected!");
    console.log(
      "   Less than 50% of emails are TO Nick Paul's managed mailboxes.",
    );
    console.log("   This suggests:");
    console.log(
      "   1. The extraction may have included general TD SYNNEX emails",
    );
    console.log("   2. CC/BCC emails might not be properly captured");
    console.log("   3. Some mailboxes or folders might be missing");
  }

  // Save detailed report
  const report = {
    analysisDate: new Date().toISOString(),
    dateRange: { start: "2025-05-01", end: "2025-07-31" },
    totalEmails: totalEmails.count,
    coverage: {
      toMailboxes: uniqueToAddresses,
      fromNickPaul: fromEmails.count,
      coveragePercentage: coverage,
      details: coverageDetails,
    },
    topSenders,
    monthlyDistribution: monthlyDist,
    mailboxesChecked: allEmailAddresses,
    recommendation: coverage < 50 ? "RE-EXTRACT NEEDED" : "Coverage acceptable",
  };

  fs.writeFileSync(
    path.join(__dirname, "../docs/email-extraction-verification.json"),
    JSON.stringify(report, null, 2),
  );

  console.log(
    "\n📄 Detailed report saved to: docs/email-extraction-verification.json",
  );

  db.close();

  return report;
}

// Run verification
analyzeEmailCoverage();
