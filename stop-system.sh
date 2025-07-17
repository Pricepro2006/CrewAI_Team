#!/bin/bash

# CrewAI Team Framework - System Shutdown Script

echo "🛑 Stopping CrewAI Team Framework..."

# Kill services using saved PIDs
if [ -f ".server.pid" ]; then
    PID=$(cat .server.pid)
    if [ ! -z "$PID" ]; then
        kill $PID 2>/dev/null && echo "✅ Backend server stopped"
    fi
    rm .server.pid
fi

if [ -f ".client.pid" ]; then
    PID=$(cat .client.pid)
    if [ ! -z "$PID" ]; then
        kill $PID 2>/dev/null && echo "✅ Frontend client stopped"
    fi
    rm .client.pid
fi

if [ -f ".ollama.pid" ]; then
    PID=$(cat .ollama.pid)
    if [ ! -z "$PID" ] && [ "$PID" != "" ]; then
        kill $PID 2>/dev/null && echo "✅ Ollama stopped"
    fi
    rm .ollama.pid
fi

# Cleanup any remaining processes
pkill -f "pnpm dev:server" 2>/dev/null
pkill -f "pnpm dev:client" 2>/dev/null

echo "🏁 All services stopped"