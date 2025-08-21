#!/bin/bash

# Email Pipeline Rollback Script
# Purpose: Rollback email pipeline to a previous backup state for service restoration

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
ROLLBACK_LOG="$LOG_DIR/rollback.log"

# Create required directories
mkdir -p "$LOG_DIR"

# Logging function
log_message() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "$timestamp [$level] $message" | tee -a "$ROLLBACK_LOG"
}

# Function to validate backup timestamp
validate_backup_timestamp() {
    local timestamp=$1
    
    if [[ ! "$timestamp" =~ ^[0-9]{8}_[0-9]{6}$ ]]; then
        log_message "ERROR" "Invalid timestamp format. Expected: YYYYMMDD_HHMMSS"
        return 1
    fi
    
    # Check if backup files exist
    local backup_files=$(ls -1 "$BACKUP_DIR"/*_"$timestamp"* 2>/dev/null | wc -l)
    if [ "$backup_files" -eq 0 ]; then
        log_message "ERROR" "No backup files found for timestamp: $timestamp"
        return 1
    fi
    
    log_message "INFO" "Backup validation passed for timestamp: $timestamp"
    return 0
}

# Function to create pre-rollback backup
create_pre_rollback_backup() {
    log_message "INFO" "Creating pre-rollback backup..."
    
    local pre_rollback_timestamp=$(date '+%Y%m%d_%H%M%S')
    local pre_rollback_dir="$BACKUP_DIR/pre_rollback_$pre_rollback_timestamp"
    
    mkdir -p "$pre_rollback_dir"
    
    # Backup current databases
    local databases=("crewai.db" "app.db")
    for db in "${databases[@]}"; do
        local db_path="$DATA_DIR/$db"
        if [ -f "$db_path" ]; then
            log_message "INFO" "Backing up current database: $db"
            cp "$db_path" "$pre_rollback_dir/$db.pre_rollback"
        fi
    done
    
    # Backup current configuration
    if [ -f "$PROJECT_DIR/.env" ]; then
        cp "$PROJECT_DIR/.env" "$pre_rollback_dir/.env.pre_rollback"
    fi
    
    log_message "INFO" "Pre-rollback backup created at: $pre_rollback_dir"
    echo "$pre_rollback_dir" # Return the backup directory path
}

# Function to stop services safely
stop_services() {
    log_message "INFO" "Stopping email pipeline services..."
    
    # Stop email pipeline service
    if systemctl is-active --quiet crewai-email-pipeline; then
        log_message "INFO" "Stopping crewai-email-pipeline service..."
        sudo systemctl stop crewai-email-pipeline
        
        # Wait for graceful shutdown
        local timeout=30
        while [ $timeout -gt 0 ] && systemctl is-active --quiet crewai-email-pipeline; do
            sleep 1
            ((timeout--))
        done
        
        if systemctl is-active --quiet crewai-email-pipeline; then
            log_message "WARN" "Service did not stop gracefully, forcing stop..."
            sudo systemctl kill crewai-email-pipeline
            sleep 2
        fi
        
        log_message "INFO" "Email pipeline service stopped"
    else
        log_message "INFO" "Email pipeline service was not running"
    fi
    
    # Stop any running Node.js processes related to email pipeline
    local node_pids=$(pgrep -f "run-email-pipeline" || true)
    if [ -n "$node_pids" ]; then
        log_message "INFO" "Stopping running email pipeline processes..."
        echo "$node_pids" | xargs -r kill -TERM
        sleep 5
        
        # Force kill if still running
        local remaining_pids=$(pgrep -f "run-email-pipeline" || true)
        if [ -n "$remaining_pids" ]; then
            log_message "WARN" "Force killing remaining processes..."
            echo "$remaining_pids" | xargs -r kill -KILL
        fi
    fi
    
    log_message "INFO" "All services stopped successfully"
}

# Function to restore databases
restore_databases() {
    local backup_timestamp=$1
    local db_backup_dir="$BACKUP_DIR/databases_$backup_timestamp"
    
    log_message "INFO" "Restoring databases from backup: $backup_timestamp"
    
    # Extract compressed database backups if needed
    if [ ! -d "$db_backup_dir" ] && [ -f "$db_backup_dir.tar.gz" ]; then
        log_message "INFO" "Extracting database backup archive..."
        tar -xzf "$db_backup_dir.tar.gz" -C "$BACKUP_DIR"
    fi
    
    if [ ! -d "$db_backup_dir" ]; then
        log_message "ERROR" "Database backup directory not found: $db_backup_dir"
        return 1
    fi
    
    # Restore each database
    for db_backup in "$db_backup_dir"/*.db.gz; do
        if [ -f "$db_backup" ]; then
            local db_name=$(basename "$db_backup" .gz)
            local db_path="$DATA_DIR/$db_name"
            
            log_message "INFO" "Restoring database: $db_name"
            
            # Decompress and restore
            if gzip -dc "$db_backup" > "$db_path.tmp"; then
                # Verify database integrity before replacing
                if sqlite3 "$db_path.tmp" "PRAGMA integrity_check;" | grep -q "ok"; then
                    mv "$db_path.tmp" "$db_path"
                    log_message "INFO" "Database restored successfully: $db_name"
                else
                    rm -f "$db_path.tmp"
                    log_message "ERROR" "Database integrity check failed: $db_name"
                    return 1
                fi
            else
                rm -f "$db_path.tmp"
                log_message "ERROR" "Failed to decompress database: $db_name"
                return 1
            fi
        fi
    done
    
    log_message "INFO" "Database restoration completed successfully"
    return 0
}

# Function to restore configuration
restore_configuration() {
    local backup_timestamp=$1
    local config_backup="$BACKUP_DIR/config_$backup_timestamp.tar.gz"
    
    log_message "INFO" "Restoring configuration from backup: $backup_timestamp"
    
    if [ ! -f "$config_backup" ]; then
        log_message "ERROR" "Configuration backup not found: $config_backup"
        return 1
    fi
    
    # Create temporary directory for extraction
    local temp_dir=$(mktemp -d)
    
    # Extract configuration backup
    if tar -xzf "$config_backup" -C "$temp_dir"; then
        local config_dir="$temp_dir/config_$backup_timestamp"
        
        # Restore configuration files
        if [ -f "$config_dir/.env" ]; then
            log_message "INFO" "Restoring environment configuration..."
            cp "$config_dir/.env" "$PROJECT_DIR/.env"
        fi
        
        # Restore other configuration files
        local config_files=("package.json" "tsconfig.json")
        for config_file in "${config_files[@]}"; do
            if [ -f "$config_dir/$config_file" ]; then
                log_message "INFO" "Restoring config file: $config_file"
                cp "$config_dir/$config_file" "$PROJECT_DIR/$config_file"
            fi
        done
        
        # Restore email batch data if exists
        if [ -d "$config_dir/email-batches" ]; then
            log_message "INFO" "Restoring email batch data..."
            rm -rf "$DATA_DIR/email-batches"
            cp -r "$config_dir/email-batches" "$DATA_DIR/"
        fi
        
        log_message "INFO" "Configuration restoration completed successfully"
        
        # Cleanup temporary directory
        rm -rf "$temp_dir"
        return 0
    else
        log_message "ERROR" "Failed to extract configuration backup"
        rm -rf "$temp_dir"
        return 1
    fi
}

# Function to verify system state after rollback
verify_rollback() {
    log_message "INFO" "Verifying rollback integrity..."
    
    # Check database files exist and are valid
    local databases=("crewai.db" "app.db")
    for db in "${databases[@]}"; do
        local db_path="$DATA_DIR/$db"
        if [ -f "$db_path" ]; then
            if sqlite3 "$db_path" "PRAGMA integrity_check;" | grep -q "ok"; then
                log_message "INFO" "Database verification passed: $db"
            else
                log_message "ERROR" "Database verification failed: $db"
                return 1
            fi
        else
            log_message "WARN" "Database not found after rollback: $db"
        fi
    done
    
    # Check essential configuration files
    if [ -f "$PROJECT_DIR/.env" ]; then
        log_message "INFO" "Environment configuration verified"
    else
        log_message "WARN" "Environment configuration not found"
    fi
    
    log_message "INFO" "Rollback verification completed"
    return 0
}

# Function to restart services
start_services() {
    log_message "INFO" "Starting email pipeline services..."
    
    # Clear any Redis queues to prevent processing old data
    log_message "INFO" "Clearing Redis queues..."
    redis-cli FLUSHDB 2>/dev/null || log_message "WARN" "Could not clear Redis database"
    
    # Restart the email pipeline service
    if systemctl is-enabled --quiet crewai-email-pipeline 2>/dev/null; then
        log_message "INFO" "Starting crewai-email-pipeline service..."
        sudo systemctl start crewai-email-pipeline
        
        # Wait for service to start
        local timeout=30
        while [ $timeout -gt 0 ] && ! systemctl is-active --quiet crewai-email-pipeline; do
            sleep 1
            ((timeout--))
        done
        
        if systemctl is-active --quiet crewai-email-pipeline; then
            log_message "INFO" "Email pipeline service started successfully"
        else
            log_message "ERROR" "Failed to start email pipeline service"
            return 1
        fi
    else
        log_message "WARN" "Email pipeline service is not enabled"
    fi
    
    # Verify service health
    local health_check_timeout=60
    while [ $health_check_timeout -gt 0 ]; do
        if curl -s -f "http://localhost:3001/api/health" >/dev/null 2>&1; then
            log_message "INFO" "Service health check passed"
            break
        fi
        sleep 2
        ((health_check_timeout -= 2))
    done
    
    if [ $health_check_timeout -le 0 ]; then
        log_message "WARN" "Service health check timeout - service may still be starting"
    fi
    
    log_message "INFO" "Services started successfully"
    return 0
}

# Function to perform complete rollback
perform_rollback() {
    local backup_timestamp=$1
    local skip_confirmation=${2:-false}
    
    log_message "INFO" "Starting rollback process to backup: $backup_timestamp"
    
    # Confirmation prompt unless skipped
    if [ "$skip_confirmation" != "true" ]; then
        echo -e "${YELLOW}WARNING: This will rollback the email pipeline to backup $backup_timestamp${NC}"
        echo -e "${YELLOW}Current data will be backed up but the system will be restored to the previous state.${NC}"
        echo -e "${RED}This action cannot be easily undone.${NC}"
        echo
        read -p "Are you sure you want to proceed? (yes/no): " confirmation
        
        if [ "$confirmation" != "yes" ]; then
            log_message "INFO" "Rollback cancelled by user"
            echo -e "${YELLOW}Rollback cancelled${NC}"
            return 0
        fi
    fi
    
    # Validate backup
    if ! validate_backup_timestamp "$backup_timestamp"; then
        return 1
    fi
    
    # Create pre-rollback backup
    local pre_rollback_dir=$(create_pre_rollback_backup)
    if [ $? -ne 0 ]; then
        log_message "ERROR" "Failed to create pre-rollback backup"
        return 1
    fi
    
    # Stop services
    if ! stop_services; then
        log_message "ERROR" "Failed to stop services"
        return 1
    fi
    
    # Perform rollback
    local rollback_success=true
    
    restore_databases "$backup_timestamp" || rollback_success=false
    restore_configuration "$backup_timestamp" || rollback_success=false
    
    if [ "$rollback_success" = true ]; then
        # Verify rollback
        if verify_rollback; then
            log_message "INFO" "Rollback verification passed"
            
            # Start services
            if start_services; then
                log_message "INFO" "Rollback completed successfully"
                echo -e "${GREEN}✓ Rollback completed successfully${NC}"
                echo -e "Rolled back to: ${YELLOW}$backup_timestamp${NC}"
                echo -e "Pre-rollback backup: ${YELLOW}$pre_rollback_dir${NC}"
                return 0
            else
                log_message "ERROR" "Failed to start services after rollback"
                rollback_success=false
            fi
        else
            log_message "ERROR" "Rollback verification failed"
            rollback_success=false
        fi
    fi
    
    if [ "$rollback_success" = false ]; then
        log_message "ERROR" "Rollback failed - attempting to restore from pre-rollback backup"
        
        # Restore from pre-rollback backup
        for db_backup in "$pre_rollback_dir"/*.pre_rollback; do
            if [ -f "$db_backup" ]; then
                local original_name=$(basename "$db_backup" .pre_rollback)
                cp "$db_backup" "$DATA_DIR/$original_name"
                log_message "INFO" "Restored original database: $original_name"
            fi
        done
        
        if [ -f "$pre_rollback_dir/.env.pre_rollback" ]; then
            cp "$pre_rollback_dir/.env.pre_rollback" "$PROJECT_DIR/.env"
            log_message "INFO" "Restored original environment configuration"
        fi
        
        # Try to start services
        start_services
        
        echo -e "${RED}✗ Rollback failed - system restored to pre-rollback state${NC}"
        echo -e "Check logs at: ${YELLOW}$ROLLBACK_LOG${NC}"
        return 1
    fi
}

# Function to list available backups for rollback
list_rollback_targets() {
    echo -e "${BLUE}Available Rollback Targets:${NC}"
    echo "=========================="
    
    if [ ! -d "$BACKUP_DIR" ] || [ -z "$(ls -A $BACKUP_DIR 2>/dev/null)" ]; then
        echo -e "${YELLOW}No backups available for rollback${NC}"
        return 0
    fi
    
    # Get unique backup timestamps (exclude pre-rollback backups)
    local timestamps=$(ls -1 "$BACKUP_DIR" | grep -E '^(databases|config|system_state)_[0-9]{8}_[0-9]{6}' | grep -oE '[0-9]{8}_[0-9]{6}' | sort -r | uniq)
    
    local count=1
    for timestamp in $timestamps; do
        echo -e "\n${GREEN}[$count] Backup: $timestamp${NC}"
        
        # Show backup components
        local has_database=$(ls -1 "$BACKUP_DIR"/databases_"$timestamp"* 2>/dev/null | wc -l)
        local has_config=$(ls -1 "$BACKUP_DIR"/config_"$timestamp"* 2>/dev/null | wc -l)
        local has_snapshot=$(ls -1 "$BACKUP_DIR"/system_state_"$timestamp"* 2>/dev/null | wc -l)
        
        echo "    Components: Database($has_database) Config($has_config) Snapshot($has_snapshot)"
        
        # Show creation date
        local creation_date=$(date -d "${timestamp:0:8} ${timestamp:9:2}:${timestamp:11:2}:${timestamp:13:2}" '+%Y-%m-%d %H:%M:%S' 2>/dev/null || echo "Unknown")
        echo "    Created: $creation_date"
        
        # Show system state if available
        local snapshot_file="$BACKUP_DIR/system_state_$timestamp.txt"
        if [ -f "$snapshot_file" ]; then
            local service_status=$(grep -A5 "SERVICE STATUS" "$snapshot_file" | grep -o "active (running)\|inactive\|failed" | head -1 || echo "unknown")
            echo "    Service was: $service_status"
        fi
        
        ((count++))
    done
}

# Function to show rollback status
show_rollback_status() {
    echo -e "${BLUE}Rollback System Status:${NC}"
    echo "====================="
    
    # Check if services are running
    if systemctl is-active --quiet crewai-email-pipeline; then
        echo -e "Email Pipeline Service: ${GREEN}RUNNING${NC}"
    else
        echo -e "Email Pipeline Service: ${RED}STOPPED${NC}"
    fi
    
    # Check recent rollbacks
    if [ -f "$ROLLBACK_LOG" ]; then
        local last_rollback=$(grep "Rollback completed successfully" "$ROLLBACK_LOG" | tail -1)
        if [ -n "$last_rollback" ]; then
            echo -e "Last successful rollback: ${GREEN}$(echo "$last_rollback" | cut -d' ' -f1-2)${NC}"
        else
            echo -e "Last successful rollback: ${YELLOW}None found${NC}"
        fi
        
        # Check for recent failures
        local last_failure=$(grep "Rollback failed" "$ROLLBACK_LOG" | tail -1)
        if [ -n "$last_failure" ]; then
            echo -e "Last rollback failure: ${RED}$(echo "$last_failure" | cut -d' ' -f1-2)${NC}"
        fi
    else
        echo -e "Rollback history: ${YELLOW}No log found${NC}"
    fi
    
    # Check available backups
    local backup_count=$(ls -1 "$BACKUP_DIR"/*_[0-9]* 2>/dev/null | grep -v pre_rollback | wc -l)
    echo -e "Available backups: ${YELLOW}$backup_count${NC}"
}

# Main function
main() {
    case "${1:-help}" in
        rollback)
            if [ -n "$2" ]; then
                perform_rollback "$2" "${3:-false}"
            else
                echo -e "${RED}Error: Please specify backup timestamp${NC}"
                echo "Usage: $0 rollback <timestamp> [skip-confirmation]"
                echo "Use '$0 list' to see available backups"
                exit 1
            fi
            ;;
        list)
            list_rollback_targets
            ;;
        status)
            show_rollback_status
            ;;
        help|*)
            echo "Usage: $0 {rollback|list|status}"
            echo
            echo "  rollback <timestamp> [skip-confirmation] - Rollback to specific backup"
            echo "  list                                     - List available rollback targets"
            echo "  status                                   - Show rollback system status"
            echo
            echo "Examples:"
            echo "  $0 list                          # List available backups"
            echo "  $0 rollback 20250130_143022      # Rollback with confirmation"
            echo "  $0 rollback 20250130_143022 true # Rollback without confirmation"
            echo
            echo "⚠️  Warning: Rollback will stop services and restore previous state"
            echo "   Current data will be backed up before rollback"
            exit 1
            ;;
    esac
}

# Handle script termination
trap 'log_message "INFO" "Rollback script interrupted"; exit 1' INT TERM

# Run main function
main "$@"