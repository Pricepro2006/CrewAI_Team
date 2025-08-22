#!/bin/bash

# Walmart Grocery Database Migration Script
# Adds due_date column to grocery_lists table
# 
# Usage: ./run_due_date_migration.sh [--dry-run] [--rollback] [--no-backup]

set -e  # Exit on any error

# Configuration
DB_PATH="data/walmart_grocery.db"
BACKUP_PATH="data/walmart_grocery_backup_$(date +%Y%m%d_%H%M%S).db"
MIGRATION_SQL="src/database/migrations/016_add_due_date_column.sql"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
DRY_RUN=false
ROLLBACK=false
NO_BACKUP=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --rollback)
      ROLLBACK=true
      shift
      ;;
    --no-backup)
      NO_BACKUP=true
      shift
      ;;
    --help|-h)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --dry-run     Test the migration on a copy without affecting the original"
      echo "  --rollback    Rollback the migration (removes due_date column)"
      echo "  --no-backup   Skip creating a backup (NOT recommended)"
      echo "  --help, -h    Show this help message"
      echo ""
      echo "Examples:"
      echo "  $0 --dry-run     # Test the migration safely"
      echo "  $0               # Apply the migration with backup"
      echo "  $0 --rollback    # Rollback the migration"
      exit 0
      ;;
    *)
      echo "Unknown option $1"
      exit 1
      ;;
  esac
done

# Change to project root
cd "$PROJECT_ROOT"

echo -e "${BLUE}🛠️  Walmart Grocery Database Migration${NC}"
echo -e "${BLUE}Migration: Add due_date column to grocery_lists table${NC}"
echo ""

# Check if database exists
if [ ! -f "$DB_PATH" ]; then
    echo -e "${RED}❌ Database file not found: $DB_PATH${NC}"
    echo "Please ensure the walmart_grocery.db file exists in the data/ directory."
    exit 1
fi

# Check if sqlite3 is available
if ! command -v sqlite3 &> /dev/null; then
    echo -e "${RED}❌ sqlite3 command not found${NC}"
    echo "Please install sqlite3: sudo apt-get install sqlite3"
    exit 1
fi

# Function to check if column exists
check_column_exists() {
    local db_path="$1"
    local count=$(sqlite3 "$db_path" "SELECT COUNT(*) FROM pragma_table_info('grocery_lists') WHERE name = 'due_date';")
    echo "$count"
}

# Function to verify database integrity
verify_integrity() {
    local db_path="$1"
    local result=$(sqlite3 "$db_path" "PRAGMA integrity_check;")
    if [ "$result" = "ok" ]; then
        return 0
    else
        echo -e "${RED}❌ Database integrity check failed: $result${NC}"
        return 1
    fi
}

# Function to create backup
create_backup() {
    echo -e "${YELLOW}💾 Creating database backup...${NC}"
    cp "$DB_PATH" "$BACKUP_PATH"
    
    if verify_integrity "$BACKUP_PATH"; then
        echo -e "${GREEN}✅ Backup created successfully: $BACKUP_PATH${NC}"
    else
        echo -e "${RED}❌ Backup integrity check failed${NC}"
        exit 1
    fi
}

# Function to apply migration
apply_migration() {
    local db_path="$1"
    local is_dry_run="$2"
    
    if [ "$is_dry_run" = "true" ]; then
        echo -e "${BLUE}🧪 Running dry run on copy...${NC}"
    else
        echo -e "${BLUE}🔧 Applying migration...${NC}"
    fi
    
    # Check current state
    local column_exists=$(check_column_exists "$db_path")
    
    if [ "$column_exists" = "1" ]; then
        echo -e "${YELLOW}⚠️  due_date column already exists, migration not needed${NC}"
        return 0
    fi
    
    # Apply the migration
    sqlite3 "$db_path" "
    BEGIN TRANSACTION;
    
    ALTER TABLE grocery_lists 
    ADD COLUMN due_date DATETIME DEFAULT NULL;
    
    CREATE INDEX IF NOT EXISTS idx_grocery_lists_due_date 
    ON grocery_lists(due_date) 
    WHERE due_date IS NOT NULL;
    
    CREATE INDEX IF NOT EXISTS idx_grocery_lists_user_due_date 
    ON grocery_lists(user_id, due_date) 
    WHERE due_date IS NOT NULL;
    
    CREATE INDEX IF NOT EXISTS idx_grocery_lists_active_due_date 
    ON grocery_lists(is_active, due_date) 
    WHERE is_active = 1 AND due_date IS NOT NULL;
    
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      execution_time INTEGER NOT NULL DEFAULT 0,
      checksum TEXT
    );
    
    INSERT OR REPLACE INTO schema_migrations (version, name, checksum)
    VALUES ('016', 'Add due_date to grocery_lists', '7d4f2a8c3b1e9f6d');
    
    COMMIT;
    "
    
    # Verify migration was applied
    local new_column_exists=$(check_column_exists "$db_path")
    
    if [ "$new_column_exists" = "1" ]; then
        echo -e "${GREEN}✅ Migration applied successfully${NC}"
        
        # Test functionality
        echo -e "${BLUE}🧪 Testing functionality...${NC}"
        local test_id="test-$(date +%s)"
        local test_date=$(date -d '+3 days' '+%Y-%m-%d %H:%M:%S')
        
        sqlite3 "$db_path" "
        INSERT INTO grocery_lists (id, user_id, name, due_date) VALUES ('$test_id', 'test-user', 'Test Migration', '$test_date');
        " || {
            echo -e "${RED}❌ Failed to insert test data${NC}"
            exit 1
        }
        
        local retrieved_date=$(sqlite3 "$db_path" "SELECT due_date FROM grocery_lists WHERE id = '$test_id';")
        
        sqlite3 "$db_path" "DELETE FROM grocery_lists WHERE id = '$test_id';"
        
        if [ "$retrieved_date" = "$test_date" ]; then
            echo -e "${GREEN}✅ Functionality test passed${NC}"
        else
            echo -e "${RED}❌ Functionality test failed${NC}"
            exit 1
        fi
        
        # Show created indexes
        echo -e "${BLUE}📊 Created indexes:${NC}"
        sqlite3 "$db_path" "SELECT name FROM pragma_index_list('grocery_lists') WHERE name LIKE '%due_date%';" | while read -r index; do
            echo "   - $index"
        done
        
    else
        echo -e "${RED}❌ Migration failed - due_date column was not created${NC}"
        exit 1
    fi
}

