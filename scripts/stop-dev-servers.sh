#!/bin/bash

# Stop Development Servers Script
# Cleanly stops all development servers

set -e

echo "🛑 Stopping development servers..."

# Stop servers by PID if available
if [ -f "logs/dev-server/backend.pid" ]; then
    BACKEND_PID=$(cat logs/dev-server/backend.pid)
    echo "Stopping backend server (PID: $BACKEND_PID)..."
    kill $BACKEND_PID 2>/dev/null || echo "Backend process already stopped"
    rm -f logs/dev-server/backend.pid
fi

if [ -f "logs/dev-server/frontend.pid" ]; then
    FRONTEND_PID=$(cat logs/dev-server/frontend.pid)
    echo "Stopping frontend server (PID: $FRONTEND_PID)..."
    kill $FRONTEND_PID 2>/dev/null || echo "Frontend process already stopped"
    rm -f logs/dev-server/frontend.pid
fi

# Kill any remaining processes
echo "🔍 Cleaning up remaining processes..."
pkill -f "vite" || echo "No Vite processes found"
pkill -f "tsx.*server.ts" || echo "No server processes found"
pkill -f "node.*server" || echo "No Node server processes found"

# Wait for cleanup
sleep 2

echo "✅ All development servers stopped"