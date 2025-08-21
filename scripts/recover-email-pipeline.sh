#!/bin/bash

# Email Pipeline Recovery Script
# Purpose: Emergency recovery for critical email pipeline failures and data corruption

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="/home/pricepro2006/CrewAI_Team"
DATA_DIR="$PROJECT_DIR/data"
BACKUP_DIR="$PROJECT_DIR/backups"
LOG_DIR="$PROJECT_DIR/logs"
RECOVERY_LOG="$LOG_DIR/recovery.log"

# Recovery settings
RECOVERY_TIMEOUT=300  # 5 minutes timeout for recovery operations
SERVICE_START_TIMEOUT=60  # 1 minute timeout for service starts
HEALTH_CHECK_TIMEOUT=120  # 2 minutes for health checks

# Create required directories
mkdir -p "$LOG_DIR" "$BACKUP_DIR/emergency"

# Logging function with emergency file backup
log_message() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local log_entry="$timestamp [$level] $message"
    
    echo -e "$log_entry" | tee -a "$RECOVERY_LOG"
    
    # Also log to emergency backup file
    echo "$log_entry" >> "$BACKUP_DIR/emergency/recovery_$(date +%Y%m%d).log" 2>/dev/null || true
}

# Function to display recovery banner
show_recovery_banner() {
    echo -e "${RED}╔══════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║           EMAIL PIPELINE EMERGENCY RECOVERY     ║${NC}"
    echo -e "${RED}║                                                  ║${NC}"
    echo -e "${RED}║  ⚠️  WARNING: This is an emergency recovery tool ║${NC}"
    echo -e "${RED}║     Use only when normal operations have failed  ║${NC}"
    echo -e "${RED}╚══════════════════════════════════════════════════╝${NC}"
    echo
}

# Function to detect failure type
detect_failure_type() {
    log_message "INFO" "Detecting failure type and system state..."
    
    local failure_types=()
    local severity="LOW"
    
    # Check service status
    if ! systemctl is-active --quiet crewai-email-pipeline; then
        failure_types+=("SERVICE_DOWN")
        severity="MEDIUM"
    fi
    
    # Check database integrity
    local databases=("crewai.db" "app.db")
    for db in "${databases[@]}"; do
        local db_path="$DATA_DIR/$db"
        if [ -f "$db_path" ]; then
            if ! sqlite3 "$db_path" "PRAGMA integrity_check;" | grep -q "ok" 2>/dev/null; then
                failure_types+=("DATABASE_CORRUPT")
                severity="HIGH"
            fi
        else
            failure_types+=("DATABASE_MISSING")
            severity="HIGH"
        fi
    done
    
    # Check disk space
    local available_space_mb=$(df "$PROJECT_DIR" | tail -1 | awk '{print int($4/1024)}')
    if [ "$available_space_mb" -lt 100 ]; then
        failure_types+=("DISK_FULL")
        severity="HIGH"
    fi
    
    # Check if processes are consuming too much memory
    local memory_usage=$(ps aux | grep -E "(node|email-pipeline)" | grep -v grep | awk '{sum+=$4} END {print int(sum)}' || echo "0")
    if [ "$memory_usage" -gt 80 ]; then
        failure_types+=("MEMORY_LEAK")
        severity="MEDIUM"
    fi
    
    # Check Redis connectivity
    if ! redis-cli ping >/dev/null 2>&1; then
        failure_types+=("REDIS_DOWN")
        severity="HIGH"
    fi
    
    # Check for corrupted logs
    if [ -f "$LOG_DIR/email-pipeline-error.log" ]; then
        local recent_errors=$(grep -c "ERROR\|FATAL" "$LOG_DIR/email-pipeline-error.log" 2>/dev/null || echo "0")
        if [ "$recent_errors" -gt 50 ]; then
            failure_types+=("HIGH_ERROR_RATE")
            severity="HIGH"
        fi
    fi
    
    # Check API responsiveness
    if ! curl -s -f "http://localhost:3001/api/health" >/dev/null 2>&1; then
        failure_types+=("API_UNRESPONSIVE")
        severity="MEDIUM"
    fi
    
    log_message "INFO" "Failure detection complete - Types: ${failure_types[*]}, Severity: $severity"
    
    # Export results for other functions
    export DETECTED_FAILURES="${failure_types[*]}"
    export FAILURE_SEVERITY="$severity"
    
    return 0
}

