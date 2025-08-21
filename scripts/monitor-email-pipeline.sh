#!/bin/bash

# Email Pipeline Monitoring Script
# Purpose: Monitor the health and performance of the email processing pipeline

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="/home/pricepro2006/CrewAI_Team"
LOG_DIR="$PROJECT_DIR/logs"
METRICS_URL="http://localhost:3001/metrics"
API_HEALTH_URL="http://localhost:3001/api/health"

# Function to check service status
check_service_status() {
    if systemctl is-active --quiet crewai-email-pipeline; then
        echo -e "${GREEN}✓${NC} Email Pipeline Service: RUNNING"
        local uptime=$(systemctl show crewai-email-pipeline --property=ActiveEnterTimestamp | cut -d'=' -f2)
        echo -e "  Started: $uptime"
    else
        echo -e "${RED}✗${NC} Email Pipeline Service: STOPPED"
    fi
}

# Function to check Redis queue
check_redis_queue() {
    echo -e "\n${BLUE}Redis Queue Status:${NC}"
    
    if command -v redis-cli &> /dev/null; then
        local waiting=$(redis-cli LLEN "bull:email-processor:wait" 2>/dev/null || echo "0")
        local active=$(redis-cli LLEN "bull:email-processor:active" 2>/dev/null || echo "0")
        local completed=$(redis-cli LLEN "bull:email-processor:completed" 2>/dev/null || echo "0")
        local failed=$(redis-cli LLEN "bull:email-processor:failed" 2>/dev/null || echo "0")
        
        echo -e "  Waiting: ${YELLOW}$waiting${NC}"
        echo -e "  Active: ${GREEN}$active${NC}"
        echo -e "  Completed: ${GREEN}$completed${NC}"
        echo -e "  Failed: ${RED}$failed${NC}"
    else
        echo -e "  ${RED}Redis CLI not available${NC}"
    fi
}

# Function to check API health
check_api_health() {
    echo -e "\n${BLUE}API Health Check:${NC}"
    
    if curl -s -f "$API_HEALTH_URL" > /dev/null 2>&1; then
        echo -e "  ${GREEN}✓${NC} API is healthy"
        
        # Get detailed health info
        local health_data=$(curl -s "$API_HEALTH_URL")
        echo -e "  Response: $health_data"
    else
        echo -e "  ${RED}✗${NC} API is not responding"
    fi
}

# Function to show recent errors
show_recent_errors() {
    echo -e "\n${BLUE}Recent Errors (last 10):${NC}"
    
    if [ -f "$LOG_DIR/email-pipeline-error.log" ]; then
        local error_count=$(grep -c "ERROR" "$LOG_DIR/email-pipeline-error.log" 2>/dev/null || echo "0")
        echo -e "  Total errors: ${RED}$error_count${NC}"
        
        if [ "$error_count" -gt 0 ]; then
            echo -e "\n  Recent error messages:"
            grep "ERROR" "$LOG_DIR/email-pipeline-error.log" | tail -10 | while read -r line; do
                echo -e "  ${RED}>${NC} $line"
            done
        fi
    else
        echo -e "  No error log found"
    fi
}

# Function to show processing statistics
show_processing_stats() {
    echo -e "\n${BLUE}Processing Statistics:${NC}"
    
    if [ -f "$LOG_DIR/email-pipeline.log" ]; then
        # Count processed emails in last hour
        local last_hour_count=$(grep -c "Email processed successfully" "$LOG_DIR/email-pipeline.log" 2>/dev/null || echo "0")
        echo -e "  Emails processed (total): ${GREEN}$last_hour_count${NC}"
        
        # Average processing time
        local avg_time=$(grep "processingTime" "$LOG_DIR/email-pipeline.log" | tail -100 | grep -oP 'processingTime":\K[0-9]+' | awk '{sum+=$1} END {if (NR>0) print int(sum/NR); else print 0}')
        echo -e "  Avg processing time: ${YELLOW}${avg_time}ms${NC}"
        
        # Cache hit rate
        local cache_hits=$(grep -c "fromCache.*true" "$LOG_DIR/email-pipeline.log" 2>/dev/null || echo "0")
        local total_processed=$(grep -c "Email processed" "$LOG_DIR/email-pipeline.log" 2>/dev/null || echo "1")
        local hit_rate=$((cache_hits * 100 / total_processed))
        echo -e "  Cache hit rate: ${GREEN}${hit_rate}%${NC}"
    fi
}

