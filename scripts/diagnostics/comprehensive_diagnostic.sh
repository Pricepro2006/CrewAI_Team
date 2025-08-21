#!/bin/bash

# Comprehensive Diagnostic Script for Walmart Grocery Agent
# Version: 1.0.0
# Environment: Local Development

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Configuration
PROJECT_ROOT="/home/pricepro2006/CrewAI_Team"
LOG_DIR="$PROJECT_ROOT/logs"
DIAGNOSTIC_OUTPUT="$PROJECT_ROOT/diagnostic_report_$(date +%Y%m%d_%H%M%S).txt"

# Function to print colored output
print_status() {
    local status=$1
    local message=$2
    case $status in
        "success") echo -e "${GREEN}✅ $message${NC}" | tee -a $DIAGNOSTIC_OUTPUT ;;
        "error") echo -e "${RED}❌ $message${NC}" | tee -a $DIAGNOSTIC_OUTPUT ;;
        "warning") echo -e "${YELLOW}⚠️  $message${NC}" | tee -a $DIAGNOSTIC_OUTPUT ;;
        "info") echo -e "${BLUE}ℹ️  $message${NC}" | tee -a $DIAGNOSTIC_OUTPUT ;;
        "header") echo -e "${BOLD}${CYAN}=== $message ===${NC}" | tee -a $DIAGNOSTIC_OUTPUT ;;
    esac
}

# Function to check if a port is in use
check_port() {
    local port=$1
    local service=$2
    if lsof -i:$port > /dev/null 2>&1; then
        local pid=$(lsof -ti:$port)
        local process=$(ps -p $pid -o comm= 2>/dev/null || echo "unknown")
        print_status "success" "Port $port ($service): Running [PID: $pid, Process: $process]"
        return 0
    else
        print_status "error" "Port $port ($service): Not running"
        return 1
    fi
}

# Function to check database health
check_database() {
    local db=$1
    if [ ! -f "$db" ]; then
        print_status "error" "Database $db: File not found"
        return 1
    fi
    
    local size=$(du -h "$db" 2>/dev/null | cut -f1)
    
    # Check if database is accessible
    if sqlite3 "$db" "SELECT 1;" > /dev/null 2>&1; then
        # Check integrity
        local integrity=$(sqlite3 "$db" "PRAGMA integrity_check;" 2>&1)
        if [ "$integrity" = "ok" ]; then
            print_status "success" "Database $(basename $db): OK (Size: $size)"
            
            # Get table count
            local tables=$(sqlite3 "$db" "SELECT COUNT(*) FROM sqlite_master WHERE type='table';" 2>/dev/null)
            echo "  Tables: $tables" | tee -a $DIAGNOSTIC_OUTPUT
            
            # Check for journal files
            if [ -f "${db}-journal" ] || [ -f "${db}-wal" ]; then
                print_status "warning" "  Journal files present (may indicate incomplete transaction)"
            fi
        else
            print_status "error" "Database $(basename $db): Integrity check failed"
            echo "  Error: $integrity" | tee -a $DIAGNOSTIC_OUTPUT
        fi
    else
        print_status "error" "Database $(basename $db): Locked or corrupted (Size: $size)"
    fi
}

# Function to check Node.js memory usage
check_memory() {
    local total_mem=0
    local count=0
    
    while IFS= read -r line; do
        if [[ ! -z "$line" ]]; then
            mem=$(echo $line | awk '{print $6}')
            total_mem=$((total_mem + mem))
            count=$((count + 1))
        fi
    done < <(ps aux | grep node | grep -v grep)
    
    if [ $count -gt 0 ]; then
        local mem_mb=$((total_mem / 1024))
        if [ $mem_mb -gt 2048 ]; then
            print_status "warning" "Node.js memory usage: ${mem_mb}MB across $count processes (HIGH)"
        else
            print_status "success" "Node.js memory usage: ${mem_mb}MB across $count processes"
        fi
    else
        print_status "info" "No Node.js processes running"
    fi
}

