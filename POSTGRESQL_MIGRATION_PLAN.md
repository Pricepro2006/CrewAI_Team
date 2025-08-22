# PostgreSQL Migration Plan - CrewAI Team System
**Date:** August 22, 2025  
**Current Database:** SQLite with better-sqlite3  
**Target Database:** PostgreSQL 15 (Native Installation)  
**Migration Type:** Zero-downtime development migration

## Executive Summary

This plan migrates the CrewAI Team system from SQLite to PostgreSQL using **native PostgreSQL installation** to resolve real-time WebSocket and API performance bottlenecks while maintaining system integrity and preserving all existing functionality. The migration follows the same local-first architecture pattern as the current SQLite implementation.

---

## 🎯 Migration Objectives

### Primary Goals
1. **Preserve Real-Time Features**: Ensure WebSocket updates work during heavy processing
2. **Eliminate API Blocking**: Remove database lock conflicts affecting user experience
3. **Maintain Data Integrity**: Zero data loss during migration
4. **Preserve Development Workflow**: Keep local, native development simple (no Docker required)
5. **Follow Existing Patterns**: Mirror current SQLite architecture patterns

### Success Criteria
- [ ] All WebSocket real-time updates work concurrently with background processing
- [ ] API response times < 200ms during heavy email analysis
- [ ] Agent orchestration operates without blocking conflicts
- [ ] All existing data preserved and accessible
- [ ] Development environment setup remains simple and native
- [ ] No Docker dependencies introduced

---

## 🏗 Current Architecture Analysis

### Existing SQLite Integration Points
```typescript
// Current database files to migrate:
src/database/ConnectionPool.ts           // better-sqlite3 connection pooling
src/database/UnifiedConnectionManager.ts // Database management layer
src/database/OptimizedQueryExecutor.ts   // Query optimization
src/database/repositories/*.ts           // Data access layer
```

### Critical Dependencies
- **better-sqlite3**: Thread-safe connection pooling and WAL mode
- **Database Repositories**: Email, Walmart, Agent data
- **Real-time WebSocket**: Status broadcasting system
- **Background Processing**: Email analysis pipeline
- **Agent Orchestration**: Master orchestrator coordination
- **Native Architecture**: Local file-based databases, no containers

---

## 📋 Migration Strategy: Native PostgreSQL Approach

### Phase 1: Native PostgreSQL Setup (Day 1 Morning)

#### 1.1 Native PostgreSQL Installation
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql-15 postgresql-client-15 postgresql-contrib-15

# Start and enable PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql
CREATE DATABASE crewai_team;
CREATE USER crewai_user WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE crewai_team TO crewai_user;
ALTER USER crewai_user CREATEDB;  -- For testing databases
\q
```

#### 1.2 PostgreSQL Configuration Optimization
```bash
# Edit /etc/postgresql/15/main/postgresql.conf
sudo nano /etc/postgresql/15/main/postgresql.conf

# Add these optimizations:
max_connections = 100
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1  # For SSD storage

# Restart PostgreSQL
sudo systemctl restart postgresql
```

#### 1.3 Environment Configuration
```bash
# Update .env file (no new file needed)
DATABASE_TYPE=postgresql
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=crewai_team
POSTGRES_USER=crewai_user
POSTGRES_PASSWORD=your_secure_password_here
POSTGRES_SSL=false
POSTGRES_MAX_CONNECTIONS=20

# Keep SQLite for fallback during migration
SQLITE_DATABASE_PATH=./data/crewai_enhanced.db
WALMART_DB_PATH=./data/walmart_grocery.db
```

### Phase 2: Database Abstraction Layer (Day 1 Afternoon) ✅

#### 2.1 Extend Existing Database Architecture - COMPLETED
```typescript
// src/database/adapters/DatabaseAdapter.interface.ts
// Follow existing ConnectionPool pattern but make it database-agnostic
// IMPORTANT: Use proper TypeScript types, no any/unknown/bare Promise

import { SqlParams, ExecuteResult, DatabaseMetrics, HealthCheckResult, 
         PreparedStatement, TransactionContext } from './types.js';