# Function to show system resources
show_system_resources() {
    echo -e "\n${BLUE}System Resources:${NC}"
    
    # Memory usage
    local mem_usage=$(ps aux | grep "run-email-pipeline" | grep -v grep | awk '{print $4}' | head -1)
    if [ -n "$mem_usage" ]; then
        echo -e "  Memory usage: ${YELLOW}${mem_usage}%${NC}"
    fi
    
    # CPU usage
    local cpu_usage=$(ps aux | grep "run-email-pipeline" | grep -v grep | awk '{print $3}' | head -1)
    if [ -n "$cpu_usage" ]; then
        echo -e "  CPU usage: ${YELLOW}${cpu_usage}%${NC}"
    fi
    
    # Disk space for logs
    local log_size=$(du -sh "$LOG_DIR" 2>/dev/null | cut -f1)
    echo -e "  Log directory size: ${YELLOW}$log_size${NC}"
}

# Function to monitor in real-time
monitor_realtime() {
    while true; do
        clear
        echo -e "${GREEN}CrewAI Email Pipeline Monitor${NC}"
        echo -e "=============================="
        echo -e "Press Ctrl+C to exit\n"
        
        check_service_status
        check_redis_queue
        check_api_health
        show_processing_stats
        show_system_resources
        show_recent_errors
        
        echo -e "\n${BLUE}Last updated:${NC} $(date)"
        sleep 5
    done
}

# Function to generate report
generate_report() {
    local report_file="$PROJECT_DIR/reports/email-pipeline-report-$(date +%Y%m%d-%H%M%S).txt"
    mkdir -p "$PROJECT_DIR/reports"
    
    {
        echo "CrewAI Email Pipeline Report"
        echo "Generated: $(date)"
        echo "==============================="
        echo
        
        echo "SERVICE STATUS"
        echo "--------------"
        systemctl status crewai-email-pipeline --no-pager
        echo
        
        echo "QUEUE STATUS"
        echo "------------"
        redis-cli INFO | grep -E "(connected_clients|used_memory_human)"
        echo
        
        echo "PROCESSING STATISTICS"
        echo "--------------------"
        grep "Batch processing completed" "$LOG_DIR/email-pipeline.log" | tail -20
        echo
        
        echo "ERROR SUMMARY"
        echo "-------------"
        grep "ERROR" "$LOG_DIR/email-pipeline-error.log" | tail -50
        
    } > "$report_file"
    
    echo -e "${GREEN}Report generated:${NC} $report_file"
}

# Main function
main() {
    case "${1:-monitor}" in
        monitor)
            monitor_realtime
            ;;
        status)
            check_service_status
            check_redis_queue
            check_api_health
            show_processing_stats
            show_system_resources
            show_recent_errors
            ;;
        report)
            generate_report
            ;;
        logs)
            echo -e "${BLUE}Tailing email pipeline logs...${NC}"
            tail -f "$LOG_DIR/email-pipeline.log"
            ;;
        errors)
            echo -e "${RED}Tailing error logs...${NC}"
            tail -f "$LOG_DIR/email-pipeline-error.log"
            ;;
        *)
            echo "Usage: $0 {monitor|status|report|logs|errors}"
            echo
            echo "  monitor - Real-time monitoring (refreshes every 5 seconds)"
            echo "  status  - Show current status once"
            echo "  report  - Generate detailed report"
            echo "  logs    - Tail pipeline logs"
            echo "  errors  - Tail error logs"
            exit 1
            ;;
    esac
}

# Run main function
main "$@"