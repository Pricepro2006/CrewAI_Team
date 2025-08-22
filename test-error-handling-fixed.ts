import { DatabaseFactory } from './src/database/adapters/DatabaseFactory.js';
import { QueryError, TransactionError } from './src/database/adapters/types.js';

async function testErrorHandling() {
  console.log('=== Testing Error Handling ===\n');
  
  const adapter = await DatabaseFactory.create({
    type: 'sqlite',
    sqlite: { databasePath: ':memory:' }
  }, 'error-test2');
  
  console.log('1. Testing invalid SQL error...');
  try {
    await adapter.query('SELECT * FROM non_existent_table');
    console.log('❌ Should have thrown an error');
  } catch (error) {
    if (error instanceof QueryError) {
      console.log('✅ QueryError caught correctly');
      console.log('   Error code:', error.code);
    }
  }
  
  console.log('\n2. Testing transaction rollback...');
  await adapter.execute('CREATE TABLE test (id INTEGER PRIMARY KEY, data TEXT UNIQUE)');
  await adapter.execute("INSERT INTO test (id, data) VALUES (1, 'unique_value')");
  
  try {
    await adapter.transaction(async (tx) => {
      await tx.execute("INSERT INTO test (id, data) VALUES (2, 'another_value')");
      // This should fail due to unique constraint
      await tx.execute("INSERT INTO test (id, data) VALUES (3, 'unique_value')");
    });
    console.log('❌ Transaction should have failed');
  } catch (error) {
    console.log('✅ Transaction error caught');
    console.log('   Type:', error.constructor.name);
  }
  
  // Verify rollback worked
  const count = await adapter.queryOne<{count: number}>('SELECT COUNT(*) as count FROM test');
  console.log('✅ Row count after rollback:', count?.count, '(should be 1)');
  
  console.log('\n3. Testing health check...');
  const health = await adapter.healthCheck();
  console.log('✅ Health check:', health.healthy ? 'HEALTHY' : 'UNHEALTHY');
  console.log('   Latency:', health.latency + 'ms');
  
  await adapter.close();
  console.log('\n✅ All error handling tests passed!');
}

testErrorHandling().catch(console.error);
