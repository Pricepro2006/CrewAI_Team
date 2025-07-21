#!/bin/bash

# Simple Staging Deployment Script
# Uses existing build artifacts and runs services in staging mode

set -euo pipefail

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Build the project
log_info "Building the project..."
npm run build:production || {
    log_error "Production build failed"
    exit 1
}

# Create staging environment file
log_info "Creating staging environment file..."
cat > .env.staging << EOF
NODE_ENV=staging
PORT=3001
WS_PORT=3002
DATABASE_PATH=./data/app.db
OLLAMA_URL=http://localhost:11434
CHROMA_URL=http://localhost:8000
LOG_LEVEL=info
EOF

# Ensure services are running
log_info "Checking required services..."

# Check Ollama
if ! curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    log_warn "Ollama not running. Starting..."
    ./scripts/start-services.sh
    sleep 10
fi

# Check ChromaDB
if ! curl -s http://localhost:8000/api/v1/heartbeat > /dev/null 2>&1; then
    log_warn "ChromaDB not running. Please start it with: docker start ai-agent-chromadb"
fi

# Run the application in staging mode
log_info "Starting application in staging mode..."

# Kill any existing processes on our ports
lsof -ti:3001 | xargs kill -9 2>/dev/null || true
lsof -ti:3002 | xargs kill -9 2>/dev/null || true

# Start the server with staging config
export NODE_ENV=staging
export PORT=3001
export WS_PORT=3002
export NODE_OPTIONS='--experimental-specifier-resolution=node'

log_info "Starting API server on port 3001..."
nohup node dist/api/server.js > staging.log 2>&1 &
API_PID=$!

sleep 5

# Check if server started
if ps -p $API_PID > /dev/null; then
    log_info "API server started successfully (PID: $API_PID)"
    
    # Test the health endpoint
    if curl -s http://localhost:3001/health | grep -q "ok"; then
        log_info "✅ Health check passed!"
    else
        log_warn "Health check failed - server may still be starting"
    fi
    
    echo ""
    echo "🎉 Staging deployment completed!"
    echo ""
    echo "📋 Service URLs:"
    echo "   - API: http://localhost:3001"
    echo "   - WebSocket: ws://localhost:3002"
    echo "   - Ollama: http://localhost:11434"
    echo "   - ChromaDB: http://localhost:8000"
    echo ""
    echo "📝 Useful commands:"
    echo "   - View logs: tail -f staging.log"
    echo "   - Stop server: kill $API_PID"
    echo "   - Check status: ps -p $API_PID"
    echo ""
else
    log_error "Failed to start API server. Check staging.log for details."
    exit 1
fi