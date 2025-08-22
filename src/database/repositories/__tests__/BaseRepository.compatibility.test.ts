/**
 * Test file to verify BaseRepository compatibility with both IDatabaseAdapter and legacy Database.Database
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { BaseRepository, BaseEntity } from '../BaseRepository.js';
import { SQLiteAdapter } from '../../adapters/SQLiteAdapter.js';
import { SQLiteCompatibilityShim } from '../../adapters/SQLiteCompatibilityShim.js';
import type { IDatabaseAdapter } from '../../adapters/DatabaseAdapter.interface.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test entity interface
interface TestEntity extends BaseEntity {
  id: string;
  name: string;
  value: number;
  created_at?: string;
  updated_at?: string;
}

// Concrete test repository implementation
class TestRepository extends BaseRepository<TestEntity> {
  constructor(dbOrAdapter: IDatabaseAdapter | Database.Database) {
    super(dbOrAdapter, 'test_entities');
  }
}

describe('BaseRepository Compatibility Tests', () => {
  const TEST_DB_PATH = path.join(__dirname, 'test-compatibility.db');
  let legacyDb: Database.Database;
  let adapter: IDatabaseAdapter;
  let legacyRepo: TestRepository;
  let adapterRepo: TestRepository;

  beforeEach(() => {
    // Clean up any existing test database
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }

    // Create test database and table
    legacyDb = new Database(TEST_DB_PATH);
    legacyDb.exec(`
      CREATE TABLE IF NOT EXISTS test_entities (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        value INTEGER NOT NULL,
        created_at TEXT,
        updated_at TEXT
      )
    `);

    // Create adapter
    adapter = new SQLiteAdapter({
      databasePath: TEST_DB_PATH,
      enableWAL: false,
      enableForeignKeys: true
    });

    // Create repositories
    legacyRepo = new TestRepository(legacyDb);
    adapterRepo = new TestRepository(adapter);
  });

  afterEach(async () => {
    // Clean up
    if (legacyDb) {
      legacyDb.close();
    }
    if (adapter) {
      await adapter.close();
    }
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  describe('Constructor Compatibility', () => {
    it('should accept a legacy Database.Database instance', () => {
      const repo = new TestRepository(legacyDb);
      expect(repo).toBeInstanceOf(TestRepository);
      expect(repo).toBeInstanceOf(BaseRepository);
    });

    it('should accept an IDatabaseAdapter instance', () => {
      const repo = new TestRepository(adapter);
      expect(repo).toBeInstanceOf(TestRepository);
      expect(repo).toBeInstanceOf(BaseRepository);
    });

    it('should wrap legacy database with compatibility shim', () => {
      const repo = new TestRepository(legacyDb);
      // @ts-ignore - accessing protected property for testing
      const internalAdapter = repo.getAdapter();
      expect(internalAdapter).toBeDefined();
      // The adapter should be a SQLiteCompatibilityShim
      expect(internalAdapter.constructor.name).toBe('SQLiteCompatibilityShim');
    });

    it('should use adapter directly when provided', () => {
      const repo = new TestRepository(adapter);
      // @ts-ignore - accessing protected property for testing
      const internalAdapter = repo.getAdapter();
      expect(internalAdapter).toBe(adapter);
    });
  });

  describe('CRUD Operations Compatibility', () => {
    it('should create entities with legacy database', async () => {
      const entity = await legacyRepo.create({
        name: 'Test Entity',
        value: 42
      });

      expect(entity).toBeDefined();
      expect(entity.id).toBeDefined();
      expect(entity.name).toBe('Test Entity');
      expect(entity.value).toBe(42);
      expect(entity.created_at).toBeDefined();
      expect(entity.updated_at).toBeDefined();
    });

    it('should create entities with adapter', async () => {
      const entity = await adapterRepo.create({
        name: 'Test Entity',
        value: 42
      });

      expect(entity).toBeDefined();
      expect(entity.id).toBeDefined();
      expect(entity.name).toBe('Test Entity');
      expect(entity.value).toBe(42);
      expect(entity.created_at).toBeDefined();
      expect(entity.updated_at).toBeDefined();
    });

    it('should find entities by ID with both patterns', async () => {
      // Create with legacy
      const created = await legacyRepo.create({
        name: 'Find Test',
        value: 100
      });

      // Find with legacy
      const foundByLegacy = await legacyRepo.findById(created.id);
      expect(foundByLegacy).toBeDefined();
      expect(foundByLegacy?.name).toBe('Find Test');

      // Find with adapter (should find the same entity)
      const foundByAdapter = await adapterRepo.findById(created.id);
      expect(foundByAdapter).toBeDefined();
      expect(foundByAdapter?.name).toBe('Find Test');
    });

    it('should update entities with both patterns', async () => {
      const created = await legacyRepo.create({
        name: 'Update Test',
        value: 200
      });

      // Update with adapter
      const updated = await adapterRepo.update(created.id, {
        name: 'Updated Name',
        value: 300
      });

      expect(updated).toBeDefined();
      expect(updated?.name).toBe('Updated Name');
      expect(updated?.value).toBe(300);

      // Verify with legacy
      const verified = await legacyRepo.findById(created.id);
      expect(verified?.name).toBe('Updated Name');
      expect(verified?.value).toBe(300);
    });

    it('should delete entities with both patterns', async () => {
      const created = await adapterRepo.create({
        name: 'Delete Test',
        value: 400
      });

      // Delete with legacy
      const deleted = await legacyRepo.delete(created.id);
      expect(deleted).toBe(true);

      // Verify deletion with adapter
      const notFound = await adapterRepo.findById(created.id);
      expect(notFound).toBeNull();
    });
  });

  describe('Query Operations Compatibility', () => {
    beforeEach(async () => {
      // Create test data
      await legacyRepo.create({ name: 'Entity 1', value: 10 });
      await legacyRepo.create({ name: 'Entity 2', value: 20 });
      await adapterRepo.create({ name: 'Entity 3', value: 30 });
    });

    it('should find all entities with both patterns', async () => {
      const legacyResults = await legacyRepo.findAll();
      const adapterResults = await adapterRepo.findAll();

      expect(legacyResults.length).toBe(3);
      expect(adapterResults.length).toBe(3);
      
      // Both should see all entities
      const legacyNames = legacyResults.map(e => e.name).sort();
      const adapterNames = adapterResults.map(e => e.name).sort();
      expect(legacyNames).toEqual(['Entity 1', 'Entity 2', 'Entity 3']);
      expect(adapterNames).toEqual(['Entity 1', 'Entity 2', 'Entity 3']);
    });

    it('should count entities correctly', async () => {
      const legacyCount = await legacyRepo.count();
      const adapterCount = await adapterRepo.count();

      expect(legacyCount).toBe(3);
      expect(adapterCount).toBe(3);
    });

    it('should support pagination with both patterns', async () => {
      const legacyPage = await legacyRepo.findPaginated(1, 2);
      const adapterPage = await adapterRepo.findPaginated(2, 2);

      expect(legacyPage.data.length).toBe(2);
      expect(legacyPage.total).toBe(3);
      expect(legacyPage.totalPages).toBe(2);
      expect(legacyPage.hasNext).toBe(true);

      expect(adapterPage.data.length).toBe(1);
      expect(adapterPage.total).toBe(3);
      expect(adapterPage.page).toBe(2);
      expect(adapterPage.hasPrevious).toBe(true);
    });

    it('should search entities with both patterns', async () => {
      const legacyResults = await legacyRepo.search('Entity', ['name']);
      const adapterResults = await adapterRepo.search('2', ['name']);

      expect(legacyResults.length).toBe(3);
      expect(adapterResults.length).toBe(1);
      expect(adapterResults[0].name).toBe('Entity 2');
    });
  });

  describe('Transaction Compatibility', () => {
    it('should handle transactions with legacy database', async () => {
      const result = await legacyRepo.transaction(async (repo) => {
        await repo.create({ name: 'Transaction 1', value: 100 });
        await repo.create({ name: 'Transaction 2', value: 200 });
        return 'success';
      });

      expect(result).toBe('success');
      
      const count = await legacyRepo.count();
      expect(count).toBe(2);
    });

    it('should handle transactions with adapter', async () => {
      const result = await adapterRepo.transaction(async (repo) => {
        await repo.create({ name: 'Transaction A', value: 300 });
        await repo.create({ name: 'Transaction B', value: 400 });
        return 'completed';
      });

      expect(result).toBe('completed');
      
      const count = await adapterRepo.count();
      expect(count).toBe(2);
    });

    it('should rollback on error with both patterns', async () => {
      // Test with legacy
      try {
        await legacyRepo.transaction(async (repo) => {
          await repo.create({ name: 'Will be rolled back', value: 500 });
          throw new Error('Intentional error');
        });
      } catch (error) {
        // Expected
      }

      let count = await legacyRepo.count();
      expect(count).toBe(0);

      // Test with adapter
      try {
        await adapterRepo.transaction(async (repo) => {
          await repo.create({ name: 'Also rolled back', value: 600 });
          throw new Error('Another intentional error');
        });
      } catch (error) {
        // Expected
      }

      count = await adapterRepo.count();
      expect(count).toBe(0);
    });
  });

  describe('Bulk Operations Compatibility', () => {
    it('should bulk create with legacy database', async () => {
      const entities = [
        { name: 'Bulk 1', value: 1 },
        { name: 'Bulk 2', value: 2 },
        { name: 'Bulk 3', value: 3 }
      ];

      const created = await legacyRepo.bulkCreate(entities);
      expect(created.length).toBe(3);

      const count = await legacyRepo.count();
      expect(count).toBe(3);
    });

    it('should bulk create with adapter', async () => {
      const entities = [
        { name: 'Bulk A', value: 10 },
        { name: 'Bulk B', value: 20 },
        { name: 'Bulk C', value: 30 }
      ];

      const created = await adapterRepo.bulkCreate(entities);
      expect(created.length).toBe(3);

      const count = await adapterRepo.count();
      expect(count).toBe(3);
    });
  });

  describe('Health Check and Metrics', () => {
    it('should perform health check with legacy database', async () => {
      const healthy = await legacyRepo.healthCheck();
      expect(healthy).toBe(true);
    });

    it('should perform health check with adapter', async () => {
      const healthy = await adapterRepo.healthCheck();
      expect(healthy).toBe(true);
    });

    it('should get adapter from repository', () => {
      // @ts-ignore - accessing protected method for testing
      const legacyAdapter = legacyRepo.getAdapter();
      // @ts-ignore - accessing protected method for testing
      const directAdapter = adapterRepo.getAdapter();

      expect(legacyAdapter).toBeDefined();
      expect(directAdapter).toBeDefined();
      expect(directAdapter).toBe(adapter);
    });

    it('should get legacy database when available', () => {
      // @ts-ignore - accessing protected method for testing
      const legacyDbFromRepo = legacyRepo.getLegacyDatabase();
      // @ts-ignore - accessing protected method for testing
      const noLegacyDb = adapterRepo.getLegacyDatabase();

      expect(legacyDbFromRepo).toBe(legacyDb);
      expect(noLegacyDb).toBeUndefined();
    });
  });

  describe('Raw Query Compatibility', () => {
    it('should execute raw queries with legacy database', async () => {
      await legacyRepo.create({ name: 'Raw Test', value: 999 });
      
      const results = await legacyRepo.raw<TestEntity[]>(
        'SELECT * FROM test_entities WHERE value = ?',
        [999]
      );

      expect(results.length).toBe(1);
      expect(results[0].name).toBe('Raw Test');
    });

    it('should execute raw queries with adapter', async () => {
      await adapterRepo.create({ name: 'Raw Adapter', value: 888 });
      
      const results = await adapterRepo.raw<TestEntity[]>(
        'SELECT * FROM test_entities WHERE value = ?',
        [888]
      );

      expect(results.length).toBe(1);
      expect(results[0].name).toBe('Raw Adapter');
    });
  });
});