# Function to emergency stop all related processes
emergency_stop() {
    log_message "WARN" "Initiating emergency stop of all email pipeline processes..."
    
    # Stop systemd service
    if systemctl is-active --quiet crewai-email-pipeline; then
        log_message "INFO" "Stopping crewai-email-pipeline service..."
        sudo systemctl stop crewai-email-pipeline || true
    fi
    
    # Kill all Node.js processes related to email pipeline
    local node_pids=$(pgrep -f "run-email-pipeline\|email-processor\|EmailQueueProcessor" || true)
    if [ -n "$node_pids" ]; then
        log_message "INFO" "Terminating email pipeline processes..."
        echo "$node_pids" | xargs -r kill -TERM 2>/dev/null || true
        sleep 5
        
        # Force kill if still running
        local remaining_pids=$(pgrep -f "run-email-pipeline\|email-processor\|EmailQueueProcessor" || true)
        if [ -n "$remaining_pids" ]; then
            log_message "WARN" "Force killing remaining processes..."
            echo "$remaining_pids" | xargs -r kill -KILL 2>/dev/null || true
        fi
    fi
    
    # Clean up any stale lock files
    find "$PROJECT_DIR" -name "*.lock" -delete 2>/dev/null || true
    
    log_message "INFO" "Emergency stop completed"
}

