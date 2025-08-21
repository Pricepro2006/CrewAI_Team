#!/bin/bash

# Download models for CrewAI Team
# Primary: Mistral 7B Quantized
# Fallback: Llama 3.2:3b

MODELS_DIR="/home/pricepro2006/CrewAI_Team/models"

# Create models directory if it doesn't exist
mkdir -p "$MODELS_DIR"

echo "📦 Downloading models for CrewAI Team..."

# Download Mistral 7B Instruct v0.2 Q4_K_M (best quality/performance balance)
if [ ! -f "$MODELS_DIR/mistral-7b-instruct-v0.2.Q4_K_M.gguf" ]; then
    echo "⬇️ Downloading Mistral 7B Instruct v0.2 Q4_K_M..."
    wget -c -P "$MODELS_DIR" \
        "https://huggingface.co/TheBloke/Mistral-7B-Instruct-v0.2-GGUF/resolve/main/mistral-7b-instruct-v0.2.Q4_K_M.gguf"
else
    echo "✅ Mistral 7B already downloaded"
fi

# Download Llama 3.2 3B Instruct Q4_K_M (fallback model)
if [ ! -f "$MODELS_DIR/Llama-3.2-3B-Instruct-Q4_K_M.gguf" ]; then
    echo "⬇️ Downloading Llama 3.2 3B Instruct Q4_K_M..."
    wget -c -P "$MODELS_DIR" \
        "https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf"
else
    echo "✅ Llama 3.2 3B already downloaded"
fi

echo "✅ All models downloaded successfully!"
echo ""
echo "Models location: $MODELS_DIR"
ls -lh "$MODELS_DIR"/*.gguf 2>/dev/null || echo "No models found yet"