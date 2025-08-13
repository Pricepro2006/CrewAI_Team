import Database from "better-sqlite3";

async function debugPipelineMetrics() {
  console.log("🔍 Debugging Pipeline Metrics\n");

  const db = new Database("./data/crewai.db");

  try {
    // Check if emails_enhanced table exists and has data
    const emailsEnhanced = db
      .prepare("SELECT COUNT(*) as count FROM emails_enhanced")
      .get() as { count: number };
    console.log(`emails_enhanced count: ${emailsEnhanced.count}`);

    // Check status distribution
    const statusDist = db
      .prepare(
        "SELECT status, COUNT(*) as count FROM emails_enhanced GROUP BY status",
      )
      .all();
    console.log("\nStatus distribution:");
    statusDist.forEach((row: any) => {
      console.log(`  ${row.status}: ${row.count}`);
    });

    // Check if columns exist
    const columns = db.prepare("PRAGMA table_info(emails_enhanced)").all();
    const columnNames = columns.map((col: any) => col.name);
    console.log("\nColumns in emails_enhanced:");
    console.log(`  Has received_at: ${columnNames.includes("received_at")}`);
    console.log(`  Has created_at: ${columnNames.includes("created_at")}`);
    console.log(`  Has processed_at: ${columnNames.includes("processed_at")}`);
    console.log(`  Has updated_at: ${columnNames.includes("updated_at")}`);

    // Try the queries used in getPipelineMetrics
    console.log("\n📊 Testing Pipeline Metric Queries:");

    try {
      const todaysEmails = db
        .prepare(
          `
        SELECT COUNT(*) as count FROM emails_enhanced 
        WHERE received_at >= date('now', 'start of day')
      `,
        )
        .get() as { count: number };
      console.log(`✅ Today's emails: ${todaysEmails.count}`);
    } catch (e) {
      console.log(`❌ Today's emails query failed: ${e}`);
    }

    try {
      const unprocessedEmails = db
        .prepare(
          `
        SELECT COUNT(*) as count FROM emails_enhanced 
        WHERE status IN ('new', 'pending')
      `,
        )
        .get() as { count: number };
      console.log(`✅ Unprocessed emails: ${unprocessedEmails.count}`);
    } catch (e) {
      console.log(`❌ Unprocessed emails query failed: ${e}`);
    }

    // Check email_analysis table
    console.log("\n📊 Checking email_analysis table:");
    try {
      const analysisCount = db
        .prepare("SELECT COUNT(*) as count FROM email_analysis")
        .get() as { count: number };
      console.log(`✅ email_analysis count: ${analysisCount.count}`);

      // Check for the columns used in stage calculations
      const analysisColumns = db
        .prepare("PRAGMA table_info(email_analysis)")
        .all();
      const analysisColumnNames = analysisColumns.map((col: any) => col.name);
      console.log(
        `  Has pipeline_stage: ${analysisColumnNames.includes("pipeline_stage")}`,
      );
      console.log(
        `  Has analysis_timestamp: ${analysisColumnNames.includes("analysis_timestamp")}`,
      );
      console.log(
        `  Has created_at: ${analysisColumnNames.includes("created_at")}`,
      );
    } catch (e) {
      console.log(`❌ email_analysis query failed: ${e}`);
    }

    // Check the actual emails table
    console.log("\n📊 Checking emails table:");
    const emailsCount = db
      .prepare("SELECT COUNT(*) as count FROM emails")
      .get() as { count: number };
    console.log(`✅ emails count: ${emailsCount.count}`);

    // Sample data from each table
    console.log("\n📝 Sample data:");

    const sampleEmail = db.prepare("SELECT * FROM emails LIMIT 1").get();
    console.log("\nSample from emails table:");
    console.log(JSON.stringify(sampleEmail, null, 2));

    const sampleEnhanced = db
      .prepare("SELECT * FROM emails_enhanced LIMIT 1")
      .get();
    console.log("\nSample from emails_enhanced table:");
    console.log(JSON.stringify(sampleEnhanced, null, 2));

    const sampleAnalysis = db
      .prepare("SELECT * FROM email_analysis LIMIT 1")
      .get();
    console.log("\nSample from email_analysis table:");
    console.log(JSON.stringify(sampleAnalysis, null, 2));
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    db.close();
  }
}

debugPipelineMetrics().catch(console.error);
