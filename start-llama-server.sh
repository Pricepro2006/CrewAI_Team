#!/bin/bash

# Script to start llama.cpp server for CrewAI Team
# Port 8081 (avoiding WebSocket conflict on 8080)

echo "🦙 Starting llama.cpp server for CrewAI Team..."
echo "================================================"

# Check if llama-server is already running on port 8081
if lsof -Pi :8081 -sTCP:LISTEN -t >/dev/null ; then
    echo "✅ llama-server is already running on port 8081"
    exit 0
fi

# Configuration
MODEL_PATH="./models/llama-3.2-3b-instruct.Q4_K_M.gguf"
FALLBACK_MODEL="./models/Llama-3.2-3B-Instruct-Q4_K_M.gguf"
PORT=8081
THREADS=8
CTX_SIZE=8192
BATCH_SIZE=512

# Check if model exists
if [ ! -f "$MODEL_PATH" ]; then
    echo "⚠️ Model not found at: $MODEL_PATH"
    if [ -f "$FALLBACK_MODEL" ]; then
        echo "✅ Using fallback model: $FALLBACK_MODEL"
        MODEL_PATH="$FALLBACK_MODEL"
    else
        echo "❌ No model found. Please download a GGUF model to ./models/"
        echo "   Example: wget https://huggingface.co/TheBloke/Llama-2-7B-GGUF/resolve/main/llama-2-7b.Q4_K_M.gguf -P ./models/"
        exit 1
    fi
fi

# Find llama-server executable
LLAMA_SERVER=""
if command -v llama-server &> /dev/null; then
    LLAMA_SERVER="llama-server"
elif [ -f "./llama.cpp/llama-server" ]; then
    LLAMA_SERVER="./llama.cpp/llama-server"
elif [ -f "../llama.cpp/llama-server" ]; then
    LLAMA_SERVER="../llama.cpp/llama-server"
else
    echo "❌ llama-server not found. Please install llama.cpp"
    echo "   git clone https://github.com/ggerganov/llama.cpp"
    echo "   cd llama.cpp && make"
    exit 1
fi

echo "📦 Model: $MODEL_PATH"
echo "🚀 Starting server on port $PORT..."

# Start the server with OpenAI-compatible API
$LLAMA_SERVER \
    --model "$MODEL_PATH" \
    --ctx-size $CTX_SIZE \
    --threads $THREADS \
    --n-gpu-layers 0 \
    --batch-size $BATCH_SIZE \
    --host 127.0.0.1 \
    --port $PORT \
    --alias llama-3.2-3b \
    --api-key "" \
    --log-disable \
    2>&1 | while read line; do
        echo "[llama-server] $line"
        if [[ "$line" == *"listening on"* ]]; then
            echo "✅ llama-server is ready on http://localhost:$PORT"
            echo "📝 OpenAI-compatible endpoint: http://localhost:$PORT/v1/chat/completions"
        fi
    done &

# Store the PID
echo $! > llama-server.pid

echo ""
echo "🎯 Server started with PID: $(cat llama-server.pid)"
echo "🛑 To stop: kill $(cat llama-server.pid)"
echo ""