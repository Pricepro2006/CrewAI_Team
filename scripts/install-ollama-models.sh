#!/bin/bash

# ============================================================================
# Ollama Model Installation Script for CrewAI Team
# ============================================================================
# This script installs all required Ollama models for the three-stage pipeline
# as documented in CLAUDE.md
#
# Required Models:
# - llama3.2:3b      : Stage 2 main production model (priority analysis)
# - nomic-embed-text : RAG embeddings
# - phi3:14b         : Stage 3 critical analysis (optional)
#
# Additional Models (from current config):
# - granite3.3:2b    : Complex queries (current main model)
# - qwen3:0.6b       : Simple queries and tool selection
# - qwen3:1.7b       : Balanced model for medium complexity
# - granite3.3:8b    : High quality for critical tasks
# ============================================================================

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if Ollama is installed
check_ollama() {
    if ! command -v ollama &> /dev/null; then
        print_error "Ollama is not installed!"
        echo "Please install Ollama first: https://ollama.ai/"
        exit 1
    fi
    print_success "Ollama is installed"
}

# Check if Ollama service is running
check_ollama_service() {
    print_status "Checking if Ollama service is running..."
    
    # Try to list models to check if service is running
    if ollama list &> /dev/null; then
        print_success "Ollama service is running"
    else
        print_warning "Ollama service is not running. Starting it..."
        # Start Ollama in the background
        ollama serve &> /dev/null &
        sleep 5
        
        # Check again
        if ollama list &> /dev/null; then
            print_success "Ollama service started successfully"
        else
            print_error "Failed to start Ollama service"
            echo "Please start Ollama manually with: ollama serve"
            exit 1
        fi
    fi
}

# Function to check if a model is already installed
is_model_installed() {
    local model=$1
    if ollama list 2>/dev/null | grep -q "^$model"; then
        return 0
    else
        return 1
    fi
}

# Function to pull a model with error handling
pull_model() {
    local model=$1
    local description=$2
    local required=$3
    
    print_status "Checking $model ($description)..."
    
    if is_model_installed "$model"; then
        print_success "$model is already installed"
    else
        if [ "$required" = "required" ]; then
            print_status "Installing required model: $model"
        else
            print_status "Installing optional model: $model"
        fi
        
        if ollama pull "$model"; then
            print_success "Successfully installed $model"
        else
            if [ "$required" = "required" ]; then
                print_error "Failed to install required model: $model"
                exit 1
            else
                print_warning "Failed to install optional model: $model (continuing...)"
            fi
        fi
    fi
}

# Main execution
main() {
    echo "============================================"
    echo "CrewAI Team - Ollama Model Installation"
    echo "============================================"
    echo
    
    # Check prerequisites
    check_ollama
    check_ollama_service
    
    echo
    echo "Installing models for Three-Stage Pipeline..."
    echo "============================================"
    
    # Three-Stage Pipeline Models (from CLAUDE.md)
    pull_model "llama3.2:3b" "Stage 2: Priority analysis (main production)" "required"
    pull_model "nomic-embed-text" "RAG embeddings" "required"
    pull_model "phi3:14b" "Stage 3: Critical analysis" "optional"
    
    echo
    echo "Installing additional models from config..."
    echo "============================================"
    
    # Current Configuration Models (from model-selection.config.ts)
    pull_model "granite3.3:2b" "Complex queries" "optional"
    pull_model "qwen3:0.6b" "Simple queries and tool selection" "optional"
    pull_model "qwen3:1.7b" "Balanced model" "optional"
    pull_model "granite3.3:8b" "High quality analysis" "optional"
    
    # Legacy models from ollama.config.ts
    pull_model "phi3:mini" "Legacy default model" "optional"
    pull_model "llama3.1:8b" "Legacy Llama model" "optional"
    
    echo
    echo "============================================"
    print_success "Model installation complete!"
    echo
    echo "Installed models:"
    ollama list
    
    echo
    echo "Next steps:"
    echo "1. Run the pre-flight check: ./scripts/preflight-check.sh"
    echo "2. Start the application: pnpm dev"
}

# Run main function
main