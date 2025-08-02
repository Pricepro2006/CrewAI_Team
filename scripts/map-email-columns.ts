/**
 * Maps email database columns to the format expected by EmailThreePhaseAnalysisService
 */

export function mapEmailColumnsForAnalysis(dbEmail: any): any {
  // Handle to_addresses which might be JSON array or string
  let recipientEmails = dbEmail.to_addresses;
  if (
    recipientEmails &&
    typeof recipientEmails === "string" &&
    recipientEmails.startsWith("[")
  ) {
    try {
      const parsed = JSON.parse(recipientEmails);
      // Convert array of email objects to comma-separated string
      if (Array.isArray(parsed)) {
        recipientEmails = parsed
          .map((r: any) =>
            typeof r === "string" ? r : r.email || r.address || "",
          )
          .filter(Boolean)
          .join(", ");
      }
    } catch (e) {
      // If parsing fails, use as-is
    }
  }

  return {
    ...dbEmail, // Include all original fields first
    id: dbEmail.id,
    message_id: dbEmail.message_id || "",
    subject: dbEmail.subject || "",
    body: dbEmail.body_text || dbEmail.body || "", // Map body_text to body
    body_text: dbEmail.body_text || dbEmail.body || "", // Keep both for compatibility
    body_preview: dbEmail.body_preview || "",
    sender_email: dbEmail.from_address || "", // Map from_address to sender_email
    from_address: dbEmail.from_address || "", // Keep both for compatibility
    sender_name: dbEmail.sender_name || "",
    recipient_emails: recipientEmails || "", // Processed recipient emails
    to_addresses: recipientEmails || "", // Keep both for compatibility
    received_at:
      dbEmail.received_time || dbEmail.received_at || new Date().toISOString(),
    received_time:
      dbEmail.received_time || dbEmail.received_at || new Date().toISOString(),
    importance: dbEmail.importance || "normal",
    conversation_id: dbEmail.conversation_id || null,
    thread_id: dbEmail.thread_id || null,
  };
}

export function mapEmailBatch(emails: any[]): any[] {
  return emails.map(mapEmailColumnsForAnalysis);
}
