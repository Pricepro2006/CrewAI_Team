#!/usr/bin/env node

/**
 * Email Batch Processor
 *
 * Processes email batch JSON files from the IEMS project backup and imports them
 * into the CrewAI Team unified email database system.
 *
 * Usage: npm run process-emails [batch-file-path] [--all] [--dry-run]
 */

import * as fs from "fs";
import * as path from "path";
import { getDatabaseConnection } from "@/database/connection";
import { EmailRepository } from "@/database/repositories/EmailRepository";
import { logger } from "@/utils/logger";

interface IEMSEmailData {
  MessageID: string;
  Subject: string;
  SenderEmail: string;
  SenderName: string;
  Recipients: string; // JSON string
  ReceivedTime: string; // ISO datetime
  FolderPath?: string;
  BodyText: string; // HTML content
  HasAttachments: number; // 0 or 1
  Importance: string;
  MailboxSource?: string;
  ThreadID?: string;
  ConversationID?: string;
  BodyHTML?: string | null;
  IsRead: number; // 0 or 1
  ExtractedAt: string;
  AnalyzedAt?: string | null;
  SuggestedThemes?: string | null;
  SuggestedCategory?: string | null;
  KeyPhrases?: string | null;
  FullAnalysis?: string | null;
  IsSynthetic: number; // 0 or 1
  workflow_state?: string | null;
}

interface ProcessingStats {
  total: number;
  processed: number;
  errors: number;
  skipped: number;
  duplicates: number;
}

class EmailBatchProcessor {
  private db: any;
  private emailRepository: EmailRepository;
  private stats: ProcessingStats = {
    total: 0,
    processed: 0,
    errors: 0,
    skipped: 0,
    duplicates: 0,
  };

  constructor() {
    this.db = getDatabaseConnection();
    this.emailRepository = new EmailRepository({ db: this.db });
  }

  /**
   * Process a single email batch file
   */
  async processBatchFile(
    filePath: string,
    dryRun: boolean = false,
  ): Promise<ProcessingStats> {
    logger.info(`Processing batch file: ${filePath}`, "EMAIL_BATCH_PROCESSOR");

    if (!fs.existsSync(filePath)) {
      throw new Error(`Batch file not found: ${filePath}`);
    }

    let emailBatch: IEMSEmailData[];

    try {
      const fileContent = fs.readFileSync(filePath, "utf-8");
      emailBatch = JSON.parse(fileContent);

      if (!Array.isArray(emailBatch)) {
        throw new Error("Invalid batch file format: expected array of emails");
      }

      this.stats.total = emailBatch.length;
      logger.info(
        `Found ${this.stats.total} emails in batch file`,
        "EMAIL_BATCH_PROCESSOR",
      );
    } catch (error) {
      logger.error(
        `Failed to parse batch file: ${error}`,
        "EMAIL_BATCH_PROCESSOR",
      );
      throw error;
    }

    // Process emails in chunks to manage memory and provide progress updates
    const chunkSize = 100;
    for (let i = 0; i < emailBatch.length; i += chunkSize) {
      const chunk = emailBatch.slice(i, i + chunkSize);
      await this.processEmailChunk(chunk, dryRun);

      logger.info(
        `Processed ${Math.min(i + chunkSize, emailBatch.length)}/${emailBatch.length} emails`,
        "EMAIL_BATCH_PROCESSOR",
      );
    }

    logger.info(
      `Batch processing completed. Stats:`,
      "EMAIL_BATCH_PROCESSOR",
      this.stats,
    );
    return { ...this.stats };
  }

  /**
   * Process a chunk of emails
   */
  private async processEmailChunk(
    emails: IEMSEmailData[],
    dryRun: boolean,
  ): Promise<void> {
    for (const iemsEmail of emails) {
      try {
        await this.processSingleEmail(iemsEmail, dryRun);
      } catch (error) {
        this.stats.errors++;
        logger.error(
          `Failed to process email ${iemsEmail.MessageID}: ${error}`,
          "EMAIL_BATCH_PROCESSOR",
        );
      }
    }
  }

