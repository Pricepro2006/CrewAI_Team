#!/bin/bash

# CrewAI Team Framework - Full System Startup Script
# This script launches all required services for comprehensive testing

echo "🚀 Starting CrewAI Team Framework Full System Test"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to log with timestamp
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

# Function to check if service is running
check_service() {
    local url=$1
    local name=$2
    local timeout=${3:-30}
    
    log "Checking ${name}..."
    for i in $(seq 1 $timeout); do
        if curl -s "$url" > /dev/null 2>&1; then
            echo -e "${GREEN}✅ ${name} is running${NC}"
            return 0
        fi
        sleep 1
    done
    echo -e "${RED}❌ ${name} failed to start${NC}"
    return 1
}

# Step 1: Verify Ollama is running
log "Step 1: Verifying Ollama service..."
if ! check_service "http://localhost:11434/api/tags" "Ollama" 10; then
    echo -e "${YELLOW}Starting Ollama...${NC}"
    ollama serve &
    OLLAMA_PID=$!
    sleep 5
    if ! check_service "http://localhost:11434/api/tags" "Ollama" 30; then
        echo -e "${RED}Failed to start Ollama. Exiting.${NC}"
        exit 1
    fi
fi

# Step 2: Install dependencies if needed
log "Step 2: Installing dependencies..."
if [ ! -d "node_modules" ]; then
    pnpm install
fi

# Step 3: Build the project
log "Step 3: Building project..."
pnpm build

# Step 4: Start backend server
log "Step 4: Starting backend server..."
pnpm dev:server &
SERVER_PID=$!
sleep 8

if ! check_service "http://localhost:3000/health" "Backend Server" 20; then
    echo -e "${RED}Backend server failed to start${NC}"
    kill $SERVER_PID 2>/dev/null
    exit 1
fi

# Step 5: Start frontend client
log "Step 5: Starting frontend client..."
pnpm dev:client &
CLIENT_PID=$!
sleep 10

if ! check_service "http://localhost:5173" "Frontend Client" 30; then
    echo -e "${RED}Frontend client failed to start${NC}"
    kill $SERVER_PID $CLIENT_PID 2>/dev/null
    exit 1
fi

# Step 6: Final system verification
log "Step 6: Final system verification..."
echo -e "${GREEN}🎉 All services are running successfully!${NC}"
echo ""
echo "📊 Service Status:"
echo "  • Frontend: http://localhost:5173"
echo "  • Backend:  http://localhost:3000"
echo "  • Ollama:   http://localhost:11434"
echo ""
echo "🔗 Service Endpoints:"
echo "  • Health Check: http://localhost:3000/health"
echo "  • tRPC API:     http://localhost:3000/trpc"
echo "  • WebSocket:    ws://localhost:3001/trpc-ws"
echo ""

# Save PIDs for cleanup
echo "$SERVER_PID" > .server.pid
echo "$CLIENT_PID" > .client.pid
echo "${OLLAMA_PID:-}" > .ollama.pid

echo -e "${BLUE}💡 To stop all services, run: ./stop-system.sh${NC}"
echo -e "${BLUE}🧪 System is ready for comprehensive testing!${NC}"

# Keep script running
wait