import { DatabaseFactory } from './src/database/adapters/DatabaseFactory.js';

async function benchmark() {
  console.log('=== Database Adapter Performance Benchmark ===\n');
  
  const adapter = await DatabaseFactory.create({
    type: 'sqlite',
    sqlite: { databasePath: ':memory:', enableWAL: false }
  }, 'benchmark');
  
  // Setup
  await adapter.execute(`
    CREATE TABLE benchmark (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      data TEXT,
      value INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  console.log('Testing 1000 INSERT operations...');
  const insertStart = Date.now();
  for (let i = 0; i < 1000; i++) {
    await adapter.execute(
      'INSERT INTO benchmark (data, value) VALUES (?, ?)',
      [`data_${i}`, i]
    );
  }
  const insertTime = Date.now() - insertStart;
  console.log(`✅ Inserts: ${insertTime}ms (${(1000/insertTime*1000).toFixed(0)} ops/sec)`);
  
  console.log('\nTesting 1000 SELECT operations...');
  const selectStart = Date.now();
  for (let i = 0; i < 1000; i++) {
    await adapter.query('SELECT * FROM benchmark WHERE value = ?', [i]);
  }
  const selectTime = Date.now() - selectStart;
  console.log(`✅ Selects: ${selectTime}ms (${(1000/selectTime*1000).toFixed(0)} ops/sec)`);
  
  console.log('\nTesting transaction with 100 operations...');
  const txStart = Date.now();
  await adapter.transaction(async (tx) => {
    for (let i = 0; i < 100; i++) {
      await tx.execute('UPDATE benchmark SET data = ? WHERE value = ?', [`updated_${i}`, i]);
    }
  });
  const txTime = Date.now() - txStart;
  console.log(`✅ Transaction: ${txTime}ms (${(100/txTime*1000).toFixed(0)} ops/sec)`);
  
  const metrics = adapter.getMetrics();
  console.log('\n📊 Final Metrics:');
  console.log(`  Total queries: ${metrics.totalQueries}`);
  console.log(`  Avg query time: ${metrics.avgQueryTime.toFixed(2)}ms`);
  console.log(`  Error count: ${metrics.errorCount}`);
  
  await adapter.close();
  console.log('\n✅ Benchmark completed!');
}

benchmark().catch(console.error);
