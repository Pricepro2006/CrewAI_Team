#!/bin/bash

# Quick System Startup - Using existing models
echo "🚀 Quick Start: TypeScript AI Enterprise Assistant"
echo "================================================="

# 1. Check Ollama
echo "✅ Ollama is running with models:"
ollama list

# 2. Build client
echo "🔨 Building client..."
pnpm build:client

# 3. Start backend (if not running)
if ! curl -s --max-time 3 "http://localhost:3000/health" > /dev/null 2>&1; then
    echo "🚀 Starting backend..."
    NODE_ENV=production node dist/server/index.js &
    echo "⏳ Waiting for backend to start..."
    sleep 10
fi

# 4. Check frontend port
FRONTEND_PORT=5173
for port in 5173 5174 5175 5176; do
    if curl -s --max-time 3 "http://localhost:$port" > /dev/null 2>&1; then
        FRONTEND_PORT=$port
        break
    fi
done

if ! curl -s --max-time 3 "http://localhost:$FRONTEND_PORT" > /dev/null 2>&1; then
    echo "🚀 Starting frontend..."
    pnpm dev:client &
    sleep 8
    
    # Check again for actual port
    for port in 5173 5174 5175 5176; do
        if curl -s --max-time 3 "http://localhost:$port" > /dev/null 2>&1; then
            FRONTEND_PORT=$port
            break
        fi
    done
fi

# 5. System status
echo "🏥 System Status:"
echo "Frontend: http://localhost:$FRONTEND_PORT"
echo "Backend: http://localhost:3000"
curl -s http://localhost:3000/health | head -100

# Save status for testing
cat > system-status.json << EOF
{
    "frontend_url": "http://localhost:$FRONTEND_PORT",
    "backend_url": "http://localhost:3000",
    "ollama_url": "http://localhost:11434",
    "websocket_url": "ws://localhost:3001/trpc-ws",
    "status": "ready",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

echo "✅ System ready for testing!"