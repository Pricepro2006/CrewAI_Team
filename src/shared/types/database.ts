/**
 * Database Types
 * Comprehensive database and data persistence types
 */

import type { Timestamp } from './index.js';

// =====================================================
// Database Configuration Types
// =====================================================

export interface DatabaseConfig {
  type: 'sqlite' | 'postgres' | 'mysql' | 'mongodb';
  url?: string;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  database?: string;
  path?: string; // for sqlite
  ssl?: boolean | SSLConfig;
  pool?: PoolConfig;
  logging?: boolean | LoggingConfig;
  migrations?: MigrationConfig;
  backup?: BackupConfig;
  performance?: PerformanceConfig;
}

export interface SSLConfig {
  rejectUnauthorized: boolean;
  ca?: string;
  key?: string;
  cert?: string;
}

export interface PoolConfig {
  min: number;
  max: number;
  acquireTimeoutMillis: number;
  createTimeoutMillis: number;
  destroyTimeoutMillis: number;
  idleTimeoutMillis: number;
  reapIntervalMillis: number;
  createRetryIntervalMillis: number;
  propagateCreateError: boolean;
}

export interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  queries: boolean;
  performance: boolean;
  slowQueries: boolean;
  slowQueryThreshold: number; // milliseconds
}

export interface MigrationConfig {
  directory: string;
  tableName: string;
  autoMigrate: boolean;
  validateChecksums: boolean;
  transactional: boolean;
}

export interface BackupConfig {
  enabled: boolean;
  schedule: string; // cron expression
  location: string;
  retention: number; // days
  compression: boolean;
  encryption: boolean;
}

export interface PerformanceConfig {
  queryTimeout: number;
  connectionTimeout: number;
  maxQueryComplexity: number;
  enableQueryPlan: boolean;
  enableStatistics: boolean;
}

// =====================================================
// Database Entity Types
// =====================================================

export interface DatabaseEntity {
  id: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  version?: number;
  isActive?: boolean;
  metadata?: Record<string, unknown>;
}

export interface DatabaseMigration {
  id: number;
  name: string;
  filename: string;
  checksum: string;
  appliedAt: Timestamp;
  executionTime: number; // milliseconds
  success: boolean;
  error?: string;
}

export interface DatabaseConnection {
  id: string;
  type: string;
  status: 'connected' | 'disconnected' | 'error' | 'connecting';
  connectedAt?: Timestamp;
  lastActivity: Timestamp;
  queryCount: number;
  errorCount: number;
  metadata?: Record<string, unknown>;
}

// =====================================================
// Query Types
// =====================================================

export interface DatabaseQuery {
  id: string;
  sql: string;
  parameters: unknown[];
  type: 'select' | 'insert' | 'update' | 'delete' | 'ddl' | 'transaction';
  
  // Execution details
  executedAt: Timestamp;
  executionTime: number; // milliseconds
  rowsAffected?: number;
  rowsReturned?: number;
  
  // Performance
  queryPlan?: QueryPlan;
  indexesUsed?: string[];
  cacheHit?: boolean;
  
  // Context
  connectionId: string;
  userId?: string;
  sessionId?: string;
  
  // Status
  status: 'pending' | 'executing' | 'completed' | 'error' | 'cancelled';
  error?: QueryError;
  
  // Metadata
  tags?: string[];
  priority?: 'low' | 'normal' | 'high';
}

export interface QueryPlan {
  estimatedCost: number;
  estimatedRows: number;
  operations: QueryOperation[];
  indexes: IndexUsage[];
  warnings?: string[];
}

export interface QueryOperation {
  type: string;
  description: string;
  cost: number;
  rows: number;
  time: number;
  children?: QueryOperation[];
}

export interface IndexUsage {
  indexName: string;
  tableName: string;
  type: 'scan' | 'seek' | 'lookup';
  efficiency: number; // 0-1
  rowsExamined: number;
  rowsReturned: number;
}

export interface QueryError {
  code: string;
  message: string;
  severity: 'error' | 'warning' | 'notice';
  position?: number;
  hint?: string;
  details?: Record<string, unknown>;
}

// =====================================================
// Transaction Types
// =====================================================

export interface DatabaseTransaction {
  id: string;
  connectionId: string;
  
