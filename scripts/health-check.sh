#!/bin/bash

# Service Health Check for Tests
check_service() {
    local service_name=$1
    local url=$2
    local timeout=${3:-5}
    
    if curl -s --max-time $timeout "$url" > /dev/null 2>&1; then
        echo "✅ $service_name: Healthy"
        return 0
    else
        echo "❌ $service_name: Not responding"
        return 1
    fi
}

echo "🔍 Checking service health..."

check_service "Backend API" "http://localhost:3001/health" 10
backend_status=$?

check_service "Frontend" "http://localhost:5178/walmart" 10
frontend_status=$?

check_service "Ollama LLM" "http://localhost:11434/api/tags" 5
ollama_status=$?

# Check WebSocket via health endpoint
if curl -s --max-time 5 "http://localhost:8080/health" > /dev/null 2>&1; then
    echo "✅ WebSocket Server: Running on port 8080"
    websocket_status=0
else
    echo "❌ WebSocket Server: Not responding on port 8080"
    websocket_status=1
fi

# Calculate overall health
total_issues=$((backend_status + frontend_status + ollama_status + websocket_status))

if [ $total_issues -eq 0 ]; then
    echo ""
    echo "🎯 All services are healthy! Ready for testing."
    exit 0
else
    echo ""
    echo "⚠️  $total_issues service(s) have issues. Check logs before running tests."
    exit 1
fi
