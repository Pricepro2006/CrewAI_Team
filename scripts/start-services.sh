#!/bin/bash

# Start all critical services for CrewAI Team

echo "🚀 Starting CrewAI Team Services..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Start Ollama service
echo "🤖 Starting Ollama..."
if ! curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    # Start Ollama in background
    ollama serve > /dev/null 2>&1 &
    echo "⏳ Waiting for Ollama to start..."
    sleep 5
    
    # Pull required models if not present
    echo "📥 Checking Ollama models..."
    if ! ollama list | grep -q "phi3:mini"; then
        echo "📥 Pulling phi3:mini model..."
        ollama pull phi3:mini
    fi
    if ! ollama list | grep -q "nomic-embed-text"; then
        echo "📥 Pulling nomic-embed-text model..."
        ollama pull nomic-embed-text
    fi
else
    echo "✅ Ollama is already running"
fi

# Start ChromaDB using Docker
echo "🔍 Starting ChromaDB..."
if ! curl -s http://localhost:8000/api/v1/heartbeat > /dev/null 2>&1; then
    docker run -d \
        --name chromadb \
        -p 8000:8000 \
        -v $(pwd)/data/chromadb:/chroma/chroma \
        -e IS_PERSISTENT=TRUE \
        -e ANONYMIZED_TELEMETRY=FALSE \
        chromadb/chroma:latest
    echo "⏳ Waiting for ChromaDB to start..."
    sleep 5
else
    echo "✅ ChromaDB is already running"
fi

# Check services status
echo ""
echo "📊 Service Status:"
echo "=================="

# Ollama status
if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "✅ Ollama: Running on port 11434"
else
    echo "❌ Ollama: Not responding"
fi

# ChromaDB status
if curl -s http://localhost:8000/api/v1/heartbeat > /dev/null 2>&1; then
    echo "✅ ChromaDB: Running on port 8000"
else
    echo "❌ ChromaDB: Not responding"
fi

echo ""
echo "🎯 Ready to start the API server with: npm run dev"