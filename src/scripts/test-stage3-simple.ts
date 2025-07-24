#!/usr/bin/env tsx

console.log("Script starting...");

import { Stage3CriticalAnalysis } from "../core/pipeline/Stage3CriticalAnalysis";

console.log("Import complete");

async function test() {
  console.log("Creating Stage3 instance...");
  const stage3 = new Stage3CriticalAnalysis();
  console.log("Stage3 instance created");

  const mockEmail = {
    id: "test-email-1",
    subject: "Test Email",
    sender_email: "test@example.com",
    body: "This is a test email body",
    recipient_emails: "recipient@example.com",
    date_received: new Date().toISOString(),
    folder: "inbox",
    is_read: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    message_id: "msg-123",
  };

  console.log("Calling process method...");
  try {
    const results = await stage3.process([mockEmail]);
    console.log("Results:", results);
  } catch (error) {
    console.error("Error:", error);
  }
}

test()
  .then(() => {
    console.log("Test complete");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Test failed:", error);
    process.exit(1);
  });
