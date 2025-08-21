#!/bin/bash

# CrewAI Team - Llama.cpp Monitoring and Health Check Script
# Provides comprehensive monitoring, alerting, and auto-recovery

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_DIR="${PROJECT_ROOT}/logs"
METRICS_FILE="${LOG_DIR}/llama-metrics.json"
ALERT_LOG="${LOG_DIR}/alerts.log"
HEALTH_LOG="${LOG_DIR}/health-check.log"

# Health check configuration
LLAMA_URL="${LLAMA_SERVER_URL:-http://localhost:8081}"
CHECK_INTERVAL="${MONITOR_INTERVAL:-30}"
RESTART_THRESHOLD="${RESTART_THRESHOLD:-3}"
MEMORY_THRESHOLD_GB="${MEMORY_THRESHOLD:-12}"
CPU_THRESHOLD_PERCENT="${CPU_THRESHOLD:-90}"

# Alert configuration
ALERT_EMAIL="${ALERT_EMAIL:-}"
WEBHOOK_URL="${MONITOR_WEBHOOK_URL:-}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging function
log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case $level in
        "INFO")
            echo -e "${GREEN}[INFO]${NC} $message"
            ;;
        "WARN")
            echo -e "${YELLOW}[WARN]${NC} $message"
            ;;
        "ERROR")
            echo -e "${RED}[ERROR]${NC} $message"
            ;;
        "DEBUG")
            echo -e "${BLUE}[DEBUG]${NC} $message"
            ;;
    esac
    
    echo "[$timestamp] [$level] $message" >> "$HEALTH_LOG"
}

# Alert function
send_alert() {
    local severity=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    # Log alert
    echo "[$timestamp] [$severity] $message" >> "$ALERT_LOG"
    log "$severity" "ALERT: $message"
    
    # Send email if configured
    if [[ -n "$ALERT_EMAIL" ]] && command -v mail &> /dev/null; then
        echo "$message" | mail -s "CrewAI Llama.cpp Alert [$severity]" "$ALERT_EMAIL"
    fi
    
    # Send webhook if configured
    if [[ -n "$WEBHOOK_URL" ]] && command -v curl &> /dev/null; then
        curl -X POST "$WEBHOOK_URL" \
            -H "Content-Type: application/json" \
            -d "{\"severity\":\"$severity\",\"message\":\"$message\",\"timestamp\":\"$timestamp\",\"service\":\"llama-cpp\"}" \
            2>/dev/null || true
    fi
}

# Function to check if llama-server is running
is_server_running() {
    if pgrep -f "llama-server" > /dev/null; then
        return 0
    fi
    return 1
}

# Function to get server PID
get_server_pid() {
    pgrep -f "llama-server" | head -1
}

