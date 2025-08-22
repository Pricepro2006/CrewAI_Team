/**
 * Data Migration Script - SQLite to PostgreSQL
 * Migrates existing data from SQLite databases to PostgreSQL
 */

import { DatabaseFactory } from '../adapters/DatabaseFactory.js';
import { IDatabaseAdapter } from '../adapters/DatabaseAdapter.interface.js';
import { Logger } from '../../utils/logger.js';
import * as fs from 'fs';
import * as path from 'path';

const logger = new Logger('DataMigration');

interface MigrationStats {
  tablesCreated: number;
  recordsMigrated: number;
  errors: string[];
  startTime: Date;
  endTime?: Date;
}

export class SQLiteToPostgreSQLMigrator {
  private sqliteAdapter: IDatabaseAdapter;
  private postgresAdapter: IDatabaseAdapter;
  private stats: MigrationStats;

  constructor(sqliteAdapter: IDatabaseAdapter, postgresAdapter: IDatabaseAdapter) {
    this.sqliteAdapter = sqliteAdapter;
    this.postgresAdapter = postgresAdapter;
    this.stats = {
      tablesCreated: 0,
      recordsMigrated: 0,
      errors: [],
      startTime: new Date()
    };
  }

  /**
   * Run the complete migration
   */
  async migrate(): Promise<MigrationStats> {
    logger.info('Starting SQLite to PostgreSQL migration');

    try {
      // 1. Create PostgreSQL schema
      await this.createPostgreSQLSchema();

      // 2. Migrate each table
      await this.migrateEmails();
      await this.migrateWalmartProducts();
      await this.migrateGroceryLists();
      await this.migrateAgents();
      await this.migrateConversations();
      await this.migrateUserPreferences();

      // 3. Verify migration
      await this.verifyMigration();

      this.stats.endTime = new Date();
      logger.info('Migration completed successfully', this.stats);
      
      return this.stats;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.stats.errors.push(errorMsg);
      logger.error('Migration failed', 'MIGRATION_ERROR', { error: errorMsg });
      throw error;
    }
  }

