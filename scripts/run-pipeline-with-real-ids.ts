import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { runThreePhaseAnalysis } from "./run-three-phase-analysis.js";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database(path.join(__dirname, "../data/crewai.db"));

// Extract real email IDs from batch files
const batches = ["001", "002", "003", "004"];
const emailIds: string[] = [];

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

  // Get the actual database IDs using the main ID field from the JSON
  for (const email of emails) {
    const dbEmail = db
      .prepare("SELECT id FROM emails WHERE id = ? OR graph_id = ?")
      .get(email.id, email.graph_id);
    if (dbEmail) {
      emailIds.push(dbEmail.id);
    }
  }
}

db.close();

console.log(`Found ${emailIds.length} emails to process`);
console.log("Email IDs:", emailIds.slice(0, 5), "...");

// Run the three-phase analysis
runThreePhaseAnalysis(emailIds).catch((error) => {
  console.error("Pipeline failed:", error);
  process.exit(1);
});
