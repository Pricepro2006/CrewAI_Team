#!/bin/bash

# CrewAI Team Database Backup Script
# Automated backup solution for production database with integrity checking

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DB_PATH="${PROJECT_ROOT}/data/crewai_team.db"
BACKUP_DIR="${PROJECT_ROOT}/data/backups"
REMOTE_BACKUP_DIR="/path/to/remote/backups" # Configure for your environment
LOG_FILE="${PROJECT_ROOT}/logs/backup.log"

# Email configuration (optional)
ADMIN_EMAIL="admin@yourcompany.com"
SMTP_SERVER="smtp.yourcompany.com"

# Retention settings
KEEP_LOCAL_DAYS=30
KEEP_REMOTE_DAYS=90
KEEP_MONTHLY_MONTHS=12

# Logging function
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" | tee -a "$LOG_FILE"
}

# Error handling
error_exit() {
    log "ERROR" "$1"
    send_alert "BACKUP FAILED" "$1"
    exit 1
}

# Send alert email (configure SMTP settings)
send_alert() {
    local subject="$1"
    local message="$2"
    
    if command -v mail >/dev/null 2>&1; then
        echo "$message" | mail -s "CrewAI Database Backup: $subject" "$ADMIN_EMAIL" || true
    fi
}

# Check prerequisites
check_prerequisites() {
    log "INFO" "Checking prerequisites"
    
    # Check if database exists
    if [[ ! -f "$DB_PATH" ]]; then
        error_exit "Database file not found: $DB_PATH"
    fi
    
    # Check if backup directory exists, create if not
    if [[ ! -d "$BACKUP_DIR" ]]; then
        mkdir -p "$BACKUP_DIR"
        log "INFO" "Created backup directory: $BACKUP_DIR"
    fi
    
    # Check if sqlite3 is available
    if ! command -v sqlite3 >/dev/null 2>&1; then
        error_exit "sqlite3 command not found. Please install SQLite3."
    fi
    
    # Check if gzip is available
    if ! command -v gzip >/dev/null 2>&1; then
        error_exit "gzip command not found. Please install gzip."
    fi
    
    # Check disk space (ensure at least 2GB free)
    local available_space=$(df "$BACKUP_DIR" | awk 'NR==2 {print $4}')
    local required_space=$((2 * 1024 * 1024)) # 2GB in KB
    
    if [[ $available_space -lt $required_space ]]; then
        error_exit "Insufficient disk space. Required: 2GB, Available: $((available_space / 1024 / 1024))GB"
    fi
    
    log "INFO" "Prerequisites check passed"
}

# Create database backup
create_backup() {
    local timestamp=$(date '+%Y%m%d_%H%M%S')
    local backup_file="${BACKUP_DIR}/crewai_team_${timestamp}.db"
    local compressed_file="${backup_file}.gz"
    
    log "INFO" "Starting backup creation: $backup_file"
    
    # Create the backup using SQLite's .backup command
    if ! sqlite3 "$DB_PATH" ".backup '$backup_file'" 2>/dev/null; then
        error_exit "Failed to create database backup"
    fi
    
    # Verify backup integrity
    log "INFO" "Verifying backup integrity"
    local integrity_check=$(sqlite3 "$backup_file" "PRAGMA integrity_check;" 2>/dev/null | head -1)
    
    if [[ "$integrity_check" != "ok" ]]; then
        rm -f "$backup_file"
        error_exit "Backup integrity check failed: $integrity_check"
    fi
    
    # Get backup statistics
    local original_size=$(stat -f%z "$DB_PATH" 2>/dev/null || stat -c%s "$DB_PATH" 2>/dev/null)
    local backup_size=$(stat -f%z "$backup_file" 2>/dev/null || stat -c%s "$backup_file" 2>/dev/null)
    
    log "INFO" "Backup created successfully. Size: $(($backup_size / 1024 / 1024))MB"
    
    # Compress the backup
    log "INFO" "Compressing backup"
    if ! gzip "$backup_file"; then
        error_exit "Failed to compress backup"
    fi
    
    local compressed_size=$(stat -f%z "$compressed_file" 2>/dev/null || stat -c%s "$compressed_file" 2>/dev/null)
    local compression_ratio=$(echo "scale=1; $compressed_size * 100 / $backup_size" | bc -l 2>/dev/null || echo "N/A")
    
    log "INFO" "Backup compressed successfully. Size: $(($compressed_size / 1024 / 1024))MB (${compression_ratio}% of original)"
    
    echo "$compressed_file"
}