export interface IDatabaseAdapter {
  query<T = Record<string, SqlValue>>(sql: string, params?: SqlParams): Promise<T[]>;
  queryOne<T = Record<string, SqlValue>>(sql: string, params?: SqlParams): Promise<T | null>;
  execute(sql: string, params?: SqlParams): Promise<ExecuteResult>;
  transaction<T>(fn: (tx: TransactionContext) => Promise<T>): Promise<T>;
  prepare<T = Record<string, SqlValue>>(sql: string): PreparedStatement<T>;
  close(): Promise<void>;
  healthCheck(): Promise<HealthCheckResult>;
  getMetrics(): DatabaseMetrics;
  initialize?(): Promise<void>;
}

// Types are defined in src/database/adapters/types.ts with:
// - SqlValue: string | number | boolean | null | Buffer | Date
// - SqlParams: SqlValue[] | Record<string, SqlValue>
// - ExecuteResult: { changes: number; lastInsertRowid?: number | bigint }
// - Custom error classes: DatabaseAdapterError, ConnectionError, QueryError, TransactionError
```

#### 2.2 Native PostgreSQL Connection Manager
```typescript
// src/database/PostgreSQLConnectionManager.ts
// Mirror the existing UnifiedConnectionManager pattern
import { Pool, PoolClient, PoolConfig } from 'pg';
import { IDatabaseAdapter, ITransactionAdapter, DatabaseMetrics } from './adapters/DatabaseAdapter.interface.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('PostgreSQLConnectionManager');

export interface PostgreSQLConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
  maxConnections?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

export class PostgreSQLConnectionManager implements IDatabaseAdapter {
  private pool: Pool;
  private metrics: DatabaseMetrics;
  private queryTimes: number[] = [];

  constructor(config: PostgreSQLConfig) {
    const poolConfig: PoolConfig = {
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      ssl: config.ssl || false,
      max: config.maxConnections || 20,
      min: 5, // Always keep minimum connections
      idleTimeoutMillis: config.idleTimeoutMillis || 30000,
      connectionTimeoutMillis: config.connectionTimeoutMillis || 5000,
    };

    this.pool = new Pool(poolConfig);
    this.initializeMetrics();
    this.setupPoolEventHandlers();
  }

  private initializeMetrics(): void {
    this.metrics = {
      totalConnections: 0,
      activeConnections: 0,
      totalQueries: 0,
      avgQueryTime: 0,
      errorCount: 0
    };
  }

  private setupPoolEventHandlers(): void {
    this.pool.on('connect', () => {
      this.metrics.totalConnections++;
      this.metrics.activeConnections++;
      logger.info('New PostgreSQL connection established');
    });

    this.pool.on('remove', () => {
      this.metrics.activeConnections--;
      logger.info('PostgreSQL connection removed');
    });

    this.pool.on('error', (err) => {
      this.metrics.errorCount++;
      logger.error('PostgreSQL pool error:', err);
    });
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const startTime = Date.now();
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(sql, params);
      this.updateQueryMetrics(Date.now() - startTime);
      return result.rows;
    } catch (error) {
      this.metrics.errorCount++;
      logger.error('PostgreSQL query error:', { sql: sql.substring(0, 100), error });
      throw error;
    } finally {
      client.release();
    }
  }

  async queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    const results = await this.query<T>(sql, params);
    return results.length > 0 ? results[0] : null;
  }

  async execute(sql: string, params: any[] = []): Promise<{ changes: number; lastInsertRowid?: number }> {
    const startTime = Date.now();
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(sql, params);
      this.updateQueryMetrics(Date.now() - startTime);
      
      return {
        changes: result.rowCount || 0,
        lastInsertRowid: result.rows[0]?.id // PostgreSQL uses RETURNING
      };
    } catch (error) {
      this.metrics.errorCount++;
      logger.error('PostgreSQL execute error:', { sql: sql.substring(0, 100), error });
      throw error;
    } finally {
      client.release();
    }
  }

  async transaction<T>(fn: (tx: ITransactionAdapter) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const txAdapter: ITransactionAdapter = {
        query: async <U = any>(sql: string, params: any[] = []) => {
          const result = await client.query(sql, params);
          return result.rows;
        },
        execute: async (sql: string, params: any[] = []) => {
          const result = await client.query(sql, params);
          return {
            changes: result.rowCount || 0,
            lastInsertRowid: result.rows[0]?.id
          };
        }
      };
      
      const result = await fn(txAdapter);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      this.metrics.errorCount++;
      logger.error('PostgreSQL transaction error:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.query('SELECT 1 as health_check');
      return result.length > 0 && result[0].health_check === 1;
    } catch (error) {
      logger.error('PostgreSQL health check failed:', error);
      return false;
    }
  }

  getMetrics(): DatabaseMetrics {
    return { ...this.metrics };
  }

  private updateQueryMetrics(queryTime: number): void {
    this.metrics.totalQueries++;
    this.queryTimes.push(queryTime);
    
    // Keep only last 1000 query times for average calculation
    if (this.queryTimes.length > 1000) {
      this.queryTimes = this.queryTimes.slice(-1000);
    }
    
    this.metrics.avgQueryTime = this.queryTimes.reduce((sum, time) => sum + time, 0) / this.queryTimes.length;
  }

  async close(): Promise<void> {
    await this.pool.end();
    logger.info('PostgreSQL connection pool closed');
  }
}
```

#### 2.3 Database Factory (Following Existing Patterns)
```typescript
// src/database/DatabaseFactory.ts
// Replace direct imports with factory pattern
import { IDatabaseAdapter } from './adapters/DatabaseAdapter.interface.js';
import { PostgreSQLConnectionManager, PostgreSQLConfig } from './PostgreSQLConnectionManager.js';
import { UnifiedConnectionManager } from './UnifiedConnectionManager.js'; // Existing SQLite manager
import appConfig from '../config/app.config.js';

