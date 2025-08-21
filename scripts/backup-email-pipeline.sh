#!/bin/bash

# Email Pipeline Backup Script
# Purpose: Create versioned backups of database and critical files with automatic cleanup

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="/home/pricepro2006/CrewAI_Team"
DATA_DIR="$PROJECT_DIR/data"
BACKUP_DIR="$PROJECT_DIR/backups"
LOG_DIR="$PROJECT_DIR/logs"
BACKUP_LOG="$LOG_DIR/backup.log"

# Backup settings
MAX_BACKUPS=10  # Keep last 10 backups
BACKUP_RETENTION_DAYS=30  # Delete backups older than 30 days
COMPRESSION_LEVEL=6  # gzip compression level (1-9)

# Create required directories
mkdir -p "$BACKUP_DIR" "$LOG_DIR"

# Logging function
log_message() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "$timestamp [$level] $message" | tee -a "$BACKUP_LOG"
}

# Function to get backup timestamp
get_backup_timestamp() {
    date '+%Y%m%d_%H%M%S'
}

# Function to check disk space
check_disk_space() {
    log_message "INFO" "Checking available disk space..."
    
    local required_space_mb=500  # Minimum 500MB required
    local available_space_mb=$(df "$BACKUP_DIR" | tail -1 | awk '{print int($4/1024)}')
    
    if [ "$available_space_mb" -lt "$required_space_mb" ]; then
        log_message "ERROR" "Insufficient disk space. Required: ${required_space_mb}MB, Available: ${available_space_mb}MB"
        return 1
    fi
    
    log_message "INFO" "Available disk space: ${available_space_mb}MB"
    return 0
}

# Function to backup database files
backup_databases() {
    local backup_timestamp=$1
    local db_backup_dir="$BACKUP_DIR/databases_$backup_timestamp"
    
    log_message "INFO" "Creating database backup at $db_backup_dir..."
    mkdir -p "$db_backup_dir"
    
    # Backup main databases
    local databases=("crewai.db" "app.db")
    
    for db in "${databases[@]}"; do
        local db_path="$DATA_DIR/$db"
        if [ -f "$db_path" ]; then
            log_message "INFO" "Backing up database: $db"
            
            # Create SQLite backup using .backup command for consistency
            sqlite3 "$db_path" ".backup '$db_backup_dir/$db'"
            
            # Verify backup integrity
            if sqlite3 "$db_backup_dir/$db" "PRAGMA integrity_check;" | grep -q "ok"; then
                log_message "INFO" "Database backup verified: $db"
                
                # Compress the backup
                gzip -$COMPRESSION_LEVEL "$db_backup_dir/$db"
                log_message "INFO" "Database compressed: $db.gz"
            else
                log_message "ERROR" "Database backup verification failed: $db"
                return 1
            fi
        else
            log_message "WARN" "Database not found: $db_path"
        fi
    done
    
    return 0
}

# Function to backup configuration files
backup_configurations() {
    local backup_timestamp=$1
    local config_backup_dir="$BACKUP_DIR/config_$backup_timestamp"
    
    log_message "INFO" "Creating configuration backup at $config_backup_dir..."
    mkdir -p "$config_backup_dir"
    
    # Configuration files to backup
    local config_files=(
        "src/config/app.config.ts"
        "src/config/ollama.config.ts"
        ".env"
        "package.json"
        "package-lock.json"
        "tsconfig.json"
    )
    
    for config_file in "${config_files[@]}"; do
        local config_path="$PROJECT_DIR/$config_file"
        if [ -f "$config_path" ]; then
            log_message "INFO" "Backing up config: $config_file"
            
            # Create directory structure if needed
            local config_dir=$(dirname "$config_backup_dir/$config_file")
            mkdir -p "$config_dir"
            
            # Copy file
            cp "$config_path" "$config_backup_dir/$config_file"
        else
            log_message "WARN" "Configuration file not found: $config_path"
        fi
    done
    
    # Backup email batch data
    if [ -d "$DATA_DIR/email-batches" ]; then
        log_message "INFO" "Backing up email batch data..."
        cp -r "$DATA_DIR/email-batches" "$config_backup_dir/"
    fi
    
    # Compress configuration backup
    tar -czf "$config_backup_dir.tar.gz" -C "$BACKUP_DIR" "config_$backup_timestamp"
    rm -rf "$config_backup_dir"
    log_message "INFO" "Configuration backup compressed: config_$backup_timestamp.tar.gz"
    
    return 0
}

