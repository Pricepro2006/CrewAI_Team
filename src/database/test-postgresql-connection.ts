#!/usr/bin/env tsx
/**
 * Test PostgreSQL Connection
 * Verifies that PostgreSQL adapter is working correctly
 */

import { config } from 'dotenv';
import { DatabaseFactory } from './adapters/DatabaseFactory.js';
import { UnifiedConnectionManagerV2 } from './UnifiedConnectionManagerV2.js';
import { Logger } from '../utils/logger.js';

// Load environment variables
config();

const logger = new Logger('PostgreSQL-Test');

async function testPostgreSQLConnection(): Promise<void> {
  console.log('\n=== PostgreSQL Connection Test ===\n');
  
  try {
    // Test 1: Direct PostgreSQL adapter
    console.log('1. Testing direct PostgreSQL adapter...');
    const postgresConfig = {
      type: 'postgresql' as const,
      postgresql: {
        host: process.env.POSTGRES_HOST || 'localhost',
        port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
        database: process.env.POSTGRES_DB || 'crewai_test',
        user: process.env.POSTGRES_USER || 'crewai_user',
        password: process.env.POSTGRES_PASSWORD || '',
        ssl: process.env.POSTGRES_SSL === 'true',
        maxConnections: 5,
        minConnections: 1
      }
    };

    const adapter = await DatabaseFactory.create(postgresConfig, 'test');
    
    // Test basic query
    const result = await adapter.queryOne<{ version: string }>(
      'SELECT version() as version'
    );
    
    if (result) {
      console.log('✅ PostgreSQL connection successful!');
      console.log('   Version:', result.version.split('\n')[0]);
    }

    // Test health check
    const health = await adapter.healthCheck();
    console.log('✅ Health check:', health.healthy ? 'PASSED' : 'FAILED');
    console.log('   Latency:', health.latency + 'ms');

    // Test table creation
    await adapter.execute(`
      CREATE TABLE IF NOT EXISTS test_table (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Table creation successful');

    // Test insert
    const insertResult = await adapter.execute(
      'INSERT INTO test_table (name) VALUES ($1) RETURNING id',
      ['Test Entry']
    );
    console.log('✅ Insert successful, ID:', insertResult.lastInsertRowid);

    // Test query
    const rows = await adapter.query<{ id: number; name: string }>(
      'SELECT * FROM test_table WHERE name = $1',
      ['Test Entry']
    );
    console.log('✅ Query successful, found', rows.length, 'rows');

    // Test transaction
    await adapter.transaction(async (tx) => {
      await tx.execute('INSERT INTO test_table (name) VALUES ($1)', ['Transaction Test 1']);
      await tx.execute('INSERT INTO test_table (name) VALUES ($1)', ['Transaction Test 2']);
    });
    console.log('✅ Transaction successful');

    // Clean up test table
    await adapter.execute('DROP TABLE IF EXISTS test_table');
    console.log('✅ Cleanup successful');

    // Get metrics
    const metrics = adapter.getMetrics();
    console.log('\n📊 Metrics:');
    console.log('   Total queries:', metrics.totalQueries);
    console.log('   Avg query time:', metrics.avgQueryTime.toFixed(2) + 'ms');
    console.log('   Error count:', metrics.errorCount);

    await adapter.close();
    console.log('\n✅ Direct PostgreSQL adapter test completed successfully!\n');

  } catch (error) {
    console.error('\n❌ PostgreSQL connection test failed:');
    console.error(error instanceof Error ? error.message : String(error));
    
    if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
      console.error('\n💡 Hint: Make sure PostgreSQL is running:');
      console.error('   sudo systemctl start postgresql');
      console.error('   sudo systemctl status postgresql');
    } else if (error instanceof Error && error.message.includes('password authentication failed')) {
      console.error('\n💡 Hint: Check your PostgreSQL credentials in .env file');
    } else if (error instanceof Error && error.message.includes('database') && error.message.includes('does not exist')) {
      console.error('\n💡 Hint: Create the database first:');
      console.error('   sudo -u postgres psql');
      console.error('   CREATE DATABASE crewai_test;');
    }
    
    process.exit(1);
  }

  // Test 2: UnifiedConnectionManagerV2
  console.log('2. Testing UnifiedConnectionManagerV2...');
  
  try {
    // Force PostgreSQL for testing
    process.env.DATABASE_TYPE = 'postgresql';
    
    const unifiedManager = UnifiedConnectionManagerV2.getInstance();
    await unifiedManager.initialize();

    // Test main database
    const mainResult = await unifiedManager.executeMainQueryOne<{ test: number }>(
      'SELECT 1 as test'
    );
    console.log('✅ Main database query:', mainResult?.test === 1 ? 'PASSED' : 'FAILED');

    // Test Walmart database (might be same database with different schema)
    const walmartResult = await unifiedManager.executeWalmartQueryOne<{ test: number }>(
      'SELECT 2 as test'
    );
    console.log('✅ Walmart database query:', walmartResult?.test === 2 ? 'PASSED' : 'FAILED');

    // Test health check
    const health = await unifiedManager.healthCheck();
    console.log('✅ Unified health check:', health.overall ? 'PASSED' : 'FAILED');

    // Get metrics
    const metrics = await unifiedManager.getMetrics();
    console.log('\n📊 Unified Metrics:');
    console.log('   Main DB healthy:', metrics.main.healthy);
    console.log('   Walmart DB healthy:', metrics.walmart.healthy);

    await unifiedManager.shutdown();
    console.log('\n✅ UnifiedConnectionManagerV2 test completed successfully!\n');

  } catch (error) {
    console.error('\n❌ UnifiedConnectionManagerV2 test failed:');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  console.log('\n🎉 All PostgreSQL tests passed!\n');
  process.exit(0);
}

// Run tests if executed directly
if (require.main === module) {
  testPostgreSQLConnection().catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
}