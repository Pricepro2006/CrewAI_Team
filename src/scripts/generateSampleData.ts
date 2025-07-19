/**
 * Sample Data Generator for Email Dashboard
 * Generates realistic test data matching TD SYNNEX workflow patterns
 */

import { writeFileSync } from 'fs';
import { join } from 'path';

interface EmailRecord {
  id: string;
  email_alias: string;
  requested_by: string;
  subject: string;
  summary: string;
  status: 'red' | 'yellow' | 'green';
  status_text: string;
  workflow_state: 'START_POINT' | 'IN_PROGRESS' | 'COMPLETION';
  timestamp: string;
  priority?: 'Critical' | 'High' | 'Medium' | 'Low';
  workflow_type?: string;
  entities?: {
    po_numbers?: string[];
    quote_numbers?: string[];
    case_numbers?: string[];
    customers?: string[];
  };
}

// TD SYNNEX email aliases based on actual patterns from IEMS analysis
const EMAIL_ALIASES = [
  'InsightOrderSupport@tdsynnex.com',
  'us.insightsurface@tdsynnex.com',
  'buildamac@tdsynnex.com',
  'salesinsight@tdsynnex.com',
  'CompuCom@tdsynnex.com',
  'HWProcurementHP@tdsynnex.com',
  'InsightHPI@tdsynnex.com',
  'team4401@tdsynnex.com',
  'VendorReturns@tdsynnex.com',
  'QuoteDeskBeijing@tdsynnex.com',
  'WasabiCloud@tdsynnex.com',
  'EPSONProjectors@tdsynnex.com',
  'PreSalesDesignSupport@tdsynnex.com',
  'EMTManagement@tdsynnex.com',
  'Surface@tdsynnex.com'
];

// Actual names from IEMS analysis
const REQUESTERS = [
  'Jessica Kubit', 'Lucas Gregory', 'Christopher Letsinger', 'Michael Corcino',
  'Humberto Fernandez', 'Afnan Tufail', 'Brad Whiteside', 'Danielle Clarizio',
  'Charles Guevarra', 'Orville Mangalus', 'Paulo King', 'Trevor Blass',
  'Brian Kirk', 'Corey Brewers', 'Nick Paul', 'Yordan Koldashki',
  'Michael Macdonald', 'Thomas Campanella', 'Dina Cabato', 'Samantha Culligan',
  'Blom Lapuz', 'Jocelyn Quililan', 'Chris Ignacio'
];

// Actual customer names from IEMS analysis
const CUSTOMERS = [
  'First Watch', 'Brown & Brown', 'Hilton Hotels', 'HealthTrust Purchasing',
  'United Therapeutics', 'Kelsey Seybold', 'Orlando Health', 'Todd County Schools',
  'Knoxville Utilities Board', 'Stonewall Resorts', 'Fender IT', 'TDX Holdings',
  'Moore Fans', 'GOAT Group', 'Royal Caribbean Cruises Ltd', 'Salesforce, Inc.',
  'Indeed', 'Camel Logistics, LLC', 'State of Utah', 'EnPointe ITS',
  'Freshpet', 'Con-Quest Contractors', 'Red Thread', 'PetPartners'
];

// Workflow types from IEMS analysis
const WORKFLOW_TYPES = [
  'Quote Processing', 'Order Management', 'Deal Registration', 'Special Pricing Approval',
  'Shipping Coordination', 'Issue Resolution', 'Product Inquiry', 'Inventory Check',
  'Return Processing', 'License Renewal', 'Technical Support', 'Escalation'
];

// Subject patterns based on actual emails
const SUBJECT_PATTERNS = {
  START_POINT: [
    'Quote Request - {customer} - {caseNumber}',
    'URGENT: PO# {poNumber}',
    'Deal Registration for {customer}',
    'New Order: {customer} - {product}',
    'Escalation: {customer} - {issue}',
    '{product} - Availability Check',
    'Special Pricing Request - {customer}',
    'Return Request #{returnNumber}',
    'License Renewal - {customer}',
    'ASAP: {customer} Order Status'
  ],
  IN_PROGRESS: [
    'Re: Quote Request - {customer}',
    'Re: PO# {poNumber} - Processing',
    'Deal Registration – In Review',
    'Order Status Update - SO# {soNumber}',
    'Re: {product} - Checking Availability',
    'Working on {customer} Request',
    'Special Pricing – Pending Approval',
    'Processing Return #{returnNumber}',
    'Re: {customer} - Investigating Issue',
    'ETA Inquiry - PO# {poNumber}'
  ],
  COMPLETION: [
    'Quote Approved - {quoteNumber}',
    'Order Shipped - PO# {poNumber}',
    'Deal Registration – Approved - {caseNumber}',
    'Special Pricing – Approved - {caseNumber}',
    'Resolution: Case #{caseNumber}',
    'SPA Automation - Success:: Ref#{spaNumber}',
    '{product} - In Stock, Ready to Order',
    'Return Processed - #{returnNumber}',
    'Issue Resolved - {customer}',
    'Order Confirmation - SO# {soNumber}'
  ]
};

