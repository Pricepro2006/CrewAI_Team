#!/bin/bash

# Master Incident Response Script
# Version: 1.0.0
# Purpose: Central command center for incident response

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

PROJECT_ROOT="/home/pricepro2006/CrewAI_Team"
cd "$PROJECT_ROOT"

# ASCII Banner
show_banner() {
    echo -e "${CYAN}"
    cat << 'EOF'
 ╔══════════════════════════════════════════╗
 ║   INCIDENT RESPONSE COMMAND CENTER        ║
 ║   Walmart Grocery Agent - Local Dev       ║
 ╚══════════════════════════════════════════╝
EOF
    echo -e "${NC}"
}

# Function to show incident severity
show_severity() {
    echo -e "${BOLD}Incident Severity Levels:${NC}"
    echo -e "${RED}P0${NC} - Complete outage, all services down"
    echo -e "${YELLOW}P1${NC} - Major functionality broken"
    echo -e "${BLUE}P2${NC} - Significant issues, partial functionality"
    echo -e "${GREEN}P3${NC} - Minor issues, cosmetic problems"
    echo ""
}

# Function to detect incident type
detect_incident() {
    echo -e "${YELLOW}🔍 Auto-detecting issues...${NC}"
    
    local severity="P3"
    local issues=()
    
    # Check WebSocket
    if ! lsof -i:8080 > /dev/null 2>&1; then
        issues+=("WebSocket server down (port 8080)")
        severity="P1"
    fi
    
    # Check API
    if ! lsof -i:3001 > /dev/null 2>&1; then
        issues+=("API server down (port 3001)")
        severity="P0"
    fi
    
    # Check databases
    for db in walmart_grocery.db app.db crewai_enhanced.db; do
        if [ -f "$db" ]; then
            if ! sqlite3 "$db" "SELECT 1;" > /dev/null 2>&1; then
                issues+=("Database $db is locked or corrupted")
                if [ "$severity" != "P0" ]; then
                    severity="P1"
                fi
            fi
        fi
    done
    
    # Check Ollama
    if ! curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
        issues+=("Ollama service not running")
        if [ "$severity" = "P3" ]; then
            severity="P2"
        fi
    fi
    
    # Check memory
    local mem_usage=$(ps aux | grep node | awk '{sum+=$6} END {print int(sum/1024)}')
    if [ "$mem_usage" -gt 2048 ]; then
        issues+=("High memory usage: ${mem_usage}MB")
        if [ "$severity" = "P3" ]; then
            severity="P2"
        fi
    fi
    
    # Display findings
    echo ""
    if [ ${#issues[@]} -eq 0 ]; then
        echo -e "${GREEN}✅ No critical issues detected${NC}"
        severity="OK"
    else
        echo -e "${RED}Issues detected:${NC}"
        for issue in "${issues[@]}"; do
            echo -e "  • $issue"
        done
        echo ""
        echo -e "Severity: ${RED}$severity${NC}"
    fi
    
    echo ""
    return 0
}

# Quick actions menu
quick_actions() {
    echo -e "${BOLD}Quick Actions:${NC}"
    echo "1) 🚨 Emergency Stop All"
    echo "2) 🔧 Quick Fix (Auto-repair)"
    echo "3) 🔍 Run Full Diagnostic"
    echo "4) 🔌 Fix WebSocket Issues"
    echo "5) 💾 Fix Database Issues"
    echo "6) 🧹 Clear Memory/Cache"
    echo "7) 🔄 Full System Reset"
    echo "8) 📊 View Live Monitoring"
    echo "9) 📝 View Recent Logs"
    echo "0) Exit"
}

# Execute quick action
execute_action() {
    case $1 in
        1)
            echo -e "${RED}🚨 EMERGENCY STOP${NC}"
            pkill -f node
            pkill -f ollama
            lsof -ti:3001,3005,3006,3007,3008,3009,3010,8080 | xargs kill -9 2>/dev/null || true
            echo -e "${GREEN}✓ All services stopped${NC}"
            ;;
        2)
            echo -e "${YELLOW}🔧 Running Quick Fix...${NC}"
            ./scripts/recovery/quick_fix.sh 1
            ;;
        3)
            echo -e "${BLUE}🔍 Running Full Diagnostic...${NC}"
            ./scripts/diagnostics/comprehensive_diagnostic.sh
            ;;
        4)
            echo -e "${YELLOW}🔌 Fixing WebSocket...${NC}"
            ./scripts/recovery/websocket_recovery.sh
            ;;
        5)
            echo -e "${YELLOW}💾 Fixing Databases...${NC}"
            ./scripts/recovery/database_recovery.sh --auto
            ;;
        6)
            echo -e "${YELLOW}🧹 Clearing Memory/Cache...${NC}"
            rm -rf node_modules/.cache
            rm -rf dist/.cache
            npm cache clean --force
            echo -e "${GREEN}✓ Memory cleared${NC}"
            ;;
        7)
            echo -e "${RED}🔄 Full System Reset${NC}"
            read -p "Are you sure? This will stop everything and restart (y/n): " confirm
            if [ "$confirm" = "y" ]; then
                ./scripts/recovery/quick_fix.sh 8
            fi
            ;;
        8)
            echo -e "${BLUE}📊 Opening Live Monitoring...${NC}"
            echo "Monitor available at: http://localhost:3002/monitor"
            echo ""
            echo "Live service status:"
            watch -n 1 'lsof -i :3001,3005,3006,3007,3008,8080 | grep LISTEN'
            ;;
        9)
            echo -e "${BLUE}📝 Recent Log Entries:${NC}"
            if [ -d "logs" ]; then
                echo "=== Recent Errors ==="
                find logs -name "*.log" -exec grep -H "ERROR\|error" {} \; | tail -10
                echo ""
                echo "=== Recent Warnings ==="
                find logs -name "*.log" -exec grep -H "WARN\|warning" {} \; | tail -5
            else
                echo "No logs directory found"
            fi
            ;;
        0)
            echo "Exiting..."
            exit 0
            ;;
        *)
            echo -e "${RED}Invalid option${NC}"
            ;;
    esac
}