  // Status
  status: 'active' | 'committed' | 'rolled_back' | 'error';
  isolationLevel: 'read_uncommitted' | 'read_committed' | 'repeatable_read' | 'serializable';
  
  // Timing
  startedAt: Timestamp;
  committedAt?: Timestamp;
  rolledBackAt?: Timestamp;
  duration?: number; // milliseconds
  
  // Operations
  operations: TransactionOperation[];
  savepoints: Savepoint[];
  
  // Locking
  locksHeld: DatabaseLock[];
  locksWaiting: DatabaseLock[];
  deadlockDetected: boolean;
  
  // Context
  userId?: string;
  sessionId?: string;
  
  // Error handling
  error?: QueryError;
  rollbackReason?: string;
}

export interface TransactionOperation {
  id: string;
  queryId: string;
  type: 'query' | 'savepoint' | 'rollback_to_savepoint';
  executedAt: Timestamp;
  success: boolean;
  error?: QueryError;
}

export interface Savepoint {
  name: string;
  createdAt: Timestamp;
  active: boolean;
}

export interface DatabaseLock {
  id: string;
  type: 'shared' | 'exclusive' | 'update' | 'intent_shared' | 'intent_exclusive';
  resource: string; // table, row, page, etc.
  resourceType: 'table' | 'row' | 'page' | 'database';
  acquiredAt?: Timestamp;
  requestedAt: Timestamp;
  holdingTransactionId: string;
  waitingTransactionIds: string[];
}

// =====================================================
// Index and Performance Types
// =====================================================

export interface DatabaseIndex {
  name: string;
  tableName: string;
  columns: IndexColumn[];
  type: 'btree' | 'hash' | 'gin' | 'gist' | 'fulltext' | 'spatial';
  unique: boolean;
  partial: boolean;
  
  // Performance metrics
  size: number; // bytes
  usage: IndexUsageStats;
  
  // Status
  isValid: boolean;
  isReady: boolean;
  lastRebuilt?: Timestamp;
  
  // Configuration
  fillfactor?: number;
  condition?: string; // for partial indexes
  options?: Record<string, unknown>;
}

export interface IndexColumn {
  name: string;
  order: 'asc' | 'desc';
  nullsFirst?: boolean;
  expression?: string; // for expression indexes
}

export interface IndexUsageStats {
  scans: number;
  tuplesRead: number;
  tuplesReturned: number;
  blocksRead: number;
  blocksHit: number;
  lastUsed?: Timestamp;
  efficiency: number; // 0-1
}

export interface DatabaseStatistics {
  // Table statistics
  tables: TableStatistics[];
  
  // Index statistics
  indexes: IndexStatistics[];
  
  // Query statistics
  queries: QueryStatistics;
  
  // Connection statistics
  connections: ConnectionStatistics;
  
  // Performance metrics
  performance: PerformanceStatistics;
  
  // Storage metrics
  storage: StorageStatistics;
  
  // Generated at
  generatedAt: Timestamp;
  generatedBy: string;
}

export interface TableStatistics {
  tableName: string;
  schemaName: string;
  rowCount: number;
  size: number; // bytes
  indexSize: number; // bytes
  lastAnalyzed?: Timestamp;
  estimatedRows: number;
  insertRate: number; // per second
  updateRate: number;
  deleteRate: number;
  selectRate: number;
}

export interface IndexStatistics {
  indexName: string;
  tableName: string;
  size: number;
  usage: IndexUsageStats;
  cardinality: number;
  selectivity: number; // 0-1
  clustered: boolean;
}

export interface QueryStatistics {
  totalQueries: number;
  successfulQueries: number;
  failedQueries: number;
  averageExecutionTime: number;
  slowestQueries: SlowQuery[];
  mostFrequentQueries: FrequentQuery[];
  queryTypeBreakdown: Record<string, number>;
}

export interface SlowQuery {
  sql: string;
  executionTime: number;
  executedAt: Timestamp;
  rowsExamined: number;
  rowsReturned: number;
  tablesUsed: string[];
}

export interface FrequentQuery {
  sqlHash: string;
  sql: string;
  executionCount: number;
  averageExecutionTime: number;
  totalExecutionTime: number;
  lastExecuted: Timestamp;
}

export interface ConnectionStatistics {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  maxConcurrentConnections: number;
  averageConnectionTime: number;
  connectionErrors: number;
  connectionTimeouts: number;
}

