#!/bin/bash

# Start Development Services
# This script starts all required services for development and testing

set -e

echo "🚀 Starting Development Services for AI Agent Team Framework"
echo "============================================================"

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to wait for a service to be ready
wait_for_service() {
    local url="$1"
    local service_name="$2"
    local max_attempts=30
    local attempt=1
    
    echo "⏳ Waiting for $service_name to be ready..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s -f "$url" >/dev/null 2>&1; then
            echo "✅ $service_name is ready!"
            return 0
        fi
        
        echo "   Attempt $attempt/$max_attempts: $service_name not ready yet..."
        sleep 2
        ((attempt++))
    done
    
    echo "❌ $service_name failed to start after $max_attempts attempts"
    return 1
}

# Check if Ollama is installed
if ! command_exists ollama; then
    echo "❌ Ollama is not installed. Please install it first:"
    echo "   curl -fsSL https://ollama.com/install.sh | sh"
    exit 1
fi

# Start Ollama server
echo "🔧 Starting Ollama server..."
ollama serve &
OLLAMA_PID=$!
echo "   Ollama server started with PID: $OLLAMA_PID"

# Wait for Ollama to be ready
if wait_for_service "http://localhost:11434/api/version" "Ollama"; then
    echo "🔍 Checking installed models..."
    
    # List current models
    INSTALLED_MODELS=$(ollama list)
    echo "   Currently installed models:"
    echo "$INSTALLED_MODELS" | tail -n +2 | awk '{print "   - " $1}'
    
    # Pull required models if not already installed
    REQUIRED_MODELS=("qwen3:8b" "qwen3:14b" "nomic-embed-text")
    
    for model in "${REQUIRED_MODELS[@]}"; do
        if ! echo "$INSTALLED_MODELS" | grep -q "$model"; then
            echo "📥 Pulling model: $model"
            ollama pull "$model"
        else
            echo "✅ Model already installed: $model"
        fi
    done
    
    echo "🎯 All required models are ready!"
else
    echo "❌ Failed to start Ollama server"
    exit 1
fi

# Check if ChromaDB should be started
if command_exists docker; then
    echo "🔧 Starting ChromaDB (optional for RAG features)..."
    
    # Check if ChromaDB container already exists
    if docker ps -a --format 'table {{.Names}}' | grep -q "chromadb"; then
        echo "   ChromaDB container already exists, starting it..."
        docker start chromadb >/dev/null 2>&1 || true
    else
        echo "   Creating new ChromaDB container..."
        docker run -d --name chromadb -p 8000:8000 chromadb/chroma:latest >/dev/null 2>&1 || true
    fi
    
    if wait_for_service "http://localhost:8000/api/v1/heartbeat" "ChromaDB"; then
        echo "✅ ChromaDB is ready and available for RAG features"
    else
        echo "⚠️  ChromaDB failed to start - RAG features will use in-memory storage"
    fi
else
    echo "⚠️  Docker not available - ChromaDB will not be started"
    echo "   RAG features will use in-memory storage fallback"
fi

# Display service status
echo ""
echo "🎉 Development services are ready!"
echo "================================="
echo "✅ Ollama: http://localhost:11434"
echo "✅ ChromaDB: http://localhost:8000 (if Docker is available)"
echo ""
echo "🚀 You can now start the development servers:"
echo "   pnpm dev:client   # Start frontend development server"
echo "   pnpm dev:server   # Start backend development server"
echo "   pnpm dev          # Start both (may have ESM issues with Node.js v22)"
echo ""
echo "🧪 Or run tests:"
echo "   pnpm test         # Run all tests"
echo "   pnpm test:unit    # Run unit tests"
echo "   pnpm test:integration # Run integration tests"
echo ""
echo "💡 To stop services:"
echo "   kill $OLLAMA_PID  # Stop Ollama"
echo "   docker stop chromadb  # Stop ChromaDB (if running)"
echo ""
echo "Press Ctrl+C to stop this script and keep services running in background"

# Keep script running to show logs
trap 'echo "Script stopped. Services are still running in background."; exit 0' SIGINT SIGTERM

echo "📋 Monitoring services... (Press Ctrl+C to exit)"
while true; do
    sleep 30
    if ! kill -0 $OLLAMA_PID 2>/dev/null; then
        echo "❌ Ollama server stopped unexpectedly"
        break
    fi
done