  /**
   * Process a single email and convert it to our schema
   */
  private async processSingleEmail(
    iemsEmail: IEMSEmailData,
    dryRun: boolean,
  ): Promise<void> {
    try {
      // Skip synthetic emails if desired (they're test data)
      if (iemsEmail.IsSynthetic === 1) {
        this.stats.skipped++;
        logger.debug(
          `Skipping synthetic email: ${iemsEmail.MessageID}`,
          "EMAIL_BATCH_PROCESSOR",
        );
        return;
      }

      // Check if email already exists (skip check in dry-run mode)
      const existingEmail = await this.checkEmailExists(
        iemsEmail.MessageID,
        dryRun,
      );
      if (existingEmail) {
        this.stats.duplicates++;
        logger.debug(
          `Email already exists: ${iemsEmail.MessageID}`,
          "EMAIL_BATCH_PROCESSOR",
        );
        return;
      }

      // Transform IEMS format to our CreateEmailParams format
      const emailParams = this.transformIEMSToEmailParams(iemsEmail);

      if (dryRun) {
        console.log(
          `\n[DRY RUN] Enhanced extraction for: ${emailParams.subject}`,
        );
        console.log(`  - Workflow State: ${emailParams.workflowState}`);
        console.log(`  - Business Process: ${emailParams.businessProcess}`);
        console.log(
          `  - Categories: ${JSON.stringify(emailParams.categories)}`,
        );
        console.log(`  - Entities:`);
        if (emailParams.entities) {
          if (emailParams.entities.orders?.length)
            console.log(
              `    - Orders: ${emailParams.entities.orders.join(", ")}`,
            );
          if (emailParams.entities.skus?.length)
            console.log(
              `    - SKUs/References: ${emailParams.entities.skus.join(", ")}`,
            );
          if (emailParams.entities.companies?.length)
            console.log(
              `    - Companies: ${emailParams.entities.companies.join(", ")}`,
            );
          if (emailParams.entities.vendors?.length)
            console.log(
              `    - Vendors: ${emailParams.entities.vendors.join(", ")}`,
            );
          if (emailParams.entities.quotes?.length)
            console.log(
              `    - Quotes: ${emailParams.entities.quotes.join(", ")}`,
            );
          if (emailParams.entities.amounts?.length)
            console.log(
              `    - Amounts: ${emailParams.entities.amounts.join(", ")}`,
            );
        }
        console.log(
          `  - Urgency: ${JSON.stringify(emailParams.urgencyIndicators)}`,
        );
        this.stats.processed++;
      } else {
        // Create email in database
        const emailId = await this.emailRepository.createEmail(emailParams);
        logger.debug(
          `Created email with ID: ${emailId}`,
          "EMAIL_BATCH_PROCESSOR",
        );

        // Store enhanced entities
        await this.storeEnhancedEntities(emailId, emailParams);

        this.stats.processed++;
      }
    } catch (error) {
      logger.error(
        `Error processing email ${iemsEmail.MessageID}: ${error}`,
        "EMAIL_BATCH_PROCESSOR",
      );
      throw error;
    }
  }

  /**
   * Transform IEMS email format to our CreateEmailParams format
   */
  private transformIEMSToEmailParams(iemsEmail: IEMSEmailData): any {
    // Parse recipients JSON
    let recipients: Array<{ address: string; name?: string }> = [];
    try {
      const recipientsData = JSON.parse(iemsEmail.Recipients);
      if (recipientsData.to && Array.isArray(recipientsData.to)) {
        recipients = recipientsData.to.map((addr: string) => ({
          address: addr,
          name: undefined,
        }));
      }
    } catch (error) {
      logger.warn(
        `Failed to parse recipients for email ${iemsEmail.MessageID}: ${error}`,
        "EMAIL_BATCH_PROCESSOR",
      );
      // Fallback: try to extract email from sender if no recipients
      if (iemsEmail.SenderEmail) {
        recipients = [{ address: iemsEmail.SenderEmail }];
      }
    }

    // Parse CC recipients if available
    let ccRecipients: Array<{ address: string; name?: string }> = [];
    try {
      const recipientsData = JSON.parse(iemsEmail.Recipients);
      if (recipientsData.cc && Array.isArray(recipientsData.cc)) {
        ccRecipients = recipientsData.cc.map((addr: string) => ({
          address: addr,
          name: undefined,
        }));
      }
    } catch (error) {
      // CC recipients parsing failed, continue with empty array
    }

    // Clean up HTML content for body text
    const bodyText = this.cleanHtmlContent(iemsEmail.BodyText);

    // Enhanced workflow analysis
    const workflowAnalysis = this.analyzeWorkflowContent(
      iemsEmail.Subject,
      bodyText,
    );

    // Extract business entities with recipient context
    const extractedEntities = this.extractBusinessEntities(
      iemsEmail.Subject,
      bodyText,
      iemsEmail.Recipients,
    );

    return {
      graphId: iemsEmail.MessageID, // Use MessageID as graph ID since it's from Graph API
      messageId: iemsEmail.MessageID,
      subject: iemsEmail.Subject || "(No Subject)",
      bodyText: bodyText,
      bodyHtml: iemsEmail.BodyText, // Keep original HTML
      bodyPreview: this.generateBodyPreview(bodyText),
      senderEmail: iemsEmail.SenderEmail,
      senderName: iemsEmail.SenderName || iemsEmail.SenderEmail,
      recipients: recipients,
      ccRecipients: ccRecipients.length > 0 ? ccRecipients : undefined,
      receivedAt: new Date(iemsEmail.ReceivedTime),
      importance: iemsEmail.Importance || "normal",
      categories: workflowAnalysis.categories,
      hasAttachments: iemsEmail.HasAttachments === 1,
      isRead: iemsEmail.IsRead === 1,
      threadId: iemsEmail.ThreadID || undefined,
      conversationId: iemsEmail.ConversationID || undefined,
      // Enhanced metadata
      workflowState: workflowAnalysis.workflowState,
      businessProcess: workflowAnalysis.businessProcess,
      entities: extractedEntities,
      urgencyIndicators: workflowAnalysis.urgencyIndicators,
      vendorRelationships: extractedEntities.vendors,
    };
  }