export class DatabaseFactory {
  static createDatabaseAdapter(): IDatabaseAdapter {
    const databaseType = process.env.DATABASE_TYPE || 'sqlite';
    
    switch (databaseType.toLowerCase()) {
      case 'postgresql':
      case 'postgres':
        return new PostgreSQLConnectionManager({
          host: process.env.POSTGRES_HOST || 'localhost',
          port: parseInt(process.env.POSTGRES_PORT || '5432'),
          database: process.env.POSTGRES_DB || 'crewai_team',
          user: process.env.POSTGRES_USER || 'crewai_user',
          password: process.env.POSTGRES_PASSWORD || '',
          ssl: process.env.POSTGRES_SSL === 'true',
          maxConnections: parseInt(process.env.POSTGRES_MAX_CONNECTIONS || '20'),
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 5000
        });
      
      case 'sqlite':
      default:
        // Use existing UnifiedConnectionManager for SQLite
        return getUnifiedConnectionManager(); // Your existing function
    }
  }
}
```

### Phase 3: Schema Migration (Day 2 Morning)

#### 3.1 Schema Extraction and Conversion
```typescript
// scripts/extract-sqlite-schema.ts
import Database from 'better-sqlite3';

export async function extractSQLiteSchema(dbPath: string): Promise<SchemaDefinition> {
  const db = new Database(dbPath, { readonly: true });
  
  // Extract tables, indexes, triggers
  const tables = db.prepare(`
    SELECT name, sql FROM sqlite_master 
    WHERE type='table' AND name NOT LIKE 'sqlite_%'
  `).all();
  
  // Convert SQLite SQL to PostgreSQL SQL
  return convertSchemaToPostgreSQL(tables);
}
```

#### 3.2 PostgreSQL Schema Creation
```sql
-- database/migrations/001_initial_schema.sql
-- Converted from SQLite schema with PostgreSQL optimizations

