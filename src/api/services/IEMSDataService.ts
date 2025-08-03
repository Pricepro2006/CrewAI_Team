/**
 * IEMS Data Service
 * Handles loading and processing of IEMS email data from JSON files
 */

import * as fs from "fs/promises";
import * as path from "path";
import type {
  RawIEMSEmail,
  IEMSEmail,
  EmailCategory,
  EmailStatus,
  IEMSMailbox,
  IEMSDistributionList,
  CategorizedEmails,
} from "../../types/iems-email.types";
import { logger } from "../../utils/logger";
import { EmailAnalysisAgent } from "../../core/agents/specialized/EmailAnalysisAgent";

export class IEMSDataService {
  private static instance: IEMSDataService;
  private mailboxes: IEMSMailbox[] = [];
  private distributionLists: IEMSDistributionList[] = [];
  private emailCache: Map<string, IEMSEmail> = new Map();
  private emailAnalysisAgent: EmailAnalysisAgent;

  // IEMS project paths
  private readonly IEMS_BASE_PATH = "/home/pricepro2006/iems_project";
  private readonly EMAIL_BATCHES_PATH = path.join(
    this.IEMS_BASE_PATH,
    "db_backups/email_batches",
  );
  private readonly MAILBOXES_FILE = path.join(
    this.IEMS_BASE_PATH,
    "mailboxes.json",
  );
  private readonly DISTRIBUTION_LIST_FILE = path.join(
    this.IEMS_BASE_PATH,
    "distribution_list.json",
  );

  private constructor() {
    this.emailAnalysisAgent = new EmailAnalysisAgent();
  }

  static getInstance(): IEMSDataService {
    if (!IEMSDataService.instance) {
      IEMSDataService.instance = new IEMSDataService();
    }
    return IEMSDataService.instance;
  }

  /**
   * Initialize the service by loading configuration files
   */
  async initialize(): Promise<void> {
    try {
      // Check if IEMS project directory exists
      try {
        await fs.access(this.IEMS_BASE_PATH);
      } catch {
        logger.warn(
          "IEMS project directory not found, using defaults",
          "IEMS_DATA",
          { path: this.IEMS_BASE_PATH },
        );
        this.mailboxes = [];
        this.distributionLists = [];
        return;
      }

      // Load mailboxes
      try {
        const mailboxesData = await fs.readFile(this.MAILBOXES_FILE, "utf-8");
        this.mailboxes = JSON.parse(mailboxesData);
        logger.info("Loaded mailboxes", "IEMS_DATA", {
          count: this.mailboxes.length,
        });
      } catch (error) {
        logger.warn("Could not load mailboxes file", "IEMS_DATA", {
          file: this.MAILBOXES_FILE,
        });
        this.mailboxes = [];
      }

      // Load distribution lists
      try {
        const distListData = await fs.readFile(
          this.DISTRIBUTION_LIST_FILE,
          "utf-8",
        );
        this.distributionLists = JSON.parse(distListData);
        logger.info("Loaded distribution lists", "IEMS_DATA", {
          count: this.distributionLists.length,
        });
      } catch (error) {
        logger.warn("Could not load distribution lists file", "IEMS_DATA", {
          file: this.DISTRIBUTION_LIST_FILE,
        });
        this.distributionLists = [];
      }

      // Initialize email analysis agent
      await this.emailAnalysisAgent.initialize?.();
    } catch (error) {
      logger.error(
        "Failed to initialize IEMS Data Service",
        "IEMS_DATA",
        error as Record<string, any>,
      );
      // Don't throw, allow service to run with defaults
    }
  }

  /**
   * Load and process email batches
   */
  async loadEmailBatches(batchNumbers?: number[]): Promise<RawIEMSEmail[]> {
    const emails: RawIEMSEmail[] = [];

    try {
      const files = await fs.readdir(this.EMAIL_BATCHES_PATH);
      const emailFiles = files
        .filter((f) => f.startsWith("emails_batch_") && f.endsWith(".json"))
        .filter((f) => {
          if (!batchNumbers || batchNumbers.length === 0) return true;
          const batchNum = parseInt(
            f.match(/emails_batch_(\d+)\.json/)?.[1] || "0",
          );
          return batchNumbers.includes(batchNum);
        });

      for (const file of emailFiles) {
        try {
          const filePath = path.join(this.EMAIL_BATCHES_PATH, file);
          const data = await fs.readFile(filePath, "utf-8");
          const batchEmails = JSON.parse(data) as RawIEMSEmail[];
          emails.push(...batchEmails);

          logger.debug("Loaded email batch", "IEMS_DATA", {
            file,
            emailCount: batchEmails.length,
          });
        } catch (error) {
          logger.error("Failed to load email batch", "IEMS_DATA", {
            file,
            error,
          });
        }
      }

      logger.info("Loaded email batches", "IEMS_DATA", {
        totalEmails: emails.length,
        filesProcessed: emailFiles.length,
      });

      return emails;
    } catch (error) {
      logger.error(
        "Failed to load email batches",
        "IEMS_DATA",
        error as Record<string, any>,
      );
      throw error;
    }
  }