# Function to check WebSocket connectivity
check_websocket() {
    if command -v wscat &> /dev/null; then
        timeout 2 bash -c 'echo "{\"type\":\"ping\"}" | wscat -c ws://localhost:8080 2>/dev/null | grep -q "pong"'
        if [ $? -eq 0 ]; then
            print_status "success" "WebSocket connection test: Passed"
        else
            print_status "error" "WebSocket connection test: Failed"
        fi
    else
        print_status "warning" "wscat not installed, skipping WebSocket test"
    fi
}

# Function to check Ollama
check_ollama() {
    if curl -s http://localhost:8081/api/tags > /dev/null 2>&1; then
        print_status "success" "Ollama service: Running"
        
        # Check for Qwen model
        if ollama list 2>/dev/null | grep -q "qwen3:0.6b"; then
            print_status "success" "  Qwen3:0.6b model: Available"
        else
            print_status "warning" "  Qwen3:0.6b model: Not found"
        fi
    else
        print_status "error" "Ollama service: Not running"
    fi
}

# Function to check disk space
check_disk_space() {
    local usage=$(df -h . | tail -1 | awk '{print $5}' | sed 's/%//')
    local available=$(df -h . | tail -1 | awk '{print $4}')
    
    if [ $usage -gt 90 ]; then
        print_status "error" "Disk usage: ${usage}% (Available: $available) - CRITICAL"
    elif [ $usage -gt 80 ]; then
        print_status "warning" "Disk usage: ${usage}% (Available: $available) - HIGH"
    else
        print_status "success" "Disk usage: ${usage}% (Available: $available)"
    fi
}

# Function to check recent errors in logs
check_logs() {
    if [ -d "$LOG_DIR" ]; then
        local error_count=$(find "$LOG_DIR" -name "*.log" -type f -exec grep -i "error" {} \; 2>/dev/null | wc -l)
        if [ $error_count -gt 0 ]; then
            print_status "warning" "Found $error_count errors in log files"
            echo "  Recent errors:" | tee -a $DIAGNOSTIC_OUTPUT
            find "$LOG_DIR" -name "*.log" -type f -exec grep -i "error" {} \; 2>/dev/null | tail -3 | while read line; do
                echo "    $line" | tee -a $DIAGNOSTIC_OUTPUT
            done
        else
            print_status "success" "No errors found in log files"
        fi
    else
        print_status "info" "Log directory not found"
    fi
}

# Function to check npm/node setup
check_node_setup() {
    # Check Node version
    if command -v node &> /dev/null; then
        local node_version=$(node -v)
        print_status "success" "Node.js version: $node_version"
    else
        print_status "error" "Node.js: Not installed"
    fi
    
    # Check npm version
    if command -v npm &> /dev/null; then
        local npm_version=$(npm -v)
        print_status "success" "npm version: $npm_version"
    else
        print_status "error" "npm: Not installed"
    fi
    
    # Check if node_modules exists
    if [ -d "$PROJECT_ROOT/node_modules" ]; then
        local module_count=$(ls -1 "$PROJECT_ROOT/node_modules" | wc -l)
        print_status "success" "node_modules: $module_count packages installed"
    else
        print_status "error" "node_modules: Not found (run npm install)"
    fi
}

