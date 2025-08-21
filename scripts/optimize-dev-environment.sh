#!/bin/bash

# Development Environment Optimization Script
# Fixes timeout issues and improves development server performance

set -e

echo "🔧 Optimizing Development Environment..."

# Kill existing dev servers to prevent conflicts
echo "🛑 Stopping existing development servers..."
pkill -f "vite" || echo "No Vite processes found"
pkill -f "tsx.*server.ts" || echo "No server processes found"
pkill -f "node.*server" || echo "No Node server processes found"

# Wait for processes to terminate
sleep 2

# Check for port conflicts and free them
echo "🔍 Checking for port conflicts..."
PORTS=(3000 3001 3210 5173 5178 8001)

for port in "${PORTS[@]}"; do
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "⚠️ Port $port is in use. Attempting to free it..."
        lsof -ti:$port | xargs kill -9 2>/dev/null || echo "Could not kill processes on port $port"
        sleep 1
    fi
done

# Create necessary directories
echo "📁 Creating necessary directories..."
mkdir -p logs/dev-server
mkdir -p browser-compatibility-results/chrome
mkdir -p browser-compatibility-results/firefox
mkdir -p browser-compatibility-results/safari
mkdir -p browser-compatibility-results/edge
mkdir -p test-results
mkdir -p screenshots

# Clean up old build artifacts and cache
echo "🧹 Cleaning up build artifacts and cache..."
rm -rf dist/ 2>/dev/null || true
rm -rf node_modules/.vite 2>/dev/null || true
rm -rf node_modules/.cache 2>/dev/null || true

# Set optimal environment variables
echo "🌍 Setting environment variables..."
export NODE_ENV=development
export NODE_OPTIONS="--max-old-space-size=4096 --optimize-for-size"
export VITE_PORT=5178
export BROWSER=none # Prevent auto-opening browsers

# Pre-warm dependency cache
echo "⚡ Pre-warming dependency cache..."
npm run build:client --silent 2>/dev/null || echo "Build cache warming completed"

# Start optimized development servers
echo "🚀 Starting optimized development servers..."

# Start backend server in background
echo "🔧 Starting backend server on port 3000..."
npm run dev:server > logs/dev-server/backend.log 2>&1 &
BACKEND_PID=$!

# Wait for backend to be ready
echo "⏳ Waiting for backend server..."
timeout=60
while [ $timeout -gt 0 ]; do
    if curl -s http://localhost:3000/health > /dev/null 2>&1 || curl -s http://localhost:3001/health > /dev/null 2>&1; then
        echo "✅ Backend server is ready"
        break
    fi
    sleep 1
    timeout=$((timeout - 1))
done

if [ $timeout -eq 0 ]; then
    echo "⚠️ Backend server may not be fully ready, but continuing..."
fi

# Start frontend server in background
echo "🎨 Starting frontend server on port 5178..."
VITE_PORT=5178 npm run dev:client:walmart > logs/dev-server/frontend.log 2>&1 &
FRONTEND_PID=$!

# Wait for frontend to be ready
echo "⏳ Waiting for frontend server..."
timeout=60
while [ $timeout -gt 0 ]; do
    if curl -s http://localhost:5178 > /dev/null 2>&1; then
        echo "✅ Frontend server is ready"
        break
    fi
    sleep 1
    timeout=$((timeout - 1))
done

if [ $timeout -eq 0 ]; then
    echo "❌ Frontend server failed to start within timeout"
    exit 1
fi

# Create PID files for later cleanup
echo $BACKEND_PID > logs/dev-server/backend.pid
echo $FRONTEND_PID > logs/dev-server/frontend.pid

echo "✅ Development environment optimized!"
echo ""
echo "🌐 Services running:"
echo "   Backend:  http://localhost:3000 (PID: $BACKEND_PID)"
echo "   Frontend: http://localhost:5178 (PID: $FRONTEND_PID)"
echo "   Walmart:  http://localhost:5178/walmart"
echo ""
echo "📋 Logs available at:"
echo "   Backend:  logs/dev-server/backend.log"
echo "   Frontend: logs/dev-server/frontend.log"
echo ""
echo "🛑 To stop servers: ./scripts/stop-dev-servers.sh"
echo ""
echo "🧪 Ready for testing!"