# Function to repair corrupted databases
repair_databases() {
    log_message "INFO" "Starting database repair process..."
    
    local databases=("crewai.db" "app.db")
    local repair_success=true
    
    for db in "${databases[@]}"; do
        local db_path="$DATA_DIR/$db"
        
        if [ -f "$db_path" ]; then
            log_message "INFO" "Checking database: $db"
            
            # Create backup before repair
            cp "$db_path" "$db_path.pre_repair.$(date +%Y%m%d_%H%M%S)"
            
            # Check integrity
            if ! sqlite3 "$db_path" "PRAGMA integrity_check;" | grep -q "ok" 2>/dev/null; then
                log_message "WARN" "Database corruption detected in $db, attempting repair..."
                
                # Create a new database and try to recover data
                local temp_db="$db_path.recovery_temp"
                sqlite3 "$temp_db" "VACUUM;" 2>/dev/null || true
                
                # Try to dump and restore
                if sqlite3 "$db_path" ".dump" 2>/dev/null | sqlite3 "$temp_db" 2>/dev/null; then
                    # Verify the recovered database
                    if sqlite3 "$temp_db" "PRAGMA integrity_check;" | grep -q "ok" 2>/dev/null; then
                        mv "$temp_db" "$db_path"
                        log_message "INFO" "Database successfully repaired: $db"
                    else
                        rm -f "$temp_db"
                        log_message "ERROR" "Database repair failed for $db"
                        repair_success=false
                    fi
                else
                    rm -f "$temp_db"
                    log_message "ERROR" "Could not dump/restore database: $db"
                    repair_success=false
                fi
            else
                log_message "INFO" "Database integrity check passed: $db"
            fi
        else
            log_message "WARN" "Database file not found: $db_path"
            
            # Try to restore from most recent backup
            local latest_backup=$(ls -t "$BACKUP_DIR"/databases_*/*.gz 2>/dev/null | grep "$db" | head -1)
            if [ -n "$latest_backup" ]; then
                log_message "INFO" "Restoring missing database from backup: $latest_backup"
                gzip -dc "$latest_backup" > "$db_path"
                
                if sqlite3 "$db_path" "PRAGMA integrity_check;" | grep -q "ok" 2>/dev/null; then
                    log_message "INFO" "Database restored successfully: $db"
                else
                    log_message "ERROR" "Restored database failed integrity check: $db"
                    repair_success=false
                fi
            else
                log_message "ERROR" "No backup found for missing database: $db"
                repair_success=false
            fi
        fi
    done
    
    if [ "$repair_success" = true ]; then
        log_message "INFO" "Database repair process completed successfully"
        return 0
    else
        log_message "ERROR" "Database repair process completed with errors"
        return 1
    fi
}

# Function to clear and rebuild Redis queues
rebuild_redis_queues() {
    log_message "INFO" "Rebuilding Redis queues..."
    
    # Check if Redis is running
    if ! redis-cli ping >/dev/null 2>&1; then
        log_message "WARN" "Redis is not responding, attempting to start..."
        sudo systemctl start redis-server || sudo systemctl start redis || {
            log_message "ERROR" "Could not start Redis service"
            return 1
        }
        
        # Wait for Redis to start
        local timeout=30
        while [ $timeout -gt 0 ] && ! redis-cli ping >/dev/null 2>&1; do
            sleep 1
            ((timeout--))
        done
        
        if ! redis-cli ping >/dev/null 2>&1; then
            log_message "ERROR" "Redis failed to start within timeout"
            return 1
        fi
    fi
    
    # Clear all email processing queues
    local queues=("bull:email-processor:wait" "bull:email-processor:active" "bull:email-processor:completed" "bull:email-processor:failed" "bull:email-processor:stalled")
    
    for queue in "${queues[@]}"; do
        local queue_length=$(redis-cli LLEN "$queue" 2>/dev/null || echo "0")
        if [ "$queue_length" -gt 0 ]; then
            log_message "INFO" "Clearing queue $queue (length: $queue_length)"
            redis-cli DEL "$queue" >/dev/null 2>&1 || true
        fi
    done
    
    # Clear any job-related keys
    redis-cli --scan --pattern "bull:email-processor:*" | xargs -r redis-cli DEL >/dev/null 2>&1 || true
    
    log_message "INFO" "Redis queues rebuilt successfully"
    return 0
}

# Function to clean up temporary files and logs
cleanup_system() {
    log_message "INFO" "Performing system cleanup..."
    
    # Clean up temporary files
    find "$PROJECT_DIR" -name "*.tmp" -delete 2>/dev/null || true
    find "$PROJECT_DIR" -name "*.temp" -delete 2>/dev/null || true
    find "$PROJECT_DIR" -name "core.*" -delete 2>/dev/null || true
    
    # Rotate large log files
    local max_log_size_mb=100
    for log_file in "$LOG_DIR"/*.log; do
        if [ -f "$log_file" ]; then
            local log_size_mb=$(du -m "$log_file" | cut -f1)
            if [ "$log_size_mb" -gt "$max_log_size_mb" ]; then
                log_message "INFO" "Rotating large log file: $(basename $log_file)"
                mv "$log_file" "$log_file.$(date +%Y%m%d_%H%M%S)"
                touch "$log_file"
            fi
        fi
    done
    
    # Clean up old npm cache and node_modules if disk space is low
    local available_space_mb=$(df "$PROJECT_DIR" | tail -1 | awk '{print int($4/1024)}')
    if [ "$available_space_mb" -lt 500 ]; then
        log_message "WARN" "Low disk space detected, performing aggressive cleanup..."
        
        # Clear npm cache
        npm cache clean --force 2>/dev/null || true
        
        # Remove old log files
        find "$LOG_DIR" -name "*.log.*" -mtime +7 -delete 2>/dev/null || true
        
        # Remove old backup files (keep last 5)
        find "$BACKUP_DIR" -name "*_[0-9]*" -type d | sort -r | tail -n +6 | xargs -r rm -rf 2>/dev/null || true
    fi
    
    log_message "INFO" "System cleanup completed"
    return 0
}

# Function to verify and install dependencies
verify_dependencies() {
    log_message "INFO" "Verifying system dependencies..."
    
    # Check Node.js
    if ! command -v node >/dev/null 2>&1; then
        log_message "ERROR" "Node.js not found"
        return 1
    fi
    
    # Check if node_modules exists and is valid
    if [ ! -d "$PROJECT_DIR/node_modules" ] || [ ! -f "$PROJECT_DIR/node_modules/.package-lock.json" ]; then
        log_message "WARN" "Node modules missing or invalid, reinstalling..."
        cd "$PROJECT_DIR"
        npm install --production --no-audit --no-fund 2>&1 | tee -a "$RECOVERY_LOG"
    fi
    
    # Check if TypeScript build exists
    if [ ! -d "$PROJECT_DIR/dist" ]; then
        log_message "WARN" "TypeScript build missing, rebuilding..."
        cd "$PROJECT_DIR"
        npm run build 2>&1 | tee -a "$RECOVERY_LOG"
    fi
    
    log_message "INFO" "Dependencies verification completed"
    return 0
}

# Function to perform safe service restart
safe_service_restart() {
    log_message "INFO" "Performing safe service restart..."
    
    # Ensure service is stopped
    emergency_stop
    
    # Wait a moment for cleanup
    sleep 5
    
    # Start Redis if not running
    if ! redis-cli ping >/dev/null 2>&1; then
        log_message "INFO" "Starting Redis service..."
        sudo systemctl start redis-server || sudo systemctl start redis
    fi
    
    # Start the email pipeline service
    if systemctl is-enabled --quiet crewai-email-pipeline 2>/dev/null; then
        log_message "INFO" "Starting crewai-email-pipeline service..."
        sudo systemctl start crewai-email-pipeline
        
        # Wait for service to start
        local timeout=$SERVICE_START_TIMEOUT
        while [ $timeout -gt 0 ] && ! systemctl is-active --quiet crewai-email-pipeline; do
            sleep 2
            ((timeout -= 2))
        done
        
        if systemctl is-active --quiet crewai-email-pipeline; then
            log_message "INFO" "Email pipeline service started successfully"
        else
            log_message "ERROR" "Failed to start email pipeline service within timeout"
            return 1
        fi
    else
        log_message "ERROR" "Email pipeline service is not enabled"
        return 1
    fi
    
    # Perform health check
    log_message "INFO" "Performing health check..."
    local health_timeout=$HEALTH_CHECK_TIMEOUT
    while [ $health_timeout -gt 0 ]; do
        if curl -s -f "http://localhost:3001/api/health" >/dev/null 2>&1; then
            log_message "INFO" "Health check passed - service is responsive"
            return 0
        fi
        sleep 5
        ((health_timeout -= 5))
    done
    
    log_message "WARN" "Health check timeout - service may still be initializing"
    return 0
}

# Function to perform emergency recovery
emergency_recovery() {
    local recovery_type=${1:-"auto"}
    
    show_recovery_banner
    
    log_message "INFO" "Starting emergency recovery process - type: $recovery_type"
    
    # Detect current failure state
    detect_failure_type
    
    echo -e "${CYAN}Detected Issues:${NC} $DETECTED_FAILURES"
    echo -e "${CYAN}Severity Level:${NC} $FAILURE_SEVERITY"
    echo
    
    # Confirmation for destructive operations
    if [[ " $DETECTED_FAILURES " =~ " DATABASE_CORRUPT " ]] || [[ " $DETECTED_FAILURES " =~ " DATABASE_MISSING " ]]; then
        if [ "$recovery_type" != "auto" ]; then
            echo -e "${RED}WARNING: Database issues detected. Recovery may result in data loss.${NC}"
            read -p "Continue with recovery? (yes/no): " confirm
            if [ "$confirm" != "yes" ]; then
                log_message "INFO" "Recovery cancelled by user"
                return 0
            fi
        fi
    fi
    
    # Create emergency backup
    log_message "INFO" "Creating emergency backup before recovery..."
    local emergency_backup_dir="$BACKUP_DIR/emergency/emergency_$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$emergency_backup_dir"
    
    # Backup current state
    cp -r "$DATA_DIR" "$emergency_backup_dir/" 2>/dev/null || true
    cp "$PROJECT_DIR/.env" "$emergency_backup_dir/" 2>/dev/null || true
    
    # Execute recovery steps based on detected issues
    local recovery_success=true
    
    # Step 1: Emergency stop
    emergency_stop || recovery_success=false
    
    # Step 2: System cleanup
    cleanup_system || recovery_success=false
    
    # Step 3: Database repair
    if [[ " $DETECTED_FAILURES " =~ " DATABASE_CORRUPT " ]] || [[ " $DETECTED_FAILURES " =~ " DATABASE_MISSING " ]]; then
        repair_databases || recovery_success=false
    fi
    
    # Step 4: Redis queue rebuild
    if [[ " $DETECTED_FAILURES " =~ " REDIS_DOWN " ]] || [ "$FAILURE_SEVERITY" = "HIGH" ]; then
        rebuild_redis_queues || recovery_success=false
    fi
    
    # Step 5: Dependency verification
    verify_dependencies || recovery_success=false
    
    # Step 6: Safe service restart
    safe_service_restart || recovery_success=false
    
    # Final verification
    log_message "INFO" "Performing final system verification..."
    detect_failure_type
    
    if [ "$recovery_success" = true ] && [ -z "$DETECTED_FAILURES" ]; then
        log_message "INFO" "Emergency recovery completed successfully"
        echo -e "${GREEN}✓ Emergency recovery completed successfully${NC}"
        echo -e "Emergency backup: ${YELLOW}$emergency_backup_dir${NC}"
        echo -e "Recovery log: ${YELLOW}$RECOVERY_LOG${NC}"
        return 0
    else
        log_message "ERROR" "Emergency recovery completed with issues"
        echo -e "${RED}✗ Emergency recovery completed with issues${NC}"
        echo -e "Remaining issues: ${YELLOW}$DETECTED_FAILURES${NC}"
        echo -e "Emergency backup: ${YELLOW}$emergency_backup_dir${NC}"
        echo -e "Recovery log: ${YELLOW}$RECOVERY_LOG${NC}"
        return 1
    fi
}

# Function to create disaster recovery package
create_disaster_recovery_package() {
    log_message "INFO" "Creating disaster recovery package..."
    
    local dr_package="$BACKUP_DIR/disaster_recovery_$(date +%Y%m%d_%H%M%S).tar.gz"
    local temp_dir=$(mktemp -d)
    
    # Collect all critical files
    mkdir -p "$temp_dir/crewai_disaster_recovery"
    
    # Copy databases
    cp -r "$DATA_DIR" "$temp_dir/crewai_disaster_recovery/" 2>/dev/null || true
    
    # Copy configuration
    cp "$PROJECT_DIR/.env" "$temp_dir/crewai_disaster_recovery/" 2>/dev/null || true
    cp "$PROJECT_DIR/package.json" "$temp_dir/crewai_disaster_recovery/" 2>/dev/null || true
    cp "$PROJECT_DIR/tsconfig.json" "$temp_dir/crewai_disaster_recovery/" 2>/dev/null || true
    
    # Copy critical source files
    cp -r "$PROJECT_DIR/src/config" "$temp_dir/crewai_disaster_recovery/" 2>/dev/null || true
    
    # Copy scripts
    cp -r "$PROJECT_DIR/scripts" "$temp_dir/crewai_disaster_recovery/" 2>/dev/null || true
    
    # Copy logs
    cp -r "$LOG_DIR" "$temp_dir/crewai_disaster_recovery/" 2>/dev/null || true
    
    # Create system information file
    {
        echo "CrewAI Email Pipeline Disaster Recovery Package"
        echo "Created: $(date)"
        echo "=============================================="
        echo
        echo "System Information:"
        echo "Node.js Version: $(node --version 2>/dev/null || echo 'Not found')"
        echo "NPM Version: $(npm --version 2>/dev/null || echo 'Not found')"
        echo "OS: $(uname -a)"
        echo
        echo "Service Status at Time of Creation:"
        systemctl status crewai-email-pipeline --no-pager 2>/dev/null || echo "Service not found"
        echo
        echo "Environment Variables:"
        env | grep -E "(NODE_ENV|DATABASE_PATH|REDIS_URL)" | sort
        
    } > "$temp_dir/crewai_disaster_recovery/RECOVERY_INFO.txt"
    
    # Create recovery instructions
    cat > "$temp_dir/crewai_disaster_recovery/RECOVERY_INSTRUCTIONS.md" << 'EOF'
# CrewAI Email Pipeline Disaster Recovery Instructions

## Prerequisites
1. Node.js 20.11+ installed
2. Redis server installed and running
3. Proper permissions for the target directory

## Recovery Steps

### 1. Stop Current Services (if any)
```bash
sudo systemctl stop crewai-email-pipeline || true
pkill -f "run-email-pipeline" || true
```

### 2. Restore Files
```bash
# Extract this package to your project directory
tar -xzf disaster_recovery_YYYYMMDD_HHMMSS.tar.gz
cd crewai_disaster_recovery

# Copy data files
cp -r data /path/to/crewai_team/
cp .env /path/to/crewai_team/
cp *.json /path/to/crewai_team/

# Copy configuration
cp -r config /path/to/crewai_team/src/
```

### 3. Install Dependencies
```bash
cd /path/to/crewai_team
npm install
npm run build
```

### 4. Start Services
```bash
# Run the recovery script if available
./scripts/recover-email-pipeline.sh emergency

# Or manually start the service
sudo systemctl start crewai-email-pipeline
```

### 5. Verify Recovery
```bash
curl http://localhost:3001/api/health
./scripts/monitor-email-pipeline.sh status
```

## Troubleshooting
- Check logs in the logs/ directory
- Verify database integrity: `sqlite3 data/crewai.db "PRAGMA integrity_check;"`
- Ensure Redis is running: `redis-cli ping`
- Check service status: `sudo systemctl status crewai-email-pipeline`

## Contact
For additional support, check the recovery log and system documentation.
EOF
    
    # Create the package
    tar -czf "$dr_package" -C "$temp_dir" crewai_disaster_recovery
    
    # Cleanup
    rm -rf "$temp_dir"
    
    echo -e "${GREEN}✓ Disaster recovery package created${NC}"
    echo -e "Package: ${YELLOW}$dr_package${NC}"
    log_message "INFO" "Disaster recovery package created: $dr_package"
}

# Function to show system health report
show_health_report() {
    echo -e "${BLUE}System Health Report${NC}"
    echo "===================="
    
    # Service status
    echo -e "\n${CYAN}Service Status:${NC}"
    if systemctl is-active --quiet crewai-email-pipeline; then
        echo -e "Email Pipeline: ${GREEN}RUNNING${NC}"
        local uptime=$(systemctl show crewai-email-pipeline --property=ActiveEnterTimestamp | cut -d'=' -f2)
        echo "Started: $uptime"
    else
        echo -e "Email Pipeline: ${RED}STOPPED${NC}"
    fi
    
    # Database status
    echo -e "\n${CYAN}Database Status:${NC}"
    local databases=("crewai.db" "app.db")
    for db in "${databases[@]}"; do
        local db_path="$DATA_DIR/$db"
        if [ -f "$db_path" ]; then
            if sqlite3 "$db_path" "PRAGMA integrity_check;" | grep -q "ok" 2>/dev/null; then
                echo -e "$db: ${GREEN}OK${NC}"
            else
                echo -e "$db: ${RED}CORRUPT${NC}"
            fi
        else
            echo -e "$db: ${RED}MISSING${NC}"
        fi
    done
    
    # Redis status
    echo -e "\n${CYAN}Redis Status:${NC}"
    if redis-cli ping >/dev/null 2>&1; then
        echo -e "Redis: ${GREEN}RUNNING${NC}"
        local queue_size=$(redis-cli LLEN "bull:email-processor:wait" 2>/dev/null || echo "0")
        echo "Queue size: $queue_size"
    else
        echo -e "Redis: ${RED}DOWN${NC}"
    fi
    
    # System resources
    echo -e "\n${CYAN}System Resources:${NC}"
    local mem_usage=$(free | grep Mem | awk '{printf "%.1f", $3/$2 * 100.0}')
    local disk_usage=$(df "$PROJECT_DIR" | tail -1 | awk '{print $5}')
    echo "Memory usage: ${mem_usage}%"
    echo "Disk usage: $disk_usage"
    
    # Recent errors
    echo -e "\n${CYAN}Recent Issues:${NC}"
    if [ -f "$LOG_DIR/email-pipeline-error.log" ]; then
        local error_count=$(grep -c "ERROR\|FATAL" "$LOG_DIR/email-pipeline-error.log" 2>/dev/null || echo "0")
        echo "Recent errors: $error_count"
    else
        echo "No error log found"
    fi
}

# Main function
main() {
    case "${1:-help}" in
        emergency)
            emergency_recovery "manual"
            ;;
        auto-recovery)
            emergency_recovery "auto"
            ;;
        health)
            show_health_report
            ;;
        disaster-package)
            create_disaster_recovery_package
            ;;
        repair-db)
            emergency_stop
            repair_databases
            safe_service_restart
            ;;
        clean-system)
            emergency_stop
            cleanup_system
            rebuild_redis_queues
            safe_service_restart
            ;;
        help|*)
            echo "Usage: $0 {emergency|auto-recovery|health|disaster-package|repair-db|clean-system}"
            echo
            echo "  emergency        - Interactive emergency recovery with confirmations"
            echo "  auto-recovery    - Automated recovery without confirmations"
            echo "  health           - Show system health report"
            echo "  disaster-package - Create disaster recovery package"
            echo "  repair-db        - Repair corrupted databases only"
            echo "  clean-system     - Clean system and rebuild queues"
            echo
            echo "Emergency Recovery Features:"
            echo "  • Automatic failure detection and severity assessment"
            echo "  • Database corruption repair and restoration"
            echo "  • Redis queue cleanup and rebuilding"
            echo "  • System cleanup and dependency verification"
            echo "  • Safe service restart with health checks"
            echo "  • Emergency backup creation before recovery"
            echo "  • Comprehensive logging and reporting"
            echo
            echo "⚠️  WARNING: Use emergency recovery only when normal operations fail"
            echo "   Always ensure you have recent backups before running recovery"
            exit 1
            ;;
    esac
}

# Handle script termination
trap 'log_message "INFO" "Recovery script interrupted"; exit 1' INT TERM

# Run main function
main "$@"