# Main diagnostic routine
main() {
    clear
    echo "🔍 Walmart Grocery Agent - Comprehensive Diagnostic Tool" | tee $DIAGNOSTIC_OUTPUT
    echo "=================================================" | tee -a $DIAGNOSTIC_OUTPUT
    echo "Timestamp: $(date)" | tee -a $DIAGNOSTIC_OUTPUT
    echo "Project Root: $PROJECT_ROOT" | tee -a $DIAGNOSTIC_OUTPUT
    echo "" | tee -a $DIAGNOSTIC_OUTPUT
    
    # Change to project directory
    cd "$PROJECT_ROOT" || {
        print_status "error" "Cannot access project directory: $PROJECT_ROOT"
        exit 1
    }
    
    # System Information
    print_status "header" "System Information"
    print_status "info" "Hostname: $(hostname)"
    print_status "info" "OS: $(uname -s) $(uname -r)"
    print_status "info" "Uptime: $(uptime -p 2>/dev/null || uptime)"
    echo ""
    
    # Node.js Setup
    print_status "header" "Node.js Environment"
    check_node_setup
    echo ""
    
    # Service Status
    print_status "header" "Service Status"
    check_port 3001 "API Server"
    check_port 8080 "WebSocket Server"
    check_port 3005 "Grocery Service"
    check_port 3006 "Cache Warmer"
    check_port 3007 "Pricing Service"
    check_port 3008 "NLP Service"
    check_port 3009 "Deal Engine"
    check_port 3010 "Memory Monitor"
    check_port 3002 "Monitoring Dashboard"
    check_port 11434 "Ollama"
    echo ""
    
    # Database Health
    print_status "header" "Database Health"
    check_database "$PROJECT_ROOT/walmart_grocery.db"
    check_database "$PROJECT_ROOT/app.db"
    check_database "$PROJECT_ROOT/crewai_enhanced.db"
    echo ""
    
    # WebSocket Testing
    print_status "header" "WebSocket Testing"
    check_websocket
    echo ""
    
    # LLM (llama.cpp) Status
    print_status "header" "Ollama/LLM Status"
    check_ollama
    echo ""
    
    # Resource Usage
    print_status "header" "Resource Usage"
    check_memory
    check_disk_space
    echo ""
    
    # Log Analysis
    print_status "header" "Log Analysis"
    check_logs
    echo ""
    
    # Environment Variables
    print_status "header" "Environment Configuration"
    if [ -f "$PROJECT_ROOT/.env" ]; then
        print_status "success" ".env file: Found"
        local env_vars=$(grep -c "=" "$PROJECT_ROOT/.env" 2>/dev/null || echo "0")
        echo "  Variables defined: $env_vars" | tee -a $DIAGNOSTIC_OUTPUT
    else
        print_status "warning" ".env file: Not found"
    fi
    echo ""
    
    # Process Summary
    print_status "header" "Process Summary"
    local node_processes=$(ps aux | grep -c "[n]ode")
    local ollama_processes=$(ps aux | grep -c "[o]llama")
    print_status "info" "Node processes: $node_processes"
    print_status "info" "Ollama processes: $ollama_processes"
    echo ""
    
    # Final Summary
    print_status "header" "Diagnostic Summary"
    
    # Count issues
    local errors=$(grep -c "❌" $DIAGNOSTIC_OUTPUT)
    local warnings=$(grep -c "⚠️" $DIAGNOSTIC_OUTPUT)
    local success=$(grep -c "✅" $DIAGNOSTIC_OUTPUT)
    
    echo "" | tee -a $DIAGNOSTIC_OUTPUT
    if [ $errors -eq 0 ]; then
        print_status "success" "System Status: HEALTHY"
    elif [ $errors -lt 3 ]; then
        print_status "warning" "System Status: DEGRADED ($errors issues found)"
    else
        print_status "error" "System Status: CRITICAL ($errors issues found)"
    fi
    
    echo "" | tee -a $DIAGNOSTIC_OUTPUT
    echo "📊 Results: $success OK, $warnings warnings, $errors errors" | tee -a $DIAGNOSTIC_OUTPUT
    echo "" | tee -a $DIAGNOSTIC_OUTPUT
    echo "📄 Full report saved to: $DIAGNOSTIC_OUTPUT"
    echo ""
    
    # Provide recommendations
    if [ $errors -gt 0 ]; then
        echo "🔧 Recommended Actions:" | tee -a $DIAGNOSTIC_OUTPUT
        
        if ! lsof -i:8080 > /dev/null 2>&1; then
            echo "  1. Start WebSocket server: npm run websocket:start" | tee -a $DIAGNOSTIC_OUTPUT
        fi
        
        if ! lsof -i:3001 > /dev/null 2>&1; then
            echo "  2. Start API server: npm run api:start" | tee -a $DIAGNOSTIC_OUTPUT
        fi
        
        if ! curl -s http://localhost:8081/api/tags > /dev/null 2>&1; then
            echo "  3. Start Ollama: ollama serve &" | tee -a $DIAGNOSTIC_OUTPUT
        fi
        
        echo "" | tee -a $DIAGNOSTIC_OUTPUT
        echo "  Run './scripts/recovery/quick_fix.sh' for automated recovery" | tee -a $DIAGNOSTIC_OUTPUT
    fi
}

# Run main function
main