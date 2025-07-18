#!/bin/bash
# Optimized Ollama startup script with timeout configurations

echo "Starting Ollama with optimized settings..."

# Export environment variables for Ollama
export OLLAMA_REQUEST_TIMEOUT=600s
export OLLAMA_KEEP_ALIVE=30m
export OLLAMA_MAX_LOADED_MODELS=3
export OLLAMA_MAX_QUEUE=512
export OLLAMA_NUM_PARALLEL=4

# Kill any existing Ollama process
pkill -f "ollama serve" 2>/dev/null

# Start Ollama in the background
ollama serve &
OLLAMA_PID=$!

# Wait for Ollama to be ready
echo "Waiting for Ollama to be ready..."
for i in {1..30}; do
  if curl -s http://localhost:11434/api/tags >/dev/null 2>&1; then
    echo "Ollama is ready!"
    break
  fi
  sleep 1
done

# Pre-load the models with keep_alive
echo "Pre-loading models with extended keep_alive..."
curl -s -X POST http://localhost:11434/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen3:14b",
    "prompt": "Hello",
    "keep_alive": "30m"
  }' > /dev/null 2>&1 &

curl -s -X POST http://localhost:11434/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen3:8b",
    "prompt": "Hello",
    "keep_alive": "30m"
  }' > /dev/null 2>&1 &

wait

echo "Ollama is running with optimized settings (PID: $OLLAMA_PID)"
echo "Models are pre-loaded and will stay in memory for 30 minutes"