# Function to rollback migration
rollback_migration() {
    echo -e "${YELLOW}🔄 Rolling back migration...${NC}"
    
    local column_exists=$(check_column_exists "$DB_PATH")
    
    if [ "$column_exists" = "0" ]; then
        echo -e "${YELLOW}⚠️  due_date column does not exist, rollback not needed${NC}"
        return 0
    fi
    
    echo -e "${YELLOW}⚠️  WARNING: This will recreate the grocery_lists table and may take some time${NC}"
    echo -e "${YELLOW}Press Enter to continue or Ctrl+C to cancel...${NC}"
    read
    
    sqlite3 "$DB_PATH" "
    BEGIN TRANSACTION;
    
    CREATE TABLE grocery_lists_temp (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      total_items INTEGER DEFAULT 0,
      estimated_total REAL,
      is_active BOOLEAN DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    INSERT INTO grocery_lists_temp (
      id, user_id, name, description, total_items, 
      estimated_total, is_active, created_at, updated_at
    )
    SELECT 
      id, user_id, name, description, total_items, 
      estimated_total, is_active, created_at, updated_at
    FROM grocery_lists;
    
    DROP TABLE grocery_lists;
    
    ALTER TABLE grocery_lists_temp RENAME TO grocery_lists;
    
    CREATE INDEX IF NOT EXISTS idx_grocery_lists_user ON grocery_lists(user_id);
    
    DELETE FROM schema_migrations WHERE version = '016';
    
    COMMIT;
    "
    
    local new_column_exists=$(check_column_exists "$DB_PATH")
    
    if [ "$new_column_exists" = "0" ]; then
        echo -e "${GREEN}✅ Migration rolled back successfully${NC}"
    else
        echo -e "${RED}❌ Rollback failed - due_date column still exists${NC}"
        exit 1
    fi
}

# Main execution
if [ "$DRY_RUN" = "true" ]; then
    # Dry run - test on a copy
    TEST_DB_PATH="data/walmart_grocery_test_$(date +%s).db"
    echo -e "${BLUE}📋 Creating test copy: $TEST_DB_PATH${NC}"
    cp "$DB_PATH" "$TEST_DB_PATH"
    
    apply_migration "$TEST_DB_PATH" "true"
    
    echo -e "${BLUE}🧹 Cleaning up test database...${NC}"
    rm "$TEST_DB_PATH"
    
    echo -e "${GREEN}🎉 Dry run completed successfully!${NC}"
    echo -e "${GREEN}The migration is safe to apply to the production database.${NC}"
    echo -e "${YELLOW}💡 Run without --dry-run to apply the migration.${NC}"
    
elif [ "$ROLLBACK" = "true" ]; then
    # Rollback migration
    if [ "$NO_BACKUP" = "false" ]; then
        create_backup
    fi
    
    rollback_migration
    
    echo -e "${GREEN}🎉 Migration rollback completed!${NC}"
    
else
    # Normal migration
    echo -e "${BLUE}📊 Checking current database state...${NC}"
    
    # Verify database integrity first
    if ! verify_integrity "$DB_PATH"; then
        exit 1
    fi
    
    local column_exists=$(check_column_exists "$DB_PATH")
    echo "Current state: due_date column exists = $([ "$column_exists" = "1" ] && echo "yes" || echo "no")"
    
    if [ "$column_exists" = "1" ]; then
        echo -e "${YELLOW}⚠️  due_date column already exists. No migration needed.${NC}"
        exit 0
    fi
    
    # Create backup unless explicitly disabled
    if [ "$NO_BACKUP" = "false" ]; then
        create_backup
    else
        echo -e "${YELLOW}⚠️  Skipping backup as requested${NC}"
    fi
    
    # Apply migration
    apply_migration "$DB_PATH" "false"
    
    # Final verification
    if verify_integrity "$DB_PATH"; then
        echo -e "${GREEN}✅ Database integrity verified after migration${NC}"
    else
        echo -e "${RED}❌ Database integrity check failed after migration${NC}"
        if [ "$NO_BACKUP" = "false" ]; then
            echo -e "${YELLOW}💡 You can restore from backup: $BACKUP_PATH${NC}"
        fi
        exit 1
    fi
    
    echo ""
    echo -e "${GREEN}🎉 Migration completed successfully!${NC}"
    echo ""
    echo -e "${BLUE}📋 You can now use due_date in your grocery_lists queries:${NC}"
    echo "   - UPDATE grocery_lists SET due_date = datetime('now', '+7 days') WHERE id = 'list-id';"
    echo "   - SELECT * FROM grocery_lists WHERE due_date BETWEEN datetime('now') AND datetime('now', '+3 days');"
    echo "   - SELECT * FROM grocery_lists WHERE user_id = 'user123' AND due_date IS NOT NULL ORDER BY due_date;"
    echo ""
    if [ "$NO_BACKUP" = "false" ]; then
        echo -e "${YELLOW}💾 Backup saved at: $BACKUP_PATH${NC}"
    fi
fi