-- Email tables
CREATE TABLE emails (
  id SERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  subject VARCHAR(500),
  sender VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_emails_created_at ON emails(created_at);
CREATE INDEX idx_emails_sender ON emails(sender);

-- Agent coordination tables
CREATE TABLE agents (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  status VARCHAR(50) DEFAULT 'idle',
  current_task_id INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- WebSocket session tracking
CREATE TABLE websocket_sessions (
  id SERIAL PRIMARY KEY,
  client_id VARCHAR(100) UNIQUE NOT NULL,
  connected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### Phase 4: Data Migration (Day 2 Afternoon)

#### 4.1 Data Export from SQLite
```typescript
// scripts/migrate-data.ts
export async function exportSQLiteData(sqliteDb: Database): Promise<MigrationData> {
  const data: MigrationData = {};
  
  // Export all tables with proper type conversion
  const tables = ['emails', 'agents', 'walmart_products', 'workflow_states'];
  
  for (const table of tables) {
    const rows = sqliteDb.prepare(`SELECT * FROM ${table}`).all();
    data[table] = rows.map(row => convertSQLiteRowToPostgreSQL(row));
  }
  
  return data;
}
```

#### 4.2 Data Import to PostgreSQL
```typescript
export async function importDataToPostgreSQL(
  pgAdapter: PostgreSQLAdapter, 
  data: MigrationData
): Promise<void> {
  await pgAdapter.transaction(async (tx) => {
    for (const [tableName, rows] of Object.entries(data)) {
      for (const row of rows) {
        await insertRowWithConflictResolution(tx, tableName, row);
      }
    }
  });
}
```

---

## 🔧 Implementation Details

### Configuration Management
```typescript
// src/config/database.config.ts
export interface DatabaseConfig {
  type: 'sqlite' | 'postgresql';
  sqlite?: SQLiteConfig;
  postgresql?: PostgreSQLConfig;
}

export function createDatabaseAdapter(config: DatabaseConfig): IDatabaseAdapter {
  switch (config.type) {
    case 'sqlite':
      return new SQLiteAdapter(config.sqlite!);
    case 'postgresql':
      return new PostgreSQLAdapter(config.postgresql!);
    default:
      throw new Error(`Unsupported database type: ${config.type}`);
  }
}
```

### Repository Layer Updates
```typescript
// src/database/repositories/EmailRepository.ts
export class EmailRepository {
  constructor(private db: IDatabaseAdapter) {}

  async getEmails(options: GetEmailsOptions): Promise<Email[]> {
    // Database-agnostic queries using adapter interface
    const sql = `
      SELECT * FROM emails 
      WHERE created_at > $1 
      ORDER BY created_at DESC 
      LIMIT $2
    `;
    return this.db.query<Email>(sql, [options.since, options.limit]);
  }
}
```

---

## 🧪 Testing Strategy

### Phase 1: Unit Testing
```typescript
// tests/database/adapters/PostgreSQLAdapter.test.ts
describe('PostgreSQL Adapter', () => {
  let adapter: PostgreSQLAdapter;
  
  beforeAll(async () => {
    // Setup test database
    adapter = new PostgreSQLAdapter(testConfig);
  });
  
  test('should handle concurrent writes without blocking', async () => {
    const promises = Array.from({ length: 10 }, (_, i) => 
      adapter.execute('INSERT INTO test_table (data) VALUES ($1)', [`data-${i}`])
    );
    
    await expect(Promise.all(promises)).resolves.not.toThrow();
  });
});
```

### Phase 2: Integration Testing
```typescript
// tests/integration/websocket-database.test.ts
describe('WebSocket + Database Integration', () => {
  test('WebSocket updates work during heavy database processing', async () => {
    // Start heavy database operation
    const heavyOperation = processLargeEmailBatch();
    
    // Test WebSocket responsiveness
    const wsResponse = await sendWebSocketMessage('get-agent-status');
    
    expect(wsResponse.latency).toBeLessThan(100); // ms
    await heavyOperation;
  });
});
```

---

## 🚀 Deployment Strategy

### Development Environment (Native)
```bash
# Ensure PostgreSQL is running
sudo systemctl status postgresql
sudo systemctl start postgresql  # if not running

# Install Node.js PostgreSQL client
npm install pg @types/pg

# Run schema migration
npm run db:migrate:postgresql

# Switch to PostgreSQL mode
export DATABASE_TYPE=postgresql
export POSTGRES_PASSWORD=your_secure_password
npm run dev
```

### Production Deployment (Future)
```bash
# Environment-based database selection (same pattern as current)
if [ "$NODE_ENV" = "production" ]; then
  export DATABASE_TYPE=postgresql
  export POSTGRES_PASSWORD="$PRODUCTION_POSTGRES_PASSWORD"
else
  export DATABASE_TYPE=sqlite  # Keep SQLite for development if desired
fi

# No Docker required - native PostgreSQL service
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

---

## 🛡 Risk Mitigation

### Rollback Plan
1. **Data Backup**: Full SQLite backup before migration (existing files preserved)
2. **Configuration Rollback**: Switch `DATABASE_TYPE=sqlite` in environment variables
3. **Code Rollback**: Database factory pattern allows instant switching
4. **Recovery Time**: < 2 minutes to restore SQLite operation (no container restart needed)
5. **Native Advantage**: No Docker dependencies means faster rollback

### Migration Validation
```typescript
// scripts/validate-migration.ts
export async function validateMigration(): Promise<ValidationResult> {
  const sqliteData = await extractSQLiteData();
  const postgresData = await extractPostgreSQLData();
  
  return {
    rowCountsMatch: compareRowCounts(sqliteData, postgresData),
    dataIntegrityCheck: validateDataIntegrity(sqliteData, postgresData),
    indexesCreated: validateIndexes(),
    performanceBaseline: await runPerformanceTests()
  };
}
```

---

## 📊 Expected Performance Improvements

### Before (SQLite + better-sqlite3)
- **WebSocket Updates**: Blocked during heavy processing (30+ seconds)
- **API Response**: 500ms-30s depending on background operations
- **Concurrent Operations**: Single writer bottleneck despite connection pooling
- **User Experience**: Frequent "system frozen" periods
- **Architecture**: Native file-based database

### After (PostgreSQL + Native Installation)
- **WebSocket Updates**: < 50ms response time consistently
- **API Response**: < 200ms even during heavy processing
- **Concurrent Operations**: True parallelism for reads and writes
- **User Experience**: Smooth, responsive real-time interface
- **Architecture**: Native PostgreSQL service (maintains local-first approach)

---

## 🕐 Migration Timeline

### Day 1: Infrastructure and Code Changes
- **Morning (3 hours)**: Native PostgreSQL installation, configuration, adapter creation
- **Afternoon (3 hours)**: Database factory implementation, repository updates

### Day 2: Data Migration and Testing
- **Morning (3 hours)**: Schema conversion, data migration scripts
- **Afternoon (3 hours)**: Testing, validation, performance verification

### Total Effort: 1.5 days (faster due to native approach)
### Rollback Time: < 2 minutes (no container dependencies)

---

## ✅ Migration Checklist

### Pre-Migration
- [ ] Native PostgreSQL 15 installed and configured
- [ ] PostgreSQL service running and optimized
- [ ] Database user and permissions configured
- [ ] Node.js pg package installed
- [ ] Database factory and PostgreSQL connection manager implemented
- [ ] Repository layer updated for database abstraction
- [ ] Migration scripts created and tested
- [ ] Backup of current SQLite database created
- [ ] Rollback procedure documented and tested

### Migration Execution
- [ ] PostgreSQL service verified running
- [ ] Database connection established and tested
- [ ] Schema migration executed successfully
- [ ] Data migration completed with validation
- [ ] All repository tests passing with PostgreSQL
- [ ] WebSocket real-time features tested under load
- [ ] API response times validated during heavy processing
- [ ] Agent orchestration tested without blocking
- [ ] Connection pooling metrics verified

### Post-Migration
- [ ] Performance benchmarks documented
- [ ] All real-time features working concurrently
- [ ] No database blocking observed during heavy processing
- [ ] WebSocket latency < 100ms consistently
- [ ] API response times < 200ms during background operations

---

## 🎯 Success Validation

The migration is successful when:
1. **Real-time WebSocket updates work during email analysis**
2. **API calls respond in < 200ms during heavy background processing**
3. **Agent orchestration operates without database conflicts**
4. **All existing data is preserved and accessible**
5. **Development workflow remains simple and native (no Docker required)**
6. **Connection pooling provides true concurrency**
7. **System maintains local-first architecture principles**

---

**Migration Lead:** Claude Code Agent  
**Approval Required Before:** Starting native PostgreSQL installation and schema migration  
**Estimated Completion:** 1.5 days with full real-time capabilities restored  
**Architecture:** Native PostgreSQL service (maintains existing local-first principles)