  /**
   * Clean HTML content to extract plain text
   */
  private cleanHtmlContent(html: string): string {
    if (!html) return "";

    // Remove style and script tags first to avoid extracting their content
    let cleaned = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");

    // Basic HTML tag removal
    cleaned = cleaned
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim();

    return cleaned;
  }

  /**
   * Generate body preview from cleaned text
   */
  private generateBodyPreview(text: string): string {
    if (!text) return "";
    return text.substring(0, 200).trim() + (text.length > 200 ? "..." : "");
  }

  /**
   * Check if email already exists in database
   */
  private async checkEmailExists(
    messageId: string,
    skipCheck: boolean = false,
  ): Promise<boolean> {
    if (skipCheck) {
      return false; // Skip check for dry-run testing
    }

    try {
      const stmt = this.db.prepare(
        "SELECT id FROM emails_enhanced WHERE message_id = ? OR graph_id = ?",
      );
      const result = stmt.get(messageId, messageId);
      return !!result;
    } catch (error) {
      logger.error(
        `Error checking email existence: ${error}`,
        "EMAIL_BATCH_PROCESSOR",
      );
      return false;
    }
  }

  /**
   * Process all batch files in a directory
   */
  async processAllBatchFiles(
    batchDir: string,
    dryRun: boolean = false,
  ): Promise<ProcessingStats> {
    logger.info(
      `Processing all batch files in: ${batchDir}`,
      "EMAIL_BATCH_PROCESSOR",
    );

    if (!fs.existsSync(batchDir)) {
      throw new Error(`Batch directory not found: ${batchDir}`);
    }

    const files = fs
      .readdirSync(batchDir)
      .filter(
        (file) => file.endsWith(".json") && !file.includes("Zone.Identifier"),
      )
      .sort(); // Process in order

    logger.info(
      `Found ${files.length} batch files to process`,
      "EMAIL_BATCH_PROCESSOR",
    );

    const totalStats: ProcessingStats = {
      total: 0,
      processed: 0,
      errors: 0,
      skipped: 0,
      duplicates: 0,
    };

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const filePath = path.join(batchDir, file);

      logger.info(
        `Processing file ${i + 1}/${files.length}: ${file}`,
        "EMAIL_BATCH_PROCESSOR",
      );

      try {
        // Reset stats for this file
        this.stats = {
          total: 0,
          processed: 0,
          errors: 0,
          skipped: 0,
          duplicates: 0,
        };

        const fileStats = await this.processBatchFile(filePath, dryRun);

        // Accumulate stats
        totalStats.total += fileStats.total;
        totalStats.processed += fileStats.processed;
        totalStats.errors += fileStats.errors;
        totalStats.skipped += fileStats.skipped;
        totalStats.duplicates += fileStats.duplicates;
      } catch (error) {
        logger.error(
          `Failed to process file ${file}: ${error}`,
          "EMAIL_BATCH_PROCESSOR",
        );
        totalStats.errors++;
      }
    }

