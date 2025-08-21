#!/bin/bash

# Grocery Database Management Tools
# Provides easy access to backup, monitoring, and administration scripts

set -e  # Exit on any error

# Configuration
DB_PATH="${DB_PATH:-/home/pricepro2006/CrewAI_Team/data/crewai_enhanced.db}"
BACKUP_DIR="${BACKUP_DIR:-/home/pricepro2006/CrewAI_Team/data/backups}"
LOG_DIR="${LOG_DIR:-/home/pricepro2006/CrewAI_Team/logs}"
SCRIPTS_DIR="/home/pricepro2006/CrewAI_Team/src/database/scripts"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    if ! command -v node &> /dev/null; then
        error "Node.js is not installed or not in PATH"
        exit 1
    fi
    
    if [ ! -f "$DB_PATH" ]; then
        error "Database file not found: $DB_PATH"
        exit 1
    fi
    
    # Create directories if they don't exist
    mkdir -p "$BACKUP_DIR" "$LOG_DIR"
    
    # Check if scripts exist
    local scripts=("groceryDatabaseBackup.ts" "groceryDatabaseMonitor.ts" "groceryDatabaseAdmin.ts")
    for script in "${scripts[@]}"; do
        if [ ! -f "$SCRIPTS_DIR/$script" ]; then
            error "Script not found: $SCRIPTS_DIR/$script"
            exit 1
        fi
    done
}

# Backup operations
backup_create() {
    log "Creating database backup..."
    local options=""
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --compress)
                options="$options --compress"
                shift
                ;;
            --encrypt)
                options="$options --encrypt"
                shift
                ;;
            --s3)
                options="$options --s3"
                shift
                ;;
            *)
                break
                ;;
        esac
    done
    
    cd "$(dirname "$SCRIPTS_DIR")"
    npx ts-node "$SCRIPTS_DIR/groceryDatabaseBackup.ts" backup $options
    
    if [ $? -eq 0 ]; then
        log "Backup created successfully"
    else
        error "Backup creation failed"
        exit 1
    fi
}

backup_restore() {
    if [ $# -lt 2 ]; then
        error "Usage: restore <backup-path> <target-path>"
        exit 1
    fi
    
    local backup_path="$1"
    local target_path="$2"
    shift 2
    
    local options=""
    while [[ $# -gt 0 ]]; do
        case $1 in
            --verify)
                options="$options --verify"
                shift
                ;;
            --pre-backup)
                options="$options --pre-backup"
                shift
                ;;
            --test)
                options="$options --test"
                shift
                ;;
            *)
                break
                ;;
        esac
    done
    
    warning "This will restore the database. Current data may be overwritten."
    read -p "Are you sure you want to continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        info "Restore cancelled"
        exit 0
    fi
    
    cd "$(dirname "$SCRIPTS_DIR")"
    npx ts-node "$SCRIPTS_DIR/groceryDatabaseBackup.ts" restore "$backup_path" "$target_path" $options
    
    if [ $? -eq 0 ]; then
        log "Database restored successfully"
    else
        error "Database restore failed"
        exit 1
    fi
}

backup_cleanup() {
    log "Cleaning up old backups..."
    cd "$(dirname "$SCRIPTS_DIR")"
    npx ts-node "$SCRIPTS_DIR/groceryDatabaseBackup.ts" cleanup
    
    if [ $? -eq 0 ]; then
        log "Backup cleanup completed"
    else
        error "Backup cleanup failed"
        exit 1
    fi
}

# Monitoring operations
monitor_start() {
    local interval=${1:-60}
    log "Starting database monitoring (interval: ${interval}s)..."
    
    cd "$(dirname "$SCRIPTS_DIR")"
    npx ts-node "$SCRIPTS_DIR/groceryDatabaseMonitor.ts" start $interval
}

monitor_health() {
    log "Checking database health..."
    cd "$(dirname "$SCRIPTS_DIR")"
    npx ts-node "$SCRIPTS_DIR/groceryDatabaseMonitor.ts" health
}

