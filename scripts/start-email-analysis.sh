#!/bin/bash

# Start Email Analysis Script (Non-systemd version)
# Purpose: Run the adaptive three-phase email analysis without requiring sudo

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="/home/pricepro2006/CrewAI_Team"
SCRIPT_DIR="$PROJECT_DIR/scripts"
LOG_DIR="$PROJECT_DIR/logs"
PID_DIR="$PROJECT_DIR/pids"
DB_PATH="$PROJECT_DIR/data/crewai_enhanced.db"

# Create required directories
mkdir -p "$LOG_DIR" "$PID_DIR"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}   Starting Adaptive Three-Phase Email Analysis${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Function to check if Ollama is running
check_ollama() {
    echo -e "${YELLOW}🔍 Checking Ollama status...${NC}"
    
    if curl -s http://localhost:11434/api/tags >/dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Ollama is running"
        return 0
    else
        echo -e "${RED}✗${NC} Ollama is not running"
        echo -e "${YELLOW}Please start Ollama with: ollama serve${NC}"
        return 1
    fi
}

# Function to check Redis
check_redis() {
    echo -e "${YELLOW}🔍 Checking Redis status...${NC}"
    
    if redis-cli ping >/dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Redis is running"
        return 0
    else
        echo -e "${YELLOW}!${NC} Redis is not running (optional for rate limiting)"
        return 0
    fi
}

# Function to check database
check_database() {
    echo -e "${YELLOW}🔍 Checking database...${NC}"
    
    if [ -f "$DB_PATH" ]; then
        local total=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM emails_enhanced;" 2>/dev/null || echo "0")
        local pending=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM emails_enhanced WHERE workflow_state IS NULL OR workflow_state = '{}' OR LENGTH(workflow_state) < 100;" 2>/dev/null || echo "0")
        echo -e "${GREEN}✓${NC} Database found: $total emails"
        echo -e "${BLUE}ℹ${NC}  Emails needing processing: $pending"
        return 0
    else
        echo -e "${RED}✗${NC} Database not found at $DB_PATH"
        return 1
    fi
}

# Function to start the processor
start_processor() {
    echo -e "${YELLOW}🚀 Starting email processor...${NC}"
    
    # Check if already running
    if [ -f "$PID_DIR/email-processor.pid" ]; then
        local pid=$(cat "$PID_DIR/email-processor.pid")
        if ps -p $pid > /dev/null 2>&1; then
            echo -e "${YELLOW}!${NC} Email processor already running (PID: $pid)"
            return 0
        fi
    fi
    
    # Start the processor in background
    cd "$PROJECT_DIR"
    nohup python3 "$SCRIPT_DIR/robust_llm_processor_cli.py" \
        --db "$DB_PATH" \
        --batch-size 10 \
        --continuous \
        > "$LOG_DIR/email-analysis.log" 2>&1 &
    
    local pid=$!
    echo $pid > "$PID_DIR/email-processor.pid"
    
    sleep 2
    
    if ps -p $pid > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Email processor started (PID: $pid)"
        echo -e "${BLUE}ℹ${NC}  Logs: tail -f $LOG_DIR/email-analysis.log"
        return 0
    else
        echo -e "${RED}✗${NC} Failed to start email processor"
        tail -20 "$LOG_DIR/email-analysis.log"
        return 1
    fi
}

# Function to start quality monitor
start_monitor() {
    echo -e "${YELLOW}🔍 Starting quality monitor...${NC}"
    
    # Check if already running
    if [ -f "$PID_DIR/quality-monitor.pid" ]; then
        local pid=$(cat "$PID_DIR/quality-monitor.pid")
        if ps -p $pid > /dev/null 2>&1; then
            echo -e "${YELLOW}!${NC} Quality monitor already running (PID: $pid)"
            return 0
        fi
    fi
    
    # Start the monitor in background
    cd "$PROJECT_DIR"
    nohup python3 "$SCRIPT_DIR/monitor_quality_metrics_fixed.py" \
        --db "$DB_PATH" \
        --continuous \
        --interval 300 \
        > "$LOG_DIR/quality-monitor.log" 2>&1 &
    
    local pid=$!
    echo $pid > "$PID_DIR/quality-monitor.pid"
    
    if ps -p $pid > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Quality monitor started (PID: $pid)"
        return 0
    else
        echo -e "${YELLOW}!${NC} Quality monitor failed to start (non-critical)"
        return 0
    fi
}

# Function to show status
show_status() {
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}   Processing Status${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    # Check processor
    if [ -f "$PID_DIR/email-processor.pid" ]; then
        local pid=$(cat "$PID_DIR/email-processor.pid")
        if ps -p $pid > /dev/null 2>&1; then
            echo -e "${GREEN}✓${NC} Email Processor: Running (PID: $pid)"
        else
            echo -e "${RED}✗${NC} Email Processor: Not running"
        fi
    else
        echo -e "${RED}✗${NC} Email Processor: Not running"
    fi
    
    # Check monitor
    if [ -f "$PID_DIR/quality-monitor.pid" ]; then
        local pid=$(cat "$PID_DIR/quality-monitor.pid")
        if ps -p $pid > /dev/null 2>&1; then
            echo -e "${GREEN}✓${NC} Quality Monitor: Running (PID: $pid)"
        else
            echo -e "${YELLOW}!${NC} Quality Monitor: Not running"
        fi
    else
        echo -e "${YELLOW}!${NC} Quality Monitor: Not running"
    fi
    
    # Show recent logs
    echo -e "\n${YELLOW}📜 Recent Activity:${NC}"
    if [ -f "$LOG_DIR/email-analysis.log" ]; then
        tail -5 "$LOG_DIR/email-analysis.log" | grep -E "Processed|Processing|Stats" || echo "No recent activity"
    fi
}

# Function to stop services
stop_services() {
    echo -e "${YELLOW}🛑 Stopping services...${NC}"
    
    # Stop processor
    if [ -f "$PID_DIR/email-processor.pid" ]; then
        local pid=$(cat "$PID_DIR/email-processor.pid")
        if ps -p $pid > /dev/null 2>&1; then
            kill $pid
            echo -e "${GREEN}✓${NC} Stopped email processor"
        fi
        rm -f "$PID_DIR/email-processor.pid"
    fi
    
    # Stop monitor
    if [ -f "$PID_DIR/quality-monitor.pid" ]; then
        local pid=$(cat "$PID_DIR/quality-monitor.pid")
        if ps -p $pid > /dev/null 2>&1; then
            kill $pid
            echo -e "${GREEN}✓${NC} Stopped quality monitor"
        fi
        rm -f "$PID_DIR/quality-monitor.pid"
    fi
}

# Main function
main() {
    case "${1:-start}" in
        start)
            # Check dependencies
            check_ollama || exit 1
            check_redis
            check_database || exit 1
            
            # Start services
            start_processor || exit 1
            start_monitor
            
            # Show status
            show_status
            
            echo -e "\n${GREEN}✅ Email analysis started successfully!${NC}"
            echo -e "\n${YELLOW}📋 Commands:${NC}"
            echo -e "  View logs:    ${BLUE}tail -f $LOG_DIR/email-analysis.log${NC}"
            echo -e "  Check status: ${BLUE}./start-email-analysis.sh status${NC}"
            echo -e "  Stop:         ${BLUE}./start-email-analysis.sh stop${NC}"
            ;;
            
        status)
            show_status
            ;;
            
        stop)
            stop_services
            echo -e "${GREEN}✓${NC} Services stopped"
            ;;
            
        restart)
            stop_services
            sleep 2
            $0 start
            ;;
            
        logs)
            tail -f "$LOG_DIR/email-analysis.log"
            ;;
            
        quality)
            cd "$PROJECT_DIR"
            python3 "$SCRIPT_DIR/monitor_quality_metrics_fixed.py" --hours 1
            ;;
            
        *)
            echo "Usage: $0 {start|status|stop|restart|logs|quality}"
            echo ""
            echo "Commands:"
            echo "  start   - Start the email analysis pipeline"
            echo "  status  - Show current status"
            echo "  stop    - Stop all services"
            echo "  restart - Restart all services"
            echo "  logs    - Follow the processing logs"
            echo "  quality - Run a quality check"
            exit 1
            ;;
    esac
}

# Run main function
main "$@"