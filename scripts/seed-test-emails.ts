import { EmailStorageService } from "../src/api/services/EmailStorageService.js";

async function seedTestEmails() {
  console.log("Starting email data seeding...");

  const emailService = new EmailStorageService();

  // Create test emails
  const testEmails = [
    {
      messageId: "MSG_001_test",
      emailAlias: "Team4401@tdsynnex.com",
      requestedBy: "John Doe",
      subject: "Urgent: Quote Request for HP Laptops",
      summary:
        "Customer requesting quote for 50 HP Elite laptops with expedited shipping",
      status: "red" as const,
      statusText: "Critical - Needs immediate attention",
      workflowState: "START_POINT" as const,
      workflowType: "Quote Processing",
      priority: "Critical" as const,
      receivedDate: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      entities: [
        { type: "product", value: "HP Elite Laptop", context: "Hardware" },
        { type: "quantity", value: "50", context: "Units" },
      ],
    },
    {
      messageId: "MSG_002_test",
      emailAlias: "InsightOrderSupport@tdsynnex.com",
      requestedBy: "Jane Smith",
      subject: "Order Status Inquiry - PO# 4578932",
      summary:
        "Customer inquiring about delayed shipment for order PO# 4578932",
      status: "yellow" as const,
      statusText: "In Progress",
      workflowState: "IN_PROGRESS" as const,
      workflowType: "Order Management",
      priority: "High" as const,
      receivedDate: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
      entities: [
        { type: "po_number", value: "4578932", context: "Purchase Order" },
      ],
    },
    {
      messageId: "MSG_003_test",
      emailAlias: "InsightHPI@tdsynnex.com",
      requestedBy: "Bob Johnson",
      subject: "Quote Request - Dell Monitors",
      summary:
        'Request for pricing on 100 Dell 27" monitors for office upgrade',
      status: "yellow" as const,
      statusText: "Pending Review",
      workflowState: "IN_PROGRESS" as const,
      workflowType: "Quote Processing",
      priority: "Medium" as const,
      receivedDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      entities: [
        { type: "product", value: 'Dell 27" Monitor', context: "Hardware" },
        { type: "quantity", value: "100", context: "Units" },
      ],
    },
    {
      messageId: "MSG_004_test",
      emailAlias: "US.InsightSurface@tdsynnex.com",
      requestedBy: "Alice Williams",
      subject: "Surface Pro Bundle Quote",
      summary:
        "Enterprise customer needs quote for 25 Surface Pro bundles with accessories",
      status: "green" as const,
      statusText: "Completed",
      workflowState: "COMPLETION" as const,
      workflowType: "Quote Processing",
      priority: "Low" as const,
      receivedDate: new Date(Date.now() - 48 * 60 * 60 * 1000), // 2 days ago
      entities: [
        { type: "product", value: "Surface Pro Bundle", context: "Hardware" },
        { type: "quantity", value: "25", context: "Units" },
      ],
    },
    {
      messageId: "MSG_005_test",
      emailAlias: "Team4401@tdsynnex.com",
      requestedBy: "Mike Davis",
      subject: "RMA Request - Defective Units",
      summary:
        "Customer reporting 5 defective printers, requesting RMA process",
      status: "red" as const,
      statusText: "Critical - Customer Impact",
      workflowState: "START_POINT" as const,
      workflowType: "RMA Processing",
      priority: "Critical" as const,
      receivedDate: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
      entities: [
        { type: "product", value: "HP LaserJet Printer", context: "Hardware" },
        { type: "quantity", value: "5", context: "Defective Units" },
      ],
    },
  ];

  // Insert test emails
  let successCount = 0;
  let errorCount = 0;

  for (const email of testEmails) {
    try {
      await emailService.createEmail(email);
      successCount++;
      console.log(`✓ Created email: ${email.subject}`);
    } catch (error) {
      errorCount++;
      console.error(`✗ Failed to create email: ${email.subject}`, error);
    }
  }

  console.log(
    `\nSeeding complete: ${successCount} emails created, ${errorCount} errors`,
  );

  // Verify data
  const stats = await emailService.getDashboardStats();
  console.log("\nDashboard Statistics:");
  console.log(`- Total Emails: ${stats.totalEmails}`);
  console.log(`- Critical: ${stats.criticalCount}`);
  console.log(`- In Progress: ${stats.inProgressCount}`);
  console.log(`- Completed: ${stats.completedCount}`);

  process.exit(0);
}

seedTestEmails().catch((error) => {
  console.error("Error seeding emails:", error);
  process.exit(1);
});