# Function to check server health via HTTP
check_http_health() {
    local response
    local http_code
    
    response=$(curl -s -w "HTTPSTATUS:%{http_code}" "$LLAMA_URL/health" 2>/dev/null) || return 1
    http_code=$(echo "$response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    
    if [[ "$http_code" == "200" ]]; then
        return 0
    fi
    
    return 1
}

# Function to get server metrics
get_server_metrics() {
    local pid=$(get_server_pid)
    local timestamp=$(date '+%s')
    local metrics="{}"
    
    if [[ -n "$pid" ]]; then
        # Get process metrics
        local ps_output
        ps_output=$(ps -p "$pid" -o pid,vsz,rss,pcpu,pmem,etime --no-headers 2>/dev/null) || return 1
        
        read -r pid_val vsz_kb rss_kb cpu_percent mem_percent etime <<< "$ps_output"
        
        # Convert to more readable units
        local mem_gb=$(echo "scale=2; $rss_kb / 1024 / 1024" | bc 2>/dev/null || echo "0")
        local vmem_gb=$(echo "scale=2; $vsz_kb / 1024 / 1024" | bc 2>/dev/null || echo "0")
        
        # Get HTTP metrics if available
        local http_metrics=""
        if command -v curl &> /dev/null; then
            http_metrics=$(curl -s "$LLAMA_URL/metrics" 2>/dev/null || echo "{}")
        fi
        
        # Build JSON metrics
        metrics=$(cat <<EOF
{
  "timestamp": $timestamp,
  "datetime": "$(date '+%Y-%m-%d %H:%M:%S')",
  "process": {
    "pid": $pid_val,
    "memory_gb": $mem_gb,
    "virtual_memory_gb": $vmem_gb,
    "cpu_percent": $cpu_percent,
    "memory_percent": $mem_percent,
    "uptime": "$etime"
  },
  "http_status": $(check_http_health && echo "\"healthy\"" || echo "\"unhealthy\""),
  "server_metrics": $http_metrics
}
EOF
        )
    else
        metrics="{\"timestamp\": $timestamp, \"datetime\": \"$(date '+%Y-%m-%d %H:%M:%S')\", \"status\": \"not_running\"}"
    fi
    
    echo "$metrics"
}

# Function to save metrics to file
save_metrics() {
    local metrics="$1"
    local temp_file="${METRICS_FILE}.tmp"
    
    # Initialize metrics file if it doesn't exist
    if [[ ! -f "$METRICS_FILE" ]]; then
        echo "[]" > "$METRICS_FILE"
    fi
    
    # Add new metrics to array (keep last 100 entries)
    jq --argjson new_metric "$metrics" '. + [$new_metric] | if length > 100 then .[1:] else . end' "$METRICS_FILE" > "$temp_file" 2>/dev/null && mv "$temp_file" "$METRICS_FILE" || {
        # Fallback if jq is not available
        echo "$metrics" >> "${METRICS_FILE}.raw"
    }
}

# Function to analyze metrics for issues
analyze_metrics() {
    local metrics="$1"
    
    if ! command -v jq &> /dev/null; then
        log "DEBUG" "jq not available, skipping detailed metrics analysis"
        return 0
    fi
    
    # Extract values
    local status=$(echo "$metrics" | jq -r '.status // "unknown"')
    local memory_gb=$(echo "$metrics" | jq -r '.process.memory_gb // 0')
    local cpu_percent=$(echo "$metrics" | jq -r '.process.cpu_percent // 0')
    local http_status=$(echo "$metrics" | jq -r '.http_status // "unknown"')
    
    # Check for issues
    if [[ "$status" == "not_running" ]]; then
        send_alert "ERROR" "Llama-server process is not running"
        return 1
    fi
    
    if [[ "$http_status" == "unhealthy" ]]; then
        send_alert "WARN" "Llama-server HTTP health check failed"
    fi
    
    # Memory check
    if (( $(echo "$memory_gb > $MEMORY_THRESHOLD_GB" | bc -l) )); then
        send_alert "WARN" "High memory usage: ${memory_gb}GB (threshold: ${MEMORY_THRESHOLD_GB}GB)"
    fi
    
    # CPU check
    if (( $(echo "$cpu_percent > $CPU_THRESHOLD_PERCENT" | bc -l) )); then
        send_alert "WARN" "High CPU usage: ${cpu_percent}% (threshold: ${CPU_THRESHOLD_PERCENT}%)"
    fi
    
    return 0
}

# Function to restart server
restart_server() {
    log "INFO" "Attempting to restart llama-server..."
    send_alert "INFO" "Restarting llama-server due to health check failure"
    
    # Try to stop gracefully first
    "${PROJECT_ROOT}/scripts/start-llama-server.sh" stop 2>/dev/null || true
    sleep 5
    
    # Force kill if still running
    if is_server_running; then
        local pid=$(get_server_pid)
        log "WARN" "Force killing llama-server (PID: $pid)"
        kill -9 "$pid" 2>/dev/null || true
        sleep 2
    fi
    
    # Start server
    "${PROJECT_ROOT}/scripts/start-llama-server.sh" start
    
    # Wait for startup
    local attempts=0
    local max_attempts=30
    
    while [[ $attempts -lt $max_attempts ]]; do
        if check_http_health; then
            log "INFO" "Server restarted successfully"
            send_alert "INFO" "Llama-server restarted successfully"
            return 0
        fi
        
        sleep 2
        ((attempts++))
    done
    
    log "ERROR" "Failed to restart server after $max_attempts attempts"
    send_alert "ERROR" "Failed to restart llama-server after multiple attempts"
    return 1
}

# Function to run single health check
run_health_check() {
    log "DEBUG" "Running health check..."
    
    # Create log directory
    mkdir -p "$LOG_DIR"
    
    # Get current metrics
    local metrics
    metrics=$(get_server_metrics)
    
    if [[ -z "$metrics" || "$metrics" == "{}" ]]; then
        log "ERROR" "Failed to get server metrics"
        return 1
    fi
    
    # Save metrics
    save_metrics "$metrics"
    
    # Analyze for issues
    if ! analyze_metrics "$metrics"; then
        return 1
    fi
    
    log "DEBUG" "Health check completed"
    return 0
}

# Function to run continuous monitoring
run_monitor() {
    log "INFO" "Starting continuous monitoring (interval: ${CHECK_INTERVAL}s)"
    log "INFO" "Monitoring URL: $LLAMA_URL"
    log "INFO" "Memory threshold: ${MEMORY_THRESHOLD_GB}GB"
    log "INFO" "CPU threshold: ${CPU_THRESHOLD_PERCENT}%"
    
    local consecutive_failures=0
    
    while true; do
        if run_health_check; then
            consecutive_failures=0
        else
            ((consecutive_failures++))
            log "WARN" "Health check failed (consecutive failures: $consecutive_failures)"
            
            # Restart if threshold reached
            if [[ $consecutive_failures -ge $RESTART_THRESHOLD ]]; then
                log "ERROR" "Restart threshold reached ($consecutive_failures failures)"
                
                if restart_server; then
                    consecutive_failures=0
                else
                    send_alert "ERROR" "Auto-restart failed after $consecutive_failures consecutive failures"
                fi
            fi
        fi
        
        sleep "$CHECK_INTERVAL"
    done
}

# Function to show current status
show_status() {
    echo "Llama.cpp Server Status Report"
    echo "=============================="
    
    # Basic status
    if is_server_running; then
        local pid=$(get_server_pid)
        echo -e "Status: ${GREEN}RUNNING${NC} (PID: $pid)"
    else
        echo -e "Status: ${RED}NOT RUNNING${NC}"
        return 1
    fi
    
    # HTTP health
    if check_http_health; then
        echo -e "HTTP Health: ${GREEN}OK${NC}"
    else
        echo -e "HTTP Health: ${RED}FAILED${NC}"
    fi
    
    # Get and display current metrics
    local metrics
    metrics=$(get_server_metrics)
    
    if command -v jq &> /dev/null && [[ -n "$metrics" ]]; then
        echo ""
        echo "Current Metrics:"
        echo "  Memory: $(echo "$metrics" | jq -r '.process.memory_gb // "N/A"')GB"
        echo "  CPU: $(echo "$metrics" | jq -r '.process.cpu_percent // "N/A"')%"
        echo "  Uptime: $(echo "$metrics" | jq -r '.process.uptime // "N/A"')"
        echo "  Last Check: $(echo "$metrics" | jq -r '.datetime // "N/A"')"
    fi
    
    # Show recent alerts
    if [[ -f "$ALERT_LOG" ]]; then
        echo ""
        echo "Recent Alerts (last 5):"
        tail -5 "$ALERT_LOG" 2>/dev/null || echo "  No recent alerts"
    fi
}

# Function to show metrics
show_metrics() {
    if [[ ! -f "$METRICS_FILE" ]]; then
        log "WARN" "No metrics file found. Run monitoring first."
        return 1
    fi
    
    if command -v jq &> /dev/null; then
        echo "Llama.cpp Server Metrics (last 10):"
        echo "===================================="
        jq -r '.[-10:] | .[] | "\(.datetime) | Memory: \(.process.memory_gb)GB | CPU: \(.process.cpu_percent)% | Status: \(.http_status)"' "$METRICS_FILE"
    else
        echo "Metrics file: $METRICS_FILE"
        echo "Install jq for formatted output"
    fi
}

# Main function
main() {
    case "${1:-status}" in
        "monitor")
            trap 'log "INFO" "Stopping monitor"; exit 0' SIGINT SIGTERM
            run_monitor
            ;;
        "check")
            run_health_check
            ;;
        "status")
            show_status
            ;;
        "metrics")
            show_metrics
            ;;
        "restart")
            restart_server
            ;;
        "help"|"--help"|"-h")
            echo "CrewAI Team Llama.cpp Monitoring Script"
            echo ""
            echo "Usage: $0 [command]"
            echo ""
            echo "Commands:"
            echo "  monitor    Start continuous monitoring with auto-restart"
            echo "  check      Run single health check"
            echo "  status     Show current server status"
            echo "  metrics    Show historical metrics"
            echo "  restart    Manually restart the server"
            echo "  help       Show this help"
            echo ""
            echo "Environment Variables:"
            echo "  LLAMA_SERVER_URL        Server URL (default: http://localhost:8081)"
            echo "  MONITOR_INTERVAL        Check interval in seconds (default: 30)"
            echo "  RESTART_THRESHOLD       Failures before restart (default: 3)"
            echo "  MEMORY_THRESHOLD        Memory alert threshold in GB (default: 12)"
            echo "  CPU_THRESHOLD           CPU alert threshold in % (default: 90)"
            echo "  ALERT_EMAIL             Email for alerts"
            echo "  MONITOR_WEBHOOK_URL     Webhook for alerts"
            ;;
        *)
            log "ERROR" "Unknown command: $1"
            echo "Use '$0 help' for usage information"
            exit 1
            ;;
    esac
}

# Run main function
main "$@"