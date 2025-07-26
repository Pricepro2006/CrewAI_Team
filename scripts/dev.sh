#!/bin/bash

# AI Agent Team Development Script
# This script handles the ESM/TypeScript issues with Node.js v22

set -e

echo "🚀 Starting AI Agent Team Development Environment"
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo -e "${RED}❌ pnpm is not installed. Please install it first:${NC}"
    echo "npm install -g pnpm"
    exit 1
fi

# Check if Ollama is running
if ! curl -s http://localhost:11434/api/tags > /dev/null; then
    echo -e "${YELLOW}⚠️  Ollama is not running. Starting Ollama...${NC}"
    if command -v ollama &> /dev/null; then
        ollama serve &
        sleep 3
    else
        echo -e "${RED}❌ Ollama is not installed. Please install it first.${NC}"
        exit 1
    fi
fi

# Function to cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}Shutting down development servers...${NC}"
    pkill -f "vite" 2>/dev/null || true
    pkill -f "tsx.*server" 2>/dev/null || true
    pkill -f "node.*server" 2>/dev/null || true
    echo -e "${GREEN}✅ Cleanup complete${NC}"
}

# Set trap to cleanup on script exit
trap cleanup EXIT

# Start client in background
echo -e "${GREEN}Starting client development server...${NC}"
pnpm dev:client &
CLIENT_PID=$!

# Wait for client to start
sleep 3

# Check if client started successfully
if ! curl -s http://localhost:5173 > /dev/null; then
    echo -e "${RED}❌ Client failed to start${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Client running at http://localhost:5173${NC}"

# Try to start server with different methods
echo -e "${GREEN}Starting API server...${NC}"

# Method 1: Try with tsx and experimental flags
if NODE_OPTIONS='--import tsx --experimental-specifier-resolution=node' node src/api/server.ts 2>/dev/null & then
    SERVER_PID=$!
    sleep 3
    if curl -s http://localhost:3000/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ API server running at http://localhost:3000${NC}"
    else
        echo -e "${YELLOW}⚠️  Server started but health check failed${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  TSX server failed, trying production build...${NC}"
    
    # Method 2: Try production build
    if [ -f "dist/api/server.js" ]; then
        node dist/api/server.js &
        SERVER_PID=$!
        echo -e "${GREEN}✅ Running production build${NC}"
    else
        echo -e "${YELLOW}Building server...${NC}"
        pnpm build:server
        if [ -f "dist/api/server.js" ]; then
            node dist/api/server.js &
            SERVER_PID=$!
            echo -e "${GREEN}✅ Running newly built server${NC}"
        else
            echo -e "${RED}❌ Server build failed${NC}"
            echo -e "${YELLOW}ℹ️  You can still use the client for UI development${NC}"
        fi
    fi
fi

# Show status
echo -e "\n${GREEN}🎉 Development environment is ready!${NC}"
echo "=============================================="
echo -e "Client: ${GREEN}http://localhost:5173${NC}"
echo -e "API:    ${GREEN}http://localhost:3000${NC}"
echo -e "Ollama: ${GREEN}http://localhost:11434${NC}"
echo "=============================================="
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}\n"

# Keep script running
wait