# Function to backup logs
backup_logs() {
    local backup_timestamp=$1
    local log_backup_dir="$BACKUP_DIR/logs_$backup_timestamp"
    
    log_message "INFO" "Creating logs backup at $log_backup_dir..."
    mkdir -p "$log_backup_dir"
    
    # Copy recent logs (last 7 days)
    find "$LOG_DIR" -name "*.log" -mtime -7 -exec cp {} "$log_backup_dir/" \;
    
    # Compress logs backup
    if [ "$(ls -A $log_backup_dir)" ]; then
        tar -czf "$log_backup_dir.tar.gz" -C "$BACKUP_DIR" "logs_$backup_timestamp"
        rm -rf "$log_backup_dir"
        log_message "INFO" "Logs backup compressed: logs_$backup_timestamp.tar.gz"
    else
        log_message "WARN" "No recent logs found to backup"
        rmdir "$log_backup_dir"
    fi
    
    return 0
}

# Function to create system state snapshot
create_system_snapshot() {
    local backup_timestamp=$1
    local snapshot_file="$BACKUP_DIR/system_state_$backup_timestamp.txt"
    
    log_message "INFO" "Creating system state snapshot..."
    
    {
        echo "CrewAI Email Pipeline System State Snapshot"
        echo "Generated: $(date)"
        echo "============================================"
        echo
        
        echo "SERVICE STATUS"
        echo "--------------"
        systemctl status crewai-email-pipeline --no-pager 2>/dev/null || echo "Service not found"
        echo
        
        echo "PROCESS INFORMATION"
        echo "------------------"
        ps aux | grep -E "(node|npm|email-pipeline)" | grep -v grep
        echo
        
        echo "REDIS STATUS"
        echo "------------"
        redis-cli INFO 2>/dev/null | grep -E "(redis_version|connected_clients|used_memory_human)" || echo "Redis not accessible"
        echo
        
        echo "QUEUE STATUS"
        echo "------------"
        redis-cli LLEN "bull:email-processor:wait" 2>/dev/null || echo "Queue not accessible"
        redis-cli LLEN "bull:email-processor:active" 2>/dev/null || echo "Queue not accessible"
        redis-cli LLEN "bull:email-processor:completed" 2>/dev/null || echo "Queue not accessible"
        redis-cli LLEN "bull:email-processor:failed" 2>/dev/null || echo "Queue not accessible"
        echo
        
        echo "DISK USAGE"
        echo "----------"
        df -h "$PROJECT_DIR"
        echo
        
        echo "ENVIRONMENT VARIABLES"
        echo "--------------------"
        env | grep -E "(NODE_ENV|DATABASE_PATH|REDIS_URL|OLLAMA|CHROMA)" | sort
        
    } > "$snapshot_file"
    
    log_message "INFO" "System snapshot created: $snapshot_file"
    return 0
}