# Copy to remote location (if configured)
copy_to_remote() {
    local backup_file="$1"
    
    if [[ -z "$REMOTE_BACKUP_DIR" ]] || [[ "$REMOTE_BACKUP_DIR" == "/path/to/remote/backups" ]]; then
        log "INFO" "Remote backup not configured, skipping"
        return 0
    fi
    
    log "INFO" "Copying backup to remote location: $REMOTE_BACKUP_DIR"
    
    # Create remote directory if it doesn't exist
    mkdir -p "$REMOTE_BACKUP_DIR" 2>/dev/null || true
    
    # Copy the file
    if cp "$backup_file" "$REMOTE_BACKUP_DIR/"; then
        log "INFO" "Remote backup copy completed"
    else
        log "WARN" "Failed to copy backup to remote location"
    fi
}

# Clean up old backups
cleanup_old_backups() {
    log "INFO" "Cleaning up old backups"
    
    # Clean up local backups older than KEEP_LOCAL_DAYS
    local deleted_local=0
    while IFS= read -r -d '' file; do
        rm -f "$file"
        ((deleted_local++))
    done < <(find "$BACKUP_DIR" -name "crewai_team_*.db.gz" -mtime +$KEEP_LOCAL_DAYS -print0 2>/dev/null || true)
    
    if [[ $deleted_local -gt 0 ]]; then
        log "INFO" "Deleted $deleted_local old local backup(s)"
    fi
    
    # Clean up remote backups if configured
    if [[ -n "$REMOTE_BACKUP_DIR" && "$REMOTE_BACKUP_DIR" != "/path/to/remote/backups" && -d "$REMOTE_BACKUP_DIR" ]]; then
        local deleted_remote=0
        while IFS= read -r -d '' file; do
            rm -f "$file"
            ((deleted_remote++))
        done < <(find "$REMOTE_BACKUP_DIR" -name "crewai_team_*.db.gz" -mtime +$KEEP_REMOTE_DAYS -print0 2>/dev/null || true)
        
        if [[ $deleted_remote -gt 0 ]]; then
            log "INFO" "Deleted $deleted_remote old remote backup(s)"
        fi
    fi
}

# Create monthly archive
create_monthly_archive() {
    local current_month=$(date '+%Y-%m')
    local monthly_backup="${BACKUP_DIR}/monthly/crewai_team_${current_month}.db.gz"
    
    # Check if monthly backup already exists
    if [[ -f "$monthly_backup" ]]; then
        log "INFO" "Monthly backup for $current_month already exists"
        return 0
    fi
    
    # Create monthly directory
    mkdir -p "$(dirname "$monthly_backup")"
    
    # Find the latest backup from this month
    local latest_monthly=$(find "$BACKUP_DIR" -name "crewai_team_${current_month}*.db.gz" -type f | sort | tail -1)
    
    if [[ -n "$latest_monthly" ]]; then
        cp "$latest_monthly" "$monthly_backup"
        log "INFO" "Created monthly archive: $monthly_backup"
    else
        log "WARN" "No backup found for monthly archive creation"
    fi
    
    # Clean up old monthly backups
    local deleted_monthly=0
    while IFS= read -r -d '' file; do
        rm -f "$file"
        ((deleted_monthly++))
    done < <(find "${BACKUP_DIR}/monthly" -name "crewai_team_*.db.gz" -mtime +$((KEEP_MONTHLY_MONTHS * 30)) -print0 2>/dev/null || true)
    
    if [[ $deleted_monthly -gt 0 ]]; then
        log "INFO" "Deleted $deleted_monthly old monthly backup(s)"
    fi
}

