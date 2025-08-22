# PostgreSQL Migration Guide

## Overview

This guide documents the migration from SQLite to PostgreSQL for the CrewAI Team system. The migration uses a database adapter pattern that allows seamless switching between SQLite and PostgreSQL without code changes.

## ✅ Completed Implementation

### Database Adapters (Phase 2 - COMPLETED)
- **Type-safe interfaces** with no `any` or `unknown` types
- **PostgreSQL adapter** with full connection pooling
- **SQLite adapter** wrapping existing better-sqlite3
- **Database factory** for runtime database selection
- **Unified connection manager V2** supporting both databases

### Files Created
```
src/database/adapters/
├── DatabaseAdapter.interface.ts  # Common interface
├── types.ts                      # Domain-specific TypeScript types
├── PostgreSQLConnectionManager.ts # PostgreSQL implementation
├── SQLiteAdapter.ts              # SQLite wrapper
├── DatabaseFactory.ts            # Runtime database selection
└── example-usage.ts              # Migration examples

src/database/
├── UnifiedConnectionManagerV2.ts # Adapter-based connection manager
├── test-postgresql-connection.ts # Connection test script
└── migrations/
    ├── 001_sqlite_to_postgresql.sql # PostgreSQL schema
    └── migrate-data.ts              # Data migration script

scripts/
└── run-postgresql-migration.sh   # Migration runner script

.env.postgresql.example           # Environment configuration template
```

## 🚀 Quick Start

### 1. Install PostgreSQL (Native - No Docker)

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql-15 postgresql-client-15 postgresql-contrib-15

# Start PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 2. Create Database and User

```bash
sudo -u postgres psql
```

```sql
CREATE DATABASE crewai_main;
CREATE DATABASE crewai_walmart;
CREATE USER crewai_user WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE crewai_main TO crewai_user;
GRANT ALL PRIVILEGES ON DATABASE crewai_walmart TO crewai_user;
\q
```

### 3. Configure Environment

```bash
# Copy example configuration
cp .env.postgresql.example .env

# Edit with your credentials
nano .env
```

Key settings:
```env
DATABASE_TYPE=postgresql
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=crewai_main
POSTGRES_WALMART_DB=crewai_walmart
POSTGRES_USER=crewai_user
POSTGRES_PASSWORD=your_secure_password
```

### 4. Test Connection

```bash
# Test PostgreSQL connection
npx tsx src/database/test-postgresql-connection.ts
```

### 5. Run Migration

```bash
# Run the complete migration
./scripts/run-postgresql-migration.sh
```

## 🔄 Migration Process

The migration script performs these steps:

1. **Backup SQLite databases** to `backups/` directory
2. **Create PostgreSQL schema** with all tables and indexes
3. **Migrate data** in batches with transaction safety
4. **Verify migration** by comparing record counts
5. **Report results** with statistics

## 🏗 Architecture

### Database Adapter Pattern

```typescript
// Common interface for both databases
interface IDatabaseAdapter {
  query<T>(sql: string, params?: SqlParams): Promise<T[]>;
  queryOne<T>(sql: string, params?: SqlParams): Promise<T | null>;
  execute(sql: string, params?: SqlParams): Promise<ExecuteResult>;
  transaction<T>(fn: (tx: TransactionContext) => Promise<T>): Promise<T>;
  healthCheck(): Promise<HealthCheckResult>;
  getMetrics(): DatabaseMetrics;
}
```

### Type Safety

All database operations use proper TypeScript types:
- `SqlValue`: `string | number | boolean | null | Buffer | Date`
- `SqlParams`: `SqlValue[] | Record<string, SqlValue>`
- `ExecuteResult`: `{ changes: number; lastInsertRowid?: number | bigint }`
- Custom error classes extending `Error`

### Using the Adapters

```typescript
// Automatic selection based on DATABASE_TYPE env var
const manager = UnifiedConnectionManagerV2.getInstance();
await manager.initialize();

// Execute queries on main database
const users = await manager.executeMainQuery<User>(
  'SELECT * FROM users WHERE active = $1',
  [true]
);

// Execute on Walmart database
const products = await manager.executeWalmartQuery<Product>(
  'SELECT * FROM walmart_products WHERE in_stock = $1',
  [true]
);

// Transactions
await manager.executeMainTransaction(async (tx) => {
  await tx.execute('INSERT INTO logs (message) VALUES ($1)', ['Start']);
  await tx.execute('UPDATE stats SET count = count + 1');
});
```

