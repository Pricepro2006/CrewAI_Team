#!/bin/bash

# Quick Fix Script for Common Issues
# Version: 1.0.0
# Purpose: One-click recovery for common development issues

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_ROOT="/home/pricepro2006/CrewAI_Team"
cd "$PROJECT_ROOT"

echo -e "${BLUE}🔧 Walmart Grocery Agent - Quick Fix Tool${NC}"
echo "=========================================="

# Function to fix port conflicts
fix_ports() {
    echo -e "${YELLOW}Fixing port conflicts...${NC}"
    
    local ports=(3001 3002 3005 3006 3007 3008 3009 3010 8080 11434)
    
    for port in "${ports[@]}"; do
        if lsof -i:$port > /dev/null 2>&1; then
            echo "  Killing process on port $port..."
            lsof -ti:$port | xargs kill -9 2>/dev/null || true
        fi
    done
    
    echo -e "${GREEN}✓ Ports cleared${NC}"
}

# Function to fix database locks
fix_database_locks() {
    echo -e "${YELLOW}Fixing database locks...${NC}"
    
    # Kill processes holding database locks
    for db in walmart_grocery.db app.db crewai_enhanced.db; do
        if [ -f "$db" ]; then
            fuser -k "$db" 2>/dev/null || true
            
            # Remove journal files
            rm -f "${db}-journal" "${db}-wal" "${db}-shm" 2>/dev/null || true
            
            # Check integrity
            if sqlite3 "$db" "PRAGMA integrity_check;" > /dev/null 2>&1; then
                echo -e "  ${GREEN}✓ $db is healthy${NC}"
            else
                echo -e "  ${RED}✗ $db is corrupted, attempting recovery...${NC}"
                
                # Try to recover
                sqlite3 "$db" ".dump" > "${db}.sql" 2>/dev/null || true
                if [ -s "${db}.sql" ]; then
                    mv "$db" "${db}.corrupted.$(date +%Y%m%d_%H%M%S)"
                    sqlite3 "$db" < "${db}.sql"
                    rm "${db}.sql"
                    echo -e "  ${GREEN}✓ $db recovered${NC}"
                else
                    echo -e "  ${RED}✗ Could not recover $db${NC}"
                fi
            fi
        fi
    done
    
    echo -e "${GREEN}✓ Database locks cleared${NC}"
}

# Function to fix WebSocket issues
fix_websocket() {
    echo -e "${YELLOW}Fixing WebSocket issues...${NC}"
    
    # Kill any existing WebSocket processes
    pkill -f "websocket" 2>/dev/null || true
    pkill -f "ws://" 2>/dev/null || true
    
    # Clear WebSocket cache
    rm -rf node_modules/.cache/websocket* 2>/dev/null || true
    
    echo -e "${GREEN}✓ WebSocket cleared${NC}"
}

# Function to fix memory issues
fix_memory() {
    echo -e "${YELLOW}Fixing memory issues...${NC}"
    
    # Kill memory-intensive Node processes
    pkill -f "node --max-old-space-size" 2>/dev/null || true
    
    # Clear various caches
    rm -rf node_modules/.cache 2>/dev/null || true
    rm -rf .next/cache 2>/dev/null || true
    rm -rf dist/.cache 2>/dev/null || true
    
    # Clear npm cache
    npm cache clean --force 2>/dev/null || true
    
    echo -e "${GREEN}✓ Memory cleared${NC}"
}

# Function to restart Ollama
fix_ollama() {
    echo -e "${YELLOW}Fixing Ollama...${NC}"
    
    # Kill existing Ollama process
    pkill -f "ollama" 2>/dev/null || true
    
    sleep 1
    
    # Start Ollama
    ollama serve > /dev/null 2>&1 &
    
    sleep 2
    
    # Check if running
    if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Ollama started${NC}"
        
        # Check for required model
        if ! ollama list 2>/dev/null | grep -q "qwen3:0.6b"; then
            echo "  Pulling Qwen3:0.6b model..."
            ollama pull qwen3:0.6b
        fi
    else
        echo -e "${RED}✗ Could not start Ollama${NC}"
    fi
}

