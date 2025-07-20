#!/usr/bin/env node
import { EmailAnalysisAgent } from '../src/core/agents/specialized/EmailAnalysisAgent';
import { logger } from '../src/utils/logger';

// Sample TD SYNNEX emails for testing
const testEmails = [
  {
    id: 'email-1',
    subject: 'URGENT: Order PO #45791234 - Shipment Delayed',
    body: `Dear Customer,

We regret to inform you that your order PO #45791234 containing HP EliteBook 840 G9 (SKU: 5D5V8UT#ABA) 
has been delayed due to inventory constraints.

New estimated delivery date: January 25, 2025
Tracking Number: 1Z999AA10123456784

Please contact your account manager if you need to expedite this order.

Best regards,
TD SYNNEX Fulfillment Team`,
    bodyPreview: 'We regret to inform you that your order PO #45791234 containing HP EliteBook',
    from: {
      emailAddress: {
        name: 'TD SYNNEX Fulfillment',
        address: 'fulfillment@tdsynnex.com'
      }
    },
    to: [{
      emailAddress: {
        name: 'Acme Corporation',
        address: 'purchasing@acme.com'
      }
    }],
    receivedDateTime: '2025-01-18T08:30:00Z',
    isRead: false,
    categories: [],
    importance: 'high'
  },
  {
    id: 'email-2',
    subject: 'Quote CAS892456 Ready for Review - Dell OptiPlex Systems',
    body: `Hello Partner,

Your quote CAS892456 is now ready for review. 

Quote Details:
- 50x Dell OptiPlex 7000 (SKU: OPTIPLEX-7000-MT)
- 50x Dell 24" Monitor (SKU: P2422H)
- Total: $45,750.00 USD
- Valid until: February 1, 2025

Additional quotes referenced: TS123789, WQ456123

Please log into the partner portal to accept or modify this quote.

Thank you,
Sales Team`,
    bodyPreview: 'Your quote CAS892456 is now ready for review',
    from: {
      emailAddress: {
        name: 'TD SYNNEX Sales',
        address: 'sales@tdsynnex.com'
      }
    },
    receivedDateTime: '2025-01-18T10:15:00Z',
    isRead: true,
    categories: [],
    importance: 'normal'
  },
  {
    id: 'email-3',
    subject: 'Case #INC789012 - Return Authorization Approved',
    body: `Support Ticket Update

Case Number: INC789012
Status: Return Authorization Approved

RMA Number: RMA-2025-1234
Products to Return:
- 2x Lenovo ThinkPad X1 Carbon (damaged in shipping)
- Order Number: ORD98765432

Please use the prepaid shipping label attached and include the RMA number on the package.

Refund will be processed within 5-7 business days after receipt.

TD SYNNEX Customer Support`,
    bodyPreview: 'Support Ticket Update - Case Number: INC789012',
    from: {
      emailAddress: {
        name: 'Customer Support',
        address: 'support@tdsynnex.com'
      }
    },
    receivedDateTime: '2025-01-18T14:22:00Z',
    isRead: false,
    categories: [],
    importance: 'normal'
  },
  {
    id: 'email-4',
    subject: 'Shipment Notification - Multiple Orders Shipped',
    body: `Your orders have been shipped!

Order ORD11223344:
- Tracking: FEDEX7890123456789
- Expected Delivery: January 20, 2025

Order ORD55667788:
- Tracking: UPS1Z999AA10987654321
- Expected Delivery: January 21, 2025

Total Value: $12,345.67 USD

Track your shipments online or contact us if you have questions.`,
    bodyPreview: 'Your orders have been shipped!',
    from: {
      emailAddress: {
        name: 'Shipping Department',
        address: 'shipping@tdsynnex.com'
      }
    },
    receivedDateTime: '2025-01-18T16:45:00Z',
    isRead: false,
    categories: [],
    importance: 'normal'
  },
  {
    id: 'email-5',
    subject: 'ACTION REQUIRED: Deal Registration DR-2025-5678 Expiring Soon',
    body: `Important: Your deal registration is expiring in 24 hours!

Deal Registration: DR-2025-5678
Customer: Global Tech Solutions
Product: HPE ProLiant DL380 Gen11 Servers (Qty: 20)
Expiration: January 19, 2025 at 5:00 PM PST

Please log in to the partner portal to extend or finalize this registration.

This is an automated reminder.`,
    bodyPreview: 'Important: Your deal registration is expiring in 24 hours!',
    from: {
      emailAddress: {
        name: 'Partner Portal',
        address: 'portal@tdsynnex.com'
      }
    },
    receivedDateTime: '2025-01-18T17:00:00Z',
    isRead: false,
    categories: [],
    importance: 'high'
  }
];

