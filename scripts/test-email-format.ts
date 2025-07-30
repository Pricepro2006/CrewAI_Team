import { getDatabaseManager } from "../src/database/DatabaseManager.js";
import { logger } from "../src/utils/logger.js";

// Helper function to parse recipients
function parseRecipients(
  recipientsStr: string | null,
): Array<{ emailAddress: { address: string; name: string } }> {
  if (!recipientsStr) return [];

  try {
    // Try to parse as JSON first
    const parsed = JSON.parse(recipientsStr);
    if (Array.isArray(parsed)) {
      return parsed.map((r) => ({
        emailAddress: {
          address: typeof r === "string" ? r : r.address || r,
          name:
            typeof r === "string"
              ? r.split("@")[0]
              : r.name || r.address?.split("@")[0] || "Unknown",
        },
      }));
    }
  } catch {
    // If not JSON, treat as comma-separated string
    return recipientsStr.split(",").map((email) => ({
      emailAddress: {
        address: email.trim(),
        name: email.trim().split("@")[0],
      },
    }));
  }

  return [];
}

async function testEmailFormat() {
  try {
    const dbManager = getDatabaseManager();
    await dbManager.initialize();

    const emailRepo = dbManager.emails;
    const result = await emailRepo.queryEmails({
      limit: 1,
      sortBy: "received_at",
      sortOrder: "desc",
    });

    if (result.emails.length === 0) {
      logger.error("No emails found in database", "TEST");
      return;
    }

    const dbEmail = result.emails[0];
    logger.info("Original DB Email", "TEST", {
      id: dbEmail.id,
      sender_email: dbEmail.sender_email,
      sender_name: dbEmail.sender_name,
      subject: dbEmail.subject?.substring(0, 50),
      has_body: !!dbEmail.body_text,
      has_preview: !!dbEmail.body_preview,
    });

    // Transform to agent format
    const transformedEmail = {
      id: dbEmail.id,
      messageId: dbEmail.message_id || dbEmail.id,
      subject: dbEmail.subject || "No Subject",
      body: dbEmail.body_text || dbEmail.body_preview || "",
      bodyPreview:
        dbEmail.body_preview || dbEmail.body_text?.substring(0, 200) || "",
      from: {
        emailAddress: {
          name:
            dbEmail.sender_name ||
            dbEmail.sender_email?.split("@")[0] ||
            "Unknown",
          address: dbEmail.sender_email || "unknown@email.com",
        },
      },
      to: dbEmail.recipients ? parseRecipients(dbEmail.recipients) : [],
      receivedDateTime: dbEmail.received_at || new Date().toISOString(),
      hasAttachments: dbEmail.has_attachments || false,
      isRead: dbEmail.is_read || false,
    };

    logger.info("Transformed Email", "TEST", {
      id: transformedEmail.id,
      hasFrom: !!transformedEmail.from,
      hasEmailAddress: !!transformedEmail.from?.emailAddress,
      fromAddress: transformedEmail.from?.emailAddress?.address,
      fromName: transformedEmail.from?.emailAddress?.name,
      toCount: transformedEmail.to.length,
      bodyLength: transformedEmail.body.length,
      subject: transformedEmail.subject.substring(0, 50),
    });

    // Verify the structure is correct
    if (!transformedEmail.from?.emailAddress?.address) {
      logger.error(
        "Email transformation failed: Missing from.emailAddress.address",
        "TEST",
      );
    } else {
      logger.info(
        "Email transformation successful! Format is correct.",
        "TEST",
      );
    }
  } catch (error) {
    logger.error("Test failed", "TEST", { error });
  } finally {
    process.exit(0);
  }
}

testEmailFormat();