export interface PerformanceStatistics {
  cpu: {
    usage: number; // percentage
    timeInQueries: number; // milliseconds
    timeInIO: number;
    timeWaiting: number;
  };
  
  memory: {
    usage: number; // bytes
    bufferHits: number;
    bufferMisses: number;
    cacheHitRatio: number; // 0-1
  };
  
  io: {
    readsPerSecond: number;
    writesPerSecond: number;
    bytesRead: number;
    bytesWritten: number;
    averageReadTime: number;
    averageWriteTime: number;
  };
  
  locks: {
    currentLocks: number;
    lockWaits: number;
    lockTimeouts: number;
    deadlocks: number;
  };
}

export interface StorageStatistics {
  totalSize: number; // bytes
  dataSize: number;
  indexSize: number;
  freeSpace: number;
  fragmentation: number; // percentage
  
  // Growth metrics
  growthRate: number; // bytes per day
  projectedSize: number; // bytes (30 days from now)
  
  // Backup metrics
  lastBackupDate?: Timestamp;
  backupSize?: number;
  backupDuration?: number;
}

// =====================================================
// Data Model Types
// =====================================================

export interface DataModel {
  name: string;
  version: string;
  description: string;
  
  // Schema definition
  tables: TableDefinition[];
  relationships: Relationship[];
  constraints: ConstraintDefinition[];
  indexes: IndexDefinition[];
  views: ViewDefinition[];
  functions: FunctionDefinition[];
  triggers: TriggerDefinition[];
  
  // Metadata
  createdAt: Timestamp;
  createdBy: string;
  lastModified: Timestamp;
  lastModifiedBy: string;
  
  // Validation
  isValid: boolean;
  validationErrors: string[];
  
  // Documentation
  documentation?: string;
  tags: string[];
}

export interface TableDefinition {
  name: string;
  schema: string;
  columns: ColumnDefinition[];
  primaryKey?: string[];
  foreignKeys: ForeignKeyDefinition[];
  checks: CheckConstraintDefinition[];
  
  // Properties
  temporary: boolean;
  unlogged: boolean;
  
  // Options
  tablespace?: string;
  options?: Record<string, unknown>;
  
  // Documentation
  comment?: string;
  tags: string[];
}

export interface ColumnDefinition {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: unknown;
  
  // Constraints
  primaryKey: boolean;
  unique: boolean;
  autoIncrement: boolean;
  
  // Metadata
  comment?: string;
  tags: string[];
  
  // Validation
  checkConstraints: string[];
  
  // Properties specific to type
  length?: number;
  precision?: number;
  scale?: number;
  enumValues?: string[];
}

export interface ForeignKeyDefinition {
  name: string;
  columns: string[];
  referencedTable: string;
  referencedColumns: string[];
  onDelete: 'cascade' | 'restrict' | 'set_null' | 'set_default' | 'no_action';
  onUpdate: 'cascade' | 'restrict' | 'set_null' | 'set_default' | 'no_action';
  deferrable: boolean;
  initiallyDeferred: boolean;
}

export interface CheckConstraintDefinition {
  name: string;
  expression: string;
  enforced: boolean;
}

export interface Relationship {
  name: string;
  type: 'one_to_one' | 'one_to_many' | 'many_to_many';
  fromTable: string;
  toTable: string;
  fromColumns: string[];
  toColumns: string[];
  
  // Properties
  required: boolean;
  cascadeDelete: boolean;
  
  // Metadata
  description?: string;
  tags: string[];
}

export interface ConstraintDefinition {
  name: string;
  type: 'primary_key' | 'foreign_key' | 'unique' | 'check' | 'not_null';
  table: string;
  columns: string[];
  expression?: string;
  
  // Status
  enforced: boolean;
  validated: boolean;
  
  // Options
  deferrable: boolean;
  initiallyDeferred: boolean;
}

export interface IndexDefinition {
  name: string;
  table: string;
  columns: IndexColumn[];
  type: 'btree' | 'hash' | 'gin' | 'gist' | 'fulltext';
  unique: boolean;
  partial: boolean;
  condition?: string;
  
  // Options
  method?: string;
  fillfactor?: number;
  tablespace?: string;
  options?: Record<string, unknown>;
}

export interface ViewDefinition {
  name: string;
  schema: string;
  definition: string;
  columns: ColumnDefinition[];
  
