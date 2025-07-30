import { EmailStorageService } from "../src/api/services/EmailStorageService.js";
import { readdir, readFile } from "fs/promises";
import path from "path";

interface IEMSEmail {
  id: string;
  subject: string;
  from: {
    emailAddress: {
      name: string;
      address: string;
    };
  };
  toRecipients: Array<{
    emailAddress: {
      name: string;
      address: string;
    };
  }>;
  receivedDateTime: string;
  bodyPreview: string;
  importance: string;
  hasAttachments: boolean;
  parentFolderId?: string;
  analysis?: {
    analyzed_at?: string;
    workflow_state?: string;
    quick_priority?: string;
    action_sla_status?: string;
    entities?: any[];
    contextual_summary?: string;
  };
}

async function importIEMSEmails() {
  console.log("Starting IEMS email import...");

  const emailService = new EmailStorageService();
  const emailsDir = "/home/pricepro2006/iems_project/received_emails";

  try {
    // Read all JSON files
    const files = await readdir(emailsDir);
    const jsonFiles = files.filter((f) => f.endsWith(".json"));

    console.log(`Found ${jsonFiles.length} email files to import`);

    let successCount = 0;
    let errorCount = 0;

    for (const file of jsonFiles) {
      try {
        const filePath = path.join(emailsDir, file);
        const content = await readFile(filePath, "utf-8");
        const emailsData = JSON.parse(content);

        // Handle both single email and array of emails
        const emails = Array.isArray(emailsData) ? emailsData : [emailsData];

        for (const iemsEmail of emails) {
          try {
            // Transform IEMS email to our format
            const transformedEmail = transformIEMSEmail(iemsEmail, file);
            await emailService.createEmail(transformedEmail);
            successCount++;
            console.log(
              `✓ Imported: ${transformedEmail.subject.substring(0, 50)}...`,
            );
          } catch (error) {
            errorCount++;
            console.error(`✗ Failed to import email from ${file}:`, error);
          }
        }
      } catch (error) {
        errorCount++;
        console.error(`✗ Failed to process file ${file}:`, error);
      }
    }

    console.log(
      `\nImport complete: ${successCount} emails imported, ${errorCount} errors`,
    );

    // Verify data
    const stats = await emailService.getDashboardStats();
    console.log("\nDashboard Statistics:");
    console.log(`- Total Emails: ${stats.totalEmails}`);
    console.log(`- Critical: ${stats.criticalCount}`);
    console.log(`- In Progress: ${stats.inProgressCount}`);
    console.log(`- Completed: ${stats.completedCount}`);
  } catch (error) {
    console.error("Error during import:", error);
  }

  process.exit(0);
}

function transformIEMSEmail(iemsEmail: IEMSEmail, fileName: string): any {
  // Extract email alias from filename
  let emailAlias = "Team4401@tdsynnex.com";
  if (fileName.includes("InsightHPI")) {
    emailAlias = "InsightHPI@tdsynnex.com";
  } else if (fileName.includes("US_Insightsurface")) {
    emailAlias = "US.InsightSurface@tdsynnex.com";
  } else if (fileName.includes("InsightOrderSupport")) {
    emailAlias = "InsightOrderSupport@tdsynnex.com";
  }

  // Determine status based on analysis
  let status: "red" | "yellow" | "green" = "yellow";
  let statusText = "In Progress";
  let workflowState: "START_POINT" | "IN_PROGRESS" | "COMPLETION" =
    "IN_PROGRESS";

  if (iemsEmail.analysis?.workflow_state) {
    const state = iemsEmail.analysis.workflow_state.toLowerCase();
    if (state.includes("start") || state.includes("new")) {
      status = "red";
      statusText = "New - Needs Attention";
      workflowState = "START_POINT";
    } else if (state.includes("complet") || state.includes("resolv")) {
      status = "green";
      statusText = "Completed";
      workflowState = "COMPLETION";
    }
  }

  // Map priority
  let priority: "Critical" | "High" | "Medium" | "Low" = "Medium";
  if (iemsEmail.analysis?.quick_priority) {
    const p = iemsEmail.analysis.quick_priority.toLowerCase();
    if (p.includes("critical") || p.includes("urgent")) {
      priority = "Critical";
      status = "red";
    } else if (p.includes("high")) {
      priority = "High";
    } else if (p.includes("low")) {
      priority = "Low";
    }
  }

  // Determine workflow type from subject
  let workflowType = "General Support";
  const subject = iemsEmail.subject.toLowerCase();
  if (subject.includes("quote")) {
    workflowType = "Quote Processing";
  } else if (subject.includes("order")) {
    workflowType = "Order Management";
  } else if (subject.includes("invoice")) {
    workflowType = "Billing Support";
  } else if (subject.includes("rma") || subject.includes("return")) {
    workflowType = "RMA Processing";
  } else if (subject.includes("ship")) {
    workflowType = "Shipping Management";
  }

  // Extract entities
  const entities = [];
  if (iemsEmail.analysis?.entities) {
    for (const entity of iemsEmail.analysis.entities) {
      entities.push({
        type: entity.type || "unknown",
        value: entity.value || "",
        context: entity.context || "",
      });
    }
  }

  // Extract recipients
  const recipients = [];
  if (iemsEmail.toRecipients) {
    for (const recipient of iemsEmail.toRecipients) {
      recipients.push({
        type: "to",
        name: recipient.emailAddress.name || "",
        email: recipient.emailAddress.address,
      });
    }
  }

  return {
    messageId:
      iemsEmail.id ||
      `MSG_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    emailAlias,
    requestedBy:
      iemsEmail.from.emailAddress.name || iemsEmail.from.emailAddress.address,
    subject: iemsEmail.subject,
    summary:
      iemsEmail.analysis?.contextual_summary ||
      iemsEmail.bodyPreview.substring(0, 500),
    status,
    statusText,
    workflowState,
    workflowType,
    priority,
    receivedDate: new Date(iemsEmail.receivedDateTime),
    hasAttachments: iemsEmail.hasAttachments,
    isRead: true,
    body: iemsEmail.bodyPreview || "",
    entities,
    recipients,
  };
}

importIEMSEmails().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
