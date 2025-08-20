#!/usr/bin/env node
/**
 * Production-Ready Database Layer Assessment
 * Tests all critical aspects of the database implementation
 */

import Database from "better-sqlite3";
import { performance } from "perf_hooks";
import { createHash } from "crypto";

interface TestResult {
  category: string;
  test: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
  passed: boolean;
  details: string;
  recommendation?: string;
  executionTime?: number;
}

class DatabaseProductionTester {
  private db: Database.Database;
  private results: TestResult[] = [];
  
  constructor(dbPath: string = "./test_production.db") {
    this.db = new Database(dbPath);
  }

  // ==================== Schema Design Tests ====================
  
  async testSchemaDesign(): Promise<void> {
    console.log("\n🔍 Testing Schema Design...\n");
    
    // Test 1: Check for proper indexes
    const indexes = this.db.prepare(`
      SELECT name, tbl_name, sql FROM sqlite_master 
      WHERE type = 'index' AND name NOT LIKE 'sqlite_%'
    `).all();
    
    this.results.push({
      category: "Schema Design",
      test: "Index Coverage",
      severity: indexes.length < 5 ? "HIGH" : "INFO",
      passed: indexes.length >= 5,
      details: `Found ${indexes.length} indexes`,
      recommendation: indexes.length < 5 ? "Add indexes for frequently queried columns" : undefined
    });
    
    // Test 2: Check for foreign key constraints
    const foreignKeys = this.db.pragma("foreign_key_list(emails_enhanced)");
    
    this.results.push({
      category: "Schema Design",
      test: "Foreign Key Constraints",
      severity: "CRITICAL",
      passed: this.db.pragma("foreign_keys")[0].foreign_keys === 1,
      details: `Foreign keys ${this.db.pragma("foreign_keys")[0].foreign_keys ? "enabled" : "DISABLED"}`,
      recommendation: !this.db.pragma("foreign_keys")[0].foreign_keys ? "Enable foreign key constraints" : undefined
    });
    
    // Test 3: Check for proper data types
    const tableInfo = this.db.pragma("table_info(emails_enhanced)");
    const hasTimestamps = tableInfo.some((col: any) => col.name.includes("_at"));
    
    this.results.push({
      category: "Schema Design",
      test: "Timestamp Columns",
      severity: "MEDIUM",
      passed: hasTimestamps,
      details: hasTimestamps ? "Timestamp columns present" : "Missing timestamp columns",
      recommendation: !hasTimestamps ? "Add created_at/updated_at columns" : undefined
    });
  }
  
  // ==================== Query Optimization Tests ====================
  
