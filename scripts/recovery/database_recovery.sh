#!/bin/bash

# Database Recovery Script
# Version: 1.0.0
# Purpose: Comprehensive database recovery and optimization

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m'

PROJECT_ROOT="/home/pricepro2006/CrewAI_Team"
BACKUP_DIR="$PROJECT_ROOT/backups/databases"
cd "$PROJECT_ROOT"

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo -e "${BLUE}🗄️  Database Recovery Tool${NC}"
echo "================================"

# Function to check database health
check_db_health() {
    local db=$1
    local status="unknown"
    
    if [ ! -f "$db" ]; then
        echo -e "${RED}✗ Not found${NC}"
        return 1
    fi
    
    # Check if locked
    if fuser "$db" 2>/dev/null | grep -q [0-9]; then
        echo -e "${YELLOW}⚠️  Locked by process$(fuser "$db" 2>/dev/null)${NC}"
        status="locked"
    fi
    
    # Check integrity
    local integrity=$(sqlite3 "$db" "PRAGMA integrity_check;" 2>&1)
    if [ "$integrity" = "ok" ]; then
        local size=$(du -h "$db" | cut -f1)
        local tables=$(sqlite3 "$db" "SELECT COUNT(*) FROM sqlite_master WHERE type='table';" 2>/dev/null)
        echo -e "${GREEN}✓ Healthy (Size: $size, Tables: $tables)${NC}"
        status="healthy"
    else
        echo -e "${RED}✗ Corrupted${NC}"
        status="corrupted"
    fi
    
    return 0
}

# Function to backup database
backup_database() {
    local db=$1
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$BACKUP_DIR/$(basename $db).backup.$timestamp"
    
    if [ -f "$db" ]; then
        cp "$db" "$backup_file"
        echo -e "${GREEN}✓ Backed up to: $backup_file${NC}"
        
        # Keep only last 10 backups
        ls -t "$BACKUP_DIR/$(basename $db).backup."* 2>/dev/null | tail -n +11 | xargs rm -f 2>/dev/null || true
    else
        echo -e "${YELLOW}⚠️  Database not found, cannot backup${NC}"
    fi
}

# Function to unlock database
unlock_database() {
    local db=$1
    
    echo "  Unlocking $db..."
    
    # Kill processes holding the database
    fuser -k "$db" 2>/dev/null || true
    
    # Remove lock files
    rm -f "${db}-journal" "${db}-wal" "${db}-shm" 2>/dev/null || true
    
    # Wait a moment
    sleep 1
    
    # Check if unlocked
    if ! fuser "$db" 2>/dev/null | grep -q [0-9]; then
        echo -e "  ${GREEN}✓ Unlocked successfully${NC}"
        return 0
    else
        echo -e "  ${RED}✗ Still locked${NC}"
        return 1
    fi
}

# Function to recover corrupted database
recover_database() {
    local db=$1
    local recovery_method=${2:-"dump"}
    
    echo -e "${YELLOW}Attempting recovery of $db...${NC}"
    
    # Method 1: SQL dump and restore
    if [ "$recovery_method" = "dump" ]; then
        echo "  Method: SQL dump and restore"
        
        # Try to dump the database
        sqlite3 "$db" ".dump" > "${db}.recovery.sql" 2>/dev/null
        
        if [ -s "${db}.recovery.sql" ]; then
            # Move corrupted database
            mv "$db" "${db}.corrupted.$(date +%Y%m%d_%H%M%S)"
            
            # Create new database from dump
            sqlite3 "$db" < "${db}.recovery.sql"
            
            if [ $? -eq 0 ]; then
                rm "${db}.recovery.sql"
                echo -e "  ${GREEN}✓ Recovery successful${NC}"
                return 0
            else
                echo -e "  ${RED}✗ Recovery failed${NC}"
                return 1
            fi
        else
            echo -e "  ${RED}✗ Could not dump database${NC}"
            return 1
        fi
    fi
    
    # Method 2: Clone with data recovery
    if [ "$recovery_method" = "clone" ]; then
        echo "  Method: Clone with data recovery"
        
        sqlite3 "$db" << EOF
.mode insert
.output ${db}.recovered.sql
SELECT * FROM sqlite_master WHERE type='table';
EOF
        
        if [ -s "${db}.recovered.sql" ]; then
            mv "$db" "${db}.corrupted.$(date +%Y%m%d_%H%M%S)"
            sqlite3 "$db" < "${db}.recovered.sql"
            rm "${db}.recovered.sql"
            echo -e "  ${GREEN}✓ Clone recovery successful${NC}"
            return 0
        else
            echo -e "  ${RED}✗ Clone recovery failed${NC}"
            return 1
        fi
    fi
}