# Function to check dependencies
check_dependencies() {
    echo -e "${YELLOW}Checking dependencies...${NC}"
    
    if [ ! -d "node_modules" ]; then
        echo "  Installing dependencies..."
        npm install
    else
        echo -e "  ${GREEN}✓ Dependencies installed${NC}"
    fi
    
    if [ ! -f ".env" ]; then
        echo -e "  ${YELLOW}Creating .env file...${NC}"
        cat > .env << 'EOF'
NODE_ENV=development
PORT=3001
WEBSOCKET_PORT=8080
DATABASE_PATH=./walmart_grocery.db
OLLAMA_HOST=http://localhost:11434
NODE_OPTIONS=--max-old-space-size=2048
EOF
        echo -e "  ${GREEN}✓ .env file created${NC}"
    fi
}

# Function to start services
start_services() {
    echo -e "${YELLOW}Starting services...${NC}"
    
    # Start in background
    npm run dev > /dev/null 2>&1 &
    
    sleep 3
    
    # Check what started
    local services_up=0
    
    if lsof -i:3001 > /dev/null 2>&1; then
        echo -e "  ${GREEN}✓ API Server started${NC}"
        ((services_up++))
    else
        echo -e "  ${RED}✗ API Server failed to start${NC}"
    fi
    
    if lsof -i:8080 > /dev/null 2>&1; then
        echo -e "  ${GREEN}✓ WebSocket started${NC}"
        ((services_up++))
    else
        echo -e "  ${RED}✗ WebSocket failed to start${NC}"
    fi
    
    echo -e "${GREEN}✓ $services_up services started${NC}"
}

# Main menu
show_menu() {
    echo ""
    echo "Select fix to apply:"
    echo "1) Fix All (Recommended)"
    echo "2) Fix Ports Only"
    echo "3) Fix Database Only"
    echo "4) Fix WebSocket Only"
    echo "5) Fix Memory Only"
    echo "6) Fix Ollama Only"
    echo "7) Start Services"
    echo "8) Full Reset"
    echo "9) Exit"
    echo ""
    read -p "Enter choice [1-9]: " choice
}

# Full reset function
full_reset() {
    echo -e "${RED}⚠️  Full Reset - This will stop everything and restart${NC}"
    read -p "Are you sure? (y/n): " confirm
    
    if [ "$confirm" = "y" ]; then
        echo -e "${YELLOW}Performing full reset...${NC}"
        
        # Stop everything
        pkill -f node 2>/dev/null || true
        pkill -f ollama 2>/dev/null || true
        
        # Clear everything
        fix_ports
        fix_database_locks
        fix_websocket
        fix_memory
        
        # Rebuild
        echo "Rebuilding..."
        npm run build
        
        # Start everything
        fix_ollama
        start_services
        
        echo -e "${GREEN}✓ Full reset complete${NC}"
    fi
}

# Process menu choice
process_choice() {
    case $1 in
        1)
            fix_ports
            fix_database_locks
            fix_websocket
            fix_memory
            fix_ollama
            check_dependencies
            start_services
            ;;
        2)
            fix_ports
            ;;
        3)
            fix_database_locks
            ;;
        4)
            fix_websocket
            ;;
        5)
            fix_memory
            ;;
        6)
            fix_ollama
            ;;
        7)
            start_services
            ;;
        8)
            full_reset
            ;;
        9)
            echo "Exiting..."
            exit 0
            ;;
        *)
            echo -e "${RED}Invalid choice${NC}"
            ;;
    esac
}

# Main execution
main() {
    # If argument provided, use it
    if [ $# -eq 1 ]; then
        process_choice $1
    else
        show_menu
        process_choice $choice
    fi
    
    echo ""
    echo -e "${BLUE}=========================================="
    echo -e "Fix complete!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Run diagnostic: ./scripts/diagnostics/comprehensive_diagnostic.sh"
    echo "  2. Check monitor: http://localhost:3002/monitor"
    echo "  3. View logs: tail -f logs/*.log"
    echo ""
}

# Run main
main $@