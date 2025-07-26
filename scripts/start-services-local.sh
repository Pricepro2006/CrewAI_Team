#!/bin/bash

# CrewAI Team - Local Services Startup Script (No Docker)
# This script starts all required backend services locally without Docker

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
REDIS_PORT=6379
CHROMA_PORT=8000
OLLAMA_PORT=11434
SEARCH_PORT=8888
LOG_DIR="$PROJECT_ROOT/logs/services"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] ✓${NC} $1"
}

print_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] ⚠${NC} $1"
}

# Create log directory
mkdir -p "$LOG_DIR"

# Function to check if a port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Function to start Redis
start_redis() {
    print_status "Starting Redis..."
    
    if check_port $REDIS_PORT; then
        print_warning "Redis is already running on port $REDIS_PORT"
        return 0
    fi
    
    # Check if redis-server is installed
    if ! command -v redis-server &> /dev/null; then
        print_error "Redis is not installed. Please install it first:"
        echo "  wget http://download.redis.io/redis-stable.tar.gz"
        echo "  tar xzf redis-stable.tar.gz && cd redis-stable"
        echo "  make && sudo make install"
        return 1
    fi
    
    # Start Redis
    redis-server --daemonize yes \
        --port $REDIS_PORT \
        --dir "$PROJECT_ROOT/data/redis" \
        --logfile "$LOG_DIR/redis.log" \
        --pidfile "$LOG_DIR/redis.pid" \
        --appendonly yes \
        --maxmemory 256mb \
        --maxmemory-policy allkeys-lru
    
    sleep 2
    
    if redis-cli -p $REDIS_PORT ping >/dev/null 2>&1; then
        print_success "Redis started successfully on port $REDIS_PORT"
        return 0
    else
        print_error "Failed to start Redis"
        return 1
    fi
}

# Function to start ChromaDB
start_chromadb() {
    print_status "Starting ChromaDB..."
    
    if check_port $CHROMA_PORT; then
        print_warning "ChromaDB is already running on port $CHROMA_PORT"
        return 0
    fi
    
    # Check if chromadb is installed
    if ! python -c "import chromadb" 2>/dev/null; then
        print_error "ChromaDB is not installed. Installing..."
        pip install chromadb
    fi
    
    # Create ChromaDB startup script
    cat > "$LOG_DIR/chromadb_server.py" << 'EOF'
import chromadb
from chromadb.config import Settings
import uvicorn
from fastapi import FastAPI
from chromadb.server.fastapi import app as chroma_app

# Configure ChromaDB
settings = Settings(
    chroma_db_impl="duckdb+parquet",
    persist_directory="./data/chromadb",
    anonymized_telemetry=False
)

# Start the server
if __name__ == "__main__":
    uvicorn.run(chroma_app, host="0.0.0.0", port=8000, log_level="info")
EOF
    
    # Start ChromaDB in background
    cd "$PROJECT_ROOT"
    nohup python "$LOG_DIR/chromadb_server.py" > "$LOG_DIR/chromadb.log" 2>&1 &
    echo $! > "$LOG_DIR/chromadb.pid"
    
    sleep 5
    
    if curl -s "http://localhost:$CHROMA_PORT/api/v1/heartbeat" >/dev/null 2>&1; then
        print_success "ChromaDB started successfully on port $CHROMA_PORT"
        return 0
    else
        print_error "Failed to start ChromaDB"
        return 1
    fi
}

# Function to start Ollama
start_ollama() {
    print_status "Starting Ollama..."
    
    if check_port $OLLAMA_PORT; then
        print_warning "Ollama is already running on port $OLLAMA_PORT"
        return 0
    fi
    
    # Check if ollama is installed
    if ! command -v ollama &> /dev/null; then
        print_error "Ollama is not installed. Installing..."
        sudo curl -L https://ollama.com/download/ollama-linux-amd64 -o /usr/bin/ollama
        sudo chmod +x /usr/bin/ollama
    fi
    
    # Start Ollama service
    OLLAMA_HOST=0.0.0.0:$OLLAMA_PORT nohup ollama serve > "$LOG_DIR/ollama.log" 2>&1 &
    echo $! > "$LOG_DIR/ollama.pid"
    
    sleep 5
    
    if curl -s "http://localhost:$OLLAMA_PORT/api/version" >/dev/null 2>&1; then
        print_success "Ollama started successfully on port $OLLAMA_PORT"
        
        # Pull required models
        print_status "Checking Ollama models..."
        if ! ollama list | grep -q "phi3:mini"; then
            print_warning "Pulling phi3:mini model..."
            ollama pull phi3:mini
        fi
        if ! ollama list | grep -q "nomic-embed-text"; then
            print_warning "Pulling nomic-embed-text model..."
            ollama pull nomic-embed-text
        fi
        
        return 0
    else
        print_error "Failed to start Ollama"
        return 1
    fi
}

