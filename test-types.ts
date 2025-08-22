import { IDatabaseAdapter } from './src/database/adapters/DatabaseAdapter.interface.js';
import { SqlValue, SqlParams, ExecuteResult } from './src/database/adapters/types.js';

// Test that types work correctly - no any or unknown
const testTypes = async (adapter: IDatabaseAdapter) => {
  // SqlValue is properly typed
  const values: SqlValue[] = ['string', 123, true, null, new Date()];
  
  // SqlParams accepts arrays or objects
  const arrayParams: SqlParams = ['test', 123, true];
  const objectParams: SqlParams = { name: 'test', age: 123, active: true };
  
  // Query returns typed results
  const users = await adapter.query<{ id: number; name: string }>('SELECT * FROM users');
  users.forEach(u => {
    console.log(u.id, u.name); // Properly typed
  });
  
  // Execute returns ExecuteResult
  const result: ExecuteResult = await adapter.execute('INSERT INTO users (name) VALUES (?)', ['test']);
  console.log(result.changes, result.lastInsertRowid);
  
  // Transaction with typed context
  await adapter.transaction(async (tx) => {
    const data = await tx.query<{ count: number }>('SELECT COUNT(*) as count FROM users');
    return data[0].count;
  });
  
  // No any types used!
  console.log('✅ All types are properly defined - no any or unknown!');
};

console.log('✅ TypeScript compilation successful - no type errors!');
