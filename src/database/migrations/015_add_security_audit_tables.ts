import Database, { Database as DatabaseInstance } from "better-sqlite3";

/**
 * Migration: Add security audit tables
 * Version: 015
 * Description: Creates comprehensive security audit logging tables for compliance
 */

export function up(db: DatabaseInstance) {
  console.log("Creating security audit tables...");

  // Create main audit log table
  db.exec(`
    CREATE TABLE IF NOT EXISTS security_audit_log (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      event_type TEXT NOT NULL CHECK (event_type IN ('AUTH', 'ACCESS', 'MODIFY', 'DELETE', 'PAYMENT', 'ERROR')),
      action TEXT NOT NULL,
      user_id TEXT,
      target_id TEXT,
      result TEXT NOT NULL CHECK (result IN ('SUCCESS', 'FAILURE')),
      ip_address TEXT,
      user_agent TEXT,
      session_id TEXT,
      request_id TEXT,
      
      -- Additional context
      resource_type TEXT,
      resource_id TEXT,
      operation TEXT,
      
      -- Metadata (JSON)
      metadata TEXT,
      
      -- Risk scoring
      risk_score DECIMAL(3,2),
      risk_factors TEXT, -- JSON array
      
      -- Response tracking
      response_code INTEGER,
      response_time_ms INTEGER,
      
      -- Compliance fields
      data_classification TEXT,
      compliance_flags TEXT, -- JSON array
      
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      
      -- Indexes for querying
      INDEX idx_audit_timestamp (timestamp DESC),
      INDEX idx_audit_user_id (user_id, timestamp DESC),
      INDEX idx_audit_event_type (event_type, timestamp DESC),
      INDEX idx_audit_result (result, event_type),
      INDEX idx_audit_target (target_id, timestamp DESC),
      INDEX idx_audit_risk (risk_score DESC)
    );
  `);

  // Create data access log table
  db.exec(`
    CREATE TABLE IF NOT EXISTS data_access_log (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      user_id TEXT NOT NULL,
      
      -- What was accessed
      table_name TEXT NOT NULL,
      record_id TEXT,
      field_names TEXT, -- JSON array of accessed fields
      
      -- Access details
      access_type TEXT NOT NULL CHECK (access_type IN ('READ', 'WRITE', 'UPDATE', 'DELETE')),
      query_hash TEXT, -- Hash of the actual query for forensics
      
      -- Data classification
      contains_pii BOOLEAN DEFAULT false,
      contains_payment BOOLEAN DEFAULT false,
      contains_health BOOLEAN DEFAULT false,
      sensitivity_level TEXT CHECK (sensitivity_level IN ('PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED')),
      
      -- Context
      purpose TEXT,
      justification TEXT,
      approved_by TEXT,
      
      -- Performance
      rows_affected INTEGER,
      execution_time_ms INTEGER,
      
      -- Compliance
      compliance_check_passed BOOLEAN DEFAULT true,
      compliance_notes TEXT,
      
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      
      FOREIGN KEY (user_id) REFERENCES users(id),
      INDEX idx_data_access_user (user_id, timestamp DESC),
      INDEX idx_data_access_table (table_name, timestamp DESC),
      INDEX idx_data_access_sensitivity (sensitivity_level, contains_pii, contains_payment)
    );
  `);

  // Create authentication events table
  db.exec(`
    CREATE TABLE IF NOT EXISTS auth_events (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      user_id TEXT,
      email TEXT,
      
      -- Event details
      event_type TEXT NOT NULL CHECK (event_type IN (
        'LOGIN_ATTEMPT', 'LOGIN_SUCCESS', 'LOGIN_FAILURE',
        'LOGOUT', 'PASSWORD_RESET', 'PASSWORD_CHANGE',
        'MFA_CHALLENGE', 'MFA_SUCCESS', 'MFA_FAILURE',
        'SESSION_CREATED', 'SESSION_EXPIRED', 'SESSION_REVOKED',
        'TOKEN_ISSUED', 'TOKEN_REFRESHED', 'TOKEN_REVOKED'
      )),
      
      -- Authentication method
      auth_method TEXT,
      mfa_type TEXT,
      
      -- Session information
      session_id TEXT,
      device_id TEXT,
      device_fingerprint TEXT,
      
      -- Location
      ip_address TEXT,
      country TEXT,
      city TEXT,
      is_vpn BOOLEAN DEFAULT false,
      is_tor BOOLEAN DEFAULT false,
      
      -- User agent details
      user_agent TEXT,
      browser TEXT,
      os TEXT,
      device_type TEXT,
      
      -- Risk assessment
      risk_score DECIMAL(3,2),
      suspicious_indicators TEXT, -- JSON array
      
      -- Result
      success BOOLEAN NOT NULL,
      failure_reason TEXT,
      
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      
      INDEX idx_auth_events_user (user_id, timestamp DESC),
      INDEX idx_auth_events_email (email, timestamp DESC),
      INDEX idx_auth_events_session (session_id),
      INDEX idx_auth_events_type (event_type, timestamp DESC),
      INDEX idx_auth_events_risk (risk_score DESC)
    );
  `);

  // Create payment security log table
  db.exec(`
    CREATE TABLE IF NOT EXISTS payment_security_log (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      user_id TEXT NOT NULL,
      
      -- Transaction details
      transaction_id TEXT,
      payment_method_token TEXT, -- Tokenized payment method
      amount DECIMAL(10,2),
      currency TEXT,
      
      -- Security checks
      fraud_score DECIMAL(3,2),
      fraud_checks_passed TEXT, -- JSON array of passed checks
      fraud_checks_failed TEXT, -- JSON array of failed checks
      
      -- Velocity checks
      transactions_last_hour INTEGER,
      transactions_last_day INTEGER,
      amount_last_hour DECIMAL(10,2),
      amount_last_day DECIMAL(10,2),
      
      -- Device and location
      device_fingerprint TEXT,
      ip_address TEXT,
      billing_zip TEXT, -- Partial for verification
      
      -- 3D Secure / SCA
      three_ds_status TEXT,
      sca_required BOOLEAN DEFAULT false,
      sca_completed BOOLEAN DEFAULT false,
      
      -- Result
      approved BOOLEAN NOT NULL,
      decline_reason TEXT,
      decline_code TEXT,
      
      -- Compliance
      pci_compliant BOOLEAN DEFAULT true,
      data_retention_days INTEGER DEFAULT 365,
      
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      
      FOREIGN KEY (user_id) REFERENCES users(id),
      INDEX idx_payment_security_user (user_id, timestamp DESC),
      INDEX idx_payment_security_transaction (transaction_id),
      INDEX idx_payment_security_fraud (fraud_score DESC),
      INDEX idx_payment_security_result (approved, timestamp DESC)
    );
  `);

  // Create API key usage table
  db.exec(`
    CREATE TABLE IF NOT EXISTS api_key_usage (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      api_key_hash TEXT NOT NULL,
      api_key_prefix TEXT NOT NULL, -- First 8 chars for identification
      
      -- Request details
      endpoint TEXT NOT NULL,
      method TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      
      -- Rate limiting
      requests_this_minute INTEGER DEFAULT 1,
      requests_this_hour INTEGER DEFAULT 1,
      requests_this_day INTEGER DEFAULT 1,
      
      -- Response
      status_code INTEGER,
      response_time_ms INTEGER,
      error_message TEXT,
      
      -- Usage metrics
      tokens_consumed INTEGER,
      data_transferred_bytes INTEGER,
      
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      
      INDEX idx_api_usage_key (api_key_hash, timestamp DESC),
      INDEX idx_api_usage_endpoint (endpoint, timestamp DESC),
      INDEX idx_api_usage_timestamp (timestamp DESC)
    );
  `);

  // Create security incidents table
  db.exec(`
    CREATE TABLE IF NOT EXISTS security_incidents (
      id TEXT PRIMARY KEY,
      incident_date TEXT NOT NULL,
      detected_at TEXT NOT NULL,
      
      -- Incident classification
      incident_type TEXT NOT NULL CHECK (incident_type IN (
        'UNAUTHORIZED_ACCESS', 'DATA_BREACH', 'FRAUD_ATTEMPT',
        'BRUTE_FORCE', 'SQL_INJECTION', 'XSS_ATTEMPT',
        'CSRF_ATTEMPT', 'DDoS', 'ACCOUNT_TAKEOVER',
        'PRIVILEGE_ESCALATION', 'DATA_EXFILTRATION', 'OTHER'
      )),
      severity TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
      
      -- Affected resources
      affected_users TEXT, -- JSON array of user IDs
      affected_systems TEXT, -- JSON array
      affected_data_types TEXT, -- JSON array
      
      -- Attack details
      attack_vector TEXT,
      attack_source_ip TEXT,
      attack_pattern TEXT,
      
      -- Response
      detected_by TEXT, -- System or user that detected
      response_actions TEXT, -- JSON array of actions taken
      mitigated_at TEXT,
      
      -- Impact assessment
      data_compromised BOOLEAN DEFAULT false,
      service_disrupted BOOLEAN DEFAULT false,
      financial_impact DECIMAL(10,2),
      records_affected INTEGER,
      
      -- Investigation
      investigation_status TEXT CHECK (investigation_status IN (
        'NEW', 'INVESTIGATING', 'RESOLVED', 'FALSE_POSITIVE'
      )),
      investigation_notes TEXT,
      root_cause TEXT,
      
      -- Compliance reporting
      reported_to_authorities BOOLEAN DEFAULT false,
      reported_to_users BOOLEAN DEFAULT false,
      compliance_notifications TEXT, -- JSON array
      
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      
      INDEX idx_incidents_date (incident_date DESC),
      INDEX idx_incidents_type (incident_type, incident_date DESC),
      INDEX idx_incidents_severity (severity, incident_date DESC),
      INDEX idx_incidents_status (investigation_status)
    );
  `);

  // Create encryption key audit table
  db.exec(`
    CREATE TABLE IF NOT EXISTS encryption_key_audit (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      
      -- Key operation
      operation TEXT NOT NULL CHECK (operation IN (
        'KEY_GENERATED', 'KEY_ROTATED', 'KEY_ACCESSED',
        'KEY_REVOKED', 'KEY_EXPIRED', 'KEY_BACKED_UP'
      )),
      
      -- Key identification (never store actual keys!)
      key_id TEXT NOT NULL,
      key_type TEXT,
      key_version INTEGER,
      
      -- Operation details
      performed_by TEXT,
      reason TEXT,
      
      -- Key metadata
      algorithm TEXT,
      key_length INTEGER,
      expiry_date TEXT,
      
      -- Result
      success BOOLEAN NOT NULL,
      error_message TEXT,
      
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      
      INDEX idx_key_audit_timestamp (timestamp DESC),
      INDEX idx_key_audit_key_id (key_id, timestamp DESC),
      INDEX idx_key_audit_operation (operation, timestamp DESC)
    );
  `);

  // Create data retention policy table
  db.exec(`
    CREATE TABLE IF NOT EXISTS data_retention_policies (
      id TEXT PRIMARY KEY,
      table_name TEXT NOT NULL UNIQUE,
      
      -- Retention settings
      retention_days INTEGER NOT NULL,
      archive_after_days INTEGER,
      delete_after_days INTEGER,
      
      -- Data classification
      contains_pii BOOLEAN DEFAULT false,
      contains_payment BOOLEAN DEFAULT false,
      contains_health BOOLEAN DEFAULT false,
      
      -- Compliance requirements
      regulatory_requirement TEXT,
      compliance_standard TEXT,
      
      -- Execution
      last_cleanup_date TEXT,
      next_cleanup_date TEXT,
      records_deleted_last_run INTEGER,
      records_archived_last_run INTEGER,
      
      -- Status
      active BOOLEAN DEFAULT true,
      
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Insert default retention policies
  db.exec(`
    INSERT INTO data_retention_policies (
      id, table_name, retention_days, archive_after_days, delete_after_days,
      contains_pii, contains_payment, regulatory_requirement
    ) VALUES 
    ('pol_001', 'security_audit_log', 2555, 365, 2555, false, false, 'SOC2'),
    ('pol_002', 'payment_security_log', 2555, 180, 2555, false, true, 'PCI DSS'),
    ('pol_003', 'auth_events', 365, 90, 365, false, false, 'Security Best Practice'),
    ('pol_004', 'purchase_history', 2555, 730, 2555, true, true, 'PCI DSS, GDPR'),
    ('pol_005', 'api_key_usage', 90, NULL, 90, false, false, 'Rate Limiting'),
    ('pol_006', 'data_access_log', 365, 180, 365, false, false, 'GDPR, HIPAA')
  `);

  console.log("✅ Security audit tables created successfully");
}

export function down(db: DatabaseInstance) {
  console.log("Dropping security audit tables...");

  db.exec(`
    DROP TABLE IF EXISTS data_retention_policies;
    DROP TABLE IF EXISTS encryption_key_audit;
    DROP TABLE IF EXISTS security_incidents;
    DROP TABLE IF EXISTS api_key_usage;
    DROP TABLE IF EXISTS payment_security_log;
    DROP TABLE IF EXISTS auth_events;
    DROP TABLE IF EXISTS data_access_log;
    DROP TABLE IF EXISTS security_audit_log;
  `);

  console.log("✅ Security audit tables dropped successfully");
}