# Validate existing backups
validate_backups() {
    log "INFO" "Validating existing backups"
    
    local validated=0
    local corrupted=0
    
    while IFS= read -r -d '' backup_file; do
        local temp_file="/tmp/backup_validation_$$.db"
        
        # Decompress to temp file
        if gunzip -c "$backup_file" > "$temp_file" 2>/dev/null; then
            # Check integrity
            local integrity=$(sqlite3 "$temp_file" "PRAGMA integrity_check;" 2>/dev/null | head -1)
            
            if [[ "$integrity" == "ok" ]]; then
                ((validated++))
            else
                log "WARN" "Corrupted backup detected: $backup_file"
                ((corrupted++))
                # Optionally remove corrupted backup
                # rm -f "$backup_file"
            fi
        else
            log "WARN" "Failed to decompress backup: $backup_file"
            ((corrupted++))
        fi
        
        # Clean up temp file
        rm -f "$temp_file"
        
    done < <(find "$BACKUP_DIR" -name "crewai_team_*.db.gz" -type f -print0 2>/dev/null || true)
    
    log "INFO" "Backup validation completed. Valid: $validated, Corrupted: $corrupted"
}

# Generate backup report
generate_report() {
    local backup_file="$1"
    local start_time="$2"
    local end_time=$(date '+%s')
    local duration=$((end_time - start_time))
    
    log "INFO" "Generating backup report"
    
    # Get database statistics
    local email_count=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM emails_enhanced;" 2>/dev/null || echo "N/A")
    local chain_count=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM email_chains;" 2>/dev/null || echo "N/A")
    local db_size=$(stat -f%z "$DB_PATH" 2>/dev/null || stat -c%s "$DB_PATH" 2>/dev/null)
    local backup_size=$(stat -f%z "$backup_file" 2>/dev/null || stat -c%s "$backup_file" 2>/dev/null)
    
    # Count total backups
    local total_backups=$(find "$BACKUP_DIR" -name "crewai_team_*.db.gz" -type f | wc -l)
    
    cat << EOF >> "$LOG_FILE"

=== BACKUP REPORT ===
Backup File: $(basename "$backup_file")
Duration: ${duration}s
Database Size: $((db_size / 1024 / 1024))MB
Backup Size: $((backup_size / 1024 / 1024))MB
Compression: $(echo "scale=1; $backup_size * 100 / $db_size" | bc -l 2>/dev/null || echo "N/A")%
Email Count: $email_count
Chain Count: $chain_count
Total Backups: $total_backups
Status: SUCCESS
=====================

EOF

    # Send success notification
    send_alert "BACKUP SUCCESS" "Database backup completed successfully in ${duration}s. Size: $((backup_size / 1024 / 1024))MB"
}

# Main execution
main() {
    local start_time=$(date '+%s')
    
    log "INFO" "Starting CrewAI Team database backup"
    
    # Ensure log directory exists
    mkdir -p "$(dirname "$LOG_FILE")"
    
    # Check prerequisites
    check_prerequisites
    
    # Create backup
    local backup_file
    backup_file=$(create_backup)
    
    # Copy to remote location
    copy_to_remote "$backup_file"
    
    # Clean up old backups
    cleanup_old_backups
    
    # Create monthly archive (first day of month)
    if [[ $(date '+%d') == "01" ]]; then
        create_monthly_archive
    fi
    
    # Validate existing backups (weekly on Sundays)
    if [[ $(date '+%u') == "7" ]]; then
        validate_backups
    fi
    
    # Generate report
    generate_report "$backup_file" "$start_time"
    
    log "INFO" "Database backup completed successfully: $(basename "$backup_file")"
}

# Handle command line arguments
case "${1:-}" in
    --help|-h)
        cat << EOF
CrewAI Team Database Backup Script

Usage:
    $0                 # Run backup
    $0 --validate      # Validate existing backups
    $0 --cleanup       # Clean up old backups only
    $0 --help          # Show this help

Configuration:
    Edit the configuration section at the top of this script to customize:
    - Backup retention periods
    - Remote backup location
    - Email notification settings

Log file: $LOG_FILE
EOF
        exit 0
        ;;
    --validate)
        check_prerequisites
        validate_backups
        exit 0
        ;;
    --cleanup)
        check_prerequisites
        cleanup_old_backups
        exit 0
        ;;
    "")
        main
        ;;
    *)
        echo "Unknown option: $1"
        echo "Use --help for usage information"
        exit 1
        ;;
esac