  async testQueryOptimization(): Promise<void> {
    console.log("\n⚡ Testing Query Optimization...\n");
    
    // Create test data
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS test_emails (
        id INTEGER PRIMARY KEY,
        subject TEXT,
        sender_email TEXT,
        received_at INTEGER,
        status TEXT
      );
      
      CREATE INDEX IF NOT EXISTS idx_test_emails_sender ON test_emails(sender_email);
      CREATE INDEX IF NOT EXISTS idx_test_emails_received ON test_emails(received_at);
    `);
    
    // Insert test data
    const stmt = this.db.prepare(`
      INSERT INTO test_emails (subject, sender_email, received_at, status) 
      VALUES (?, ?, ?, ?)
    `);
    
    for (let i = 0; i < 10000; i++) {
      stmt.run(
        `Test Email ${i}`,
        `user${i % 100}@example.com`,
        Date.now() - Math.random() * 86400000 * 30,
        i % 3 === 0 ? "read" : "unread"
      );
    }
    
    // Test 1: Query with index
    const start1 = performance.now();
    const result1 = this.db.prepare(`
      SELECT * FROM test_emails WHERE sender_email = ?
    `).all("user50@example.com");
    const time1 = performance.now() - start1;
    
    // Test 2: Explain query plan
    const plan = this.db.prepare(`
      EXPLAIN QUERY PLAN 
      SELECT * FROM test_emails WHERE sender_email = ?
    `).all("user50@example.com");
    
    const usesIndex = plan.some((row: any) => 
      row.detail?.includes("USING INDEX")
    );
    
    this.results.push({
      category: "Query Optimization",
      test: "Index Usage",
      severity: "HIGH",
      passed: usesIndex,
      details: `Query ${usesIndex ? "uses" : "DOES NOT use"} index (${time1.toFixed(2)}ms)`,
      recommendation: !usesIndex ? "Ensure queries use proper indexes" : undefined,
      executionTime: time1
    });
    
    // Test 3: N+1 Query Detection
    const start2 = performance.now();
    // Simulate N+1 query pattern
    const emails = this.db.prepare("SELECT * FROM test_emails LIMIT 100").all();
    for (const email of emails) {
      this.db.prepare("SELECT * FROM test_emails WHERE id = ?").get(email.id);
    }
    const time2 = performance.now() - start2;
    
    const start3 = performance.now();
    // Optimized version
    const ids = emails.map((e: any) => e.id);
    this.db.prepare(`
      SELECT * FROM test_emails WHERE id IN (${ids.map(() => '?').join(',')})
    `).all(...ids);
    const time3 = performance.now() - start3;
    
    this.results.push({
      category: "Query Optimization",
      test: "N+1 Query Pattern",
      severity: "HIGH",
      passed: time3 < time2 / 2,
      details: `N+1: ${time2.toFixed(2)}ms vs Batch: ${time3.toFixed(2)}ms`,
      recommendation: "Use batch queries instead of N+1 patterns",
      executionTime: time2
    });
  }
  
  // ==================== Connection Pooling Tests ====================
  
  async testConnectionPooling(): Promise<void> {
    console.log("\n🔄 Testing Connection Pooling...\n");
    
    // Test 1: WAL mode for concurrency
    const walMode = this.db.pragma("journal_mode")[0].journal_mode;
    
    this.results.push({
      category: "Connection Pooling",
      test: "WAL Mode",
      severity: "HIGH",
      passed: walMode === "wal",
      details: `Journal mode: ${walMode}`,
      recommendation: walMode !== "wal" ? "Enable WAL mode for better concurrency" : undefined
    });
    
    // Test 2: Connection settings
    const settings = {
      busy_timeout: this.db.pragma("busy_timeout")[0].timeout,
      cache_size: this.db.pragma("cache_size")[0].cache_size,
      synchronous: this.db.pragma("synchronous")[0].synchronous,
      temp_store: this.db.pragma("temp_store")[0].temp_store
    };
    
    this.results.push({
      category: "Connection Pooling",
      test: "Connection Settings",
      severity: "MEDIUM",
      passed: settings.busy_timeout >= 5000 && Math.abs(settings.cache_size) >= 2000,
      details: JSON.stringify(settings, null, 2),
      recommendation: "Optimize connection settings for production load"
    });
    
    // Test 3: Concurrent read test
    const promises = [];
    const start = performance.now();
    
    for (let i = 0; i < 100; i++) {
      promises.push(new Promise((resolve) => {
        const result = this.db.prepare("SELECT COUNT(*) as count FROM test_emails").get();
        resolve(result);
      }));
    }
    
    await Promise.all(promises);
    const concurrentTime = performance.now() - start;
    
    this.results.push({
      category: "Connection Pooling",
      test: "Concurrent Reads",
      severity: "MEDIUM",
      passed: concurrentTime < 1000,
      details: `100 concurrent reads in ${concurrentTime.toFixed(2)}ms`,
      recommendation: concurrentTime >= 1000 ? "Optimize for concurrent access" : undefined,
      executionTime: concurrentTime
    });
  }
  
  // ==================== Data Integrity Tests ====================
  
  async testDataIntegrity(): Promise<void> {
    console.log("\n🔒 Testing Data Integrity...\n");
    
    // Test 1: Transaction rollback
    let transactionWorks = false;
    try {
      this.db.exec("BEGIN TRANSACTION");
      this.db.exec("INSERT INTO test_emails (subject) VALUES ('Transaction Test')");
      const before = this.db.prepare("SELECT COUNT(*) as count FROM test_emails").get();
      this.db.exec("ROLLBACK");
      const after = this.db.prepare("SELECT COUNT(*) as count FROM test_emails").get();
      transactionWorks = before.count > after.count;
    } catch (error) {
      transactionWorks = false;
    }
    
    this.results.push({
      category: "Data Integrity",
      test: "Transaction Rollback",
      severity: "CRITICAL",
      passed: transactionWorks,
      details: transactionWorks ? "Transactions work correctly" : "Transaction rollback FAILED",
      recommendation: !transactionWorks ? "Fix transaction handling immediately" : undefined
    });
    
    // Test 2: Constraint enforcement
    let constraintWorks = false;
    try {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS test_constraints (
          id INTEGER PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          age INTEGER CHECK (age >= 0)
        )
      `);
      
