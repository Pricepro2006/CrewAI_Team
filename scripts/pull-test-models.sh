#!/bin/bash

# Script to pull all required models for confidence testing

echo "Pulling all required models for confidence testing..."
echo "This may take a while depending on your internet connection..."

MODELS=(
  "qwen3:0.6b"
  "gemma3n:e2b"
  "gemma3n:e4b"
  "phi4-mini-reasoning:3.8b"
  "qwen3:1.7b"
  "qwen3:4b"
  "granite3.3:8b"
  "granite3.3:2b"
)

for model in "${MODELS[@]}"; do
  echo ""
  echo "Pulling model: $model"
  echo "======================================="
  
  if ollama pull "$model"; then
    echo "✓ Successfully pulled $model"
  else
    echo "✗ Failed to pull $model"
    # Try alternative names for some models
    case "$model" in
      "gemma3n:e2b")
        echo "Trying alternative: gemma:2b"
        ollama pull gemma:2b || echo "Alternative also failed"
        ;;
      "gemma3n:e4b")
        echo "Trying alternative: gemma2:2b"
        ollama pull gemma2:2b || echo "Alternative also failed"
        ;;
      "phi4-mini-reasoning:3.8b")
        echo "Trying alternative: phi3:mini"
        ollama pull phi3:mini || echo "Alternative also failed"
        ;;
    esac
  fi
done

echo ""
echo "Model pulling complete!"
echo ""
echo "Listing available models:"
ollama list