  // Properties
  materialized: boolean;
  updatable: boolean;
  
  // Dependencies
  dependencies: string[]; // tables/views this view depends on
  
  // Metadata
  comment?: string;
  tags: string[];
}

export interface FunctionDefinition {
  name: string;
  schema: string;
  language: string;
  returnType: string;
  parameters: FunctionParameter[];
  body: string;
  
  // Properties
  immutable: boolean;
  deterministic: boolean;
  securityDefiner: boolean;
  
  // Metadata
  comment?: string;
  tags: string[];
}

export interface FunctionParameter {
  name: string;
  type: string;
  mode: 'in' | 'out' | 'inout';
  defaultValue?: unknown;
}

export interface TriggerDefinition {
  name: string;
  table: string;
  timing: 'before' | 'after' | 'instead_of';
  events: ('insert' | 'update' | 'delete')[];
  level: 'row' | 'statement';
  condition?: string;
  function: string;
  
  // Properties
  enabled: boolean;
  
  // Metadata
  comment?: string;
  tags: string[];
}

// =====================================================
// Database Monitoring Types
// =====================================================

export interface DatabaseMonitoring {
  // Health status
  health: DatabaseHealth;
  
  // Performance metrics
  performance: DatabasePerformance;
  
  // Resource usage
  resources: DatabaseResources;
  
  // Alert conditions
  alerts: DatabaseAlert[];
  
  // Monitoring configuration
  configuration: MonitoringConfiguration;
  
  // Last updated
  lastUpdated: Timestamp;
  updateInterval: number; // seconds
}

export interface DatabaseHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number; // seconds
  version: string;
  
  // Connection health
  connections: {
    total: number;
    active: number;
    idle: number;
    maxAllowed: number;
    refused: number;
  };
  
  // Replication health (if applicable)
  replication?: {
    status: 'running' | 'stopped' | 'error';
    lag: number; // seconds
    lastSyncAt?: Timestamp;
  };
  
  // Backup health
  backup?: {
    lastBackupAt?: Timestamp;
    lastBackupStatus: 'success' | 'failed' | 'running';
    nextScheduledBackup?: Timestamp;
  };
}

export interface DatabasePerformance {
  // Query performance
  queries: {
    averageExecutionTime: number;
    slowQueryCount: number;
    queriesPerSecond: number;
    longestRunningQuery: number; // seconds
  };
  
  // Transaction performance
  transactions: {
    commitsPerSecond: number;
    rollbacksPerSecond: number;
    averageTransactionTime: number;
    longestTransaction: number; // seconds
  };
  
  // I/O performance
  io: {
    readsPerSecond: number;
    writesPerSecond: number;
    averageReadTime: number;
    averageWriteTime: number;
  };
  
  // Cache performance
  cache: {
    hitRatio: number; // 0-1
    bufferHits: number;
    bufferMisses: number;
  };
}

export interface DatabaseResources {
  // CPU usage
  cpu: {
    usage: number; // percentage
    loadAverage: number[];
  };
  
  // Memory usage
  memory: {
    usage: number; // percentage
    used: number; // bytes
    available: number; // bytes
    bufferCache: number; // bytes
  };
  
  // Storage usage
  storage: {
    usage: number; // percentage
    used: number; // bytes
    available: number; // bytes
    growthRate: number; // bytes per day
  };
  
  // Network usage
  network: {
    bytesIn: number;
    bytesOut: number;
    connectionsPerSecond: number;
  };
}

export interface DatabaseAlert {
  id: string;
  name: string;
  severity: 'critical' | 'warning' | 'info';
  status: 'active' | 'resolved' | 'acknowledged';
  
  // Alert details
  condition: string;
  threshold: number;
  currentValue: number;
  
  // Timing
  triggeredAt: Timestamp;
  resolvedAt?: Timestamp;
  acknowledgedAt?: Timestamp;
  acknowledgedBy?: string;
  
  // Response
  actions: AlertAction[];
  notifications: AlertNotification[];
}

export interface AlertAction {
  type: 'email' | 'webhook' | 'script' | 'restart' | 'backup';
  configuration: Record<string, unknown>;
  executedAt?: Timestamp;
  success?: boolean;
  error?: string;
}

export interface AlertNotification {
  channel: string;
  sentAt: Timestamp;
  success: boolean;
  error?: string;
}

