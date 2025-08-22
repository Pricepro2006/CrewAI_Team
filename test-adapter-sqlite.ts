import { DatabaseFactory } from './src/database/adapters/DatabaseFactory.js';
import { SqlValue } from './src/database/adapters/types.js';

async function testSQLiteAdapter() {
  console.log('=== Testing SQLite Adapter ===\n');
  
  try {
    // Create SQLite adapter
    const config = {
      type: 'sqlite' as const,
      sqlite: {
        databasePath: './test_adapter.db',
        enableWAL: true,
        enableForeignKeys: true
      }
    };
    
    const adapter = await DatabaseFactory.create(config, 'test-sqlite');
    console.log('✅ SQLite adapter created');
    
    // Create test table
    await adapter.execute(`
      CREATE TABLE IF NOT EXISTS test_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Table created');
    
    // Test insert
    const insertResult = await adapter.execute(
      'INSERT INTO test_users (name, email) VALUES (?, ?)',
      ['John Doe', 'john@example.com']
    );
    console.log('✅ Insert successful, ID:', insertResult.lastInsertRowid);
    
    // Test query
    const users = await adapter.query<{id: number, name: string, email: string}>(
      'SELECT * FROM test_users WHERE email = ?',
      ['john@example.com']
    );
    console.log('✅ Query successful:', users);
    
    // Test transaction
    await adapter.transaction(async (tx) => {
      await tx.execute('INSERT INTO test_users (name, email) VALUES (?, ?)', ['Jane Doe', 'jane@example.com']);
      await tx.execute('INSERT INTO test_users (name, email) VALUES (?, ?)', ['Bob Smith', 'bob@example.com']);
    });
    console.log('✅ Transaction successful');
    
    // Test prepared statement
    const stmt = adapter.prepare<{count: number}>('SELECT COUNT(*) as count FROM test_users');
    const countResult = await stmt.get();
    console.log('✅ Prepared statement result:', countResult);
    
    // Get metrics
    const metrics = adapter.getMetrics();
    console.log('\n📊 Metrics:', metrics);
    
    // Health check
    const health = await adapter.healthCheck();
    console.log('🏥 Health check:', health.healthy ? 'PASSED' : 'FAILED');
    
    await adapter.close();
    console.log('\n✅ SQLite adapter test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testSQLiteAdapter();
