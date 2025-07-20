#!/bin/bash

# TypeScript AI Enterprise Assistant - Full System Startup Script
# This script starts all required services for comprehensive testing

set -e

echo "🚀 Starting TypeScript AI Enterprise Assistant - Full System"
echo "==========================================================="

# Function to check if a service is running
check_service() {
    local port=$1
    local service=$2
    if curl -s --max-time 5 "http://localhost:$port/health" > /dev/null 2>&1; then
        echo "✅ $service is running on port $port"
        return 0
    else
        echo "❌ $service is not running on port $port"
        return 1
    fi
}

# Function to wait for service to be ready
wait_for_service() {
    local port=$1
    local service=$2
    local max_attempts=30
    local attempt=0
    
    echo "⏳ Waiting for $service to be ready on port $port..."
    
    while [ $attempt -lt $max_attempts ]; do
        if check_service $port "$service"; then
            return 0
        fi
        
        attempt=$((attempt + 1))
        echo "   Attempt $attempt/$max_attempts - waiting 2 seconds..."
        sleep 2
    done
    
    echo "❌ $service failed to start within $((max_attempts * 2)) seconds"
    return 1
}

# 1. Check if Ollama is running
echo "🔍 Checking Ollama status..."
if ! pgrep -f "ollama" > /dev/null; then
    echo "🚀 Starting Ollama service..."
    ollama serve &
    sleep 3
fi

# Verify Ollama is accessible
if ! curl -s http://localhost:11434/api/tags > /dev/null; then
    echo "❌ Ollama is not accessible at http://localhost:11434"
    exit 1
fi
echo "✅ Ollama is running and accessible"

# 2. Check required models are available
echo "🔍 Checking required Ollama models..."
REQUIRED_MODELS=("qwen2.5:0.5b" "qwen2.5:1.5b" "qwen2.5:3b" "nomic-embed-text")

for model in "${REQUIRED_MODELS[@]}"; do
    if ollama list | grep -q "$model"; then
        echo "✅ Model $model is available"
    else
        echo "⚠️  Model $model not found - pulling now..."
        ollama pull "$model"
    fi
done

# 3. Build the project
echo "🔨 Building project..."
pnpm build:client || {
    echo "❌ Client build failed"
    exit 1
}

# 4. Check if backend server is already running
echo "🔍 Checking backend server status..."
if ! check_service 3000 "Backend API"; then
    echo "🚀 Starting backend server..."
    
    # Start backend server in background
    NODE_ENV=production node dist/server/index.js &
    BACKEND_PID=$!
    
    # Wait for backend to be ready
    if ! wait_for_service 3000 "Backend API"; then
        echo "❌ Backend server failed to start"
        kill $BACKEND_PID 2>/dev/null || true
        exit 1
    fi
    
    echo "✅ Backend server started successfully (PID: $BACKEND_PID)"
else
    echo "✅ Backend server is already running"
fi

# 5. Check if frontend server is running
echo "🔍 Checking frontend server status..."
FRONTEND_PORT=5173
if ! curl -s --max-time 5 "http://localhost:$FRONTEND_PORT" > /dev/null 2>&1; then
    echo "🚀 Starting frontend server..."
    
    # Start frontend server in background
    pnpm dev:client &
    FRONTEND_PID=$!
    
    # Wait for frontend to be ready
    sleep 10
    
    # Check if frontend is accessible
    local_attempt=0
    while [ $local_attempt -lt 15 ]; do
        if curl -s --max-time 5 "http://localhost:$FRONTEND_PORT" > /dev/null 2>&1; then
            echo "✅ Frontend server is running on port $FRONTEND_PORT"
            break
        fi
        
        # Check alternative ports
        for port in 5174 5175 5176; do
            if curl -s --max-time 5 "http://localhost:$port" > /dev/null 2>&1; then
                FRONTEND_PORT=$port
                echo "✅ Frontend server is running on port $port"
                break 2
            fi
        done
        
        local_attempt=$((local_attempt + 1))
        echo "   Waiting for frontend... attempt $local_attempt/15"
        sleep 2
    done
    
    if [ $local_attempt -eq 15 ]; then
        echo "❌ Frontend server failed to start"
        exit 1
    fi
else
    echo "✅ Frontend server is already running on port $FRONTEND_PORT"
fi

# 6. Final system health check
echo "🏥 Performing final system health check..."
echo "==========================================="

# Check all services
echo "Backend API Health:"
curl -s http://localhost:3000/health | jq '.' 2>/dev/null || curl -s http://localhost:3000/health

echo -e "\nDetailed Backend Health:"
curl -s http://localhost:3000/trpc/health.detailed | jq '.' 2>/dev/null || curl -s http://localhost:3000/trpc/health.detailed

echo -e "\nOllama Models:"
ollama list

echo -e "\n✅ System Status Summary:"
echo "========================"
echo "🔗 Frontend UI: http://localhost:$FRONTEND_PORT"
echo "🔗 Backend API: http://localhost:3000"
echo "🔗 tRPC Endpoint: http://localhost:3000/trpc"
echo "🔗 Health Check: http://localhost:3000/health"
echo "🔗 Ollama API: http://localhost:11434"
echo "🔗 WebSocket: ws://localhost:3001/trpc-ws"

echo -e "\n🎉 All services are running successfully!"
echo "Ready for comprehensive testing with Playwright and Puppeteer"
echo "============================================================"

# Save service info for testing
cat > system-status.json << EOF
{
    "frontend_url": "http://localhost:$FRONTEND_PORT",
    "backend_url": "http://localhost:3000",
    "ollama_url": "http://localhost:11434",
    "websocket_url": "ws://localhost:3001/trpc-ws",
    "status": "ready",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

echo "📋 System configuration saved to system-status.json"