# Function to optimize database
optimize_database() {
    local db=$1
    
    echo "  Optimizing $db..."
    
    # Run optimization commands
    sqlite3 "$db" << EOF
PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;
PRAGMA cache_size=10000;
PRAGMA temp_store=MEMORY;
VACUUM;
ANALYZE;
REINDEX;
EOF
    
    if [ $? -eq 0 ]; then
        echo -e "  ${GREEN}✓ Optimization complete${NC}"
        
        # Get stats
        local size_before=$(du -h "${db}.corrupted."* 2>/dev/null | cut -f1 | head -1)
        local size_after=$(du -h "$db" | cut -f1)
        
        if [ ! -z "$size_before" ]; then
            echo "    Size: $size_before → $size_after"
        fi
    else
        echo -e "  ${RED}✗ Optimization failed${NC}"
    fi
}

# Function to add missing indexes
add_indexes() {
    local db=$1
    
    echo "  Adding indexes to $db..."
    
    # Check which database we're working with
    case "$(basename $db)" in
        "walmart_grocery.db")
            sqlite3 "$db" << EOF
CREATE INDEX IF NOT EXISTS idx_grocery_lists_user_id ON grocery_lists(user_id);
CREATE INDEX IF NOT EXISTS idx_grocery_lists_created_at ON grocery_lists(created_at);
CREATE INDEX IF NOT EXISTS idx_grocery_lists_status ON grocery_lists(status);
CREATE INDEX IF NOT EXISTS idx_items_list_id ON items(list_id);
CREATE INDEX IF NOT EXISTS idx_items_product_id ON items(product_id);
EOF
            ;;
        "app.db")
            sqlite3 "$db" << EOF
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
EOF
            ;;
        "crewai_enhanced.db")
            sqlite3 "$db" << EOF
CREATE INDEX IF NOT EXISTS idx_emails_chain_id ON emails(chain_id);
CREATE INDEX IF NOT EXISTS idx_emails_subject ON emails(subject);
CREATE INDEX IF NOT EXISTS idx_emails_date ON emails(date);
CREATE INDEX IF NOT EXISTS idx_emails_is_complete_chain ON emails(is_complete_chain);
EOF
            ;;
    esac
    
    echo -e "  ${GREEN}✓ Indexes added${NC}"
}

