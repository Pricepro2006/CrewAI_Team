#!/bin/bash

# Script to restart services with new CORS configuration
# Date: January 21, 2025

echo "🔄 Restarting CrewAI Team services with CORS fix..."

# Kill existing processes
echo "🛑 Stopping existing services..."
kill $(lsof -ti:3001) 2>/dev/null || true
kill $(lsof -ti:3002) 2>/dev/null || true
kill $(lsof -ti:5175) 2>/dev/null || true
sleep 2

# Export environment variables
export NODE_ENV=development
export API_PORT=3001
export WS_PORT=3002
export CLIENT_PORT=5175
export ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,http://localhost:5174,http://localhost:5175
export NODE_OPTIONS='--experimental-specifier-resolution=node'

# Start backend server
echo "🚀 Starting backend server on port $API_PORT..."
cd /home/pricepro2006/CrewAI_Team
nohup node dist/api/server.js > backend.log 2>&1 &
BACKEND_PID=$!
echo "   Backend PID: $BACKEND_PID"

# Wait for backend to be ready
echo "⏳ Waiting for backend to be ready..."
sleep 3

# Test backend health
echo "🏥 Testing backend health..."
curl -s http://localhost:3001/health | jq '.' || echo "Health check failed"

# Start frontend in development mode
echo "🎨 Starting frontend on port $CLIENT_PORT..."
nohup npm run dev:client > frontend.log 2>&1 &
FRONTEND_PID=$!
echo "   Frontend PID: $FRONTEND_PID"

# Wait for frontend to be ready
sleep 5

# Test CORS configuration
echo ""
echo "🔍 Testing CORS configuration..."
echo "   Testing OPTIONS request from port 5175..."
curl -v -X OPTIONS http://localhost:3001/trpc \
  -H "Origin: http://localhost:5175" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" 2>&1 | grep -E "(< HTTP|< Access-Control)"

echo ""
echo "✅ Services restarted with CORS fix!"
echo ""
echo "📊 Service Status:"
echo "   - Backend: http://localhost:$API_PORT (PID: $BACKEND_PID)"
echo "   - WebSocket: ws://localhost:$WS_PORT/trpc-ws"
echo "   - Frontend: http://localhost:$CLIENT_PORT (PID: $FRONTEND_PID)"
echo ""
echo "📝 Logs:"
echo "   - Backend: tail -f backend.log"
echo "   - Frontend: tail -f frontend.log"
echo ""
echo "🛑 To stop services: kill $BACKEND_PID $FRONTEND_PID"