// Status mappings
const STATUS_MAPPINGS = {
  START_POINT: { status: 'red' as const, texts: ['New Request', 'Critical', 'Urgent Request', 'Action Required', 'Escalated'] },
  IN_PROGRESS: { status: 'yellow' as const, texts: ['In Progress', 'Processing', 'Pending Approval', 'Investigating', 'On Hold', 'Quote Preparation', 'Final Review'] },
  COMPLETION: { status: 'green' as const, texts: ['Completed', 'Approved', 'Shipped', 'Resolved', 'Delivered', 'Automated'] }
};

// Helper functions
function randomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function generatePONumber(): string {
  const formats = [
    () => `0505${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`,
    () => `${Math.floor(Math.random() * 10000)}XA`,
    () => `70${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`,
    () => `0011${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`
  ];
  return randomElement(formats)();
}

function generateQuoteNumber(): string {
  const formats = [
    () => `WQ${Math.floor(Math.random() * 1000000000).toString().padStart(9, '0')}`,
    () => `TS-${Math.floor(Math.random() * 10000000).toString().padStart(7, '0')}`,
    () => `SP-00${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}-${Math.floor(Math.random() * 100)}`
  ];
  return randomElement(formats)();
}

function generateCaseNumber(): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const randomLetters = Array(6).fill(0).map(() => randomElement(letters.split(''))).join('');
  return `CAS-${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}-${randomLetters}`;
}

function generateSONumber(): string {
  return `33${Math.floor(Math.random() * 10000000).toString().padStart(7, '0')}`;
}

function generateSPANumber(): string {
  return Math.floor(Math.random() * 100000000000000000000).toString();
}

function generateTimestamp(daysAgo: number): string {
  const now = new Date();
  const past = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
  const randomHours = Math.floor(Math.random() * 24);
  const randomMinutes = Math.floor(Math.random() * 60);
  past.setHours(randomHours, randomMinutes, 0, 0);
  return past.toISOString();
}

function generateSubject(state: 'START_POINT' | 'IN_PROGRESS' | 'COMPLETION'): string {
  const template = randomElement(SUBJECT_PATTERNS[state]);
  const replacements = {
    '{customer}': randomElement(CUSTOMERS),
    '{caseNumber}': generateCaseNumber(),
    '{poNumber}': generatePONumber(),
    '{soNumber}': generateSONumber(),
    '{quoteNumber}': generateQuoteNumber(),
    '{spaNumber}': generateSPANumber(),
    '{returnNumber}': Math.floor(Math.random() * 10000000).toString(),
    '{product}': randomElement(['HP ProLiant DL380', 'Microsoft Surface Pro', 'iPhone 16E', 'Veeam Backup', 'Fortinet Firewall']),
    '{issue}': randomElement(['Shipping Delay', 'Pricing Discrepancy', 'Product Configuration', 'Order Status'])
  };
  
  let subject = template;
  Object.entries(replacements).forEach(([key, value]) => {
    subject = subject.replace(key, value);
  });
  
  return subject;
}

function generateSummary(workflowType: string, state: 'START_POINT' | 'IN_PROGRESS' | 'COMPLETION'): string {
  const summaries = {
    'Quote Processing': {
      START_POINT: 'New quote request requiring pricing and product availability check',
      IN_PROGRESS: 'Quote being prepared with special pricing validation in progress',
      COMPLETION: 'Quote approved and delivered to customer with all pricing confirmed'
    },
    'Order Management': {
      START_POINT: 'New order received requiring processing and inventory allocation',
      IN_PROGRESS: 'Order being processed, awaiting inventory confirmation and shipping details',
      COMPLETION: 'Order successfully processed and shipped with tracking information'
    },
    'Deal Registration': {
      START_POINT: 'New deal registration submitted for vendor program participation',
      IN_PROGRESS: 'Deal registration under review with vendor for approval',
      COMPLETION: 'Deal registration approved with special pricing authorized'
    },
    'Special Pricing Approval': {
      START_POINT: 'Special pricing request submitted requiring management approval',
      IN_PROGRESS: 'Special pricing under review, checking discount thresholds and margins',
      COMPLETION: 'Special pricing approved and registered in system'
    },
    'Shipping Coordination': {
      START_POINT: 'Shipping request received requiring address verification and routing',
      IN_PROGRESS: 'Coordinating shipping logistics and carrier selection',
      COMPLETION: 'Shipment dispatched with confirmed delivery schedule'
    },
    'Issue Resolution': {
      START_POINT: 'Customer issue reported requiring investigation and resolution',
      IN_PROGRESS: 'Issue being investigated, working with relevant teams for solution',
      COMPLETION: 'Issue successfully resolved with customer confirmation'
    }
  };
  
  const defaultSummaries = {
    START_POINT: 'New request received requiring immediate attention and processing',
    IN_PROGRESS: 'Request being actively processed by appropriate team',
    COMPLETION: 'Request completed successfully with all requirements fulfilled'
  };
  
  return summaries[workflowType]?.[state] || defaultSummaries[state];
}

