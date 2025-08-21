#!/bin/bash

# Monitoring System Startup Script
# Starts the comprehensive monitoring system for Walmart Grocery Agent

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MONITORING_LOG_DIR="$PROJECT_ROOT/logs/monitoring"

# Create logs directory
mkdir -p "$MONITORING_LOG_DIR"

echo -e "${BLUE}🔍 Walmart Grocery Agent - Monitoring System${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js first.${NC}"
    exit 1
fi

# Check if TypeScript is available
if ! command -v npx &> /dev/null; then
    echo -e "${RED}❌ npx is not available. Please install npm first.${NC}"
    exit 1
fi

# Check if project dependencies are installed
if [ ! -d "$PROJECT_ROOT/node_modules" ]; then
    echo -e "${YELLOW}⚠️  Dependencies not found. Installing...${NC}"
    cd "$PROJECT_ROOT"
    npm install
fi

# Set environment variables
export NODE_ENV="${NODE_ENV:-development}"
export MONITORING_API_PORT="${MONITORING_API_PORT:-3002}"
export MONITORING_WS_PORT="${MONITORING_WS_PORT:-3003}"

echo -e "${GREEN}✅ Environment configured${NC}"
echo -e "   • API Port: $MONITORING_API_PORT"
echo -e "   • WebSocket Port: $MONITORING_WS_PORT"
echo -e "   • Environment: $NODE_ENV"

# Check if monitoring TypeScript file exists
MONITORING_SCRIPT="$PROJECT_ROOT/scripts/monitoring/start-monitoring.ts"
if [ ! -f "$MONITORING_SCRIPT" ]; then
    echo -e "${RED}❌ Monitoring script not found: $MONITORING_SCRIPT${NC}"
    exit 1
fi

# Function to cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}🛑 Shutting down monitoring system...${NC}"
    # Kill any remaining processes
    pkill -f "start-monitoring.ts" || true
    pkill -f "monitoring" || true
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

echo -e "${GREEN}🚀 Starting monitoring system...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Start the monitoring system
cd "$PROJECT_ROOT"

# Check if we should run in development mode with live reload
if [ "$NODE_ENV" = "development" ]; then
    echo -e "${YELLOW}🔧 Running in development mode with live reload${NC}"
    
    # Use ts-node for development with live reload
    if command -v tsx &> /dev/null; then
        npx tsx "$MONITORING_SCRIPT"
    elif command -v ts-node &> /dev/null; then
        npx ts-node "$MONITORING_SCRIPT"
    else
        echo -e "${YELLOW}⚠️  Installing tsx for development...${NC}"
        npm install --save-dev tsx
        npx tsx "$MONITORING_SCRIPT"
    fi
else
    echo -e "${GREEN}🏭 Running in production mode${NC}"
    
    # Compile TypeScript first
    echo -e "${YELLOW}📦 Compiling TypeScript...${NC}"
    npx tsc --project tsconfig.json --outDir dist/monitoring
    
    # Run compiled JavaScript
    node "dist/monitoring/scripts/monitoring/start-monitoring.js"
fi

# This point should not be reached unless there's an error
echo -e "${RED}❌ Monitoring system exited unexpectedly${NC}"
exit 1