# Function to start Mock Search Service
start_search() {
    print_status "Starting Mock Search Service..."
    
    if check_port $SEARCH_PORT; then
        print_warning "Search service is already running on port $SEARCH_PORT"
        return 0
    fi
    
    # Create mock search service
    cat > "$LOG_DIR/mock_search_service.py" << 'EOF'
from fastapi import FastAPI, Query
from typing import Optional, List, Dict
import json

app = FastAPI(title="Mock Search Service")

# Mock search results
MOCK_RESULTS = {
    "default": [
        {
            "title": "Example Result 1",
            "url": "https://example.com/1",
            "content": "This is a mock search result for testing purposes."
        },
        {
            "title": "Example Result 2",
            "url": "https://example.com/2",
            "content": "Another mock result to simulate search functionality."
        }
    ]
}

@app.get("/search")
async def search(
    q: str = Query(..., description="Search query"),
    format: Optional[str] = Query("json", description="Response format")
):
    """Mock search endpoint compatible with SearXNG API"""
    results = MOCK_RESULTS.get(q, MOCK_RESULTS["default"])
    
    return {
        "query": q,
        "number_of_results": len(results),
        "results": results
    }

@app.get("/healthz")
async def health():
    """Health check endpoint"""
    return {"status": "ok"}

@app.get("/")
async def root():
    """Root endpoint"""
    return {"name": "Mock Search Service", "version": "1.0.0"}
EOF
    
    # Install required packages
    pip install fastapi uvicorn >/dev/null 2>&1
    
    # Start mock search service
    cd "$LOG_DIR"
    nohup python -m uvicorn mock_search_service:app --host 0.0.0.0 --port $SEARCH_PORT > "$LOG_DIR/search.log" 2>&1 &
    echo $! > "$LOG_DIR/search.pid"
    
    sleep 3
    
    if curl -s "http://localhost:$SEARCH_PORT/healthz" >/dev/null 2>&1; then
        print_success "Mock Search Service started successfully on port $SEARCH_PORT"
        return 0
    else
        print_error "Failed to start Mock Search Service"
        return 1
    fi
}

# Function to stop all services
stop_all() {
    print_status "Stopping all services..."
    
    # Stop Redis
    if [ -f "$LOG_DIR/redis.pid" ]; then
        PID=$(cat "$LOG_DIR/redis.pid")
        if kill -0 $PID 2>/dev/null; then
            redis-cli -p $REDIS_PORT shutdown
            print_success "Redis stopped"
        fi
        rm -f "$LOG_DIR/redis.pid"
    fi
    
    # Stop ChromaDB
    if [ -f "$LOG_DIR/chromadb.pid" ]; then
        PID=$(cat "$LOG_DIR/chromadb.pid")
        if kill -0 $PID 2>/dev/null; then
            kill $PID
            print_success "ChromaDB stopped"
        fi
        rm -f "$LOG_DIR/chromadb.pid"
    fi
    
    # Stop Ollama
    if [ -f "$LOG_DIR/ollama.pid" ]; then
        PID=$(cat "$LOG_DIR/ollama.pid")
        if kill -0 $PID 2>/dev/null; then
            kill $PID
            print_success "Ollama stopped"
        fi
        rm -f "$LOG_DIR/ollama.pid"
    fi
    
    # Stop Mock Search
    if [ -f "$LOG_DIR/search.pid" ]; then
        PID=$(cat "$LOG_DIR/search.pid")
        if kill -0 $PID 2>/dev/null; then
            kill $PID
            print_success "Mock Search Service stopped"
        fi
        rm -f "$LOG_DIR/search.pid"
    fi
}

# Function to show status
show_status() {
    print_status "Service Status:"
    echo ""
    
    # Redis
    if check_port $REDIS_PORT; then
        print_success "Redis: Running on port $REDIS_PORT"
    else
        print_error "Redis: Not running"
    fi
    
    # ChromaDB
    if check_port $CHROMA_PORT; then
        print_success "ChromaDB: Running on port $CHROMA_PORT"
    else
        print_error "ChromaDB: Not running"
    fi
    
    # Ollama
    if check_port $OLLAMA_PORT; then
        print_success "Ollama: Running on port $OLLAMA_PORT"
    else
        print_error "Ollama: Not running"
    fi
    
    # Search
    if check_port $SEARCH_PORT; then
        print_success "Search Service: Running on port $SEARCH_PORT"
    else
        print_error "Search Service: Not running"
    fi
}

# Main execution
main() {
    print_status "Starting CrewAI Team Backend Services (Local Mode)..."
    echo ""
    
    # Create necessary directories
    mkdir -p "$PROJECT_ROOT/data/redis"
    mkdir -p "$PROJECT_ROOT/data/chromadb"
    
    # Start services
    start_redis
    start_chromadb
    start_ollama
    start_search
    
    echo ""
    print_success "All services started successfully!"
    echo ""
    echo "Service URLs:"
    echo "  - Redis:    redis://localhost:$REDIS_PORT"
    echo "  - ChromaDB: http://localhost:$CHROMA_PORT"
    echo "  - Ollama:   http://localhost:$OLLAMA_PORT"
    echo "  - Search:   http://localhost:$SEARCH_PORT"
    echo ""
    echo "Logs are available in: $LOG_DIR"
    echo ""
    echo "To stop all services, run:"
    echo "  $0 stop"
    echo ""
    echo "🎯 Ready to start the API server with: npm run dev"
}

# Handle command line arguments
case "${1:-start}" in
    start)
        main
        ;;
    stop)
        stop_all
        ;;
    restart)
        stop_all
        sleep 2
        main
        ;;
    status)
        show_status
        ;;
    logs)
        if [ -z "$2" ]; then
            tail -f "$LOG_DIR"/*.log
        else
            tail -f "$LOG_DIR/$2.log"
        fi
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|logs [service_name]}"
        exit 1
        ;;
esac