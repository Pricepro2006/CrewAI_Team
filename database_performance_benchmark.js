#!/usr/bin/env node

/**
 * Database Performance Benchmark Suite
 * Comprehensive analysis of CrewAI Team database performance
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

class DatabasePerformanceBenchmark {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      databases: {},
      summary: {},
      recommendations: []
    };
  }

  async runBenchmarks() {
    console.log('🚀 Starting Database Performance Benchmark Suite\n');

    // Test main databases
    await this.benchmarkDatabase('crewai_enhanced.db', '/home/pricepro2006/CrewAI_Team/data/crewai_enhanced.db');
    await this.benchmarkDatabase('walmart_grocery.db', '/home/pricepro2006/CrewAI_Team/data/walmart_grocery.db');

    // Generate summary and recommendations
    this.generateSummary();
    this.generateRecommendations();

    // Export results
    this.exportResults();

    console.log('\n✅ Benchmark Suite Complete');
    console.log(`📊 Results saved to: database_performance_report.json`);
  }

  async benchmarkDatabase(name, dbPath) {
    if (!fs.existsSync(dbPath)) {
      console.log(`❌ Database not found: ${name}`);
      return;
    }

    console.log(`📊 Benchmarking: ${name}`);
    
    let db;
    try {
      db = new Database(dbPath, { readonly: true });
      
      const dbStats = {
        name,
        path: dbPath,
        size: this.getFileSize(dbPath),
        tables: {},
        indexes: {},
        performance: {},
        pragmas: this.getPragmaSettings(db)
      };

      // Get database schema info
      await this.analyzeSchema(db, dbStats);
      
      // Run performance tests
      await this.runPerformanceTests(db, dbStats);
      
      // Analyze query plans
      await this.analyzeQueryPlans(db, dbStats);

      this.results.databases[name] = dbStats;
      
    } catch (error) {
      console.error(`❌ Error benchmarking ${name}:`, error.message);
      this.results.databases[name] = { error: error.message };
    } finally {
      if (db) db.close();
    }
  }

  getFileSize(filePath) {
    const stats = fs.statSync(filePath);
    return {
      bytes: stats.size,
      mb: Math.round(stats.size / 1024 / 1024 * 100) / 100,
      human: this.formatBytes(stats.size)
    };
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  getPragmaSettings(db) {
    const pragmas = {};
    try {
      const pragmaCommands = [
        'journal_mode', 'synchronous', 'cache_size', 'mmap_size', 
        'page_size', 'temp_store', 'foreign_keys', 'optimize'
      ];
      
      for (const pragma of pragmaCommands) {
        try {
          const result = db.pragma(pragma);
          pragmas[pragma] = result;
        } catch (e) {
          pragmas[pragma] = 'N/A';
        }
      }
    } catch (error) {
      pragmas.error = error.message;
    }
    return pragmas;
  }

  async analyzeSchema(db, dbStats) {
    try {
      // Get all tables
      const tables = db.prepare(`
        SELECT name, sql FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
      `).all();

      for (const table of tables) {
        const tableName = table.name;
        
        // Get table info
        const tableInfo = db.pragma(`table_info(${tableName})`);
        
        // Get row count
        const rowCount = db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get().count;
        
        // Get table size estimate
        const pageCount = db.prepare(`SELECT COUNT(*) as count FROM pragma_page_list('${tableName}')`).get().count;
        const pageSize = db.pragma('page_size');
        
        dbStats.tables[tableName] = {
          columns: tableInfo.length,
          rows: rowCount,
          estimatedSizeBytes: pageCount * pageSize,
          estimatedSizeMB: Math.round((pageCount * pageSize) / 1024 / 1024 * 100) / 100
        };
      }

      // Get all indexes
      const indexes = db.prepare(`
        SELECT name, tbl_name, sql FROM sqlite_master 
        WHERE type='index' AND name NOT LIKE 'sqlite_autoindex_%'
      `).all();

      for (const index of indexes) {
        dbStats.indexes[index.name] = {
          table: index.tbl_name,
          sql: index.sql
        };
      }

    } catch (error) {
      dbStats.schemaError = error.message;
    }
  }

  async runPerformanceTests(db, dbStats) {
    const tests = [];
    
    // Test 1: Simple SELECT
    const simpleSelectTest = this.timeQuery(db, 'SELECT 1 as test');
    tests.push({ name: 'Simple SELECT', ...simpleSelectTest });

    // Test 2: COUNT queries on largest tables
    const largestTables = Object.entries(dbStats.tables)
      .sort(([,a], [,b]) => b.rows - a.rows)
      .slice(0, 3);

    for (const [tableName, tableInfo] of largestTables) {
      const countTest = this.timeQuery(db, `SELECT COUNT(*) FROM ${tableName}`);
      tests.push({ name: `COUNT ${tableName} (${tableInfo.rows} rows)`, ...countTest });
    }

    // Test 3: Index usage tests (if we have indexed columns)
    const emailsTable = Object.keys(dbStats.tables).find(t => t.includes('email'));
    if (emailsTable) {
      // Test indexed column search
      const indexedSearchTest = this.timeQuery(db, `
        SELECT * FROM ${emailsTable} 
        WHERE created_at > datetime('now', '-30 days') 
        LIMIT 100
      `);
      tests.push({ name: `Indexed search ${emailsTable}`, ...indexedSearchTest });

      // Test text search
      const textSearchTest = this.timeQuery(db, `
        SELECT * FROM ${emailsTable} 
        WHERE subject LIKE '%important%' 
        LIMIT 50
      `);
      tests.push({ name: `Text search ${emailsTable}`, ...textSearchTest });
    }

    // Test 4: Complex JOIN (if multiple tables exist)
    const tableNames = Object.keys(dbStats.tables);
    if (tableNames.length > 1 && emailsTable) {
      const joinTest = this.timeQuery(db, `
        SELECT t1.*, COUNT(*) as count 
        FROM ${emailsTable} t1 
        GROUP BY sender_email 
        ORDER BY count DESC 
        LIMIT 10
      `);
      tests.push({ name: `Complex GROUP BY ${emailsTable}`, ...joinTest });
    }

    dbStats.performance.tests = tests;
    dbStats.performance.summary = {
      averageQueryTime: tests.reduce((sum, test) => sum + test.executionTimeMs, 0) / tests.length,
      slowestQuery: tests.reduce((max, test) => test.executionTimeMs > max.executionTimeMs ? test : max, tests[0]),
      fastestQuery: tests.reduce((min, test) => test.executionTimeMs < min.executionTimeMs ? test : min, tests[0])
    };
  }

  timeQuery(db, sql) {
    try {
      const start = process.hrtime.bigint();
      const result = db.prepare(sql).all();
      const end = process.hrtime.bigint();
      
      const executionTimeNs = Number(end - start);
      const executionTimeMs = executionTimeNs / 1000000;
      
      return {
        sql: sql.replace(/\s+/g, ' ').trim(),
        executionTimeMs: Math.round(executionTimeMs * 100) / 100,
        rowsReturned: Array.isArray(result) ? result.length : 1,
        success: true
      };
    } catch (error) {
      return {
        sql: sql.replace(/\s+/g, ' ').trim(),
        executionTimeMs: 0,
        rowsReturned: 0,
        error: error.message,
        success: false
      };
    }
  }

  async analyzeQueryPlans(db, dbStats) {
    const plans = [];
    
    // Analyze common query patterns
    const emailsTable = Object.keys(dbStats.tables).find(t => t.includes('email'));
    if (emailsTable) {
      const queries = [
        `SELECT * FROM ${emailsTable} WHERE sender_email = 'test@example.com'`,
        `SELECT * FROM ${emailsTable} WHERE created_at > datetime('now', '-1 day')`,
        `SELECT * FROM ${emailsTable} WHERE subject LIKE '%test%'`,
        `SELECT sender_email, COUNT(*) FROM ${emailsTable} GROUP BY sender_email`
      ];

      for (const query of queries) {
        try {
          const plan = db.prepare(`EXPLAIN QUERY PLAN ${query}`).all();
          plans.push({
            query: query.replace(/\s+/g, ' ').trim(),
            plan: plan.map(p => p.detail).join(' | '),
            usesIndex: plan.some(p => p.detail.includes('INDEX')),
            scansTables: plan.some(p => p.detail.includes('SCAN TABLE'))
          });
        } catch (error) {
          plans.push({
            query: query.replace(/\s+/g, ' ').trim(),
            error: error.message
          });
        }
      }
    }

    dbStats.queryPlans = plans;
  }

  generateSummary() {
    const dbNames = Object.keys(this.results.databases);
    const totalSize = dbNames.reduce((sum, name) => {
      const db = this.results.databases[name];
      return sum + (db.size ? db.size.bytes : 0);
    }, 0);

    const allTests = dbNames.flatMap(name => {
      const db = this.results.databases[name];
      return db.performance && db.performance.tests ? db.performance.tests : [];
    });

    this.results.summary = {
      totalDatabases: dbNames.length,
      totalSizeBytes: totalSize,
      totalSizeMB: Math.round(totalSize / 1024 / 1024 * 100) / 100,
      totalSizeHuman: this.formatBytes(totalSize),
      averageQueryTime: allTests.length > 0 ? 
        Math.round(allTests.reduce((sum, test) => sum + test.executionTimeMs, 0) / allTests.length * 100) / 100 : 0,
      slowestQuery: allTests.reduce((max, test) => 
        test.executionTimeMs > (max ? max.executionTimeMs : 0) ? test : max, null),
      totalTables: dbNames.reduce((sum, name) => {
        const db = this.results.databases[name];
        return sum + (db.tables ? Object.keys(db.tables).length : 0);
      }, 0),
      totalIndexes: dbNames.reduce((sum, name) => {
        const db = this.results.databases[name];
        return sum + (db.indexes ? Object.keys(db.indexes).length : 0);
      }, 0)
    };
  }

  generateRecommendations() {
    const recommendations = [];

    for (const [dbName, db] of Object.entries(this.results.databases)) {
      if (db.error) continue;

      // Check pragma settings
      if (db.pragmas) {
        if (db.pragmas.journal_mode !== 'wal') {
          recommendations.push({
            database: dbName,
            type: 'performance',
            priority: 'high',
            issue: 'Journal mode not set to WAL',
            recommendation: 'Enable WAL mode: PRAGMA journal_mode = WAL',
            expectedImprovement: 'Better concurrency and reduced blocking'
          });
        }

        if (db.pragmas.cache_size && Math.abs(db.pragmas.cache_size) < 10000) {
          recommendations.push({
            database: dbName,
            type: 'performance',
            priority: 'medium',
            issue: 'Small cache size',
            recommendation: 'Increase cache size: PRAGMA cache_size = -10000 (10MB)',
            expectedImprovement: 'Faster query execution for repeated queries'
          });
        }
      }

      // Check query performance
      if (db.performance && db.performance.tests) {
        const slowQueries = db.performance.tests.filter(test => test.executionTimeMs > 100);
        if (slowQueries.length > 0) {
          recommendations.push({
            database: dbName,
            type: 'performance',
            priority: 'high',
            issue: `${slowQueries.length} slow queries detected (>100ms)`,
            recommendation: 'Analyze query plans and add appropriate indexes',
            expectedImprovement: 'Significant reduction in query execution time'
          });
        }
      }

      // Check query plans for table scans
      if (db.queryPlans) {
        const tableScans = db.queryPlans.filter(plan => plan.scansTables && !plan.usesIndex);
        if (tableScans.length > 0) {
          recommendations.push({
            database: dbName,
            type: 'indexing',
            priority: 'high',
            issue: `${tableScans.length} queries using table scans`,
            recommendation: 'Add indexes for frequently queried columns',
            expectedImprovement: 'Convert O(n) scans to O(log n) index lookups'
          });
        }
      }

      // Check database size
      if (db.size && db.size.mb > 500) {
        recommendations.push({
          database: dbName,
          type: 'maintenance',
          priority: 'medium',
          issue: `Large database size (${db.size.human})`,
          recommendation: 'Consider running VACUUM and ANALYZE regularly',
          expectedImprovement: 'Reduced file size and updated query statistics'
        });
      }

      // Check table sizes
      if (db.tables) {
        const largeTables = Object.entries(db.tables)
          .filter(([, table]) => table.rows > 100000)
          .map(([name]) => name);
        
        if (largeTables.length > 0) {
          recommendations.push({
            database: dbName,
            type: 'performance',
            priority: 'medium',
            issue: `Large tables detected: ${largeTables.join(', ')}`,
            recommendation: 'Consider partitioning, archiving old data, or optimizing queries',
            expectedImprovement: 'Better performance on large datasets'
          });
        }
      }
    }

    this.results.recommendations = recommendations;
  }

  exportResults() {
    const reportPath = '/home/pricepro2006/CrewAI_Team/database_performance_report.json';
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));

    // Also create a markdown summary
    this.createMarkdownReport();
  }

  createMarkdownReport() {
    const md = [];
    
    md.push('# Database Performance Analysis Report');
    md.push(`Generated: ${this.results.timestamp}\n`);

    // Summary
    md.push('## Summary');
    md.push(`- **Total Databases:** ${this.results.summary.totalDatabases}`);
    md.push(`- **Total Size:** ${this.results.summary.totalSizeHuman}`);
    md.push(`- **Total Tables:** ${this.results.summary.totalTables}`);
    md.push(`- **Total Indexes:** ${this.results.summary.totalIndexes}`);
    md.push(`- **Average Query Time:** ${this.results.summary.averageQueryTime}ms`);
    
    if (this.results.summary.slowestQuery) {
      md.push(`- **Slowest Query:** ${this.results.summary.slowestQuery.executionTimeMs}ms`);
    }
    md.push('');

    // Database Details
    md.push('## Database Analysis');
    for (const [dbName, db] of Object.entries(this.results.databases)) {
      if (db.error) {
        md.push(`### ❌ ${dbName}`);
        md.push(`Error: ${db.error}\n`);
        continue;
      }

      md.push(`### 📊 ${dbName}`);
      md.push(`- **Size:** ${db.size.human}`);
      md.push(`- **Tables:** ${Object.keys(db.tables || {}).length}`);
      md.push(`- **Indexes:** ${Object.keys(db.indexes || {}).length}`);
      
      if (db.performance && db.performance.summary) {
        md.push(`- **Average Query Time:** ${db.performance.summary.averageQueryTime}ms`);
      }
      
      // Largest tables
      if (db.tables) {
        const largest = Object.entries(db.tables)
          .sort(([,a], [,b]) => b.rows - a.rows)
          .slice(0, 3);
        
        md.push('\n**Largest Tables:**');
        for (const [tableName, table] of largest) {
          md.push(`- ${tableName}: ${table.rows.toLocaleString()} rows (${table.estimatedSizeMB}MB)`);
        }
      }
      md.push('');
    }

    // Recommendations
    md.push('## 🎯 Recommendations');
    
    const highPriority = this.results.recommendations.filter(r => r.priority === 'high');
    const mediumPriority = this.results.recommendations.filter(r => r.priority === 'medium');
    const lowPriority = this.results.recommendations.filter(r => r.priority === 'low');

    if (highPriority.length > 0) {
      md.push('### 🔥 High Priority');
      for (const rec of highPriority) {
        md.push(`**${rec.database}** - ${rec.issue}`);
        md.push(`- **Fix:** ${rec.recommendation}`);
        md.push(`- **Impact:** ${rec.expectedImprovement}\n`);
      }
    }

    if (mediumPriority.length > 0) {
      md.push('### ⚡ Medium Priority');
      for (const rec of mediumPriority) {
        md.push(`**${rec.database}** - ${rec.issue}`);
        md.push(`- **Fix:** ${rec.recommendation}`);
        md.push(`- **Impact:** ${rec.expectedImprovement}\n`);
      }
    }

    if (lowPriority.length > 0) {
      md.push('### 💡 Low Priority');
      for (const rec of lowPriority) {
        md.push(`**${rec.database}** - ${rec.issue}`);
        md.push(`- **Fix:** ${rec.recommendation}`);
        md.push(`- **Impact:** ${rec.expectedImprovement}\n`);
      }
    }

    const mdPath = '/home/pricepro2006/CrewAI_Team/database_performance_report.md';
    fs.writeFileSync(mdPath, md.join('\n'));
  }
}

// Run the benchmark
const benchmark = new DatabasePerformanceBenchmark();
benchmark.runBenchmarks().catch(console.error);