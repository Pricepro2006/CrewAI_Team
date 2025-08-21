#!/bin/bash

# Setup script for test environment
# This script ensures all necessary services are running for integration tests

set -e

echo "🚀 Setting up test environment..."

# Function to check if a service is healthy
check_service() {
    local service=$1
    local url=$2
    local max_attempts=30
    local attempt=0

    echo -n "Checking $service..."
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -s -f "$url" > /dev/null 2>&1; then
            echo " ✅"
            return 0
        fi
        echo -n "."
        sleep 1
        attempt=$((attempt + 1))
    done
    
    echo " ❌"
    return 1
}

# Start services if not running
if ! docker-compose -f docker-compose.test.yml ps | grep -q "ollama-test.*Up"; then
    echo "Starting test services..."
    docker-compose -f docker-compose.test.yml up -d
    sleep 5
fi

# Wait for services to be healthy
check_service "Ollama" "http://localhost:8081/api/tags" || {
    echo "❌ Ollama is not responding. Please check the service."
    exit 1
}

check_service "ChromaDB" "http://localhost:8000/api/v1/heartbeat" || {
    echo "❌ ChromaDB is not responding. Please check the service."
    exit 1
}

check_service "Redis" "http://localhost:6379" || {
    # Redis doesn't have HTTP endpoint, check with redis-cli
    if ! docker exec crewai-redis-test redis-cli ping > /dev/null 2>&1; then
        echo "❌ Redis is not responding. Please check the service."
        exit 1
    fi
    echo "Checking Redis... ✅"
}

# Pull required Ollama models for tests
echo "Ensuring test models are available..."
docker exec crewai-ollama-test ollama pull llama3.2:3b || true
docker exec crewai-ollama-test ollama pull nomic-embed-text || true

echo "✅ Test environment is ready!"
echo ""
echo "To run tests:"
echo "  - Unit tests: pnpm test:unit"
echo "  - Integration tests: pnpm test:integration"
echo "  - All tests: pnpm test"
echo ""
echo "To stop test services: docker-compose -f docker-compose.test.yml down"