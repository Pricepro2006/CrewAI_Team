/**
 * Test file to verify BaseRepository compatibility with both IDatabaseAdapter and legacy Database.Database
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { BaseRepository, BaseEntity } from '../BaseRepository.js';
import { SQLiteAdapter } from '../../adapters/SQLiteAdapter.js';
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

describe('BaseRepository Adapter Compatibility', () => {
  const TEST_DB_PATH = path.join(__dirname, 'test-adapter.db');
  let legacyDb: Database.Database;
  let adapter: IDatabaseAdapter;
  
  beforeAll(async () => {
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

    // Create adapter using a separate connection
    adapter = new SQLiteAdapter({
      databasePath: TEST_DB_PATH,
      enableWAL: false,
      enableForeignKeys: true
    });
    
    // Initialize the adapter
    await adapter.initialize();
  });

  afterAll(async () => {
    // Clean up
    if (legacyDb && legacyDb.open) {
      legacyDb.close();
    }
    if (adapter) {
      await adapter.close();
    }
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  describe('Constructor Support', () => {
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

  describe('Basic CRUD Operations', () => {
    it('should perform CRUD with legacy database', async () => {
      const repo = new TestRepository(legacyDb);
      
      // Create
      const created = await repo.create({
        name: 'Legacy Test',
        value: 42
      });
      expect(created.id).toBeDefined();
      expect(created.name).toBe('Legacy Test');
      
      // Read
      const found = await repo.findById(created.id);
      expect(found).toBeDefined();
      expect(found?.name).toBe('Legacy Test');
      
      // Update
      const updated = await repo.update(created.id, {
        name: 'Updated Legacy',
        value: 100
      });
      expect(updated?.name).toBe('Updated Legacy');
      expect(updated?.value).toBe(100);
      
      // Delete
      const deleted = await repo.delete(created.id);
      expect(deleted).toBe(true);
      
      const notFound = await repo.findById(created.id);
      expect(notFound).toBeNull();
    });

    it('should perform CRUD with adapter', async () => {
      const repo = new TestRepository(adapter);
      
      // Create
      const created = await repo.create({
        name: 'Adapter Test',
        value: 84
      });
      expect(created.id).toBeDefined();
      expect(created.name).toBe('Adapter Test');
      
      // Read
      const found = await repo.findById(created.id);
      expect(found).toBeDefined();
      expect(found?.name).toBe('Adapter Test');
      
      // Update
      const updated = await repo.update(created.id, {
        name: 'Updated Adapter',
        value: 200
      });
      expect(updated?.name).toBe('Updated Adapter');
      expect(updated?.value).toBe(200);
      
      // Delete
      const deleted = await repo.delete(created.id);
      expect(deleted).toBe(true);
      
      const notFound = await repo.findById(created.id);
      expect(notFound).toBeNull();
    });
  });

  describe('Cross-compatibility', () => {
    it('should read data created by legacy with adapter', async () => {
      const legacyRepo = new TestRepository(legacyDb);
      const adapterRepo = new TestRepository(adapter);
      
      // Create with legacy
      const created = await legacyRepo.create({
        name: 'Cross Test',
        value: 999
      });
      
      // Read with adapter
      const found = await adapterRepo.findById(created.id);
      expect(found).toBeDefined();
      expect(found?.name).toBe('Cross Test');
      expect(found?.value).toBe(999);
      
      // Clean up
      await legacyRepo.delete(created.id);
    });

    it('should read data created by adapter with legacy', async () => {
      const legacyRepo = new TestRepository(legacyDb);
      const adapterRepo = new TestRepository(adapter);
      
      // Create with adapter
      const created = await adapterRepo.create({
        name: 'Reverse Cross Test',
        value: 777
      });
      
      // Read with legacy
      const found = await legacyRepo.findById(created.id);
      expect(found).toBeDefined();
      expect(found?.name).toBe('Reverse Cross Test');
      expect(found?.value).toBe(777);
      
      // Clean up
      await adapterRepo.delete(created.id);
    });
  });

  describe('Query Operations', () => {
    it('should count entities correctly with both patterns', async () => {
      const legacyRepo = new TestRepository(legacyDb);
      const adapterRepo = new TestRepository(adapter);
      
      // Create test data
      await legacyRepo.create({ name: 'Count 1', value: 1 });
      await adapterRepo.create({ name: 'Count 2', value: 2 });
      
      const legacyCount = await legacyRepo.count();
      const adapterCount = await adapterRepo.count();
      
      // Both should see both entities
      expect(legacyCount).toBeGreaterThanOrEqual(2);
      expect(adapterCount).toBeGreaterThanOrEqual(2);
      expect(legacyCount).toBe(adapterCount);
    });

    it('should find all entities with both patterns', async () => {
      const legacyRepo = new TestRepository(legacyDb);
      const adapterRepo = new TestRepository(adapter);
      
      const legacyResults = await legacyRepo.findAll();
      const adapterResults = await adapterRepo.findAll();
      
      // Both should return the same number of results
      expect(legacyResults.length).toBe(adapterResults.length);
    });
  });

  describe('Health Check', () => {
    it('should perform health check with legacy database', async () => {
      const repo = new TestRepository(legacyDb);
      const healthy = await repo.healthCheck();
      expect(healthy).toBe(true);
    });

    it('should perform health check with adapter', async () => {
      const repo = new TestRepository(adapter);
      const healthy = await repo.healthCheck();
      expect(healthy).toBe(true);
    });
  });

  describe('Adapter Access', () => {
    it('should provide access to underlying adapter', () => {
      const legacyRepo = new TestRepository(legacyDb);
      const adapterRepo = new TestRepository(adapter);
      
      // @ts-ignore - accessing protected method
      const legacyAdapter = legacyRepo.getAdapter();
      // @ts-ignore - accessing protected method
      const directAdapter = adapterRepo.getAdapter();
      
      expect(legacyAdapter).toBeDefined();
      expect(directAdapter).toBeDefined();
      expect(directAdapter).toBe(adapter);
    });

    it('should provide access to legacy database when available', () => {
      const legacyRepo = new TestRepository(legacyDb);
      const adapterRepo = new TestRepository(adapter);
      
      // @ts-ignore - accessing protected method
      const legacyDbFromRepo = legacyRepo.getLegacyDatabase();
      // @ts-ignore - accessing protected method
      const noLegacyDb = adapterRepo.getLegacyDatabase();
      
      expect(legacyDbFromRepo).toBe(legacyDb);
      expect(noLegacyDb).toBeUndefined();
    });
  });
});