import { UnifiedConnectionManagerV2 } from './src/database/UnifiedConnectionManagerV2.js';

async function testUnifiedManager() {
  console.log('=== Testing UnifiedConnectionManagerV2 with SQLite ===\n');
  
  // Force SQLite since PostgreSQL is not installed
  process.env.DATABASE_TYPE = 'sqlite';
  process.env.SQLITE_DATABASE_PATH = './test_main.db';
  process.env.WALMART_DB_PATH = './test_walmart.db';
  
  try {
    const manager = UnifiedConnectionManagerV2.getInstance();
    await manager.initialize();
    console.log('✅ UnifiedConnectionManagerV2 initialized');
    
    // Test main database
    await manager.executeMainCommand(`
      CREATE TABLE IF NOT EXISTS main_test (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        data TEXT
      )
    `);
    console.log('✅ Main database table created');
    
    const mainInsert = await manager.executeMainCommand(
      'INSERT INTO main_test (data) VALUES (?)',
      ['Main database test']
    );
    console.log('✅ Main database insert:', mainInsert);
    
    const mainQuery = await manager.executeMainQuery<{id: number, data: string}>(
      'SELECT * FROM main_test'
    );
    console.log('✅ Main database query:', mainQuery);
    
    // Test Walmart database
    await manager.executeWalmartCommand(`
      CREATE TABLE IF NOT EXISTS walmart_test (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product TEXT
      )
    `);
    console.log('✅ Walmart database table created');
    
    await manager.executeWalmartTransaction(async (tx) => {
      await tx.execute('INSERT INTO walmart_test (product) VALUES (?)', ['Product 1']);
      await tx.execute('INSERT INTO walmart_test (product) VALUES (?)', ['Product 2']);
    });
    console.log('✅ Walmart database transaction completed');
    
    const walmartQuery = await manager.executeWalmartQuery<{id: number, product: string}>(
      'SELECT * FROM walmart_test'
    );
    console.log('✅ Walmart database query:', walmartQuery);
    
    // Get metrics
    const metrics = await manager.getMetrics();
    console.log('\n📊 Unified Metrics:');
    console.log('  Main DB healthy:', metrics.main.healthy);
    console.log('  Main DB queries:', metrics.main.metrics.totalQueries);
    console.log('  Walmart DB healthy:', metrics.walmart.healthy);
    console.log('  Walmart DB queries:', metrics.walmart.metrics.totalQueries);
    
    // Health check
    const health = await manager.healthCheck();
    console.log('\n🏥 Health Check:');
    console.log('  Overall:', health.overall ? 'PASSED' : 'FAILED');
    console.log('  Main DB latency:', health.main.latency + 'ms');
    console.log('  Walmart DB latency:', health.walmart.latency + 'ms');
    
    await manager.shutdown();
    console.log('\n✅ UnifiedConnectionManagerV2 test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testUnifiedManager();
