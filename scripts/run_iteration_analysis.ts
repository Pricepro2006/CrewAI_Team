#!/usr/bin/env node

/**
 * Run iteration analysis (Opus-4 patterns) on test emails
 * for comparison with Granite3.3:2b results
 */

import * as fs from "fs";
import * as sqlite3 from "sqlite3";

// Test email IDs to analyze (same as Granite test)
const testEmailIds = [
  'email-8ef42296-42ba-4e7d-90be-0db338a66daf',
  'email-caa27fb2-eb96-4a20-b007-3891e38263af',
  'email-9bc600d9-a47a-4cef-8972-d05dea17b9ef',
  'email-9cc82b32-7e12-4012-b41a-83757a77f210',
  'email-ff0620c2-1900-4808-a12e-51db1a7ba6ea',
  'email-0b7ae5b6-5246-49c5-aed5-c06e56c9f3a9',
  'email-d534d622-7058-4422-9111-9f8c8fd249fc',
  'email-98dc5793-e04e-4597-8299-d2194105aff5',
  'email-b69eaf2d-1c09-4051-9cb5-b1a707b7b707',
  'email-41bdb30a-ee78-4c20-9afa-5448275be868'
];

async function runIterationAnalysis() {
  const db = getDatabaseConnection();
  const processor = new EmailBatchProcessor();
  const results: any[] = [];

  for (const emailId of testEmailIds) {
    try {
      // Get email from database
      const email = db.prepare(`
        SELECT 
          id,
          subject,
          body,
          sender_email,
          sender_name,
          received_at
        FROM emails
        WHERE id = ?
      `).get(emailId);

      if (email) {
        // Transform to IEMS format for processor
        const iemsEmail = {
          MessageID: email.id,
          Subject: email.subject,
          SenderEmail: email.sender_email,
          SenderName: email.sender_name,
          Recipients: JSON.stringify({ to: [] }), // Use empty for test
          ReceivedTime: email.received_at,
          BodyText: email.body,
          HasAttachments: 0,
          Importance: "normal",
          IsRead: 1,
          ExtractedAt: new Date().toISOString(),
          IsSynthetic: 0
        };

        // Run analysis (using private methods through reflection)
        const analysis = processor['transformIEMSToEmailParams'](iemsEmail);
        const workflowAnalysis = processor['analyzeWorkflowContent'](email.subject, email.body);
        const entities = processor['extractBusinessEntities'](email.subject, email.body, "{}");

        results.push({
          email_id: email.id,
          subject: email.subject,
          body: email.body.substring(0, 500),
          sender: email.sender_email,
          iteration_analysis: {
            workflow_state: workflowAnalysis.workflowState,
            business_process: workflowAnalysis.businessProcess,
            categories: workflowAnalysis.categories,
            urgency_indicators: workflowAnalysis.urgencyIndicators,
            entities: entities
          }
        });
      }
    } catch (error) {
      console.error(`Error analyzing ${emailId}:`, error);
    }
  }

  // Save results
  fs.writeFileSync('iteration_results.json', JSON.stringify(results, null, 2));
  console.log(`Analyzed ${results.length} emails with iteration script`);
  console.log('Results saved to: iteration_results.json');
}

// Run analysis
runIterationAnalysis().catch(console.error);