#!/bin/bash

# Start WebSocket Server on Port 8080
# This script starts the dedicated WebSocket server for real-time updates

set -e

echo "🚀 Starting WebSocket Server..."

# Set environment variables
export NODE_ENV=${NODE_ENV:-development}
export WEBSOCKET_PORT=8080
export WEBSOCKET_HOST=localhost

# Check if port 8080 is already in use
if lsof -i :8080 >/dev/null 2>&1; then
  echo "❌ Port 8080 is already in use"
  echo "🔍 Checking what's using port 8080:"
  lsof -i :8080
  exit 1
fi

echo "📋 WebSocket Server Configuration:"
echo "   Port: ${WEBSOCKET_PORT}"
echo "   Host: ${WEBSOCKET_HOST}"
echo "   Environment: ${NODE_ENV}"
echo ""

# Start the WebSocket server
echo "🎯 Starting WebSocket server on port ${WEBSOCKET_PORT}..."

if [[ "$NODE_ENV" == "development" ]]; then
  # Development mode with TypeScript support
  NODE_OPTIONS='--import tsx --experimental-specifier-resolution=node' \
  tsx src/api/websocket/server.ts
else
  # Production mode
  node dist/api/websocket/server.js
fi