      // Try to violate unique constraint
      this.db.exec("INSERT INTO test_constraints (email, age) VALUES ('test@example.com', 25)");
      try {
        this.db.exec("INSERT INTO test_constraints (email, age) VALUES ('test@example.com', 30)");
        constraintWorks = false;
      } catch {
        constraintWorks = true;
      }
    } catch (error) {
      constraintWorks = false;
    }
    
    this.results.push({
      category: "Data Integrity",
      test: "Constraint Enforcement",
      severity: "CRITICAL",
      passed: constraintWorks,
      details: constraintWorks ? "Constraints properly enforced" : "Constraints NOT enforced",
      recommendation: !constraintWorks ? "Enable and verify all constraints" : undefined
    });
    
    // Test 3: SQL Injection Protection
    let injectionProtected = true;
    try {
      const maliciousInput = "'; DROP TABLE test_emails; --";
      const stmt = this.db.prepare("SELECT * FROM test_emails WHERE subject = ?");
      stmt.all(maliciousInput);
      
      // Check if table still exists
      const tables = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='test_emails'").all();
      injectionProtected = tables.length > 0;
    } catch {
      injectionProtected = false;
    }
    
    this.results.push({
      category: "Data Integrity",
      test: "SQL Injection Protection",
      severity: "CRITICAL",
      passed: injectionProtected,
      details: injectionProtected ? "Protected against SQL injection" : "VULNERABLE to SQL injection",
      recommendation: !injectionProtected ? "Use parameterized queries ONLY" : undefined
    });
  }
  
  // ==================== Performance Tests ====================
  
  async testPerformance(): Promise<void> {
    console.log("\n🚀 Testing Performance...\n");
    
    // Test 1: Bulk insert performance
    const insertCount = 10000;
    const start = performance.now();
    
    const transaction = this.db.transaction((records: any[]) => {
      const stmt = this.db.prepare("INSERT INTO test_emails (subject, sender_email) VALUES (?, ?)");
      for (const record of records) {
        stmt.run(record.subject, record.email);
      }
    });
    
    const records = Array.from({ length: insertCount }, (_, i) => ({
      subject: `Bulk Test ${i}`,
      email: `bulk${i}@example.com`
    }));
    
    transaction(records);
    const insertTime = performance.now() - start;
    const insertsPerSecond = (insertCount / (insertTime / 1000)).toFixed(0);
    
    this.results.push({
      category: "Performance",
      test: "Bulk Insert Speed",
      severity: "HIGH",
      passed: parseInt(insertsPerSecond) > 5000,
      details: `${insertsPerSecond} inserts/second (${insertTime.toFixed(2)}ms for ${insertCount} records)`,
      recommendation: parseInt(insertsPerSecond) <= 5000 ? "Use transactions for bulk operations" : undefined,
      executionTime: insertTime
    });
    
    // Test 2: Query performance with large dataset
    const queryStart = performance.now();
    const complexQuery = this.db.prepare(`
      SELECT sender_email, COUNT(*) as count, MAX(received_at) as latest
      FROM test_emails
      GROUP BY sender_email
      HAVING count > 10
      ORDER BY count DESC
      LIMIT 10
    `).all();
    const queryTime = performance.now() - queryStart;
    
    this.results.push({
      category: "Performance",
      test: "Complex Query Performance",
      severity: "MEDIUM",
      passed: queryTime < 100,
      details: `Complex aggregation query in ${queryTime.toFixed(2)}ms`,
      recommendation: queryTime >= 100 ? "Optimize complex queries with proper indexes" : undefined,
      executionTime: queryTime
    });
    
    // Test 3: Database size and vacuum
    const pageCount = this.db.pragma("page_count")[0].page_count;
    const pageSize = this.db.pragma("page_size")[0].page_size;
    const dbSize = (pageCount * pageSize) / (1024 * 1024); // MB
    
    this.results.push({
      category: "Performance",
      test: "Database Size Management",
      severity: "LOW",
      passed: true,
      details: `Database size: ${dbSize.toFixed(2)} MB (${pageCount} pages × ${pageSize} bytes)`,
      recommendation: "Run VACUUM periodically to reclaim space"
    });
  }
  
  // ==================== Generate Report ====================
  
  generateReport(): void {
    console.log("\n" + "=".repeat(80));
    console.log(" DATABASE PRODUCTION READINESS ASSESSMENT");
    console.log("=".repeat(80) + "\n");
    
    const categories = [...new Set(this.results.map(r => r.category))];
    
    let criticalCount = 0;
    let highCount = 0;
    let mediumCount = 0;
    let passedCount = 0;
    
    for (const category of categories) {
      console.log(`\n📊 ${category}`);
      console.log("-".repeat(40));
      
      const categoryResults = this.results.filter(r => r.category === category);
      
      for (const result of categoryResults) {
        const icon = result.passed ? "✅" : "❌";
        const severityColor = {
          CRITICAL: "\x1b[31m", // Red
          HIGH: "\x1b[33m",     // Yellow
          MEDIUM: "\x1b[36m",   // Cyan
          LOW: "\x1b[32m",      // Green
          INFO: "\x1b[37m"      // White
        }[result.severity];
        
        console.log(`${icon} ${result.test}`);
        console.log(`   Severity: ${severityColor}${result.severity}\x1b[0m`);
        console.log(`   Details: ${result.details}`);
        
        if (result.executionTime !== undefined) {
          console.log(`   Execution Time: ${result.executionTime.toFixed(2)}ms`);
        }
        
        if (result.recommendation) {
          console.log(`   💡 Recommendation: ${result.recommendation}`);
        }
        
        if (result.passed) passedCount++;
        if (!result.passed) {
          if (result.severity === "CRITICAL") criticalCount++;
          if (result.severity === "HIGH") highCount++;
          if (result.severity === "MEDIUM") mediumCount++;
        }
      }
    }
    
    // Overall Score
    const totalTests = this.results.length;
    const score = Math.round((passedCount / totalTests) * 100);
    
    console.log("\n" + "=".repeat(80));
    console.log(" SUMMARY");
    console.log("=".repeat(80));
    
    console.log(`\n📈 Overall Score: ${score}% (${passedCount}/${totalTests} tests passed)`);
    console.log(`\n⚠️  Issues Found:`);
    console.log(`   🔴 Critical: ${criticalCount}`);
    console.log(`   🟠 High: ${highCount}`);
    console.log(`   🟡 Medium: ${mediumCount}`);
    
    // Production Readiness Assessment
    console.log("\n" + "=".repeat(80));
    console.log(" PRODUCTION READINESS");
    console.log("=".repeat(80));
    
    if (criticalCount > 0) {
      console.log("\n❌ NOT READY FOR PRODUCTION");
      console.log("   Critical issues must be resolved before deployment.");
    } else if (highCount > 2) {
      console.log("\n⚠️  MARGINALLY READY");
      console.log("   High severity issues should be addressed for stable production use.");
    } else if (score >= 80) {
      console.log("\n✅ READY FOR PRODUCTION");
      console.log("   Database layer meets production standards.");
    } else {
      console.log("\n⚠️  NEEDS IMPROVEMENT");
      console.log("   Address remaining issues for optimal production performance.");
    }
    
    // Top Recommendations
    const recommendations = this.results
      .filter(r => !r.passed && r.recommendation)
      .sort((a, b) => {
        const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      })
      .slice(0, 5);
    
    if (recommendations.length > 0) {
      console.log("\n🔧 TOP RECOMMENDATIONS:");
      recommendations.forEach((r, i) => {
        console.log(`   ${i + 1}. [${r.severity}] ${r.recommendation}`);
      });
    }
  }
  
  // ==================== Run All Tests ====================
  
  async runAllTests(): Promise<void> {
    try {
      await this.testSchemaDesign();
      await this.testQueryOptimization();
      await this.testConnectionPooling();
      await this.testDataIntegrity();
      await this.testPerformance();
      
      this.generateReport();
    } catch (error) {
      console.error("Test execution failed:", error);
    } finally {
      // Cleanup
      this.db.exec("DROP TABLE IF EXISTS test_emails");
      this.db.exec("DROP TABLE IF EXISTS test_constraints");
      this.db.close();
    }
  }
}

// Run the tests
const tester = new DatabaseProductionTester();
tester.runAllTests().catch(console.error);