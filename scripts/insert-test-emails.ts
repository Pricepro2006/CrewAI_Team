import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database(path.join(__dirname, "../data/crewai.db"));

// Load test batch emails
const batches = ["001", "002", "003", "004"];
let totalInserted = 0;

db.prepare("BEGIN").run();

try {
  for (const batchNum of batches) {
    const batchFile = path.join(
      __dirname,
      `../test_batches/emails_batch_${batchNum}.json`,
    );

    if (!fs.existsSync(batchFile)) {
      console.log(`Skipping batch ${batchNum} - file not found`);
      continue;
    }

    const emails = JSON.parse(fs.readFileSync(batchFile, "utf-8"));
    console.log(`Processing batch ${batchNum} with ${emails.length} emails`);

    const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO emails (
        id, graph_id, subject, sender_email, sender_name,
        to_addresses, received_at, body_preview, body,
        importance, categories, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, datetime('now'), datetime('now')
      )
    `);

    for (const email of emails) {
      // Generate simple database ID from graph ID
      const dbId = `test-batch-${batchNum}-${email.graph_id.substring(0, 8)}`;

      const result = insertStmt.run(
        dbId,
        email.graph_id,
        email.subject,
        email.sender_email,
        email.sender_name,
        email.to_addresses,
        email.received_at,
        email.body_preview,
        email.body,
        email.importance,
        email.categories,
      );

      if (result.changes > 0) {
        totalInserted++;
      }
    }
  }

  db.prepare("COMMIT").run();
  console.log(`\nSuccessfully inserted ${totalInserted} emails into database`);

  // Show sample of inserted emails
  const samples = db
    .prepare(
      'SELECT id, subject FROM emails WHERE id LIKE "test-batch-%" LIMIT 5',
    )
    .all();
  console.log("\nSample inserted emails:");
  samples.forEach((row) => {
    console.log(`- ${row.id}: ${row.subject.substring(0, 50)}...`);
  });
} catch (error) {
  db.prepare("ROLLBACK").run();
  console.error("Error inserting emails:", error);
  throw error;
} finally {
  db.close();
}
