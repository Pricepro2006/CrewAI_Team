#!/usr/bin/env node

import Database from 'better-sqlite3';
import { resolve } from 'path';
import { existsSync, statSync } from 'fs';

import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = resolve(__dirname, '../data/app.db');
const WAL_PATH = `${DB_PATH}-wal`;
const SHM_PATH = `${DB_PATH}-shm`;

async function checkpointDatabase() {
  console.log('🔧 Database WAL Checkpoint Tool');
  console.log('================================\n');

  // Check if database exists
  if (!existsSync(DB_PATH)) {
    console.error('❌ Database not found at:', DB_PATH);
    process.exit(1);
  }

  // Check WAL file size
  if (existsSync(WAL_PATH)) {
    const walStats = statSync(WAL_PATH);
    const walSizeMB = (walStats.size / (1024 * 1024)).toFixed(2);
    console.log(`📊 Current WAL file size: ${walSizeMB} MB`);
  } else {
    console.log('ℹ️ No WAL file found');
  }

  try {
    // Open database connection
    const db = new Database(DB_PATH);
    
    // Get current WAL status
    const walStatus = db.pragma('wal_checkpoint(PASSIVE)');
    console.log('\n📈 WAL Status before checkpoint:');
    console.log(`   Busy: ${walStatus[0] === -1 ? 'Yes' : 'No'}`);
    console.log(`   Log frames: ${walStatus[1]}`);
    console.log(`   Checkpointed frames: ${walStatus[2]}`);

    // Perform full checkpoint
    console.log('\n🔄 Performing full checkpoint...');
    const result = db.pragma('wal_checkpoint(FULL)');
    
    console.log('\n✅ Checkpoint complete!');
    console.log(`   Status: ${result[0] === 0 ? 'Success' : 'Partial (database busy)'}`);
    console.log(`   Total frames: ${result[1]}`);
    console.log(`   Checkpointed frames: ${result[2]}`);

    // Optimize database
    console.log('\n🔧 Running VACUUM to optimize database...');
    db.exec('VACUUM');
    console.log('✅ Database optimized!');

    // Analyze tables for better query planning
    console.log('\n📊 Analyzing tables...');
    db.exec('ANALYZE');
    console.log('✅ Table analysis complete!');

    // Get final database stats
    const pageCount = db.pragma('page_count')[0];
    const pageSize = db.pragma('page_size')[0];
    const dbSizeMB = ((pageCount * pageSize) / (1024 * 1024)).toFixed(2);
    
    console.log('\n📊 Final Database Statistics:');
    console.log(`   Database size: ${dbSizeMB} MB`);
    console.log(`   Page count: ${pageCount}`);
    console.log(`   Page size: ${pageSize} bytes`);

    // Check final WAL size
    if (existsSync(WAL_PATH)) {
      const finalWalStats = statSync(WAL_PATH);
      const finalWalSizeMB = (finalWalStats.size / (1024 * 1024)).toFixed(2);
      console.log(`   WAL file size: ${finalWalSizeMB} MB`);
    }

    // Close database
    db.close();
    
    console.log('\n✅ Database maintenance complete!');
    
  } catch (error) {
    console.error('\n❌ Error during checkpoint:', error);
    process.exit(1);
  }
}

// Run the checkpoint
checkpointDatabase().catch(console.error);