# Incident logging
log_incident() {
    local timestamp=$(date +"%Y-%m-%d %H:%M:%S")
    local log_file="incidents/incident_$(date +%Y%m%d_%H%M%S).log"
    
    mkdir -p incidents
    
    echo "=== Incident Report ===" > "$log_file"
    echo "Timestamp: $timestamp" >> "$log_file"
    echo "Severity: $1" >> "$log_file"
    echo "Issue: $2" >> "$log_file"
    echo "Action Taken: $3" >> "$log_file"
    echo "Result: $4" >> "$log_file"
    echo "" >> "$log_file"
    
    echo -e "${GREEN}✓ Incident logged to $log_file${NC}"
}

# Guided incident response
guided_response() {
    echo -e "${BOLD}${BLUE}Guided Incident Response${NC}"
    echo "========================"
    echo ""
    
    # Step 1: Identify the problem
    echo -e "${YELLOW}Step 1: What's the problem?${NC}"
    echo "1) WebSocket not connecting"
    echo "2) Database locked/corrupted"
    echo "3) API not responding"
    echo "4) High memory usage"
    echo "5) Service won't start"
    echo "6) Other/Unknown"
    read -p "Select problem type [1-6]: " problem
    
    case $problem in
        1)
            echo -e "${YELLOW}Resolving WebSocket issues...${NC}"
            ./scripts/recovery/websocket_recovery.sh
            log_incident "P1" "WebSocket connection failure" "Ran WebSocket recovery" "Resolved"
            ;;
        2)
            echo -e "${YELLOW}Resolving database issues...${NC}"
            ./scripts/recovery/database_recovery.sh --auto
            log_incident "P1" "Database lock/corruption" "Ran database recovery" "Resolved"
            ;;
        3)
            echo -e "${YELLOW}Restarting API server...${NC}"
            lsof -ti:3001 | xargs kill -9 2>/dev/null || true
            npm run api:start &
            sleep 3
            if lsof -i:3001 > /dev/null 2>&1; then
                echo -e "${GREEN}✓ API server restarted${NC}"
                log_incident "P0" "API not responding" "Restarted API server" "Resolved"
            else
                echo -e "${RED}✗ Failed to restart API${NC}"
                log_incident "P0" "API not responding" "Attempted restart" "Failed"
            fi
            ;;
        4)
            echo -e "${YELLOW}Clearing memory...${NC}"
            pkill -f "node --max-old-space"
            rm -rf node_modules/.cache
            NODE_OPTIONS="--max-old-space-size=2048" npm run dev &
            log_incident "P2" "High memory usage" "Cleared cache and restarted with limits" "Resolved"
            ;;
        5)
            echo -e "${YELLOW}Checking service dependencies...${NC}"
            ./scripts/diagnostics/comprehensive_diagnostic.sh
            echo ""
            echo "Based on diagnostic, running quick fix..."
            ./scripts/recovery/quick_fix.sh 1
            log_incident "P1" "Service startup failure" "Ran diagnostic and quick fix" "Resolved"
            ;;
        6)
            echo -e "${YELLOW}Running comprehensive diagnostic...${NC}"
            ./scripts/diagnostics/comprehensive_diagnostic.sh
            ;;
    esac
}

# Main menu
main_menu() {
    while true; do
        show_banner
        detect_incident
        quick_actions
        echo ""
        read -p "Select action [0-9] or 'g' for guided response: " choice
        
        if [ "$choice" = "g" ] || [ "$choice" = "G" ]; then
            guided_response
        else
            execute_action $choice
        fi
        
        echo ""
        read -p "Press Enter to continue..."
    done
}

# Parse command line arguments
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "Incident Response Command Center"
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  --auto        Run automatic detection and fix"
    echo "  --diagnostic  Run diagnostic only"
    echo "  --fix         Run quick fix"
    echo "  --websocket   Fix WebSocket issues"
    echo "  --database    Fix database issues"
    echo "  --help        Show this help"
    echo ""
    exit 0
fi

if [ "$1" = "--auto" ]; then
    detect_incident
    echo -e "${YELLOW}Running automatic fix...${NC}"
    ./scripts/recovery/quick_fix.sh 1
    exit 0
fi

if [ "$1" = "--diagnostic" ]; then
    ./scripts/diagnostics/comprehensive_diagnostic.sh
    exit 0
fi

if [ "$1" = "--fix" ]; then
    ./scripts/recovery/quick_fix.sh 1
    exit 0
fi

if [ "$1" = "--websocket" ]; then
    ./scripts/recovery/websocket_recovery.sh
    exit 0
fi

if [ "$1" = "--database" ]; then
    ./scripts/recovery/database_recovery.sh --auto
    exit 0
fi

# Run main menu
main_menu