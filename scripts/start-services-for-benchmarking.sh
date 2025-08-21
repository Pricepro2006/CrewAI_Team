#!/bin/bash
# Start all services needed for performance benchmarking

set -e

echo "🚀 Starting Walmart Grocery Agent services for performance benchmarking..."

# Navigate to project directory
cd "$(dirname "$0")/.."

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check if port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${YELLOW}Port $port is already in use${NC}"
        return 0
    else
        return 1
    fi
}

# Function to wait for service to be ready
wait_for_service() {
    local url=$1
    local name=$2
    local max_attempts=${3:-30}
    local attempt=1
    
    echo -n "Waiting for $name to be ready..."
    while [ $attempt -le $max_attempts ]; do
        if curl -s "$url" >/dev/null 2>&1 || curl -s "$url/health" >/dev/null 2>&1; then
            echo -e " ${GREEN}✅ Ready!${NC}"
            return 0
        fi
        
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo -e " ${RED}❌ Failed to start${NC}"
    return 1
}

# Function to start service in background
start_service() {
    local command=$1
    local name=$2
    local port=$3
    local log_file="logs/benchmark-${name,,}.log"
    
    # Create logs directory
    mkdir -p logs
    
    echo -e "${BLUE}Starting $name...${NC}"
    
    # Start the service
    eval "$command" > "$log_file" 2>&1 &
    local pid=$!
    
    # Store PID for cleanup
    echo "$pid" >> "logs/benchmark.pids"
    
    echo "PID $pid: $name (Port $port, Log: $log_file)"
    
    # Wait for service to be ready
    if wait_for_service "http://localhost:$port" "$name"; then
        return 0
    else
        echo -e "${RED}Failed to start $name${NC}"
        return 1
    fi
}

# Cleanup function
cleanup() {
    echo -e "\n${YELLOW}Cleaning up services...${NC}"
    
    if [ -f "logs/benchmark.pids" ]; then
        while read -r pid; do
            if [ -n "$pid" ]; then
                kill $pid 2>/dev/null || true
                echo "Stopped PID $pid"
            fi
        done < "logs/benchmark.pids"
        rm -f "logs/benchmark.pids"
    fi
    
    # Kill any remaining processes on our ports
    local ports=(3000 3006 3007 3008 3009 3010 5178 8080)
    for port in "${ports[@]}"; do
        local pid=$(lsof -ti:$port 2>/dev/null || true)
        if [ -n "$pid" ]; then
            kill $pid 2>/dev/null || true
            echo "Stopped service on port $port"
        fi
    done
}

# Set up cleanup trap
trap cleanup EXIT INT TERM

# Initialize PIDs file
rm -f logs/benchmark.pids
touch logs/benchmark.pids

echo -e "${BLUE}Checking prerequisites...${NC}"

# Check if npm/node is available
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not installed${NC}"
    exit 1
fi

# Check if Ollama is running
if ! pgrep -f "ollama serve" > /dev/null; then
    echo -e "${RED}❌ Ollama is not running. Please start Ollama first:${NC}"
    echo "ollama serve"
    exit 1
fi

# Check if required models are available
if ! ollama list | grep -q "qwen3"; then
    echo -e "${YELLOW}⚠️  Qwen3 model not found. Pulling model...${NC}"
    ollama pull qwen3:0.6b || {
        echo -e "${RED}❌ Failed to pull Qwen3 model${NC}"
        exit 1
    }
fi

echo -e "${GREEN}✅ Prerequisites check passed${NC}\n"

# Start services in order
echo -e "${BLUE}Starting core services...${NC}"

# 1. Start main API server (handles tRPC, database, etc.)
if ! check_port 3000; then
    start_service "npm run dev:server" "Main API Server" 3000 || exit 1
else
    echo -e "${GREEN}✅ Main API Server already running on port 3000${NC}"
fi

sleep 5

# 2. Start frontend development server
if ! check_port 5178; then
    start_service "VITE_PORT=5178 npm run dev:client" "Frontend Dev Server" 5178 || exit 1
else
    echo -e "${GREEN}✅ Frontend already running on port 5178${NC}"
fi

sleep 3

echo -e "${BLUE}Starting microservices...${NC}"

# 3. Start NLP Service
if ! check_port 3008; then
    start_service "tsx src/microservices/nlp-service/NLPServiceServer.ts" "NLP Service" 3008 || exit 1
else
    echo -e "${GREEN}✅ NLP Service already running on port 3008${NC}"
fi

# 4. Start Pricing Service  
if ! check_port 3007; then
    start_service "tsx src/microservices/pricing-service/PricingServiceServer.ts" "Pricing Service" 3007 || exit 1
else
    echo -e "${GREEN}✅ Pricing Service already running on port 3007${NC}"
fi

# 5. Start Cache Warmer Service
if ! check_port 3006; then
    start_service "tsx src/microservices/cache-warmer/server.ts" "Cache Service" 3006 || exit 1
else
    echo -e "${GREEN}✅ Cache Service already running on port 3006${NC}"
fi

# 6. Start WebSocket Server
if ! check_port 8080; then
    start_service "tsx src/api/websocket/WalmartWebSocketServer.ts" "WebSocket Server" 8080 || exit 1
else
    echo -e "${GREEN}✅ WebSocket Server already running on port 8080${NC}"
fi

echo -e "\n${GREEN}🎉 All services started successfully!${NC}\n"

# Display service status
echo -e "${BLUE}Service Status:${NC}"
echo "┌─────────────────────┬──────┬──────────────────────────────┐"
echo "│ Service             │ Port │ URL                          │"
echo "├─────────────────────┼──────┼──────────────────────────────┤"
echo "│ Main API Server     │ 3000 │ http://localhost:3000        │"
echo "│ Frontend            │ 5178 │ http://localhost:5178        │"
echo "│ NLP Service         │ 3008 │ http://localhost:3008        │"
echo "│ Pricing Service     │ 3007 │ http://localhost:3007        │"
echo "│ Cache Service       │ 3006 │ http://localhost:3006        │"
echo "│ WebSocket Server    │ 8080 │ http://localhost:8080        │"
echo "└─────────────────────┴──────┴──────────────────────────────┘"

echo -e "\n${YELLOW}Ready for performance benchmarking!${NC}"
echo -e "Run: ${GREEN}tsx src/scripts/comprehensive-performance-benchmark.ts${NC}"
echo ""
echo -e "${YELLOW}To stop all services, press Ctrl+C or run:${NC}"
echo -e "${GREEN}pkill -f 'tsx.*microservices'${NC}"
echo ""

# Keep the script running to maintain services
echo -e "${BLUE}Services running... Press Ctrl+C to stop all services${NC}"

# Wait for interrupt
while true; do
    sleep 60
    # Quick health check
    for service in "Main API:3000" "Frontend:5178" "NLP:3008" "Pricing:3007" "Cache:3006" "WebSocket:8080"; do
        name=$(echo $service | cut -d: -f1)
        port=$(echo $service | cut -d: -f2)
        if ! check_port $port; then
            echo -e "${RED}⚠️ $name (port $port) is no longer running${NC}"
        fi
    done
done