  /**
   * Categorize email based on recipient
   */
  categorizeEmail(email: RawIEMSEmail): EmailCategory {
    const recipients = this.parseRecipients(email.Recipients);
    const primaryRecipient = recipients.to[0]?.toLowerCase() || "";

    // Check mailboxes for email aliases
    const isMailboxEmail = this.mailboxes.some(
      (m) => m.email.toLowerCase() === primaryRecipient,
    );

    // Check distribution lists
    const isDistListEmail = this.distributionLists.some(
      (d) => d.email.toLowerCase() === primaryRecipient,
    );

    // Categorize based on recipient patterns
    if (
      primaryRecipient.includes("marketing") ||
      primaryRecipient.includes("splunk")
    ) {
      return "marketing-splunk";
    } else if (primaryRecipient.includes("vmware")) {
      return "vmware-tdsynnex";
    } else if (isMailboxEmail || isDistListEmail) {
      return "email-alias";
    }

    // Default category
    return "email-alias";
  }

  /**
   * Determine email status based on various factors
   */
  determineEmailStatus(email: RawIEMSEmail): EmailStatus {
    // Check workflow state
    if (
      email.workflow_state === "completed" ||
      email.workflow_state === "resolved"
    ) {
      return "green";
    }

    // Check if it's been analyzed
    if (email.AnalyzedAt) {
      // Check priority from analysis
      if (
        email.FullAnalysis?.quick_priority === "urgent" ||
        email.FullAnalysis?.quick_priority === "high"
      ) {
        return "red";
      }

      // Check SLA status
      if (email.FullAnalysis?.action_sla_status === "overdue") {
        return "red";
      }

      if (
        email.workflow_state === "in_progress" ||
        email.FullAnalysis?.workflow_state === "in_progress"
      ) {
        return "yellow";
      }
    }

    // Check if it's unread and recent
    if (email.IsRead === 0) {
      const receivedTime = new Date(email.ReceivedTime);
      const hoursSinceReceived =
        (Date.now() - receivedTime.getTime()) / (1000 * 60 * 60);

      if (hoursSinceReceived < 4) {
        return "yellow"; // Recent unread
      }
    }

    // Default to green for processed/older emails
    return "green";
  }

  /**
   * Generate summary from email content
   */
  async generateSummary(email: RawIEMSEmail): Promise<string> {
    // First check if we have a pre-generated summary
    if (email.FullAnalysis?.quick_summary) {
      return email.FullAnalysis.quick_summary;
    }

    // Use AI to generate summary
    try {
      const analysis = await this.emailAnalysisAgent.analyzeEmail({
        id: email.MessageID,
        subject: email.Subject,
        sender: email.SenderEmail,
        recipient: this.parseRecipients(email.Recipients).to[0] || "",
        content: this.extractTextContent(email.BodyText),
        from: {
          emailAddress: {
            name: email.SenderName,
            address: email.SenderEmail,
          },
        },
        receivedDateTime: email.ReceivedTime,
        isRead: email.IsRead === 1,
        categories: [],
        metadata: {
          importance: email.Importance,
          hasAttachments: email.HasAttachments > 0,
        },
      });

      return analysis.summary || this.generateBasicSummary(email);
    } catch (error) {
      logger.error(
        "Failed to generate AI summary",
        "IEMS_DATA",
        error as Record<string, any>,
      );
      return this.generateBasicSummary(email);
    }
  }

  /**
   * Generate basic summary without AI
   */
  private generateBasicSummary(email: RawIEMSEmail): string {
    const textContent = this.extractTextContent(email.BodyText);
    const firstLines = textContent
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .slice(0, 2)
      .join(" ");

    return firstLines.length > 100
      ? firstLines.substring(0, 97) + "..."
      : firstLines;
  }