async function testEmailAnalysis() {
  logger.info('Starting Email Analysis Agent test', 'TEST');
  
  try {
    // Initialize the agent
    const agent = new EmailAnalysisAgent();
    await agent.initialize();
    
    logger.info('Email Analysis Agent initialized', 'TEST');
    
    // Process each test email
    for (const email of testEmails) {
      logger.info(`\n${'='.repeat(80)}`, 'TEST');
      logger.info(`Analyzing email: ${email.subject}`, 'TEST');
      logger.info(`From: ${email.from.emailAddress.address}`, 'TEST');
      logger.info(`${'='.repeat(80)}`, 'TEST');
      
      try {
        const startTime = Date.now();
        const analysis = await agent.analyzeEmail(email);
        const processingTime = Date.now() - startTime;
        
        // Display results
        console.log('\n📧 Email Analysis Results:');
        console.log(`\n📌 Priority: ${analysis.priority} (${analysis.categories.urgency})`);
        console.log(`📂 Workflow: ${analysis.categories.workflow.join(', ')}`);
        console.log(`🎯 Intent: ${analysis.categories.intent}`);
        console.log(`📊 Confidence: ${(analysis.confidence * 100).toFixed(1)}%`);
        console.log(`🔄 Workflow State: ${analysis.workflowState}`);
        console.log(`⏱️  Processing Time: ${processingTime}ms`);
        
        console.log('\n📋 Summary:');
        console.log(analysis.summary);
        
        console.log('\n🔍 Extracted Entities:');
        if (analysis.entities.poNumbers.length > 0) {
          console.log(`  • PO Numbers: ${analysis.entities.poNumbers.join(', ')}`);
        }
        if (analysis.entities.quoteNumbers.length > 0) {
          console.log(`  • Quote Numbers: ${analysis.entities.quoteNumbers.join(', ')}`);
        }
        if (analysis.entities.orderNumbers.length > 0) {
          console.log(`  • Order Numbers: ${analysis.entities.orderNumbers.join(', ')}`);
        }
        if (analysis.entities.trackingNumbers.length > 0) {
          console.log(`  • Tracking Numbers: ${analysis.entities.trackingNumbers.join(', ')}`);
        }
        if (analysis.entities.caseNumbers.length > 0) {
          console.log(`  • Case Numbers: ${analysis.entities.caseNumbers.join(', ')}`);
        }
        if (analysis.entities.customers.length > 0) {
          console.log(`  • Customers: ${analysis.entities.customers.join(', ')}`);
        }
        if (analysis.entities.products.length > 0) {
          console.log(`  • Products: ${analysis.entities.products.join(', ')}`);
        }
        if (analysis.entities.amounts.length > 0) {
          console.log(`  • Amounts: ${analysis.entities.amounts.map(a => `${a.currency} ${a.value}`).join(', ')}`);
        }
        
        console.log('\n💡 Suggested Actions:');
        analysis.suggestedActions.forEach(action => {
          console.log(`  • ${action}`);
        });
        
      } catch (error) {
        logger.error(`Failed to analyze email: ${error}`, 'TEST');
        console.error(`❌ Error analyzing email: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    logger.info('\n\nEmail Analysis test completed', 'TEST');
    
  } catch (error) {
    logger.error('Test failed', 'TEST', { error });
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testEmailAnalysis()
    .then(() => {
      console.log('\n✅ All tests completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test execution failed:', error);
      process.exit(1);
    });
}