    logger.info(
      `All batch files processed. Total stats:`,
      "EMAIL_BATCH_PROCESSOR",
      totalStats,
    );
    return totalStats;
  }

  /**
   * Analyze workflow content to determine business process and state
   */
  private analyzeWorkflowContent(subject: string, bodyText: string): any {
    const content = `${subject} ${bodyText}`.toLowerCase();

    // Determine workflow state with enhanced patterns
    let workflowState = "NEW";

    // COMPLETION indicators (highest priority)
    if (
      content.includes("success") ||
      content.includes("approved") ||
      content.includes("completed") ||
      content.includes("processed") ||
      content.includes("created") ||
      content.includes("confirmed") ||
      content.includes("sent to") ||
      content.includes("here are") ||
      content.includes("here is")
    ) {
      workflowState = "COMPLETION";
    }
    // IN_PROGRESS indicators
    else if (
      subject.toLowerCase().includes("re:") ||
      subject.toLowerCase().includes("re ") ||
      content.includes("needed") ||
      content.includes("required") ||
      content.includes("issue") ||
      content.includes("verification") ||
      content.includes("provide") ||
      content.includes("please")
    ) {
      workflowState = "IN_PROGRESS";
    }

    // Identify business process category with enhanced patterns
    let businessProcess = "General";
    const categories: string[] = [];

    // Enhanced business process detection
    if (
      content.includes("quote") ||
      content.includes("pricing") ||
      content.includes("rfq") ||
      content.includes("approved") ||
      content.includes("f5q-") ||
      content.includes("price increase")
    ) {
      businessProcess = "Quote Processing";
      categories.push("Quote Management");
    }
    if (
      content.includes("po#") ||
      content.includes("po ") ||
      content.includes("order") ||
      content.includes("bo#") ||
      content.includes("backorder") ||
      content.includes("so#")
    ) {
      businessProcess = "Order Management";
      categories.push("Order Processing");
    }
    if (
      content.includes("deal registration") ||
      content.includes("deal reg") ||
      content.includes("spa automation") ||
      content.includes("dr")
    ) {
      businessProcess = "Deal Registration";
      categories.push("Partner Management");
    }
    if (
      content.includes("renewal") ||
      content.includes("fy2") ||
      content.includes("annual") ||
      content.includes("lypo") ||
      content.includes("lyso")
    ) {
      businessProcess = "Renewal Processing";
      categories.push("Subscription Management");
    }
    if (content.includes("refuse") || content.includes("return")) {
      businessProcess = "Returns Processing";
      categories.push("Order Processing");
    }
    if (
      content.includes("briefing") ||
      content.includes("daily") ||
      content.includes("newsletter")
    ) {
      businessProcess = "Information Distribution";
      categories.push("Communications");
    }
    if (
      content.includes("issue") ||
      content.includes("problem") ||
      content.includes("correct")
    ) {
      businessProcess = "Issue Resolution";
      categories.push("Problem Management");
    }
    if (content.includes("verification") || content.includes("address")) {
      businessProcess = "Verification Processing";
      categories.push("Data Management");
    }

    // Identify urgency indicators
    const urgencyIndicators: string[] = [];
    if (
      content.includes("may be deleted") ||
      content.includes("urgent") ||
      content.includes("expedite") ||
      content.includes("in a bind") ||
      content.includes("asap") ||
      content.includes("critical")
    ) {
      urgencyIndicators.push("HIGH_PRIORITY");
    }
    if (content.includes("effective") && content.includes("2025")) {
      urgencyIndicators.push("DEADLINE_SENSITIVE");
    }
    if (
      content.includes("price increase") ||
      content.includes("price change")
    ) {
      urgencyIndicators.push("PRICING_UPDATE");
    }

    return {
      workflowState,
      businessProcess,
      categories,
      urgencyIndicators,
    };
  }

  /**
   * Extract business entities from email content
   */
  private extractBusinessEntities(
    subject: string,
    bodyText: string,
    recipients?: string,
  ): any {
    const content = `${subject} ${bodyText}`;
    const entities: any = {
      orders: [],
      skus: [],
      companies: [],
      vendors: [],
      quotes: [],
      locations: [],
      amounts: [],
    };

    // CRITICAL: Analyze subject line specifically for company and vendor information
    const subjectLower = subject.toLowerCase();

    // Parse recipients for vendor and company context
    let recipientsData: any = {};
    try {
      if (recipients) {
        recipientsData = JSON.parse(recipients);
      }
    } catch (error) {
      // Continue with empty recipients data
    }

    // Extract companies from subject line patterns
    const companyFromSubject = this.extractCompaniesFromSubject(subject);
    entities.companies.push(...companyFromSubject);

    // Extract vendors from subject line and recipients
    const vendorsFromContext = this.extractVendorsFromContext(
      subject,
      recipientsData,
    );
    entities.vendors.push(...vendorsFromContext);

    // Extract order numbers with enhanced patterns
    const orderPatterns = [
      /(?:bo#|order#|refuse order#|original order#)\s*:?\s*(\d{6,12})/gi,
      /(?:so#|so )\s*:?\s*(\d{6,12})/gi,
      /(?:lypo#|lyso#)\s*(\d{6,12})/gi,
    ];

    // PO patterns separate (these should go to quotes, not orders)
    const poPatterns = [/(?:po#|po )\s*:?\s*(\d{6,12})/gi];

    orderPatterns.forEach((pattern) => {
      const matches = content.match(pattern);
      if (matches) {
        matches.forEach((match) => {
          const orderNum = match.replace(/.*?(\d{6,12}).*/, "$1");
          if (orderNum && !entities.orders.includes(orderNum)) {
            entities.orders.push(orderNum);
          }
        });
      }
    });

    // Extract PO numbers as quotes
    poPatterns.forEach((pattern) => {
      const matches = content.match(pattern);
      if (matches) {
        matches.forEach((match) => {
          const poNum = match.replace(/.*?(\d{6,12}).*/, "$1");
          if (poNum && !entities.quotes.includes(`PO-${poNum}`)) {
            entities.quotes.push(`PO-${poNum}`);
          }
        });
      }
    });

    // Extract business reference numbers with enhanced patterns (avoid HTML image IDs)
    const referencePatterns = [
      // Business reference numbers from subject
      /\b\d{7,10}\b/g, // 7-10 digit reference numbers like 4176247, 10271714, 0228416372
      /\bf5q-\d+/gi, // F5 quote numbers like F5Q-00962283
      /\bftq-\d+/gi, // FTQ quote numbers like FTQ-00955625
      /\bpo-\d+/gi, // Purchase order numbers like PO-44000079962131047
      /\bq-\d+-\d+/gi, // Vendor quote numbers like Q-241120-2
      /\bwq\d+/gi, // WQ reference numbers like WQ149670364
      /\bcpq-\d+/gi, // CPQ reference numbers like CPQ-1116540
      /\bdr\d+/gi, // Deal registration numbers like DR9139173
      /\bcas-[a-z0-9]+-[a-z0-9]+/gi, // CAS case numbers like CAS-086603-Q4X7T6
      /\breg\s*#\s*([A-Z0-9]+)/gi, // REG# patterns like H497219
      /\bbd#?\s*(\d+)/gi, // BD# patterns
      /\bdb-\d+/gi, // DB- patterns like DB-8000925
      /\bpn#?\s*([A-Z0-9]+)/gi, // PN# patterns
    ];

    // Extract from subject line primarily (more reliable than HTML content)
    referencePatterns.forEach((pattern) => {
      const matches = subject.match(pattern);
      if (matches) {
        matches.forEach((ref) => {
          let cleanRef = ref.trim().toUpperCase();

          // Skip HTML color codes and other non-business references
          if (cleanRef.match(/^[0-9A-F]{6}$/)) return; // Skip hex color codes
          if (cleanRef === "0563C1") return; // Skip specific HTML color code

          // Extract just the number from patterns like "REG # H497219"
          if (cleanRef.includes("REG")) {
            cleanRef = cleanRef.replace(/REG\s*#?\s*/i, "");
          }
          if (cleanRef.includes("BD#") || cleanRef.includes("BD ")) {
            cleanRef = cleanRef.replace(/BD#?\s*/i, "");
            // Store BD numbers separately
            if (!entities.quotes.includes(`BD-${cleanRef}`)) {
              entities.quotes.push(`BD-${cleanRef}`);
            }
            return; // Don't add to SKUs
          }

          if (
            cleanRef.length >= 4 &&
            !entities.skus.includes(cleanRef) &&
            !cleanRef.match(/^\d+$/)
          ) {
            entities.skus.push(cleanRef);
          }
        });
      }
    });

    // Extract SKUs from subject first (more reliable)
    const skuFromSubject = subject.match(
      /\b[A-Z0-9]{5,10}(?:#[A-Z0-9]{3})?\b/g,
    );
    if (skuFromSubject) {
      skuFromSubject.forEach((sku) => {
        const cleanSku = sku.trim();
        // Skip pure numbers and already added
        if (
          !entities.skus.includes(cleanSku) &&
          !cleanSku.match(/^\d+$/) &&
          !cleanSku.match(/^(BD|PO|REG|DB)\d+$/)
        ) {
          entities.skus.push(cleanSku);
        }
      });
    }

    // Legacy SKU patterns (keep existing for compatibility)
    const skuPatterns = [
      /\b(?:hpi-|hpp-|apl-|dell-)[a-z0-9]+(?:#aba|\/aba)?\b/gi, // Vendor prefixed SKUs
      /\b[a-z]?\d+[a-z]+\d*(?:#[a-z0-9]+)?\b/gi, // General SKU patterns like B18M0EC#ABA, 4U555A#B1H
      /\b\d[a-z]\d{3}[a-z]#[a-z0-9]+\b/gi, // HP format like 4U555A#B1H
      /\bPN#?\s*([A-Z0-9]+)\b/gi, // PN# patterns
    ];

    skuPatterns.forEach((pattern) => {
      const matches = content.match(pattern);
      if (matches) {
        matches.forEach((sku) => {
          // Special handling for PN# patterns
          if (pattern.toString().includes("PN#")) {
            const pnMatch = sku.match(/PN#?\s*([A-Z0-9]+)/i);
            if (pnMatch && pnMatch[1]) {
              const cleanSku = pnMatch[1].trim().toUpperCase();
              if (cleanSku.length >= 4 && !entities.skus.includes(cleanSku)) {
                entities.skus.push(cleanSku);
              }
            }
          } else {
            const cleanSku = sku.trim().toUpperCase();
            if (cleanSku.length >= 4 && !entities.skus.includes(cleanSku)) {
              entities.skus.push(cleanSku);
            }
          }
        });
      }
    });

    // Extract vendor relationships with enhanced detection
    // Only check subject and cleaned body text, not HTML
    const cleanContent = `${subject} ${bodyText}`;
    const vendorDetection = [
      { pattern: /\bhp\s+(bd#|big\s+deal|printers|personal)/i, vendor: "HP" },
      { pattern: /\b(hpi-|hpp-|anyware)\b/i, vendor: "HP" },
      { pattern: /\bdell\b/i, vendor: "Dell" },
      { pattern: /\bpanasonic\b|\btoughbook\b/i, vendor: "Panasonic" },
      { pattern: /\blogitech\b/i, vendor: "Logitech" },
      { pattern: /\bpoly\b/i, vendor: "Poly" },
      { pattern: /\bapple\b|\b(apl-)\b/i, vendor: "Apple" },
      { pattern: /\bsymantec\b|\bcarbon.*black\b/i, vendor: "Symantec" },
      { pattern: /\bsap\b/i, vendor: "SAP" },
      { pattern: /\bsecurus\b/i, vendor: "Securus" },
    ];

    vendorDetection.forEach(({ pattern, vendor }) => {
      // Only add vendor if explicitly mentioned in non-HTML context
      if (pattern.test(cleanContent) && !entities.vendors.includes(vendor)) {
        // Skip Microsoft unless it's explicitly about Microsoft products
        if (
          vendor === "MICROSOFT" &&
          !cleanContent.match(/\b(microsoft|surface|windows|office|azure)\b/i)
        ) {
          return;
        }
        entities.vendors.push(vendor);
      }
    });

    // Extract company names with enhanced patterns
    const companyPatterns = [
      /(?:reseller name is:|company:)\s*([a-z\s&,.]+)/gi,
      /university of ([a-z\s]+)/gi,
      /(.*?) equipment group/gi,
      /(.*?) & associates/gi,
      /([a-z\s]+) cpas/gi,
      /(honda|sap|insight)/gi,
    ];

    companyPatterns.forEach((pattern) => {
      const matches = content.match(pattern);
      if (matches) {
        matches.forEach((match) => {
          let company = match
            .replace(/.*?(?::|of|equipment group|& associates|cpas)\s*/i, "")
            .trim();
          company = company.replace(/^(honda|sap|insight).*$/i, "$1");
          if (
            company &&
            company.length > 2 &&
            !entities.companies.includes(company.toUpperCase())
          ) {
            entities.companies.push(company.toUpperCase());
          }
        });
      }
    });

    // Extract specific companies mentioned in various contexts
    const specificCompanies = [
      "COMPUCOM",
      "INSIGHT",
      "GOAT GROUP",
      "SAP AMERICA",
      "HONDA",
      "UNIVERSITY OF DELAWARE",
      "EVERGLADES EQUIPMENT GROUP",
      "REED & ASSOCIATES",
    ];

    specificCompanies.forEach((company) => {
      const pattern = new RegExp(company.replace(/[&\s]/g, "\\s*"), "i");
      if (pattern.test(content) && !entities.companies.includes(company)) {
        entities.companies.push(company);
      }
    });

    // Extract location codes (DGA, DDS, DSW, etc.)
    const locationMatches = content.match(/\b(?:dga|dds|dsw|dch|dfw)\b/gi);
    if (locationMatches) {
      locationMatches.forEach((loc) => {
        if (!entities.locations.includes(loc.toUpperCase())) {
          entities.locations.push(loc.toUpperCase());
        }
      });
    }

    // Extract monetary amounts
    const amountMatches = content.match(/\$\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/g);
    if (amountMatches) {
      amountMatches.forEach((amount) => {
        const cleanAmount = amount.replace(/\$\s*/, "");
        if (!entities.amounts.includes(cleanAmount)) {
          entities.amounts.push(cleanAmount);
        }
      });
    }

    // Extract CTO indicators
    if (content.includes("cto5") || content.includes("configure")) {
      entities.customization = ["CTO"];
    }

    return entities;
  }

  /**
   * Extract companies from subject line patterns
   */
  private extractCompaniesFromSubject(subject: string): string[] {
    const companies: string[] = [];
    const subjectLower = subject.toLowerCase();

    // Common company patterns in subjects
    const companyPatterns = [
      // Direct company mentions
      { pattern: /marriott/i, company: "MARRIOTT" },
      { pattern: /edf renewables/i, company: "EDF RENEWABLES" },
      {
        pattern: /american electric power|aep/i,
        company: "AMERICAN ELECTRIC POWER",
      },
      { pattern: /cloud software group/i, company: "CLOUD SOFTWARE GROUP" },
      { pattern: /ppg/i, company: "PPG" },
      { pattern: /optiv security/i, company: "OPTIV SECURITY" },
      { pattern: /compucom/i, company: "COMPUCOM" },
      { pattern: /insight(?!HPI@)/i, company: "INSIGHT" }, // Avoid matching email addresses
      { pattern: /first watch/i, company: "FIRST WATCH" },
      { pattern: /lesco lightin/i, company: "LESCO LIGHTIN" },
      { pattern: /new mexico environment/i, company: "NEW MEXICO ENVIRONMENT" },
      { pattern: /scan health/i, company: "SCAN HEALTH" },
      { pattern: /turing enterprises/i, company: "TURING ENTERPRISES" },
      { pattern: /infoblox/i, company: "INFOBLOX" },
      { pattern: /jensen\s*&\s*halstead/i, company: "JENSEN & HALSTEAD LTD" },
      { pattern: /cae\s+usa/i, company: "CAE USA INC" },
      { pattern: /securus/i, company: "SECURUS" },
    ];

    companyPatterns.forEach(({ pattern, company }) => {
      if (pattern.test(subject) && !companies.includes(company)) {
        companies.push(company);
      }
    });

    // Dynamic company extraction from quote patterns
    // Pattern: "Quote Request-{Company Name}-CAS-"
    const quoteCompanyMatch = subject.match(/quote request-([^-]+)-cas-/i);
    if (quoteCompanyMatch && quoteCompanyMatch[1]) {
      const company = quoteCompanyMatch[1].trim().toUpperCase();
      if (company && !companies.includes(company)) {
        companies.push(company);
      }
    }

    // Pattern: "Quote request - {Company Name} - {number}"
    const quoteCompanyMatch2 = subject.match(
      /quote request\s*-\s*([^-]+)\s*-\s*\d+/i,
    );
    if (quoteCompanyMatch2 && quoteCompanyMatch2[1]) {
      const company = quoteCompanyMatch2[1].trim().toUpperCase();
      if (company && !companies.includes(company)) {
        companies.push(company);
      }
    }

    // Pattern: "{Company Name} | CAS-"
    const pipeCompanyMatch = subject.match(/^([^|]+)\s*\|.*cas-/i);
    if (
      pipeCompanyMatch &&
      pipeCompanyMatch[1] &&
      pipeCompanyMatch[1].toLowerCase() !== "re:"
    ) {
      const company = pipeCompanyMatch[1]
        .replace(/^re:\s*/i, "")
        .trim()
        .toUpperCase();
      if (company && !companies.includes(company)) {
        companies.push(company);
      }
    }

    // Dynamic pattern: "{Company Name}, Inc." or similar corporate suffixes
    const corporateMatch = subject.match(
      /([A-Za-z\s]+)(?:,\s*Inc\.|\s+Corporation|\s+LLC|\s+Ltd\.)/i,
    );
    if (corporateMatch && corporateMatch[1]) {
      const company = corporateMatch[1].trim().toUpperCase();
      if (company && company.length > 2 && !companies.includes(company)) {
        companies.push(company);
      }
    }

    return companies;
  }

  /**
   * Extract vendors from subject line and recipient context
   */
  private extractVendorsFromContext(
    subject: string,
    recipientsData: any,
  ): string[] {
    const vendors: string[] = [];

    // Analyze subject for vendor mentions
    const vendorPatterns = [
      { pattern: /fortinet/i, vendor: "FORTINET" },
      { pattern: /f5/i, vendor: "F5" },
      { pattern: /imperva/i, vendor: "IMPERVA" },
      { pattern: /symantec/i, vendor: "SYMANTEC" },
      { pattern: /thales/i, vendor: "THALES" },
      { pattern: /hp|hpi/i, vendor: "HP" },
      { pattern: /dell/i, vendor: "DELL" },
      { pattern: /panasonic/i, vendor: "PANASONIC" },
      { pattern: /infoblox/i, vendor: "INFOBLOX" },
    ];

    vendorPatterns.forEach(({ pattern, vendor }) => {
      if (pattern.test(subject) && !vendors.includes(vendor)) {
        vendors.push(vendor);
      }
    });

    // Analyze recipient emails for vendor context
    const allRecipients = [
      ...(recipientsData.to || []),
      ...(recipientsData.cc || []),
      ...(recipientsData.bcc || []),
    ];

    allRecipients.forEach((email: string) => {
      const emailLower = email.toLowerCase();

      if (emailLower.includes("imperva") && !vendors.includes("IMPERVA")) {
        vendors.push("IMPERVA");
      }
      if (emailLower.includes("fortinet") && !vendors.includes("FORTINET")) {
        vendors.push("FORTINET");
      }
      if (emailLower.includes("f5") && !vendors.includes("F5")) {
        vendors.push("F5");
      }
      if (emailLower.includes("symantec") && !vendors.includes("SYMANTEC")) {
        vendors.push("SYMANTEC");
      }
      if (emailLower.includes("thales") && !vendors.includes("THALES")) {
        vendors.push("THALES");
      }
      if (
        (emailLower.includes("hpipg") || emailLower.includes("hp")) &&
        !vendors.includes("HP")
      ) {
        vendors.push("HP");
      }
      if (
        (emailLower.includes("microsoft") || emailLower.includes("surface")) &&
        !vendors.includes("MICROSOFT")
      ) {
        vendors.push("MICROSOFT");
      }
    });

    return vendors;
  }

  /**
   * Store enhanced entities in the database
   */
  private async storeEnhancedEntities(
    emailId: string,
    emailParams: any,
  ): Promise<void> {
    const entities = [];
    const timestamp = new Date().toISOString();

    // Store workflow state
    if (emailParams.workflowState && emailParams.workflowState !== "NEW") {
      entities.push({
        id: `entity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        emailId,
        entityType: "WORKFLOW_STATE",
        entityValue: emailParams.workflowState,
        entityFormat: "STATE",
        confidence: 0.9,
        extractionMethod: "PATTERN_MATCHING",
        verified: false,
        createdAt: timestamp,
      });
    }

    // Store business process
    if (emailParams.businessProcess) {
      entities.push({
        id: `entity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        emailId,
        entityType: "BUSINESS_PROCESS",
        entityValue: emailParams.businessProcess,
        entityFormat: "CATEGORY",
        confidence: 0.85,
        extractionMethod: "PATTERN_MATCHING",
        verified: false,
        createdAt: timestamp,
      });
    }

    // Store extracted entities
    if (emailParams.entities && typeof emailParams.entities === "object") {
      // Store orders
      if (Array.isArray(emailParams.entities.orders)) {
        emailParams.entities.orders.forEach((order: string) => {
          entities.push({
            id: `entity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            emailId,
            entityType: "ORDER_NUMBER",
            entityValue: order,
            entityFormat: "IDENTIFIER",
            confidence: 0.95,
            extractionMethod: "PATTERN_MATCHING",
            verified: false,
            createdAt: timestamp,
          });
        });
      }

      // Store SKUs
      if (Array.isArray(emailParams.entities.skus)) {
        emailParams.entities.skus.forEach((sku: string) => {
          entities.push({
            id: `entity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            emailId,
            entityType: "SKU",
            entityValue: sku,
            entityFormat: "PRODUCT_CODE",
            confidence: 0.9,
            extractionMethod: "PATTERN_MATCHING",
            verified: false,
            createdAt: timestamp,
          });
        });
      }

      // Store companies
      if (Array.isArray(emailParams.entities.companies)) {
        emailParams.entities.companies.forEach((company: string) => {
          entities.push({
            id: `entity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            emailId,
            entityType: "COMPANY",
            entityValue: company,
            entityFormat: "NAME",
            confidence: 0.85,
            extractionMethod: "PATTERN_MATCHING",
            verified: false,
            createdAt: timestamp,
          });
        });
      }

      // Store vendors
      if (Array.isArray(emailParams.entities.vendors)) {
        emailParams.entities.vendors.forEach((vendor: string) => {
          entities.push({
            id: `entity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            emailId,
            entityType: "VENDOR",
            entityValue: vendor,
            entityFormat: "NAME",
            confidence: 0.9,
            extractionMethod: "PATTERN_MATCHING",
            verified: false,
            createdAt: timestamp,
          });
        });
      }

      // Store quotes
      if (Array.isArray(emailParams.entities.quotes)) {
        emailParams.entities.quotes.forEach((quote: string) => {
          entities.push({
            id: `entity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            emailId,
            entityType: "QUOTE_NUMBER",
            entityValue: quote,
            entityFormat: "IDENTIFIER",
            confidence: 0.95,
            extractionMethod: "PATTERN_MATCHING",
            verified: false,
            createdAt: timestamp,
          });
        });
      }

      // Store amounts
      if (Array.isArray(emailParams.entities.amounts)) {
        emailParams.entities.amounts.forEach((amount: string) => {
          entities.push({
            id: `entity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            emailId,
            entityType: "AMOUNT",
            entityValue: amount,
            entityFormat: "CURRENCY",
            confidence: 0.95,
            extractionMethod: "PATTERN_MATCHING",
            verified: false,
            createdAt: timestamp,
          });
        });
      }
    }

    // Store urgency indicators
    if (Array.isArray(emailParams.urgencyIndicators)) {
      emailParams.urgencyIndicators.forEach((urgency: string) => {
        entities.push({
          id: `entity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          emailId,
          entityType: "URGENCY_INDICATOR",
          entityValue: urgency,
          entityFormat: "FLAG",
          confidence: 0.8,
          extractionMethod: "PATTERN_MATCHING",
          verified: false,
          createdAt: timestamp,
        });
      });
    }

    // Store entities in database
    if (entities.length > 0) {
      await this.emailRepository.storeEmailEntities(emailId, entities);
      logger.debug(
        `Stored ${entities.length} entities for email ${emailId}`,
        "EMAIL_BATCH_PROCESSOR",
      );
    }
  }

  /**
   * Get processing statistics
   */
  getStats(): ProcessingStats {
    return { ...this.stats };
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const processAll = args.includes("--all");

  let targetPath = args.find((arg) => !arg.startsWith("--"));

  if (!targetPath) {
    targetPath = "/home/pricepro2006/iems_project/db_backups/email_batches";
  }

  const processor = new EmailBatchProcessor();

  try {
    if (processAll || fs.statSync(targetPath).isDirectory()) {
      // Process all files in directory
      const stats = await processor.processAllBatchFiles(targetPath, dryRun);
      console.log("\n=== FINAL PROCESSING STATS ===");
      console.log(`Total emails: ${stats.total}`);
      console.log(`Processed: ${stats.processed}`);
      console.log(`Errors: ${stats.errors}`);
      console.log(`Skipped: ${stats.skipped}`);
      console.log(`Duplicates: ${stats.duplicates}`);
    } else {
      // Process single file
      const stats = await processor.processBatchFile(targetPath, dryRun);
      console.log("\n=== PROCESSING STATS ===");
      console.log(`Total emails: ${stats.total}`);
      console.log(`Processed: ${stats.processed}`);
      console.log(`Errors: ${stats.errors}`);
      console.log(`Skipped: ${stats.skipped}`);
      console.log(`Duplicates: ${stats.duplicates}`);
    }

    if (dryRun) {
      console.log(
        "\n*** DRY RUN MODE - No changes were made to the database ***",
      );
    }
  } catch (error) {
    console.error("Processing failed:", error);
    process.exit(1);
  }
}

// Export for use as module
export { EmailBatchProcessor, IEMSEmailData };

// Run as CLI if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