# Function to check and fix schema
fix_schema() {
    local db=$1
    
    echo "  Checking schema for $db..."
    
    # Get current schema
    local schema=$(sqlite3 "$db" ".schema" 2>/dev/null)
    
    if [ -z "$schema" ]; then
        echo -e "  ${RED}✗ No schema found${NC}"
        
        # Try to restore schema from migrations
        if [ -d "src/database/migrations" ]; then
            echo "  Attempting to restore schema from migrations..."
            
            for migration in src/database/migrations/*.sql; do
                if [ -f "$migration" ]; then
                    sqlite3 "$db" < "$migration" 2>/dev/null || true
                fi
            done
            
            echo -e "  ${GREEN}✓ Schema restoration attempted${NC}"
        fi
    else
        echo -e "  ${GREEN}✓ Schema exists${NC}"
    fi
}

# Main recovery menu
show_menu() {
    echo ""
    echo "Select database to recover:"
    echo "1) walmart_grocery.db"
    echo "2) app.db"
    echo "3) crewai_enhanced.db (616MB)"
    echo "4) All databases"
    echo "5) Backup all databases"
    echo "6) Restore from backup"
    echo "7) Optimize all databases"
    echo "8) Exit"
    echo ""
    read -p "Enter choice [1-8]: " choice
}

# Process database recovery
process_recovery() {
    local db=$1
    
    echo ""
    echo -e "${BLUE}Processing: $db${NC}"
    echo "------------------------"
    
    # Check current status
    echo -n "Current status: "
    check_db_health "$db"
    
    # Backup first
    echo "Creating backup..."
    backup_database "$db"
    
    # Try to unlock if locked
    if fuser "$db" 2>/dev/null | grep -q [0-9]; then
        unlock_database "$db"
    fi
    
    # Check integrity
    local integrity=$(sqlite3 "$db" "PRAGMA integrity_check;" 2>&1)
    if [ "$integrity" != "ok" ]; then
        recover_database "$db" "dump"
    fi
    
    # Optimize
    optimize_database "$db"
    
    # Add indexes
    add_indexes "$db"
    
    # Final check
    echo -n "Final status: "
    check_db_health "$db"
    
    echo ""
}

# Restore from backup
restore_from_backup() {
    echo ""
    echo "Available backups:"
    echo "------------------"
    
    ls -lh "$BACKUP_DIR"/*.backup.* 2>/dev/null | tail -20
    
    echo ""
    read -p "Enter backup filename (or 'cancel'): " backup_file
    
    if [ "$backup_file" != "cancel" ] && [ -f "$BACKUP_DIR/$backup_file" ]; then
        # Extract database name from backup filename
        local db_name=$(echo "$backup_file" | sed 's/\.backup\..*//')
        
        echo -e "${YELLOW}Restoring $db_name from $backup_file...${NC}"
        
        # Backup current database
        if [ -f "$db_name" ]; then
            mv "$db_name" "${db_name}.before_restore.$(date +%Y%m%d_%H%M%S)"
        fi
        
        # Restore
        cp "$BACKUP_DIR/$backup_file" "$db_name"
        
        echo -e "${GREEN}✓ Restored successfully${NC}"
    else
        echo -e "${RED}✗ Backup file not found or cancelled${NC}"
    fi
}

# Main execution
main() {
    if [ "$1" = "--auto" ]; then
        # Auto mode: fix all databases
        echo -e "${YELLOW}Running automatic recovery...${NC}"
        
        for db in walmart_grocery.db app.db crewai_enhanced.db; do
            if [ -f "$db" ]; then
                process_recovery "$db"
            fi
        done
        
        echo -e "${GREEN}✓ Automatic recovery complete${NC}"
    else
        show_menu
        
        case $choice in
            1) process_recovery "walmart_grocery.db" ;;
            2) process_recovery "app.db" ;;
            3) process_recovery "crewai_enhanced.db" ;;
            4)
                for db in walmart_grocery.db app.db crewai_enhanced.db; do
                    if [ -f "$db" ]; then
                        process_recovery "$db"
                    fi
                done
                ;;
            5)
                for db in walmart_grocery.db app.db crewai_enhanced.db; do
                    if [ -f "$db" ]; then
                        backup_database "$db"
                    fi
                done
                ;;
            6) restore_from_backup ;;
            7)
                for db in walmart_grocery.db app.db crewai_enhanced.db; do
                    if [ -f "$db" ]; then
                        optimize_database "$db"
                        add_indexes "$db"
                    fi
                done
                ;;
            8) exit 0 ;;
            *) echo -e "${RED}Invalid choice${NC}" ;;
        esac
    fi
    
    echo ""
    echo -e "${BLUE}================================"
    echo "Database Recovery Complete"
    echo "================================${NC}"
    echo ""
    echo "Summary:"
    for db in walmart_grocery.db app.db crewai_enhanced.db; do
        if [ -f "$db" ]; then
            echo -n "  $(basename $db): "
            check_db_health "$db"
        fi
    done
    
    echo ""
    echo "Next steps:"
    echo "  1. Run diagnostic: ./scripts/diagnostics/comprehensive_diagnostic.sh"
    echo "  2. Test queries: sqlite3 [database] 'SELECT COUNT(*) FROM [table];'"
    echo "  3. Monitor performance: watch -n 1 'ls -lh *.db'"
}

# Run main
main $@