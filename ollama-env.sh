#!/bin/bash
# Ollama CPU Optimization Environment Variables
# Source this file before running Ollama: source ollama-env.sh

echo "Setting Ollama CPU optimization environment variables..."

# Maximum number of models to keep loaded in memory
export OLLAMA_MAX_LOADED_MODELS=2

# Maximum parallel requests per model
export OLLAMA_NUM_PARALLEL=2

# Maximum queued requests when busy
export OLLAMA_MAX_QUEUE=256

# Keep models loaded in memory for this duration
export OLLAMA_KEEP_ALIVE=300s

# Number of CPU threads (adjust based on your system)
# For AMD Ryzen 7 PRO 7840HS (16 threads), using 12 for Ollama
export OLLAMA_NUM_THREADS=12

# Enable flash attention for better performance
export OLLAMA_FLASH_ATTENTION=1

# Set temperature for consistent results
export OLLAMA_TEMPERATURE=0.7

# Enable NUMA awareness for multi-socket systems
export OLLAMA_NUMA=false

echo "Ollama environment variables set successfully!"
echo "Current settings:"
echo "  OLLAMA_MAX_LOADED_MODELS=$OLLAMA_MAX_LOADED_MODELS"
echo "  OLLAMA_NUM_PARALLEL=$OLLAMA_NUM_PARALLEL"
echo "  OLLAMA_MAX_QUEUE=$OLLAMA_MAX_QUEUE"
echo "  OLLAMA_KEEP_ALIVE=$OLLAMA_KEEP_ALIVE"
echo "  OLLAMA_NUM_THREADS=$OLLAMA_NUM_THREADS"