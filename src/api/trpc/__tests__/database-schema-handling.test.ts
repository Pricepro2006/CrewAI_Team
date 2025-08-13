/**
 * Database Schema Handling Tests
 * Tests for schema validation, error handling, and safe database operations
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { TRPCError } from '@trpc/server';
import { DatabaseSchemaAdapter } from '../database-schema-adapter.js';
import { DatabaseErrorHandler } from '../database-error-middleware.js';
import { SafeDatabaseOperations } from '../database-middleware.js';

describe('Database Schema Handling', () => {
  let db: Database.Database;
  let adapter: DatabaseSchemaAdapter;
  let errorHandler: DatabaseErrorHandler;
  let safeDb: SafeDatabaseOperations;

  beforeAll(() => {
    // Create in-memory database for testing
    db = new Database(':memory:');
    
    // Create test tables
    db.exec(`
      CREATE TABLE test_table (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE,
        age INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE grocery_lists (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        estimated_total REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE grocery_items (
        id TEXT PRIMARY KEY,
        list_id TEXT NOT NULL,
        product_id TEXT,
        quantity INTEGER DEFAULT 1,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (list_id) REFERENCES grocery_lists(id)
      );
    `);

    // Initialize components
    adapter = new DatabaseSchemaAdapter(db);
    errorHandler = new DatabaseErrorHandler(db, adapter);
    safeDb = new SafeDatabaseOperations(db, adapter, errorHandler);
  });

  afterAll(() => {
    db.close();
  });

  beforeEach(() => {
    // Clear test data before each test
    db.exec('DELETE FROM grocery_items');
    db.exec('DELETE FROM grocery_lists');
    db.exec('DELETE FROM test_table');
  });

  describe('DatabaseSchemaAdapter', () => {
    it('should detect existing columns', () => {
      expect(adapter.columnExists('test_table', 'name')).toBe(true);
      expect(adapter.columnExists('test_table', 'email')).toBe(true);
      expect(adapter.columnExists('test_table', 'nonexistent_column')).toBe(false);
    });

    it('should get table columns', () => {
      const columns = adapter.getTableColumns('test_table');
      expect(columns).toContain('id');
      expect(columns).toContain('name');
      expect(columns).toContain('email');
      expect(columns).toContain('age');
      expect(columns).toContain('created_at');
    });

    it('should validate table schema', () => {
      const expectedColumns = [
        { name: 'id', type: 'TEXT', required: true },
        { name: 'name', type: 'TEXT', required: true },
        { name: 'missing_column', type: 'TEXT', required: false }
      ];

      const validation = adapter.validateTableSchema('test_table', expectedColumns);
      
      expect(validation.valid).toBe(false);
      expect(validation.missingColumns).toContain('missing_column');
    });

    it('should create safe SELECT query', () => {
      const requestedColumns = ['id', 'name', 'nonexistent_column'];
      const result = adapter.createSafeSelectQuery('test_table', requestedColumns);

      expect(result.availableColumns).toEqual(['id', 'name']);
      expect(result.missingColumns).toEqual(['nonexistent_column']);
      expect(result.query).toContain('SELECT id, name FROM test_table');
    });

    it('should create safe INSERT query', () => {
      const data = {
        id: 'test-1',
        name: 'Test User',
        nonexistent_column: 'should be skipped'
      };

      const result = adapter.createSafeInsertQuery('test_table', data);

      expect(result.skippedColumns).toContain('nonexistent_column');
      expect(result.query).toContain('INSERT INTO test_table (id, name)');
      expect(result.values).toEqual(['test-1', 'Test User']);
    });

    it('should create safe UPDATE query', () => {
      const data = {
        name: 'Updated Name',
        nonexistent_column: 'should be skipped'
      };

      const result = adapter.createSafeUpdateQuery('test_table', data, 'id = ?');

      expect(result.skippedColumns).toContain('nonexistent_column');
      expect(result.query).toContain('UPDATE test_table SET name = ?');
      expect(result.values).toEqual(['Updated Name']);
    });

    it('should add column safely', () => {
      const success = adapter.addColumnSafe('test_table', 'new_column', 'TEXT', 'default_value');
      expect(success).toBe(true);

      // Verify column was added
      expect(adapter.columnExists('test_table', 'new_column')).toBe(true);
    });

    it('should handle adding existing column gracefully', () => {
      const success = adapter.addColumnSafe('test_table', 'name', 'TEXT');
      expect(success).toBe(true); // Should succeed without error
    });
  });

  describe('DatabaseErrorHandler', () => {
    it('should handle column not found error', () => {
      const error = new Error('no such column: nonexistent_column');
      
      expect(() => {
        errorHandler.handleError(error, { table: 'test_table', operation: 'SELECT' });
      }).toThrow(TRPCError);
    });

    it('should handle table not found error', () => {
      const error = new Error('no such table: nonexistent_table');
      
      expect(() => {
        errorHandler.handleError(error);
      }).toThrow(TRPCError);
    });

    it('should handle unique constraint violation', () => {
      const error = new Error('UNIQUE constraint failed: test_table.email');
      
      expect(() => {
        errorHandler.handleError(error, { table: 'test_table', operation: 'INSERT' });
      }).toThrow(TRPCError);
    });

    it('should handle not null constraint violation', () => {
      const error = new Error('NOT NULL constraint failed: test_table.name');
      
      expect(() => {
        errorHandler.handleError(error, { table: 'test_table', operation: 'INSERT' });
      }).toThrow(TRPCError);
    });

    it('should execute operations safely', async () => {
      const mockOperation = vi.fn().mockReturnValue('success');
      
      const result = await errorHandler.safeExecute(mockOperation, { 
        table: 'test_table', 
        operation: 'SELECT' 
      });

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalled();
    });

    it('should handle errors in safe execution', async () => {
      const mockOperation = vi.fn().mockImplementation(() => {
        throw new Error('Database error');
      });

      await expect(
        errorHandler.safeExecute(mockOperation, { table: 'test_table', operation: 'SELECT' })
      ).rejects.toThrow(TRPCError);
    });

    it('should validate schema before execution', async () => {
      const mockOperation = vi.fn().mockReturnValue('success');

      await expect(
        errorHandler.executeWithSchemaValidation(
          'test_table',
          ['id', 'name', 'nonexistent_column'],
          mockOperation,
          { operation: 'SELECT' }
        )
      ).rejects.toThrow(TRPCError);

      expect(mockOperation).not.toHaveBeenCalled();
    });

    it('should get database health info', () => {
      const health = errorHandler.getDatabaseHealth();
      
      expect(health.status).toBe('healthy');
      expect(health.details.connected).toBe(true);
    });
  });

  describe('SafeDatabaseOperations', () => {
    it('should perform safe SELECT operations', async () => {
      // Insert test data
      db.prepare('INSERT INTO test_table (id, name, email) VALUES (?, ?, ?)').run(
        'test-1', 'Test User', 'test@example.com'
      );

      const result = await safeDb.select('test_table', ['id', 'name', 'nonexistent_column']);

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toHaveProperty('id', 'test-1');
      expect(result.data[0]).toHaveProperty('name', 'Test User');
      expect(result.missingColumns).toContain('nonexistent_column');
      expect(result.warnings).toHaveLength(1);
    });

    it('should perform safe INSERT operations', async () => {
      const data = {
        id: 'test-2',
        name: 'Test User 2',
        email: 'test2@example.com',
        nonexistent_column: 'should be skipped'
      };

      const result = await safeDb.insert('test_table', data);

      expect(result.success).toBe(true);
      expect(result.affectedRows).toBe(1);
      expect(result.skippedColumns).toContain('nonexistent_column');
      expect(result.warnings).toHaveLength(1);

      // Verify data was inserted
      const selectResult = await safeDb.select('test_table', ['id', 'name'], 'id = ?', ['test-2']);
      expect(selectResult.data).toHaveLength(1);
      expect(selectResult.data[0].name).toBe('Test User 2');
    });

    it('should perform safe UPDATE operations', async () => {
      // Insert test data first
      await safeDb.insert('test_table', {
        id: 'test-3',
        name: 'Original Name',
        email: 'test3@example.com'
      });

      const updateData = {
        name: 'Updated Name',
        nonexistent_column: 'should be skipped'
      };

      const result = await safeDb.update('test_table', updateData, 'id = ?', ['test-3']);

      expect(result.success).toBe(true);
      expect(result.affectedRows).toBe(1);
      expect(result.skippedColumns).toContain('nonexistent_column');

      // Verify data was updated
      const selectResult = await safeDb.select('test_table', ['name'], 'id = ?', ['test-3']);
      expect(selectResult.data[0].name).toBe('Updated Name');
    });

    it('should perform safe DELETE operations', async () => {
      // Insert test data first
      await safeDb.insert('test_table', {
        id: 'test-4',
        name: 'To Be Deleted',
        email: 'delete@example.com'
      });

      const result = await safeDb.delete('test_table', 'id = ?', ['test-4']);

      expect(result.success).toBe(true);
      expect(result.affectedRows).toBe(1);

      // Verify data was deleted
      const selectResult = await safeDb.select('test_table', ['id'], 'id = ?', ['test-4']);
      expect(selectResult.data).toHaveLength(0);
    });

    it('should check table existence', async () => {
      const exists = await safeDb.tableExists('test_table');
      const doesntExist = await safeDb.tableExists('nonexistent_table');

      expect(exists).toBe(true);
      expect(doesntExist).toBe(false);
    });

    it('should get table columns safely', async () => {
      const columns = await safeDb.getTableColumns('test_table');

      expect(columns).toContain('id');
      expect(columns).toContain('name');
      expect(columns).toContain('email');
    });

    it('should execute custom queries safely', async () => {
      // Insert test data
      await safeDb.insert('test_table', {
        id: 'test-5',
        name: 'Custom Query Test',
        email: 'custom@example.com'
      });

      const results = await safeDb.customQuery('SELECT COUNT(*) as count FROM test_table');

      expect(results).toHaveLength(1);
      expect(results[0]).toHaveProperty('count', 1);
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle missing column gracefully in SELECT', async () => {
      const result = await safeDb.select('test_table', ['id', 'name', 'missing_column']);

      expect(result.missingColumns).toContain('missing_column');
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should handle constraint violations', async () => {
      // Insert data first
      await safeDb.insert('test_table', {
        id: 'duplicate-test',
        name: 'Duplicate Test',
        email: 'duplicate@example.com'
      });

      // Try to insert duplicate email
      await expect(
        safeDb.insert('test_table', {
          id: 'duplicate-test-2',
          name: 'Another User',
          email: 'duplicate@example.com' // Same email
        })
      ).rejects.toThrow();
    });

    it('should handle missing table gracefully', async () => {
      await expect(
        safeDb.select('nonexistent_table', ['id'])
      ).rejects.toThrow();
    });

    it('should provide helpful error messages', async () => {
      try {
        await safeDb.customQuery('SELECT nonexistent_column FROM test_table');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message.toLowerCase()).toContain('column');
      }
    });
  });

  describe('Schema Adaptation', () => {
    it('should adapt to missing columns in real-world scenario', async () => {
      // Simulate a scenario where code expects 'due_date' but table has 'deadline'
      db.exec(`
        CREATE TABLE tasks (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          deadline DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Code requests 'due_date' but table has 'deadline'
      const result = await safeDb.select('tasks', ['id', 'title', 'due_date']);

      expect(result.missingColumns).toContain('due_date');
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should handle mixed existing and missing columns', async () => {
      const data = {
        id: 'mixed-test',
        name: 'Mixed Test', // exists
        description: 'Test description', // doesn't exist
        email: 'mixed@example.com' // exists
      };

      const result = await safeDb.insert('test_table', data);

      expect(result.success).toBe(true);
      expect(result.skippedColumns).toContain('description');
      expect(result.warnings.length).toBeGreaterThan(0);

      // Verify only valid columns were inserted
      const selectResult = await safeDb.select('test_table', ['name', 'email'], 'id = ?', ['mixed-test']);
      expect(selectResult.data[0].name).toBe('Mixed Test');
      expect(selectResult.data[0].email).toBe('mixed@example.com');
    });
  });
});

describe('Database Middleware Integration', () => {
  // These tests would require actual tRPC setup, which is more complex
  // For now, we'll focus on unit tests of the individual components
  
  it('should be tested with actual tRPC procedures', () => {
    // TODO: Add integration tests with actual tRPC procedures
    expect(true).toBe(true);
  });
});