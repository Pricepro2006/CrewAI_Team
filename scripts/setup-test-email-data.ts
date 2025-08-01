import Database from "better-sqlite3";
import { v4 as uuidv4 } from "uuid";

async function setupTestEmailData() {
  console.log("🚀 Setting up test email data for email-pipeline-health integration\n");

  // Connect to database
  const db = new Database("./data/crewai.db");
  
  try {
    // Enable foreign keys
    db.exec("PRAGMA foreign_keys = ON");

    // Test emails to insert (matching actual schema)
    const testEmails = [
      {
        id: "c3a7f5b8-1234-5678-9012-345678901234",
        graph_id: null,
        subject: "Urgent: Quote Request for Enterprise Licenses",
        sender_email: "john.smith@techvendor.com",
        sender_name: "John Smith",
        to_addresses: JSON.stringify(["sales@company.com"]),
        received_at: new Date().toISOString(),
        is_read: 0,
        has_attachments: 0,
        body_preview: "Dear Sales Team, We urgently need a quote for 500 enterprise licenses...",
        body: "Dear Sales Team,\n\nWe urgently need a quote for 500 enterprise licenses.\n\nProduct codes: ABC123, DEF456\nDeadline: End of week\n\nPlease expedite.\n\nBest regards,\nJohn Smith",
        importance: "high",
        categories: JSON.stringify(["urgent", "quote"]),
        raw_content: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: "d4b8g6c9-2345-6789-0123-456789012345", 
        graph_id: null,
        subject: "Support Request: Product Issue #ISS456",
        sender_email: "sarah.johnson@customersupport.com",
        sender_name: "Sarah Johnson",
        to_addresses: JSON.stringify(["support@company.com"]),
        received_at: new Date().toISOString(),
        is_read: 0,
        has_attachments: 0,
        body_preview: "Hello Support, Customer reporting issues with product P789...",
        body: "Hello Support,\n\nCustomer reporting issues with product P789.\n\nIssue: Device not powering on\nCase #: ISS456\nCustomer: ABC Corp\n\nPlease investigate.\n\nThanks,\nSarah",
        importance: "normal",
        categories: JSON.stringify(["support", "technical"]),
        raw_content: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: "e5c9h7da-3456-7890-1234-567890123456",
        graph_id: null,
        subject: "Order Status Update - PO#789456123",
        sender_email: "shipping@logistics.com",
        sender_name: "Shipping Department",
        to_addresses: JSON.stringify(["orders@company.com"]),
        received_at: new Date().toISOString(),
        is_read: 1,
        has_attachments: 0,
        body_preview: "Order Update: PO #789456123 Status: Shipped...",
        body: "Order Update:\n\nPO #789456123\nStatus: Shipped\nTracking: 1Z999AA10123456784\nETA: 3 business days\n\nThank you for your business.",
        importance: "low",
        categories: JSON.stringify(["order", "shipping"]),
        raw_content: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: "f6da18eb-4567-8901-2345-678901234567",
        graph_id: null,
        subject: "Follow-up: Previous Discussion",
        sender_email: "manager@customer.com",
        sender_name: "Manager",
        to_addresses: JSON.stringify(["account@company.com"]),
        received_at: new Date().toISOString(),
        is_read: 0,
        has_attachments: 0,
        body_preview: "Hi Team, Following up on our discussion about the new contract terms...",
        body: "Hi Team,\n\nFollowing up on our discussion about the new contract terms.\n\nPlease send the updated proposal.\n\nRegards,\nManager",
        importance: "normal",
        categories: JSON.stringify(["followup"]),
        raw_content: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];

    // Insert emails
    console.log("1️⃣ Inserting test emails...");
    const insertEmailStmt = db.prepare(`
      INSERT OR REPLACE INTO emails (
        id, graph_id, subject, sender_email, sender_name, to_addresses,
        received_at, is_read, has_attachments, body_preview, body,
        importance, categories, raw_content, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const emailTransaction = db.transaction(() => {
      for (const email of testEmails) {
        insertEmailStmt.run(
          email.id,
          email.graph_id,
          email.subject,
          email.sender_email,
          email.sender_name,
          email.to_addresses,
          email.received_at,
          email.is_read,
          email.has_attachments,
          email.body_preview,
          email.body,
          email.importance,
          email.categories,
          email.raw_content,
          email.created_at,
          email.updated_at
        );
      }
    });

    emailTransaction();
    console.log(`✅ Inserted ${testEmails.length} test emails\n`);

    // Insert corresponding analysis records
    console.log("2️⃣ Inserting test analysis records...");
    const insertAnalysisStmt = db.prepare(`
      INSERT OR REPLACE INTO email_analysis (
        id, email_id,
        quick_workflow, quick_priority, quick_intent, quick_urgency,
        quick_confidence, quick_suggested_state, quick_model, quick_processing_time,
        deep_workflow_primary, deep_workflow_secondary, deep_workflow_related, deep_confidence,
        entities_po_numbers, entities_quote_numbers, entities_case_numbers,
        entities_part_numbers, entities_order_references, entities_contacts,
        action_summary, action_details, action_sla_status,
        workflow_state, workflow_state_updated_at, workflow_suggested_next,
        workflow_estimated_completion, workflow_blockers,
        business_impact_revenue, business_impact_satisfaction, business_impact_urgency_reason,
        contextual_summary, suggested_response, related_emails, thread_position,
        deep_model, deep_processing_time, total_processing_time,
        created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `);

    const analyses = [
      {
        id: uuidv4(),
        email_id: testEmails[0].id,
        // Quick analysis
        quick_workflow: "Quote Processing",
        quick_priority: "High",
        quick_intent: "quote_request",
        quick_urgency: "high",
        quick_confidence: 0.92,
        quick_suggested_state: "IN_PROGRESS",
        quick_model: "llama3.2:3b",
        quick_processing_time: 150,
        // Deep analysis
        deep_workflow_primary: "Quote Processing",
        deep_workflow_secondary: "Customer Communication",
        deep_workflow_related: JSON.stringify(["Order Management", "Pricing"]),
        deep_confidence: 0.95,
        // Entities
        entities_po_numbers: JSON.stringify([]),
        entities_quote_numbers: JSON.stringify(["Q123456"]),
        entities_case_numbers: JSON.stringify([]),
        entities_part_numbers: JSON.stringify(["ABC123", "DEF456"]),
        entities_order_references: JSON.stringify([]),
        entities_contacts: JSON.stringify([
          {type: "from", name: "John Smith", email: "john.smith@techvendor.com"},
          {type: "to", name: "Sales Team", email: "sales@company.com"}
        ]),
        // Actions
        action_summary: "Review and respond to urgent quote request",
        action_details: JSON.stringify({
          actions: ["Review pricing", "Check inventory", "Send quote"],
          priority: "high",
          deadline: new Date(Date.now() + 86400000).toISOString()
        }),
        action_sla_status: "ON_TRACK",
        // Workflow
        workflow_state: "IN_PROGRESS",
        workflow_state_updated_at: new Date().toISOString(),
        workflow_suggested_next: "SEND_QUOTE",
        workflow_estimated_completion: new Date(Date.now() + 86400000).toISOString(),
        workflow_blockers: JSON.stringify([]),
        // Business impact
        business_impact_revenue: 50000.00,
        business_impact_satisfaction: "HIGH",
        business_impact_urgency_reason: "Large enterprise customer with urgent deadline",
        // Context
        contextual_summary: "Urgent quote request for 500 enterprise licenses. High-value opportunity.",
        suggested_response: "Thank you for your inquiry. We are reviewing your requirements and will provide a detailed quote within 24 hours.",
        related_emails: JSON.stringify([]),
        thread_position: 1,
        // Metadata
        deep_model: "llama3.1:8b",
        deep_processing_time: 300,
        total_processing_time: 450,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: uuidv4(),
        email_id: testEmails[1].id,
        // Quick analysis
        quick_workflow: "Customer Support",
        quick_priority: "Medium",
        quick_intent: "support_request",
        quick_urgency: "medium",
        quick_confidence: 0.88,
        quick_suggested_state: "ASSIGNED",
        quick_model: "llama3.2:3b",
        quick_processing_time: 120,
        // Deep analysis
        deep_workflow_primary: "Customer Support",
        deep_workflow_secondary: "Technical Support",
        deep_workflow_related: JSON.stringify(["Product Issues"]),
        deep_confidence: 0.90,
        // Entities
        entities_po_numbers: JSON.stringify([]),
        entities_quote_numbers: JSON.stringify([]),
        entities_case_numbers: JSON.stringify(["ISS456"]),
        entities_part_numbers: JSON.stringify(["P789"]),
        entities_order_references: JSON.stringify([]),
        entities_contacts: JSON.stringify([
          {type: "from", name: "Sarah Johnson", email: "sarah.johnson@customersupport.com"},
          {type: "to", name: "Support Team", email: "support@company.com"}
        ]),
        // Actions
        action_summary: "Investigate technical issue with product",
        action_details: JSON.stringify({
          actions: ["Diagnose issue", "Contact tech team", "Update customer"],
          priority: "medium",
          deadline: new Date(Date.now() + 172800000).toISOString()
        }),
        action_sla_status: "ON_TRACK",
        // Workflow
        workflow_state: "ASSIGNED",
        workflow_state_updated_at: new Date().toISOString(),
        workflow_suggested_next: "INVESTIGATE",
        workflow_estimated_completion: new Date(Date.now() + 172800000).toISOString(),
        workflow_blockers: JSON.stringify([]),
        // Business impact
        business_impact_revenue: 0,
        business_impact_satisfaction: "MEDIUM",
        business_impact_urgency_reason: "Customer experiencing product issues",
        // Context
        contextual_summary: "Technical support request for product P789 not powering on.",
        suggested_response: "Thank you for reporting this issue. Our technical team will investigate and provide a solution within 48 hours.",
        related_emails: JSON.stringify([]),
        thread_position: 1,
        // Metadata
        deep_model: "llama3.1:8b",
        deep_processing_time: 250,
        total_processing_time: 370,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: uuidv4(),
        email_id: testEmails[2].id,
        // Quick analysis
        quick_workflow: "Order Management",
        quick_priority: "Low",
        quick_intent: "status_update",
        quick_urgency: "low",
        quick_confidence: 0.95,
        quick_suggested_state: "COMPLETED",
        quick_model: "llama3.2:3b",
        quick_processing_time: 100,
        // Deep analysis
        deep_workflow_primary: "Order Management",
        deep_workflow_secondary: "Shipping",
        deep_workflow_related: JSON.stringify(["Logistics"]),
        deep_confidence: 0.97,
        // Entities
        entities_po_numbers: JSON.stringify(["789456123"]),
        entities_quote_numbers: JSON.stringify([]),
        entities_case_numbers: JSON.stringify([]),
        entities_part_numbers: JSON.stringify([]),
        entities_order_references: JSON.stringify(["789456123"]),
        entities_contacts: JSON.stringify([
          {type: "from", name: "Shipping", email: "shipping@logistics.com"},
          {type: "to", name: "Orders", email: "orders@company.com"}
        ]),
        // Actions
        action_summary: "Order shipped - no action required",
        action_details: JSON.stringify({
          actions: ["Track shipment"],
          priority: "low",
          deadline: null
        }),
        action_sla_status: "COMPLETED",
        // Workflow
        workflow_state: "COMPLETED",
        workflow_state_updated_at: new Date().toISOString(),
        workflow_suggested_next: null,
        workflow_estimated_completion: null,
        workflow_blockers: JSON.stringify([]),
        // Business impact
        business_impact_revenue: 0,
        business_impact_satisfaction: "NEUTRAL",
        business_impact_urgency_reason: null,
        // Context
        contextual_summary: "Order has been shipped with tracking number provided.",
        suggested_response: null,
        related_emails: JSON.stringify([]),
        thread_position: 1,
        // Metadata
        deep_model: "llama3.1:8b",
        deep_processing_time: 200,
        total_processing_time: 300,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: uuidv4(),
        email_id: testEmails[3].id,
        // Quick analysis
        quick_workflow: "General Inquiry",
        quick_priority: "Medium",
        quick_intent: "follow_up",
        quick_urgency: "medium",
        quick_confidence: 0.82,
        quick_suggested_state: "NEW",
        quick_model: "llama3.2:3b",
        quick_processing_time: 110,
        // Deep analysis
        deep_workflow_primary: "General Inquiry",
        deep_workflow_secondary: null,
        deep_workflow_related: JSON.stringify([]),
        deep_confidence: 0.85,
        // Entities
        entities_po_numbers: JSON.stringify([]),
        entities_quote_numbers: JSON.stringify([]),
        entities_case_numbers: JSON.stringify([]),
        entities_part_numbers: JSON.stringify([]),
        entities_order_references: JSON.stringify([]),
        entities_contacts: JSON.stringify([
          {type: "from", name: "Manager", email: "manager@customer.com"},
          {type: "to", name: "Account Team", email: "account@company.com"}
        ]),
        // Actions
        action_summary: "Send updated proposal as requested",
        action_details: JSON.stringify({
          actions: ["Prepare updated proposal", "Send to customer"],
          priority: "medium",
          deadline: new Date(Date.now() + 86400000).toISOString()
        }),
        action_sla_status: "ON_TRACK",
        // Workflow
        workflow_state: "NEW",
        workflow_state_updated_at: new Date().toISOString(),
        workflow_suggested_next: "PREPARE_RESPONSE",
        workflow_estimated_completion: new Date(Date.now() + 86400000).toISOString(),
        workflow_blockers: JSON.stringify([]),
        // Business impact
        business_impact_revenue: 0,
        business_impact_satisfaction: "MEDIUM",
        business_impact_urgency_reason: "Customer follow-up on contract discussion",
        // Context
        contextual_summary: "Customer following up on contract discussion, requesting updated proposal.",
        suggested_response: "Thank you for following up. We'll send the updated proposal by end of day tomorrow.",
        related_emails: JSON.stringify([]),
        thread_position: 1,
        // Metadata
        deep_model: "llama3.1:8b",
        deep_processing_time: 220,
        total_processing_time: 330,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];

    const analysisTransaction = db.transaction(() => {
      for (const analysis of analyses) {
        insertAnalysisStmt.run(
          analysis.id,
          analysis.email_id,
          analysis.quick_workflow,
          analysis.quick_priority,
          analysis.quick_intent,
          analysis.quick_urgency,
          analysis.quick_confidence,
          analysis.quick_suggested_state,
          analysis.quick_model,
          analysis.quick_processing_time,
          analysis.deep_workflow_primary,
          analysis.deep_workflow_secondary,
          analysis.deep_workflow_related,
          analysis.deep_confidence,
          analysis.entities_po_numbers,
          analysis.entities_quote_numbers,
          analysis.entities_case_numbers,
          analysis.entities_part_numbers,
          analysis.entities_order_references,
          analysis.entities_contacts,
          analysis.action_summary,
          analysis.action_details,
          analysis.action_sla_status,
          analysis.workflow_state,
          analysis.workflow_state_updated_at,
          analysis.workflow_suggested_next,
          analysis.workflow_estimated_completion,
          analysis.workflow_blockers,
          analysis.business_impact_revenue,
          analysis.business_impact_satisfaction,
          analysis.business_impact_urgency_reason,
          analysis.contextual_summary,
          analysis.suggested_response,
          analysis.related_emails,
          analysis.thread_position,
          analysis.deep_model,
          analysis.deep_processing_time,
          analysis.total_processing_time,
          analysis.created_at,
          analysis.updated_at
        );
      }
    });

    analysisTransaction();
    console.log(`✅ Inserted ${analyses.length} test analysis records\n`);

    // Verify data
    console.log("3️⃣ Verifying test data...");
    
    const emailCount = db.prepare("SELECT COUNT(*) as count FROM emails WHERE id IN (?, ?, ?, ?)")
      .get(...testEmails.map(e => e.id)) as { count: number };
    console.log(`   Emails in database: ${emailCount.count}`);

    const analysisCount = db.prepare("SELECT COUNT(*) as count FROM email_analysis WHERE email_id IN (?, ?, ?, ?)")
      .get(...testEmails.map(e => e.id)) as { count: number };
    console.log(`   Analysis records: ${analysisCount.count}`);

    // Show sample analysis
    const sampleAnalysis = db.prepare(`
      SELECT 
        ea.quick_workflow,
        ea.quick_priority,
        ea.workflow_state,
        ea.action_sla_status,
        e.subject
      FROM email_analysis ea
      JOIN emails e ON ea.email_id = e.id
      LIMIT 3
    `).all();

    console.log("\n📊 Sample Analysis Data:");
    sampleAnalysis.forEach((row: any) => {
      console.log(`   - "${row.subject}"`);
      console.log(`     Workflow: ${row.quick_workflow}, Priority: ${row.quick_priority}`);
      console.log(`     State: ${row.workflow_state}, SLA: ${row.action_sla_status}`);
    });

    console.log("\n✅ Test data setup complete!");
    console.log("🎉 The email-pipeline-health endpoints should now return data!");

  } catch (error) {
    console.error("❌ Error setting up test data:", error);
  } finally {
    db.close();
  }
}

// Run the setup
setupTestEmailData().catch(console.error);