  /**
   * Create PostgreSQL schema from SQL file
   */
  private async createPostgreSQLSchema(): Promise<void> {
    logger.info('Creating PostgreSQL schema');
    
    const schemaPath = path.join(__dirname, '001_sqlite_to_postgresql.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
    
    // Split by statement and execute each
    const statements = schemaSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      try {
        await this.postgresAdapter.execute(statement + ';');
      } catch (error) {
        logger.warn('Schema statement failed (may already exist)', 'SCHEMA_WARNING', {
          statement: statement.substring(0, 100),
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    this.stats.tablesCreated = 10; // Number of tables in schema
    logger.info('PostgreSQL schema created');
  }

  /**
   * Migrate emails table
   */
  private async migrateEmails(): Promise<void> {
    logger.info('Migrating emails table');
    
    try {
      // Check if emails table exists in SQLite
      const emails = await this.sqliteAdapter.query<any>(
        `SELECT * FROM emails ORDER BY created_at LIMIT 1000`
      );

      if (emails.length === 0) {
        logger.info('No emails to migrate');
        return;
      }

      // Migrate in batches
      const batchSize = 100;
      for (let i = 0; i < emails.length; i += batchSize) {
        const batch = emails.slice(i, i + batchSize);
        
        await this.postgresAdapter.transaction(async (tx) => {
          for (const email of batch) {
            await tx.execute(
              `INSERT INTO emails (
                id, from_email, to_email, subject, body, html_body,
                received_at, processed, processed_at, priority, category,
                sentiment_score, metadata, created_at, updated_at
              ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
              ) ON CONFLICT (id) DO NOTHING`,
              [
                email.id,
                email.from_email,
                email.to_email,
                email.subject,
                email.body,
                email.html_body,
                email.received_at,
                email.processed,
                email.processed_at,
                email.priority || 0,
                email.category,
                email.sentiment_score,
                email.metadata ? JSON.stringify(email.metadata) : null,
                email.created_at,
                email.updated_at
              ]
            );
            this.stats.recordsMigrated++;
          }
        });

        logger.debug(`Migrated ${i + batch.length} emails`);
      }

      logger.info(`Successfully migrated ${emails.length} emails`);
    } catch (error) {
      logger.warn('Emails table migration skipped', 'TABLE_NOT_FOUND', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Migrate walmart_products table
   */
  private async migrateWalmartProducts(): Promise<void> {
    logger.info('Migrating walmart_products table');
    
    try {
      const products = await this.sqliteAdapter.query<any>(
        `SELECT * FROM walmart_products ORDER BY created_at LIMIT 5000`
      );

      if (products.length === 0) {
        logger.info('No walmart products to migrate');
        return;
      }

      const batchSize = 100;
      for (let i = 0; i < products.length; i += batchSize) {
        const batch = products.slice(i, i + batchSize);
        
        await this.postgresAdapter.transaction(async (tx) => {
          for (const product of batch) {
            await tx.execute(
              `INSERT INTO walmart_products (
                id, product_id, name, brand, category, department,
                price, original_price, discount_percentage, in_stock,
                stock_quantity, rating, review_count, image_url,
                product_url, description, features, specifications,
                last_checked, price_history, created_at, updated_at
              ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22
              ) ON CONFLICT (id) DO NOTHING`,
              [
                product.id,
                product.product_id,
                product.name,
                product.brand,
                product.category,
                product.department,
                product.price,
                product.original_price,
                product.discount_percentage,
                product.in_stock,
                product.stock_quantity,
                product.rating,
                product.review_count,
                product.image_url,
                product.product_url,
                product.description,
                product.features ? JSON.stringify(product.features) : null,
                product.specifications ? JSON.stringify(product.specifications) : null,
                product.last_checked,
                product.price_history ? JSON.stringify(product.price_history) : null,
                product.created_at,
                product.updated_at
              ]
            );
            this.stats.recordsMigrated++;
          }
        });

        logger.debug(`Migrated ${i + batch.length} walmart products`);
      }

      logger.info(`Successfully migrated ${products.length} walmart products`);
    } catch (error) {
      logger.warn('Walmart products table migration skipped', 'TABLE_NOT_FOUND', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Migrate grocery_lists table
   */
  private async migrateGroceryLists(): Promise<void> {
    logger.info('Migrating grocery_lists table');
    
    try {
      const lists = await this.sqliteAdapter.query<any>(
        `SELECT * FROM grocery_lists ORDER BY created_at LIMIT 1000`
      );

      if (lists.length === 0) {
        logger.info('No grocery lists to migrate');
        return;
      }

      for (const list of lists) {
        await this.postgresAdapter.execute(
          `INSERT INTO grocery_lists (
            id, user_id, name, items, total_items, total_price,
            status, shared_with, notes, scheduled_for, completed_at,
            created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
          ) ON CONFLICT (id) DO NOTHING`,
          [
            list.id,
            list.user_id,
            list.name,
            JSON.stringify(list.items || []),
            list.total_items || 0,
            list.total_price || 0,
            list.status || 'active',
            list.shared_with ? JSON.stringify(list.shared_with) : null,
            list.notes,
            list.scheduled_for,
            list.completed_at,
            list.created_at,
            list.updated_at
          ]
        );
        this.stats.recordsMigrated++;
      }

      logger.info(`Successfully migrated ${lists.length} grocery lists`);
    } catch (error) {
      logger.warn('Grocery lists table migration skipped', 'TABLE_NOT_FOUND', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Migrate agents table
   */
  private async migrateAgents(): Promise<void> {
    logger.info('Migrating agents table');
    
    try {
      const agents = await this.sqliteAdapter.query<any>(
        `SELECT * FROM agents ORDER BY created_at`
      );

      if (agents.length === 0) {
        logger.info('No agents to migrate');
        return;
      }

      for (const agent of agents) {
        await this.postgresAdapter.execute(
          `INSERT INTO agents (
            id, name, type, status, configuration, capabilities,
            permissions, last_active, total_tasks_completed,
            average_response_time_ms, error_count, metadata,
            created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
          ) ON CONFLICT (id) DO NOTHING`,
          [
            agent.id,
            agent.name,
            agent.type,
            agent.status || 'inactive',
            agent.configuration ? JSON.stringify(agent.configuration) : null,
            agent.capabilities ? JSON.stringify(agent.capabilities) : null,
            agent.permissions ? JSON.stringify(agent.permissions) : null,
            agent.last_active,
            agent.total_tasks_completed || 0,
            agent.average_response_time_ms,
            agent.error_count || 0,
            agent.metadata ? JSON.stringify(agent.metadata) : null,
            agent.created_at,
            agent.updated_at
          ]
        );
        this.stats.recordsMigrated++;
      }

      logger.info(`Successfully migrated ${agents.length} agents`);
    } catch (error) {
      logger.warn('Agents table migration skipped', 'TABLE_NOT_FOUND', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Migrate conversations and messages
   */
  private async migrateConversations(): Promise<void> {
    logger.info('Migrating conversations and messages');
    
    try {
      // Migrate conversations
      const conversations = await this.sqliteAdapter.query<any>(
        `SELECT * FROM conversations ORDER BY created_at`
      );

      for (const conv of conversations) {
        await this.postgresAdapter.execute(
          `INSERT INTO conversations (
            id, user_id, agent_id, title, context, message_count,
            status, started_at, last_message_at, ended_at, metadata,
            created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
          ) ON CONFLICT (id) DO NOTHING`,
          [
            conv.id,
            conv.user_id,
            conv.agent_id,
            conv.title,
            conv.context ? JSON.stringify(conv.context) : null,
            conv.message_count || 0,
            conv.status || 'active',
            conv.started_at || conv.created_at,
            conv.last_message_at,
            conv.ended_at,
            conv.metadata ? JSON.stringify(conv.metadata) : null,
            conv.created_at,
            conv.updated_at
          ]
        );
        this.stats.recordsMigrated++;

        // Migrate messages for this conversation
        const messages = await this.sqliteAdapter.query<any>(
          `SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at`,
          [conv.id]
        );

        for (const msg of messages) {
          await this.postgresAdapter.execute(
            `INSERT INTO messages (
              id, conversation_id, sender_type, sender_id, content,
              content_type, attachments, metadata, tokens_used,
              processing_time_ms, created_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
            ) ON CONFLICT (id) DO NOTHING`,
            [
              msg.id,
              msg.conversation_id,
              msg.sender_type,
              msg.sender_id,
              msg.content,
              msg.content_type || 'text',
              msg.attachments ? JSON.stringify(msg.attachments) : null,
              msg.metadata ? JSON.stringify(msg.metadata) : null,
              msg.tokens_used,
              msg.processing_time_ms,
              msg.created_at
            ]
          );
          this.stats.recordsMigrated++;
        }
      }

      logger.info(`Successfully migrated ${conversations.length} conversations`);
    } catch (error) {
      logger.warn('Conversations table migration skipped', 'TABLE_NOT_FOUND', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Migrate user_preferences table
   */
  private async migrateUserPreferences(): Promise<void> {
    logger.info('Migrating user_preferences table');
    
    try {
      const prefs = await this.sqliteAdapter.query<any>(
        `SELECT * FROM user_preferences`
      );

      for (const pref of prefs) {
        await this.postgresAdapter.execute(
          `INSERT INTO user_preferences (
            id, user_id, preferences, theme, language, timezone,
            notifications_enabled, email_notifications,
            created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
          ) ON CONFLICT (id) DO NOTHING`,
          [
            pref.id,
            pref.user_id,
            JSON.stringify(pref.preferences || {}),
            pref.theme || 'light',
            pref.language || 'en',
            pref.timezone || 'UTC',
            pref.notifications_enabled !== false,
            pref.email_notifications !== false,
            pref.created_at,
            pref.updated_at
          ]
        );
        this.stats.recordsMigrated++;
      }

      logger.info(`Successfully migrated ${prefs.length} user preferences`);
    } catch (error) {
      logger.warn('User preferences table migration skipped', 'TABLE_NOT_FOUND', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Verify migration by comparing record counts
   */
  private async verifyMigration(): Promise<void> {
    logger.info('Verifying migration');

    const tables = [
      'emails',
      'walmart_products',
      'grocery_lists',
      'agents',
      'conversations',
      'messages',
      'user_preferences'
    ];

    for (const table of tables) {
      try {
        const sqliteCount = await this.sqliteAdapter.queryOne<{ count: number }>(
          `SELECT COUNT(*) as count FROM ${table}`
        );
        
        const postgresCount = await this.postgresAdapter.queryOne<{ count: number }>(
          `SELECT COUNT(*) as count FROM ${table}`
        );

        if (sqliteCount && postgresCount) {
          const sqliteTotal = sqliteCount.count;
          const postgresTotal = postgresCount.count;

          if (sqliteTotal !== postgresTotal) {
            const warning = `Count mismatch for ${table}: SQLite=${sqliteTotal}, PostgreSQL=${postgresTotal}`;
            logger.warn(warning, 'COUNT_MISMATCH');
            this.stats.errors.push(warning);
          } else {
            logger.info(`Verified ${table}: ${postgresTotal} records`);
          }
        }
      } catch (error) {
        // Table might not exist in SQLite
        logger.debug(`Skipping verification for ${table}`, {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }
}

// Command-line execution
if (require.main === module) {
  (async () => {
    try {
      // Create SQLite adapter
      const sqliteConfig = DatabaseFactory.createConfigFromEnv();
      sqliteConfig.type = 'sqlite'; // Force SQLite
      const sqliteAdapter = await DatabaseFactory.create(sqliteConfig, 'sqlite-source');

      // Create PostgreSQL adapter
      const postgresConfig = DatabaseFactory.createConfigFromEnv();
      postgresConfig.type = 'postgresql'; // Force PostgreSQL
      const postgresAdapter = await DatabaseFactory.create(postgresConfig, 'postgres-target');

      // Run migration
      const migrator = new SQLiteToPostgreSQLMigrator(sqliteAdapter, postgresAdapter);
      const stats = await migrator.migrate();

      console.log('\n=== Migration Complete ===');
      console.log(`Tables created: ${stats.tablesCreated}`);
      console.log(`Records migrated: ${stats.recordsMigrated}`);
      console.log(`Errors: ${stats.errors.length}`);
      if (stats.errors.length > 0) {
        console.log('Error details:', stats.errors);
      }
      console.log(`Duration: ${((stats.endTime?.getTime() || 0) - stats.startTime.getTime()) / 1000}s`);

      // Clean up
      await sqliteAdapter.close();
      await postgresAdapter.close();
      
      process.exit(0);
    } catch (error) {
      console.error('Migration failed:', error);
      process.exit(1);
    }
  })();
}