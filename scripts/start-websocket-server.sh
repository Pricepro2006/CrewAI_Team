#!/bin/bash

# WebSocket Server Startup Script
# Starts the WebSocket server on port 8080 with proper logging

set -e

echo "🚀 Starting WebSocket Server..."
echo "📍 Port: 8080"
echo "🔗 Endpoints:"
echo "   - General: ws://localhost:8080/ws"
echo "   - Walmart: ws://localhost:8080/ws/walmart"
echo "   - Health: http://localhost:8080/health"
echo ""

# Set environment variables
export WEBSOCKET_PORT=8080
export WEBSOCKET_HOST=localhost
export NODE_OPTIONS='--import tsx --experimental-specifier-resolution=node'

# Check if port is already in use
if lsof -Pi :8080 -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️  Port 8080 is already in use. Stopping existing process..."
    lsof -ti:8080 | xargs kill -9 || true
    sleep 2
fi

# Start the WebSocket server
echo "🎯 Starting WebSocket server..."
tsx src/api/websocket/server.ts

# Handle cleanup on exit
trap 'echo "🛑 Shutting down WebSocket server..."; kill 0' SIGINT SIGTERM EXIT