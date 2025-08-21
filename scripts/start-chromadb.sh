#!/bin/bash

# ChromaDB Startup Script
echo "🚀 Starting ChromaDB Service..."

# Check if Docker is available
if command -v docker &> /dev/null; then
    echo "✅ Docker found. Starting ChromaDB via Docker..."
    
    # Stop any existing ChromaDB container
    docker stop chromadb 2>/dev/null
    docker rm chromadb 2>/dev/null
    
    # Start ChromaDB
    docker run -d \
        --name chromadb \
        -p 8000:8000 \
        chromadb/chroma:latest
    
    echo "⏳ Waiting for ChromaDB to start..."
    sleep 5
    
    # Check if it's running
    if curl -s http://localhost:8000/api/v1/heartbeat > /dev/null; then
        echo "✅ ChromaDB is running on port 8000"
    else
        echo "❌ Failed to start ChromaDB via Docker"
        exit 1
    fi
else
    echo "⚠️ Docker not found. Installing ChromaDB locally..."
    
    # Try to use existing Python ChromaDB installation
    if command -v chroma &> /dev/null; then
        echo "✅ ChromaDB CLI found. Starting local instance..."
        nohup chroma run --host 0.0.0.0 --port 8000 > /tmp/chromadb.log 2>&1 &
        echo $! > /tmp/chromadb.pid
        
        echo "⏳ Waiting for ChromaDB to start..."
        sleep 5
        
        if curl -s http://localhost:8000/api/v1/heartbeat > /dev/null; then
            echo "✅ ChromaDB is running on port 8000"
        else
            echo "❌ Failed to start ChromaDB locally"
            exit 1
        fi
    else
        echo "Installing ChromaDB..."
        pip install chromadb
        
        # Try again after installation
        nohup chroma run --host 0.0.0.0 --port 8000 > /tmp/chromadb.log 2>&1 &
        echo $! > /tmp/chromadb.pid
        
        echo "⏳ Waiting for ChromaDB to start..."
        sleep 5
        
        if curl -s http://localhost:8000/api/v1/heartbeat > /dev/null; then
            echo "✅ ChromaDB is running on port 8000"
        else
            echo "❌ Failed to start ChromaDB after installation"
            exit 1
        fi
    fi
fi

echo "✅ ChromaDB service started successfully!"
echo "📊 Status endpoint: http://localhost:8000/api/v1/heartbeat"