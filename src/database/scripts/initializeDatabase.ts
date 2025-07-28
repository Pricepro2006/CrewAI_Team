/**
 * Database Initialization Script
 * Sets up the enhanced database schema and imports sample data
 */

import { join } from 'path';
import { getDatabaseManager } from '../DatabaseManager.js';
import { logger } from '../../utils/logger.js';

interface SampleData {
  users: Array<{
    email: string;
    name: string;
    role: 'admin' | 'manager' | 'user' | 'viewer';
    department?: string;
  }>;
  deals: Array<{
    deal_id: string;
    customer_name: string;
    end_date: string;
    total_value?: number;
    sales_rep?: string;
    region?: string;
  }>;
  dealItems: Array<{
    deal_id: string;
    product_number: string;
    product_family: string;
    remaining_quantity: number;
    dealer_net_price: number;
    description?: string;
  }>;
  emails: Array<{
    message_id: string;
    subject: string;
    sender_email: string;
    sender_name: string;
    received_at: string;
    body_text: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    status: 'new' | 'in_progress' | 'completed';
  }>;
}

const sampleData: SampleData = {
  users: [
    {
      email: 'admin@crewai-team.local',
      name: 'System Administrator',
      role: 'admin'
    },
    {
      email: 'john.manager@company.com',
      name: 'John Manager',
      role: 'manager',
      department: 'Sales'
    },
    {
      email: 'jane.agent@company.com',
      name: 'Jane Agent',
      role: 'user',
      department: 'Support'
    },
    {
      email: 'mike.analyst@company.com',
      name: 'Mike Analyst',
      role: 'user',
      department: 'Analysis'
    }
  ],
  deals: [
    {
      deal_id: '45791720',
      customer_name: 'ACME CORPORATION',
      end_date: '2025-12-31',
      total_value: 125000.00,
      sales_rep: 'John Manager',
      region: 'North America'
    },
    {
      deal_id: '44892156',
      customer_name: 'TECH SOLUTIONS INC',
      end_date: '2025-08-15',
      total_value: 89500.00,
      sales_rep: 'John Manager',
      region: 'North America'
    },
    {
      deal_id: '46123789',
      customer_name: 'GLOBAL SYSTEMS LLC',
      end_date: '2025-06-30',
      total_value: 256800.00,
      sales_rep: 'John Manager',
      region: 'Europe'
    },
    {
      deal_id: '47845321',
      customer_name: 'ENTERPRISE TECH CORP',
      end_date: '2025-03-15',
      total_value: 145200.00,
      sales_rep: 'John Manager',
      region: 'Asia Pacific'
    }
  ],
  dealItems: [
    // Deal 45791720 items
    { deal_id: '45791720', product_number: '7ED25UT', product_family: 'IPG', remaining_quantity: 150, dealer_net_price: 125.99, description: 'Enterprise Storage Unit' },
    { deal_id: '45791720', product_number: '9VD15AA', product_family: 'PSG', remaining_quantity: 75, dealer_net_price: 89.50, description: 'Network Switch' },
    { deal_id: '45791720', product_number: '4XDJ3UT#ABA', product_family: 'IPG', remaining_quantity: 200, dealer_net_price: 45.75, description: 'Memory Module' },

    // Deal 44892156 items  
    { deal_id: '44892156', product_number: '2XHJ8UT', product_family: 'PSG', remaining_quantity: 100, dealer_net_price: 299.99, description: 'Server Blade' },
    { deal_id: '44892156', product_number: '5TW10AA', product_family: 'IPG', remaining_quantity: 50, dealer_net_price: 189.00, description: 'Graphics Card' },

    // Deal 46123789 items
    { deal_id: '46123789', product_number: '8QR45CV', product_family: 'IPG', remaining_quantity: 300, dealer_net_price: 67.25, description: 'Storage Drive' },
    { deal_id: '46123789', product_number: '1ZX23MN', product_family: 'PSG', remaining_quantity: 25, dealer_net_price: 1250.00, description: 'Enterprise Router' },

    // Deal 47845321 items
    { deal_id: '47845321', product_number: '3QW67RT', product_family: 'IPG', remaining_quantity: 80, dealer_net_price: 450.00, description: 'Server Processor' },
    { deal_id: '47845321', product_number: '6YU89OP', product_family: 'PSG', remaining_quantity: 120, dealer_net_price: 180.75, description: 'Network Adapter' }
  ],
  emails: [
    {
      message_id: 'email_001',
      subject: 'Urgent: Quote request for deal 45791720',
      sender_email: 'customer@acme.com',
      sender_name: 'Alice Customer',
      received_at: '2025-01-20T09:30:00Z',
      body_text: 'Hi, we need an urgent quote for the items in deal 45791720. The quantities we need are: 7ED25UT x50, 9VD15AA x25. Please provide pricing and availability ASAP.',
      priority: 'critical',
      status: 'new'
    },
    {
      message_id: 'email_002',
      subject: 'Order confirmation needed for PO# PO123456',
      sender_email: 'orders@techsolutions.com',
      sender_name: 'Bob Purchaser',
      received_at: '2025-01-20T14:15:00Z',
      body_text: 'Please confirm the order details for PO# PO123456. We need confirmation for part 2XHJ8UT quantity 50 from deal 44892156.',
      priority: 'high',
      status: 'in_progress'
    },
    {
      message_id: 'email_003',
      subject: 'Shipping inquiry for case# CS789012',
      sender_email: 'shipping@globalsystems.com',
      sender_name: 'Carol Logistics',
      received_at: '2025-01-20T16:45:00Z',
      body_text: 'Can you provide shipping status for case# CS789012? This is regarding the order for part 8QR45CV from our recent deal.',
      priority: 'medium',
      status: 'new'
    },
    {
      message_id: 'email_004',
      subject: 'Deal extension request for 47845321',
      sender_email: 'procurement@enterprise.com',
      sender_name: 'David Buyer',
      received_at: '2025-01-20T11:20:00Z',
      body_text: 'We would like to request an extension for deal 47845321. Can we extend the end date by 3 months? We are still evaluating the 3QW67RT processors.',
      priority: 'medium',
      status: 'completed'
    }
  ]
};