monitor_report() {
    local hours=${1:-24}
    local output_file="$LOG_DIR/monitor_report_$(date +%Y%m%d_%H%M%S).md"
    
    if [ -n "$2" ]; then
        output_file="$2"
    fi
    
    log "Generating monitoring report for last $hours hours..."
    cd "$(dirname "$SCRIPTS_DIR")"
    npx ts-node "$SCRIPTS_DIR/groceryDatabaseMonitor.ts" report $hours "$output_file"
    
    if [ $? -eq 0 ]; then
        log "Report generated: $output_file"
    else
        error "Report generation failed"
        exit 1
    fi
}

# Administration operations
admin_maintenance() {
    log "Performing database maintenance..."
    local options=""
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --no-vacuum|--no-analyze|--no-checkpoint|--no-integrity|--reindex|--optimize)
                options="$options $1"
                shift
                ;;
            *)
                break
                ;;
        esac
    done
    
    cd "$(dirname "$SCRIPTS_DIR")"
    npx ts-node "$SCRIPTS_DIR/groceryDatabaseAdmin.ts" maintenance $options
    
    if [ $? -eq 0 ]; then
        log "Database maintenance completed"
    else
        error "Database maintenance failed"
        exit 1
    fi
}

admin_create_user() {
    if [ $# -lt 4 ]; then
        error "Usage: create-user <username> <email> <password> <role>"
        exit 1
    fi
    
    cd "$(dirname "$SCRIPTS_DIR")"
    npx ts-node "$SCRIPTS_DIR/groceryDatabaseAdmin.ts" create-user "$1" "$2" "$3" "$4"
}

admin_list_users() {
    cd "$(dirname "$SCRIPTS_DIR")"
    npx ts-node "$SCRIPTS_DIR/groceryDatabaseAdmin.ts" list-users
}

admin_report() {
    local output_file="$LOG_DIR/admin_report_$(date +%Y%m%d_%H%M%S).md"
    
    if [ -n "$1" ]; then
        output_file="$1"
    fi
    
    log "Generating administration report..."
    cd "$(dirname "$SCRIPTS_DIR")"
    npx ts-node "$SCRIPTS_DIR/groceryDatabaseAdmin.ts" report "$output_file"
    
    if [ $? -eq 0 ]; then
        log "Report generated: $output_file"
    else
        error "Report generation failed"
        exit 1
    fi
}

# Migration operations
migrate_run() {
    log "Running database migrations..."
    cd "$(dirname "$SCRIPTS_DIR")"
    npx ts-node src/database/scripts/runMigrations.ts
    
    if [ $? -eq 0 ]; then
        log "Migrations completed successfully"
    else
        error "Migration failed"
        exit 1
    fi
}

# Automated maintenance schedule
schedule_maintenance() {
    local cron_file="/tmp/grocery_db_maintenance.cron"
    
    cat > "$cron_file" << EOF
# Grocery Database Maintenance Schedule
# Backup every 6 hours
0 */6 * * * $0 backup --compress
# Cleanup old backups daily
0 2 * * * $0 backup-cleanup
# Full maintenance weekly (Sunday 3 AM)
0 3 * * 0 $0 maintenance --optimize --reindex
# Health check every hour
0 * * * * $0 monitor-health >> $LOG_DIR/health_check.log 2>&1
# Generate daily reports
0 1 * * * $0 monitor-report 24
# Generate weekly admin reports
0 1 * * 1 $0 admin-report
EOF
    
    if command -v crontab &> /dev/null; then
        crontab "$cron_file"
        log "Maintenance schedule installed in crontab"
    else
        warning "crontab not available. Manual scheduling required."
        info "Suggested cron entries saved to: $cron_file"
    fi
    
    rm -f "$cron_file"
}

# Emergency procedures
emergency_backup() {
    log "Creating emergency backup..."
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local emergency_backup="$BACKUP_DIR/emergency_backup_$timestamp.db"
    
    backup_create --compress
    
    # Also create a simple copy
    cp "$DB_PATH" "$emergency_backup"
    
    log "Emergency backup created: $emergency_backup"
}

disaster_recovery() {
    error "DISASTER RECOVERY PROCEDURE"
    warning "This should only be used in emergency situations"
    
    read -p "Has the primary database been completely corrupted? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        info "Disaster recovery cancelled"
        exit 0
    fi
    
    # Find latest backup
    local latest_backup=$(ls -t "$BACKUP_DIR"/grocery_backup_*.db* 2>/dev/null | head -1)
    
    if [ -z "$latest_backup" ]; then
        error "No backups found in $BACKUP_DIR"
        exit 1
    fi
    
    log "Latest backup found: $latest_backup"
    
    # Create recovery directory
    local recovery_dir="$BACKUP_DIR/recovery_$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$recovery_dir"
    
    # Backup current (corrupted) database
    if [ -f "$DB_PATH" ]; then
        mv "$DB_PATH" "$recovery_dir/corrupted_database.db"
        log "Corrupted database moved to: $recovery_dir/corrupted_database.db"
    fi
    
    # Restore from backup
    backup_restore "$latest_backup" "$DB_PATH" --verify --pre-backup
    
    # Test restored database
    if admin_maintenance --no-vacuum --no-analyze --no-reindex --no-optimize; then
        log "Database successfully restored and tested"
        log "Recovery files saved in: $recovery_dir"
    else
        error "Database restoration failed"
        exit 1
    fi
}

# Display usage information
show_usage() {
    cat << EOF
Grocery Database Management Tools

Usage: $0 <command> [options]

BACKUP OPERATIONS:
  backup [--compress] [--encrypt] [--s3]  Create database backup
  restore <backup-path> <target-path>     Restore database from backup
    [--verify] [--pre-backup] [--test]
  backup-cleanup                          Remove old backups

MONITORING OPERATIONS:
  monitor-start [interval]                Start monitoring (default: 60s)
  monitor-health                          Check database health
  monitor-report [hours] [output-file]    Generate monitoring report

ADMINISTRATION:
  maintenance [options]                   Perform database maintenance
    --no-vacuum     Skip VACUUM operation
    --no-analyze    Skip ANALYZE operation  
    --reindex       Include REINDEX operation
    --no-checkpoint Skip WAL checkpoint
    --no-integrity  Skip integrity check
    --optimize      Include optimization
  create-user <username> <email> <password> <role>  Create database user
  list-users                              List all users
  admin-report [output-file]              Generate admin report

MIGRATION:
  migrate                                 Run pending migrations

AUTOMATION:
  schedule                                Install maintenance cron jobs

EMERGENCY:
  emergency-backup                        Create emergency backup
  disaster-recovery                       Emergency database recovery

ENVIRONMENT VARIABLES:
  DB_PATH      - Database file path (default: $DB_PATH)
  BACKUP_DIR   - Backup directory (default: $BACKUP_DIR)
  LOG_DIR      - Log directory (default: $LOG_DIR)

EXAMPLES:
  $0 backup --compress
  $0 monitor-start 30
  $0 maintenance --optimize
  $0 restore /path/to/backup.db /path/to/target.db --verify
  $0 create-user admin admin@example.com password123 admin

EOF
}

# Main script logic
main() {
    if [ $# -eq 0 ]; then
        show_usage
        exit 1
    fi
    
    # Check prerequisites before running commands
    check_prerequisites
    
    case "$1" in
        backup)
            shift
            backup_create "$@"
            ;;
        restore)
            shift
            backup_restore "$@"
            ;;
        backup-cleanup)
            backup_cleanup
            ;;
        monitor-start)
            shift
            monitor_start "$@"
            ;;
        monitor-health)
            monitor_health
            ;;
        monitor-report)
            shift
            monitor_report "$@"
            ;;
        maintenance)
            shift
            admin_maintenance "$@"
            ;;
        create-user)
            shift
            admin_create_user "$@"
            ;;
        list-users)
            admin_list_users
            ;;
        admin-report)
            shift
            admin_report "$@"
            ;;
        migrate)
            migrate_run
            ;;
        schedule)
            schedule_maintenance
            ;;
        emergency-backup)
            emergency_backup
            ;;
        disaster-recovery)
            disaster_recovery
            ;;
        help|--help|-h)
            show_usage
            ;;
        *)
            error "Unknown command: $1"
            echo
            show_usage
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"