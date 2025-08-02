#!/usr/bin/env tsx

/**
 * Direct Email Processing - Bypasses complex infrastructure
 * Processes emails directly from database to identify the issue
 */

import Database from "better-sqlite3";
import path from "path";
import chalk from "chalk";

const DB_PATH = path.join(process.cwd(), "data/crewai.db");

async function main() {
  console.log(chalk.blue.bold("\n🔧 Direct Email Processing (Simplified)\n"));

  const db = new Database(DB_PATH);

  try {
    // Get email count by status
    const statusCount = db
      .prepare(
        `
      SELECT status, COUNT(*) as count 
      FROM emails 
      GROUP BY status
    `,
      )
      .all();

    console.log(chalk.cyan("Email Status Distribution:"));
    statusCount.forEach((row: any) => {
      console.log(`  ${row.status || "null"}: ${row.count}`);
    });

    // Get sample emails
    const emails = db
      .prepare(
        `
      SELECT * FROM emails 
      WHERE status = 'pending' 
      LIMIT 5
    `,
      )
      .all();

    console.log(
      chalk.yellow(`\nProcessing ${emails.length} sample emails...\n`),
    );

    for (const email of emails) {
      console.log(chalk.cyan(`Email: ${email.subject?.substring(0, 50)}...`));
      console.log(`  ID: ${email.id}`);
      console.log(`  From: ${email.from_address}`);
      console.log(`  To: ${email.to_addresses?.substring(0, 50)}...`);

      // Find related emails by subject
      const cleanSubject = (email.subject || "")
        .replace(/^(re:|fw:|fwd:)\s*/gi, "")
        .trim();

      if (cleanSubject) {
        const relatedEmails = db
          .prepare(
            `
          SELECT id, subject, from_address, received_time 
          FROM emails 
          WHERE subject LIKE ? 
          ORDER BY received_time ASC
          LIMIT 10
        `,
          )
          .all(`%${cleanSubject}%`);

        console.log(`  Related emails found: ${relatedEmails.length}`);

        // Simple chain detection
        const chainId = `chain_${email.id.substring(0, 8)}`;

        // Update email with basic analysis
        const updateStmt = db.prepare(`
          UPDATE emails SET
            conversation_id = ?,
            thread_id = ?,
            workflow_state = 'ANALYZED',
            status = 'processed',
            analyzed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `);

        updateStmt.run(chainId, chainId, email.id);
        console.log(chalk.green(`  ✓ Updated with chain ID: ${chainId}`));
      }

      console.log("");
    }

    // Show final status
    const finalCount = db
      .prepare(
        `
      SELECT status, COUNT(*) as count 
      FROM emails 
      WHERE status IN ('pending', 'processed')
      GROUP BY status
    `,
      )
      .all();

    console.log(chalk.green("\nFinal Status:"));
    finalCount.forEach((row: any) => {
      console.log(`  ${row.status}: ${row.count}`);
    });
  } catch (error) {
    console.error(chalk.red("Error:"), error);
  } finally {
    db.close();
  }
}

main().catch(console.error);