  /**
   * Extract text content from HTML
   */
  private extractTextContent(bodyText: string): string {
    // Remove HTML tags
    return bodyText
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Parse recipients JSON string
   */
  private parseRecipients(recipientsStr: string): {
    to: string[];
    cc: string[];
  } {
    try {
      return JSON.parse(recipientsStr);
    } catch {
      return { to: [], cc: [] };
    }
  }

  /**
   * Process raw emails into UI-ready format
   */
  async processEmails(rawEmails: RawIEMSEmail[]): Promise<IEMSEmail[]> {
    const processedEmails: IEMSEmail[] = [];

    for (const rawEmail of rawEmails) {
      try {
        // Check cache first
        const cachedEmail = this.emailCache.get(rawEmail.MessageID);
        if (cachedEmail) {
          processedEmails.push(cachedEmail);
          continue;
        }

        // Process email
        const category = this.categorizeEmail(rawEmail);
        const status = this.determineEmailStatus(rawEmail);
        const summary = await this.generateSummary(rawEmail);

        const processedEmail: IEMSEmail = {
          id: rawEmail.MessageID,
          category,
          emailAlias: this.getEmailAlias(rawEmail),
          requestedBy: rawEmail.SenderName,
          subject: rawEmail.Subject,
          summary,
          status,
          statusText: this.getStatusText(status, rawEmail),
          assignedTo: this.getAssignedTo(rawEmail, category),
          action: this.getActionForEmail(rawEmail, category),
          receivedTime: new Date(rawEmail.ReceivedTime),
          hasAttachments: rawEmail.HasAttachments > 0,
          priority: this.getPriority(rawEmail),
          rawData: rawEmail,
        };

        // Cache the processed email
        this.emailCache.set(rawEmail.MessageID, processedEmail);
        processedEmails.push(processedEmail);
      } catch (error) {
        logger.error("Failed to process email", "IEMS_DATA", {
          messageId: rawEmail.MessageID,
          error,
        });
      }
    }

    return processedEmails;
  }

  /**
   * Get email alias for display
   */
  private getEmailAlias(email: RawIEMSEmail): string {
    const recipients = this.parseRecipients(email.Recipients);
    const primaryRecipient = recipients.to[0] || "";

    // Find matching mailbox or distribution list
    const mailbox = this.mailboxes.find(
      (m) => m.email.toLowerCase() === primaryRecipient.toLowerCase(),
    );

    if (mailbox) {
      return mailbox.name;
    }

    const distList = this.distributionLists.find(
      (d) => d.email.toLowerCase() === primaryRecipient.toLowerCase(),
    );

    if (distList) {
      return distList.name;
    }

    return primaryRecipient;
  }

  /**
   * Get status text for display
   */
  private getStatusText(status: EmailStatus, email: RawIEMSEmail): string {
    if (status === "red") {
      return "Urgent - Requires immediate attention";
    } else if (status === "yellow") {
      return "In Progress - Being handled";
    } else {
      return "Completed - No action needed";
    }
  }

  /**
   * Get assigned team member for marketing emails
   */
  private getAssignedTo(
    email: RawIEMSEmail,
    category: EmailCategory,
  ): string | undefined {
    if (category === "marketing-splunk") {
      // Check if there's an assignment in the workflow state
      // For now, return undefined to show unassigned
      return undefined;
    }
    return undefined;
  }

  /**
   * Get action button text for VMware emails
   */
  private getActionForEmail(
    email: RawIEMSEmail,
    category: EmailCategory,
  ): string | undefined {
    if (category === "vmware-tdsynnex") {
      return "View Case";
    }
    return undefined;
  }

  /**
   * Get email priority
   */
  private getPriority(email: RawIEMSEmail): "high" | "medium" | "low" {
    // Check importance field
    if (email.Importance === "high") return "high";
    if (email.Importance === "low") return "low";

    // Check analysis priority
    const analysisPriority = email.FullAnalysis?.quick_priority;
    if (analysisPriority === "urgent" || analysisPriority === "high")
      return "high";
    if (analysisPriority === "low") return "low";

    // Check mailbox priority
    const recipients = this.parseRecipients(email.Recipients);
    const primaryRecipient = recipients.to[0]?.toLowerCase() || "";

    const mailbox = this.mailboxes.find(
      (m) => m.email.toLowerCase() === primaryRecipient,
    );

    if (mailbox) {
      return mailbox.priority;
    }

    return "medium";
  }

  /**
   * Get categorized emails for dashboard display
   */
  async getCategorizedEmails(limit?: number): Promise<CategorizedEmails> {
    // Load a sample of emails (first few batches for demo)
    const rawEmails = await this.loadEmailBatches([1, 2, 3, 4, 5]);
    const processedEmails = await this.processEmails(rawEmails);

    // Categorize emails
    const categorized: CategorizedEmails = {
      emailAlias: [],
      marketingSplunk: [],
      vmwareTDSynnex: [],
      totalCount: processedEmails.length,
      lastUpdated: new Date(),
    };

    for (const email of processedEmails) {
      switch (email.category) {
        case "email-alias":
          categorized.emailAlias.push(email);
          break;
        case "marketing-splunk":
          categorized.marketingSplunk.push(email);
          break;
        case "vmware-tdsynnex":
          categorized.vmwareTDSynnex.push(email);
          break;
      }
    }

    // Apply limit if specified
    if (limit) {
      categorized.emailAlias = categorized.emailAlias.slice(0, limit);
      categorized.marketingSplunk = categorized.marketingSplunk.slice(0, limit);
      categorized.vmwareTDSynnex = categorized.vmwareTDSynnex.slice(0, limit);
    }

    logger.info("Categorized emails", "IEMS_DATA", {
      emailAlias: categorized.emailAlias.length,
      marketingSplunk: categorized.marketingSplunk.length,
      vmwareTDSynnex: categorized.vmwareTDSynnex.length,
      total: categorized.totalCount,
    });

    return categorized;
  }

  /**
   * Get mailboxes configuration
   */
  getMailboxes(): IEMSMailbox[] {
    return this.mailboxes;
  }

  /**
   * Get distribution lists configuration
   */
  getDistributionLists(): IEMSDistributionList[] {
    return this.distributionLists;
  }
}
