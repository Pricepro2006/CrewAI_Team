import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, "data", "crewai.db");
const db = new Database(dbPath);

console.log("Testing email queries...");

// Test the exact query from the service
const query = `
  SELECT 
    e.id,
    e.sender_email as email_alias,
    e.sender_name as requested_by,
    e.subject,
    ea.contextual_summary as summary,
    ea.workflow_state,
    ea.quick_priority as priority,
    e.received_at as received_date,
    e.is_read,
    e.has_attachments
  FROM emails e
  LEFT JOIN email_analysis ea ON e.id = ea.email_id
  ORDER BY e.received_at DESC
  LIMIT 2 OFFSET 0
`;

try {
  const stmt = db.prepare(query);
  const result = stmt.all();

  console.log("Query result type:", typeof result);
  console.log("Is array:", Array.isArray(result));
  console.log("Result length:", result.length);
  console.log("First item:", result[0]);

  // Test count query
  const countQuery = `
    SELECT COUNT(*) as total
    FROM emails e
    LEFT JOIN email_analysis ea ON e.id = ea.email_id
  `;

  const countStmt = db.prepare(countQuery);
  const countResult = countStmt.get();

  console.log("\nCount result:", countResult);
} catch (error) {
  console.error("Error:", error);
} finally {
  db.close();
}