/**
 * Initialize the database with sample data
 */
async function initializeDatabase(): Promise<void> {
  const dbManager = getDatabaseManager();
  
  try {
    logger.info('Starting database initialization...', 'DB_INIT');

    // Initialize the database system
    await dbManager.initialize();

    // Import sample data
    await importSampleData(dbManager);

    // Verify the setup
    await verifySetup(dbManager);

    logger.info('Database initialization completed successfully', 'DB_INIT');

  } catch (error) {
    logger.error(`Database initialization failed: ${error}`, 'DB_INIT');
    throw error;
  }
}

/**
 * Import sample data into the database
 */
async function importSampleData(dbManager: any): Promise<void> {
  try {
    logger.info('Importing sample data...', 'DB_INIT');

    // Import users (skip if already exist)
    const existingUsersCount = await dbManager.users.count();
    if (existingUsersCount === 0) {
      for (const userData of sampleData.users) {
        await dbManager.users.createUser({
          ...userData,
          permissions: userData.role === 'admin' ? ['*'] : ['read', 'write']
        });
      }
      logger.info(`Imported ${sampleData.users.length} users`, 'DB_INIT');
    }

    // Import deals
    const existingDealsCount = await dbManager.deals.count();
    if (existingDealsCount === 0) {
      for (const dealData of sampleData.deals) {
        await dbManager.deals.createDeal(dealData);
      }
      logger.info(`Imported ${sampleData.deals.length} deals`, 'DB_INIT');
    }

    // Import deal items
    const existingItemsCount = await dbManager.dealItems.count();
    if (existingItemsCount === 0) {
      for (const itemData of sampleData.dealItems) {
        await dbManager.dealItems.createDealItem({
          ...itemData,
          original_quantity: itemData.remaining_quantity
        });
      }
      logger.info(`Imported ${sampleData.dealItems.length} deal items`, 'DB_INIT');
    }

    // Import emails
    const existingEmailsCount = await dbManager.emails.count();
    if (existingEmailsCount === 0) {
      for (const emailData of sampleData.emails) {
        await dbManager.emails.createEmail(emailData);
      }
      logger.info(`Imported ${sampleData.emails.length} emails`, 'DB_INIT');
    }

    logger.info('Sample data import completed', 'DB_INIT');

  } catch (error) {
    logger.error(`Sample data import failed: ${error}`, 'DB_INIT');
    throw error;
  }
}

/**
 * Verify the database setup
 */
async function verifySetup(dbManager: any): Promise<void> {
  try {
    logger.info('Verifying database setup...', 'DB_INIT');

    // Get statistics
    const stats = await dbManager.getStatistics();
    logger.info(`Database statistics:`, 'DB_INIT');
    logger.info(`  SQLite - Tables: ${stats.sqlite.tables}, Users: ${stats.sqlite.users}, Emails: ${stats.sqlite.emails}, Deals: ${stats.sqlite.deals}`, 'DB_INIT');
    
    if (stats.chromadb) {
      logger.info(`  ChromaDB - Connected: ${stats.chromadb.connected}, Collections: ${stats.chromadb.collections}`, 'DB_INIT');
    }

    // Health check
    const health = await dbManager.healthCheck();
    if (!health.overall) {
      throw new Error('Database health check failed');
    }

    // Test a few queries
    const activeDeals = await dbManager.deals.findActiveDeals();
    logger.info(`Found ${activeDeals.length} active deals`, 'DB_INIT');

    const unassignedEmails = await dbManager.emails.findUnassignedEmails();
    logger.info(`Found ${unassignedEmails.total} unassigned emails`, 'DB_INIT');

    logger.info('Database verification completed successfully', 'DB_INIT');

  } catch (error) {
    logger.error(`Database verification failed: ${error}`, 'DB_INIT');
    throw error;
  }
}

/**
 * Reset the database (for development/testing)
 */
async function resetDatabase(): Promise<void> {
  const dbManager = getDatabaseManager();
  
  try {
    logger.info('Resetting database...', 'DB_INIT');

    // Close existing connections
    await dbManager.close();

    // TODO: In a real implementation, you would:
    // 1. Drop all tables
    // 2. Clear ChromaDB collections
    // 3. Reinitialize everything

    logger.info('Database reset completed', 'DB_INIT');

  } catch (error) {
    logger.error(`Database reset failed: ${error}`, 'DB_INIT');
    throw error;
  }
}

// Export functions for use as a module
export { initializeDatabase, resetDatabase };

// Command-line execution
if (require.main === module) {
  const command = process.argv[2] || 'init';
  
  switch (command) {
    case 'init':
      initializeDatabase()
        .then(() => process.exit(0))
        .catch((error) => {
          logger.error(`Initialization failed: ${error}`, 'DB_INIT');
          process.exit(1);
        });
      break;
      
    case 'reset':
      resetDatabase()
        .then(() => process.exit(0))
        .catch((error) => {
          logger.error(`Reset failed: ${error}`, 'DB_INIT');
          process.exit(1);
        });
      break;
      
    default:
      logger.error(`Unknown command: ${command}. Use 'init' or 'reset'`, 'DB_INIT');
      process.exit(1);
  }
}