export interface MonitoringConfiguration {
  // Collection intervals
  intervals: {
    health: number; // seconds
    performance: number;
    resources: number;
  };
  
  // Alert thresholds
  thresholds: {
    slowQueryTime: number; // milliseconds
    connectionUsage: number; // percentage
    cpuUsage: number; // percentage
    memoryUsage: number; // percentage
    storageUsage: number; // percentage
  };
  
  // Retention policies
  retention: {
    performanceData: number; // days
    alertHistory: number; // days
    queryLogs: number; // days
  };
  
  // Notification channels
  notifications: {
    email: string[];
    webhooks: string[];
    slack?: string;
  };
}

// =====================================================
// Database Security Types
// =====================================================

export interface DatabaseSecurity {
  // Authentication
  authentication: AuthenticationConfig;
  
  // Authorization
  authorization: AuthorizationConfig;
  
  // Encryption
  encryption: EncryptionConfig;
  
  // Auditing
  auditing: AuditingConfig;
  
  // Network security
  network: NetworkSecurityConfig;
  
  // Compliance
  compliance: ComplianceConfig;
}

export interface AuthenticationConfig {
  methods: ('password' | 'certificate' | 'ldap' | 'oauth' | 'kerberos')[];
  passwordPolicy: PasswordPolicy;
  sessionTimeout: number; // minutes
  maxLoginAttempts: number;
  lockoutDuration: number; // minutes
}

export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSymbols: boolean;
  historySize: number; // prevent reuse of last N passwords
  maxAge: number; // days
}

export interface AuthorizationConfig {
  roles: DatabaseRole[];
  permissions: DatabasePermission[];
  defaultRole: string;
  inheritanceEnabled: boolean;
}

export interface DatabaseRole {
  name: string;
  description: string;
  permissions: string[];
  inheritsFrom: string[];
  
  // Properties
  canLogin: boolean;
  isSystem: boolean;
  
  // Limits
  connectionLimit?: number;
  validUntil?: Timestamp;
}

export interface DatabasePermission {
  name: string;
  description: string;
  scope: 'database' | 'schema' | 'table' | 'column' | 'function';
  actions: string[];
  conditions?: string[];
}

export interface EncryptionConfig {
  // Data at rest
  dataAtRest: {
    enabled: boolean;
    algorithm: string;
    keySize: number;
    keyRotationDays: number;
  };
  
  // Data in transit
  dataInTransit: {
    enabled: boolean;
    tlsVersion: string;
    cipherSuites: string[];
    certificatePath?: string;
  };
  
  // Column-level encryption
  columnEncryption: ColumnEncryptionConfig[];
}

export interface ColumnEncryptionConfig {
  tableName: string;
  columnName: string;
  algorithm: string;
  keyId: string;
}

export interface AuditingConfig {
  enabled: boolean;
  logLocation: string;
  logFormat: 'json' | 'text' | 'csv';
  
  // What to audit
  auditLogin: boolean;
  auditDDL: boolean;
  auditDML: boolean;
  auditSelect: boolean;
  auditFailures: boolean;
  
  // Retention
  retentionDays: number;
  archiveLocation?: string;
}

export interface NetworkSecurityConfig {
  // IP restrictions
  allowedIPs: string[];
  deniedIPs: string[];
  
  // Firewall rules
  firewallEnabled: boolean;
  allowedPorts: number[];
  
  // VPN requirements
  requireVPN: boolean;
  vpnNetworks?: string[];
}

export interface ComplianceConfig {
  standards: ('SOX' | 'GDPR' | 'HIPAA' | 'PCI_DSS' | 'SOC2')[];
  dataRetentionPolicies: DataRetentionPolicy[];
  privacySettings: PrivacySettings;
}

export interface DataRetentionPolicy {
  tableName: string;
  retentionPeriod: number; // days
  archiveAfter?: number; // days
  deleteAfter?: number; // days
  conditions?: string[];
}

export interface PrivacySettings {
  enableDataMasking: boolean;
  maskingRules: DataMaskingRule[];
  rightToErasure: boolean;
  consentTracking: boolean;
}

export interface DataMaskingRule {
  tableName: string;
  columnName: string;
  maskingType: 'full' | 'partial' | 'hash' | 'substitute';
  maskingPattern?: string;
  conditions?: string[];
}