# Function to cleanup old backups
cleanup_old_backups() {
    log_message "INFO" "Cleaning up old backups..."
    
    # Remove backups older than retention period
    find "$BACKUP_DIR" -name "*_[0-9]*" -type f -mtime +$BACKUP_RETENTION_DAYS -delete
    log_message "INFO" "Removed backups older than $BACKUP_RETENTION_DAYS days"
    
    # Keep only the latest MAX_BACKUPS sets
    local backup_sets=$(ls -1 "$BACKUP_DIR" | grep -E "databases_[0-9]{8}_[0-9]{6}" | sed 's/databases_//' | sed 's/\..*$//' | sort -r | tail -n +$((MAX_BACKUPS + 1)))
    
    for timestamp in $backup_sets; do
        log_message "INFO" "Removing old backup set: $timestamp"
        rm -f "$BACKUP_DIR"/*_"$timestamp"*
    done
    
    # Show current backup status
    local total_backups=$(ls -1 "$BACKUP_DIR"/*_[0-9]* 2>/dev/null | wc -l)
    local backup_size=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)
    log_message "INFO" "Backup cleanup complete. Total backups: $total_backups, Size: $backup_size"
}

# Function to verify backup integrity
verify_backup_integrity() {
    local backup_timestamp=$1
    
    log_message "INFO" "Verifying backup integrity..."
    
    # Check database backups
    local db_backup_dir="$BACKUP_DIR/databases_$backup_timestamp"
    if [ -d "$db_backup_dir" -o -f "$db_backup_dir.tar.gz" ]; then
        for db_backup in "$db_backup_dir"/*.db.gz; do
            if [ -f "$db_backup" ]; then
                # Test gzip integrity
                if gzip -t "$db_backup" 2>/dev/null; then
                    log_message "INFO" "Database backup integrity verified: $(basename $db_backup)"
                else
                    log_message "ERROR" "Database backup integrity check failed: $(basename $db_backup)"
                    return 1
                fi
            fi
        done
    fi
    
    # Check configuration backup
    local config_backup="$BACKUP_DIR/config_$backup_timestamp.tar.gz"
    if [ -f "$config_backup" ]; then
        if tar -tzf "$config_backup" >/dev/null 2>&1; then
            log_message "INFO" "Configuration backup integrity verified"
        else
            log_message "ERROR" "Configuration backup integrity check failed"
            return 1
        fi
    fi
    
    log_message "INFO" "Backup integrity verification complete"
    return 0
}

# Function to create full backup
create_full_backup() {
    local backup_timestamp=$(get_backup_timestamp)
    
    log_message "INFO" "Starting full backup process - timestamp: $backup_timestamp"
    
    # Check prerequisites
    if ! check_disk_space; then
        log_message "ERROR" "Backup aborted due to insufficient disk space"
        return 1
    fi
    
    # Stop the service temporarily for consistent backup
    local service_was_running=false
    if systemctl is-active --quiet crewai-email-pipeline; then
        log_message "INFO" "Stopping email pipeline service for backup..."
        sudo systemctl stop crewai-email-pipeline
        service_was_running=true
        sleep 2  # Wait for graceful shutdown
    fi
    
    # Create backups
    local backup_success=true
    
    backup_databases "$backup_timestamp" || backup_success=false
    backup_configurations "$backup_timestamp" || backup_success=false
    backup_logs "$backup_timestamp" || backup_success=false
    create_system_snapshot "$backup_timestamp" || backup_success=false
    
    # Restart service if it was running
    if [ "$service_was_running" = true ]; then
        log_message "INFO" "Restarting email pipeline service..."
        sudo systemctl start crewai-email-pipeline
        
        # Wait and verify service started
        sleep 3
        if systemctl is-active --quiet crewai-email-pipeline; then
            log_message "INFO" "Email pipeline service restarted successfully"
        else
            log_message "ERROR" "Failed to restart email pipeline service"
            backup_success=false
        fi
    fi
    
    # Verify backup integrity
    if [ "$backup_success" = true ]; then
        verify_backup_integrity "$backup_timestamp" || backup_success=false
    fi
    
    # Cleanup old backups
    cleanup_old_backups
    
    if [ "$backup_success" = true ]; then
        log_message "INFO" "Full backup completed successfully - timestamp: $backup_timestamp"
        echo -e "${GREEN}✓ Backup completed successfully${NC}"
        echo -e "Backup timestamp: ${YELLOW}$backup_timestamp${NC}"
        echo -e "Backup location: ${YELLOW}$BACKUP_DIR${NC}"
        return 0
    else
        log_message "ERROR" "Backup process completed with errors"
        echo -e "${RED}✗ Backup completed with errors - check logs${NC}"
        return 1
    fi
}

# Function to list available backups
list_backups() {
    echo -e "${BLUE}Available Backups:${NC}"
    echo "=================="
    
    if [ ! -d "$BACKUP_DIR" ] || [ -z "$(ls -A $BACKUP_DIR 2>/dev/null)" ]; then
        echo -e "${YELLOW}No backups found${NC}"
        return 0
    fi
    
    # Get unique backup timestamps
    local timestamps=$(ls -1 "$BACKUP_DIR" | grep -oE '[0-9]{8}_[0-9]{6}' | sort -r | uniq)
    
    for timestamp in $timestamps; do
        echo -e "\n${GREEN}Backup Set: $timestamp${NC}"
        
        # Show backup components
        local databases=$(ls -1 "$BACKUP_DIR"/databases_"$timestamp"* 2>/dev/null | wc -l)
        local config=$(ls -1 "$BACKUP_DIR"/config_"$timestamp"* 2>/dev/null | wc -l)
        local logs=$(ls -1 "$BACKUP_DIR"/logs_"$timestamp"* 2>/dev/null | wc -l)
        local snapshot=$(ls -1 "$BACKUP_DIR"/system_state_"$timestamp"* 2>/dev/null | wc -l)
        
        echo "  - Databases: $databases"
        echo "  - Configuration: $config"
        echo "  - Logs: $logs"
        echo "  - System snapshot: $snapshot"
        
        # Calculate backup size
        local backup_size=$(du -sh "$BACKUP_DIR"/*_"$timestamp"* 2>/dev/null | awk '{sum+=$1} END {print sum "K"}' | numfmt --from=iec --to=iec 2>/dev/null || echo "Unknown")
        echo "  - Total size: $backup_size"
        
        # Show creation date
        local creation_date=$(date -d "${timestamp:0:8} ${timestamp:9:2}:${timestamp:11:2}:${timestamp:13:2}" '+%Y-%m-%d %H:%M:%S' 2>/dev/null || echo "Unknown")
        echo "  - Created: $creation_date"
    done
}

# Function to show backup status
show_backup_status() {
    echo -e "${BLUE}Backup System Status:${NC}"
    echo "===================="
    
    # Check backup directory
    if [ -d "$BACKUP_DIR" ]; then
        local total_backups=$(ls -1 "$BACKUP_DIR"/*_[0-9]* 2>/dev/null | wc -l)
        local backup_size=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)
        echo -e "Backup directory: ${GREEN}$BACKUP_DIR${NC}"
        echo -e "Total backups: ${YELLOW}$total_backups${NC}"
        echo -e "Total size: ${YELLOW}$backup_size${NC}"
    else
        echo -e "Backup directory: ${RED}Not found${NC}"
    fi
    
    # Check disk space
    local available_space=$(df -h "$PROJECT_DIR" | tail -1 | awk '{print $4}')
    echo -e "Available space: ${YELLOW}$available_space${NC}"
    
    # Show last backup
    if [ -f "$BACKUP_LOG" ]; then
        local last_backup=$(grep "Full backup completed successfully" "$BACKUP_LOG" | tail -1 | cut -d' ' -f1-2)
        if [ -n "$last_backup" ]; then
            echo -e "Last backup: ${GREEN}$last_backup${NC}"
        else
            echo -e "Last backup: ${YELLOW}No successful backups found${NC}"
        fi
    else
        echo -e "Last backup: ${YELLOW}No backup log found${NC}"
    fi
    
    # Configuration
    echo -e "\nConfiguration:"
    echo -e "Max backups: ${YELLOW}$MAX_BACKUPS${NC}"
    echo -e "Retention days: ${YELLOW}$BACKUP_RETENTION_DAYS${NC}"
    echo -e "Compression level: ${YELLOW}$COMPRESSION_LEVEL${NC}"
}

# Main function
main() {
    case "${1:-backup}" in
        backup|full)
            create_full_backup
            ;;
        list)
            list_backups
            ;;
        status)
            show_backup_status
            ;;
        cleanup)
            cleanup_old_backups
            ;;
        verify)
            if [ -n "$2" ]; then
                verify_backup_integrity "$2"
            else
                echo -e "${RED}Error: Please specify backup timestamp${NC}"
                echo "Usage: $0 verify <timestamp>"
                exit 1
            fi
            ;;
        *)
            echo "Usage: $0 {backup|list|status|cleanup|verify <timestamp>}"
            echo
            echo "  backup  - Create full backup (default)"
            echo "  list    - List available backups"
            echo "  status  - Show backup system status"
            echo "  cleanup - Remove old backups"
            echo "  verify  - Verify backup integrity"
            echo
            echo "Examples:"
            echo "  $0 backup                    # Create full backup"
            echo "  $0 list                      # List all backups"
            echo "  $0 verify 20250130_143022    # Verify specific backup"
            exit 1
            ;;
    esac
}

# Handle script termination
trap 'log_message "INFO" "Backup script interrupted"; exit 1' INT TERM

# Run main function
main "$@"