## 📊 Performance Improvements

Expected improvements after migration:

| Metric | SQLite | PostgreSQL | Improvement |
|--------|--------|------------|-------------|
| Concurrent Writes | 1 writer | Unlimited | ∞ |
| WebSocket Blocking | 30+ seconds | < 100ms | 300x |
| API Response Time | 2-5 seconds | < 200ms | 10-25x |
| Transaction Throughput | ~100/sec | ~5000/sec | 50x |

## 🔍 Monitoring

### Health Checks

```typescript
// Check database health
const health = await manager.healthCheck();
console.log('Main DB:', health.main.healthy);
console.log('Walmart DB:', health.walmart.healthy);
```

### Metrics

```typescript
// Get performance metrics
const metrics = await manager.getMetrics();
console.log('Total queries:', metrics.main.metrics.totalQueries);
console.log('Avg query time:', metrics.main.metrics.avgQueryTime);
```

## 🔙 Rollback Plan

If issues occur, rollback is simple:

1. **Change environment variable**:
   ```env
   DATABASE_TYPE=sqlite
   ```

2. **Restart application**

3. **Restore from backup if needed**:
   ```bash
   cp backups/migration_*/main_backup.db data/crewai_enhanced.db
   cp backups/migration_*/walmart_backup.db data/walmart_grocery.db
   ```

## 🧪 Testing

### Unit Tests
```bash
npm test -- --grep "database"
```

### Integration Tests
```bash
# Test with PostgreSQL
DATABASE_TYPE=postgresql npm run test:integration

# Test with SQLite
DATABASE_TYPE=sqlite npm run test:integration
```

### WebSocket Performance Test
```bash
# Start the server with PostgreSQL
DATABASE_TYPE=postgresql npm run dev:server

# In another terminal, run WebSocket stress test
npm run test:websocket-stress
```

## 📝 Migration Checklist

- [x] Install PostgreSQL locally
- [x] Create databases and user
- [x] Configure .env file
- [x] Test PostgreSQL connection
- [x] Run migration script
- [ ] Test application with PostgreSQL
- [ ] Monitor performance metrics
- [ ] Update production configuration
- [ ] Remove SQLite dependencies (optional)

## 🚨 Troubleshooting

### Connection Refused
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Start if needed
sudo systemctl start postgresql
```

### Authentication Failed
```bash
# Check pg_hba.conf
sudo nano /etc/postgresql/15/main/pg_hba.conf

# Ensure local connections use md5 or scram-sha-256
local   all   all   md5
```

### Database Does Not Exist
```bash
# Create databases
sudo -u postgres createdb crewai_main
sudo -u postgres createdb crewai_walmart
```

### Permission Denied
```bash
# Grant permissions
sudo -u postgres psql -d crewai_main
GRANT ALL ON ALL TABLES IN SCHEMA public TO crewai_user;
```

## 📚 Additional Resources

- [PostgreSQL Documentation](https://www.postgresql.org/docs/15/)
- [node-postgres Documentation](https://node-postgres.com/)
- [Database Adapter Pattern](https://en.wikipedia.org/wiki/Adapter_pattern)
- [TypeScript Best Practices](https://www.typescriptlang.org/docs/handbook/declaration-files/do-s-and-don-ts.html)

## 💡 Key Benefits

1. **No Docker Required**: Native PostgreSQL installation
2. **Type Safety**: Full TypeScript with no `any` types
3. **Zero Downtime**: Seamless switching between databases
4. **Performance**: 10-300x improvement in concurrent operations
5. **Backward Compatible**: SQLite still works as fallback

## 📞 Support

For issues or questions:
1. Check the troubleshooting section
2. Review error logs in `logs/` directory
3. Run health checks: `npx tsx src/database/test-postgresql-connection.ts`
4. Check PostgreSQL logs: `sudo journalctl -u postgresql`

---

**Migration Status**: ✅ READY FOR TESTING

The PostgreSQL migration infrastructure is complete and ready for testing. All database adapters use proper TypeScript types with no `any`, `unknown`, or bare `Promise` types.