function generateEmailRecord(index: number): EmailRecord {
  const workflowState = randomElement(['START_POINT', 'IN_PROGRESS', 'COMPLETION'] as const);
  const statusMapping = STATUS_MAPPINGS[workflowState];
  const workflowType = randomElement(WORKFLOW_TYPES);
  
  // Generate time based on workflow state
  let daysAgo: number;
  switch (workflowState) {
    case 'START_POINT':
      daysAgo = Math.random() * 2; // 0-2 days ago
      break;
    case 'IN_PROGRESS':
      daysAgo = 1 + Math.random() * 3; // 1-4 days ago
      break;
    case 'COMPLETION':
      daysAgo = 3 + Math.random() * 7; // 3-10 days ago
      break;
  }
  
  const record: EmailRecord = {
    id: (index + 1).toString(),
    email_alias: randomElement(EMAIL_ALIASES),
    requested_by: randomElement(REQUESTERS),
    subject: generateSubject(workflowState),
    summary: generateSummary(workflowType, workflowState),
    status: statusMapping.status,
    status_text: randomElement(statusMapping.texts),
    workflow_state: workflowState,
    timestamp: generateTimestamp(daysAgo),
    priority: randomElement(['Critical', 'High', 'Medium', 'Low']),
    workflow_type: workflowType
  };
  
  // Add entities based on workflow type
  if (workflowType === 'Order Management' || workflowType === 'Shipping Coordination') {
    record.entities = {
      po_numbers: [generatePONumber()],
      customers: [randomElement(CUSTOMERS)]
    };
  } else if (workflowType === 'Quote Processing') {
    record.entities = {
      quote_numbers: [generateQuoteNumber()],
      customers: [randomElement(CUSTOMERS)]
    };
  } else if (workflowType === 'Deal Registration' || workflowType === 'Issue Resolution') {
    record.entities = {
      case_numbers: [generateCaseNumber()],
      customers: [randomElement(CUSTOMERS)]
    };
  }
  
  return record;
}

// Generate sample data
function generateSampleData(count: number = 100) {
  const emails: EmailRecord[] = [];
  
  // Ensure good distribution of workflow states
  const stateDistribution = {
    START_POINT: Math.floor(count * 0.25),
    IN_PROGRESS: Math.floor(count * 0.50),
    COMPLETION: Math.floor(count * 0.25)
  };
  
  let currentIndex = 0;
  
  // Generate emails for each state
  Object.entries(stateDistribution).forEach(([state, count]) => {
    for (let i = 0; i < count; i++) {
      emails.push(generateEmailRecord(currentIndex++));
    }
  });
  
  // Sort by timestamp (newest first)
  emails.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  
  // Reassign IDs after sorting
  emails.forEach((email, index) => {
    email.id = (index + 1).toString();
  });
  
  const data = {
    email_dashboard_data: {
      metadata: {
        source: 'Sample Data Generator',
        total_emails: emails.length,
        generation_date: new Date().toISOString(),
        version: '2.0.0'
      },
      emails,
      workflow_summary: {
        total_emails: emails.length,
        status_distribution: {
          red: emails.filter(e => e.status === 'red').length,
          yellow: emails.filter(e => e.status === 'yellow').length,
          green: emails.filter(e => e.status === 'green').length
        },
        workflow_state_distribution: {
          START_POINT: emails.filter(e => e.workflow_state === 'START_POINT').length,
          IN_PROGRESS: emails.filter(e => e.workflow_state === 'IN_PROGRESS').length,
          COMPLETION: emails.filter(e => e.workflow_state === 'COMPLETION').length
        },
        workflow_types: WORKFLOW_TYPES,
        priority_distribution: {
          Critical: emails.filter(e => e.priority === 'Critical').length,
          High: emails.filter(e => e.priority === 'High').length,
          Medium: emails.filter(e => e.priority === 'Medium').length,
          Low: emails.filter(e => e.priority === 'Low').length
        }
      }
    }
  };
  
  // Write to file
  const outputPath = join(process.cwd(), 'data', 'sample_email_data.json');
  writeFileSync(outputPath, JSON.stringify(data, null, 2));
  
  console.log(`Generated ${emails.length} sample email records`);
  console.log(`Output saved to: ${outputPath}`);
  console.log('\nStatus Distribution:');
  console.log(`  Red (Critical): ${data.workflow_summary.status_distribution.red}`);
  console.log(`  Yellow (In Progress): ${data.workflow_summary.status_distribution.yellow}`);
  console.log(`  Green (Completed): ${data.workflow_summary.status_distribution.green}`);
  console.log('\nWorkflow State Distribution:');
  console.log(`  Start Points: ${data.workflow_summary.workflow_state_distribution.START_POINT}`);
  console.log(`  In Progress: ${data.workflow_summary.workflow_state_distribution.IN_PROGRESS}`);
  console.log(`  Completed: ${data.workflow_summary.workflow_state_distribution.COMPLETION}`);
}

// Run the generator
const count = process.argv[2] ? parseInt(process.argv[2], 10) : 100;
generateSampleData(count);

export { generateSampleData, generateEmailRecord, EmailRecord };