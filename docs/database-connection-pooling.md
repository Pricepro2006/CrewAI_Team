# Database Connection Pooling Documentation

## Overview

The CrewAI Team application now supports optional database connection pooling for better-sqlite3, providing improved concurrency and performance for high-load scenarios.

## Features

- **WAL Mode Support**: Automatic Write-Ahead Logging (WAL) mode for concurrent readers
- **Connection Reuse**: Efficient connection management with automatic recycling
- **Automatic Checkpointing**: Prevents WAL file growth with configurable intervals
- **Performance Monitoring**: Built-in statistics and event tracking
- **Transparent Integration**: Works seamlessly with existing code through proxy pattern

## When to Use Connection Pooling

### Use Connection Pooling When:
- Multiple concurrent users access the database
- Running in a multi-threaded environment
- High read/write concurrency is required
- Running behind a load balancer with multiple instances

### Use Single Connection When:
- Single-threaded application
- Low concurrency requirements
- Maximum performance for sequential operations
- Using prepared statements extensively

## Configuration

### Basic Usage

```typescript
// Single connection mode (default - recommended for most cases)
const emailService = new EmailStorageService();

// Connection pool mode (for high concurrency)
const emailService = new EmailStorageService(dbPath, true);
```

### Advanced Configuration

```typescript
import { ConnectionPool } from './core/database/ConnectionPool';

const pool = new ConnectionPool({
  filename: 'database.db',
  poolSize: 5,                    // Maximum connections
  maxIdleTime: 300000,           // 5 minutes idle timeout
  checkpointInterval: 60000,      // 1 minute checkpoint interval
  walSizeLimit: 10 * 1024 * 1024, // 10MB WAL size limit
  enableWAL: true,               // Enable WAL mode
  readonly: false,               // Read-write mode
  verbose: true                  // Enable debug logging
});
```

## Architecture

### Connection Pool Design

```
┌─────────────────────┐
│   Application Code   │
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│   Connection Pool    │
│  ┌───────────────┐  │
│  │ Pool Manager  │  │
│  └───────┬───────┘  │
│          │          │
│  ┌───────▼───────┐  │
│  │ Connection 1  │  │
│  ├───────────────┤  │
│  │ Connection 2  │  │
│  ├───────────────┤  │
│  │ Connection 3  │  │
│  ├───────────────┤  │
│  │     ...       │  │
│  └───────────────┘  │
└─────────────────────┘
           │
┌──────────▼──────────┐
│   SQLite Database   │
│    (WAL Mode)       │
└─────────────────────┘
```

### Proxy Pattern Implementation

The EmailStorageService uses a proxy pattern to maintain compatibility:

```typescript
private createPooledDbProxy(): Database.Database {
  return new Proxy({}, {
    get: (target, prop) => {
      if (prop === 'prepare') {
        return (sql: string) => ({
          run: (...params) => pool.execute(db => db.prepare(sql).run(...params)),
          get: (...params) => pool.execute(db => db.prepare(sql).get(...params)),
          all: (...params) => pool.execute(db => db.prepare(sql).all(...params))
        });
      }
      // ... other method proxies
    }
  });
}
```

## Performance Optimizations

### Database Pragmas

Both single connection and pooled modes apply these optimizations:

```sql
PRAGMA journal_mode = WAL;        -- Enable concurrent reads
PRAGMA synchronous = NORMAL;      -- Balance safety and speed
PRAGMA cache_size = 10000;        -- 10MB page cache
PRAGMA temp_store = MEMORY;       -- Use memory for temp tables
PRAGMA mmap_size = 268435456;     -- 256MB memory mapping
PRAGMA foreign_keys = ON;         -- Enforce referential integrity
PRAGMA busy_timeout = 30000;      -- 30 second timeout
```

### Automatic Maintenance

The connection pool performs automatic maintenance:

1. **Idle Connection Recycling**: Closes connections idle for > 5 minutes
2. **WAL Checkpointing**: Prevents unbounded WAL growth
3. **Connection Health Checks**: Ensures connections remain valid

## Monitoring and Statistics

### Getting Pool Statistics

```typescript
const stats = emailService.getPoolStats();
console.log(stats);
// {
//   poolSize: 5,
//   activeConnections: 2,
//   availableConnections: 3,
//   totalQueries: 1234,
//   checkpoints: 10,
//   recycledConnections: 5,
//   connectionDetails: [...]
// }
```

### Event Monitoring

```typescript
pool.on('acquire', ({ connectionId, poolSize }) => {
  console.log(`Connection ${connectionId} acquired`);
});

pool.on('release', ({ connectionId }) => {
  console.log(`Connection ${connectionId} released`);
});

pool.on('checkpoint', ({ walSize, timestamp }) => {
  console.log(`WAL checkpoint performed, size was ${walSize} bytes`);
});

pool.on('recycle', ({ connectionId, idleTime }) => {
  console.log(`Connection ${connectionId} recycled after ${idleTime}ms idle`);
});
```

## Best Practices

### 1. Choose the Right Mode

```typescript
// For single-user or low-concurrency scenarios
const service = new EmailStorageService(dbPath, false);

// For multi-user or high-concurrency scenarios
const service = new EmailStorageService(dbPath, true);
```

### 2. Handle Errors Gracefully

```typescript
try {
  const result = await pool.execute(db => {
    return db.prepare('SELECT * FROM emails').all();
  }, { retries: 3 }); // Automatic retry on lock errors
} catch (error) {
  logger.error('Database operation failed after retries', error);
}
```

### 3. Monitor Pool Health

```typescript
setInterval(() => {
  const stats = service.getPoolStats();
  if (stats && stats.activeConnections === stats.poolSize) {
    logger.warn('Connection pool is fully utilized');
  }
}, 30000);
```

### 4. Proper Cleanup

```typescript
// Always close the service when done
await emailService.close();
```

## Migration Guide

### From Single Connection to Pool

1. Update initialization:
   ```typescript
   // Before
   const service = new EmailStorageService();
   
   // After
   const service = new EmailStorageService(dbPath, true);
   ```

2. No other code changes required - the proxy pattern ensures compatibility

### Performance Comparison

| Scenario | Single Connection | Connection Pool |
|----------|------------------|-----------------|
| Sequential Reads | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Concurrent Reads | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Write Performance | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| Memory Usage | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| Connection Overhead | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |

## Troubleshooting

### Common Issues

1. **"Database is locked" errors**
   - Increase `busy_timeout` pragma
   - Enable connection pooling
   - Check for long-running transactions

2. **WAL file growing too large**
   - Reduce `checkpointInterval`
   - Manually trigger checkpoint: `db.pragma('wal_checkpoint(RESTART)')`
   - Check for long-running read transactions

3. **Pool exhaustion**
   - Increase `poolSize`
   - Check for connection leaks
   - Monitor with `getPoolStats()`

### Debug Logging

Enable verbose logging:
```typescript
const pool = new ConnectionPool({
  filename: 'database.db',
  verbose: true // Enables SQL query logging
});
```

## Future Enhancements

1. **Read Replica Support**: Separate read and write pools
2. **Connection Warmup**: Pre-create connections on startup
3. **Adaptive Pool Sizing**: Dynamic pool size based on load
4. **Query Queue Management**: Priority-based query execution
5. **Connection Pool Metrics**: Prometheus/OpenTelemetry integration