#!/bin/bash

# ============================================================================
# Ollama Service Management Script for CrewAI Team
# ============================================================================
# This script starts Ollama service and ensures required models are available
# for both development and testing environments.
# ============================================================================

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
OLLAMA_HOST=${OLLAMA_HOST:-"127.0.0.1"}
OLLAMA_PORT=${OLLAMA_PORT:-11434}
OLLAMA_URL="http://${OLLAMA_HOST}:${OLLAMA_PORT}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Test models (lightweight for fast testing)
TEST_MODELS=(
    "qwen2.5:0.5b"
    "phi3:mini"
)

# Production models
PROD_MODELS=(
    "doomgrave/phi-4:14b-tools-Q3_K_S"
    "llama3.2:3b"
    "nomic-embed-text"
)

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
check_ollama_installed() {
    if ! command -v ollama &> /dev/null; then
        print_error "Ollama is not installed!"
        echo "Please install Ollama first: https://ollama.ai/"
        echo "Or run: curl -fsSL https://ollama.ai/install.sh | sh"
        exit 1
    fi
    print_success "Ollama is installed"
}

# Check if Ollama service is running
check_ollama_running() {
    print_status "Checking if Ollama service is running on ${OLLAMA_URL}..."
    
    if curl -s "${OLLAMA_URL}/api/tags" &> /dev/null; then
        print_success "Ollama service is already running"
        return 0
    else
        return 1
    fi
}

# Start Ollama service
start_ollama_service() {
    print_status "Starting Ollama service..."
    
    # Export environment variables for Ollama
    export OLLAMA_HOST="${OLLAMA_HOST}"
    export OLLAMA_PORT="${OLLAMA_PORT}"
    
    # Start Ollama in the background
    nohup ollama serve > "${PROJECT_ROOT}/logs/ollama.log" 2>&1 &
    OLLAMA_PID=$!
    
    # Save PID for later cleanup
    echo $OLLAMA_PID > "${PROJECT_ROOT}/logs/ollama.pid"
    
    print_status "Ollama service starting (PID: $OLLAMA_PID)..."
    
    # Wait for service to be ready
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s "${OLLAMA_URL}/api/tags" &> /dev/null; then
            print_success "Ollama service is ready"
            return 0
        fi
        
        sleep 1
        attempt=$((attempt + 1))
    done
    
    print_error "Ollama service failed to start within 30 seconds"
    return 1
}

# Stop Ollama service
stop_ollama_service() {
    print_status "Stopping Ollama service..."
    
    if [ -f "${PROJECT_ROOT}/logs/ollama.pid" ]; then
        local pid=$(cat "${PROJECT_ROOT}/logs/ollama.pid")
        if ps -p $pid > /dev/null 2>&1; then
            kill $pid
            print_success "Ollama service stopped (PID: $pid)"
        else
            print_warning "Ollama process (PID: $pid) was not running"
        fi
        rm -f "${PROJECT_ROOT}/logs/ollama.pid"
    else
        # Try to find and kill any ollama serve processes
        pkill -f "ollama serve" && print_success "Ollama processes terminated" || print_warning "No Ollama processes found"
    fi
}

# Function to check if a model is installed
is_model_installed() {
    local model=$1
    if curl -s "${OLLAMA_URL}/api/tags" | grep -q "\"name\":\"${model}\""; then
        return 0
    else
        return 1
    fi
}

# Function to pull a model
pull_model() {
    local model=$1
    local required=$2
    
    print_status "Checking model: $model"
    
    if is_model_installed "$model"; then
        print_success "$model is already available"
        return 0
    fi
    
    if [ "$required" = "required" ]; then
        print_status "Pulling required model: $model"
    else
        print_status "Pulling optional model: $model"
    fi
    
    if curl -s -X POST "${OLLAMA_URL}/api/pull" \
        -H "Content-Type: application/json" \
        -d "{\"name\":\"${model}\"}" | \
        while IFS= read -r line; do
            if echo "$line" | grep -q "\"status\":\"success\""; then
                break
            elif echo "$line" | grep -q "\"error\""; then
                return 1
            fi
        done; then
        print_success "Successfully pulled $model"
        return 0
    else
        if [ "$required" = "required" ]; then
            print_error "Failed to pull required model: $model"
            return 1
        else
            print_warning "Failed to pull optional model: $model (continuing...)"
            return 0
        fi
    fi
}

# Setup models for testing
setup_test_models() {
    print_status "Setting up test models..."
    
    for model in "${TEST_MODELS[@]}"; do
        pull_model "$model" "optional"
    done
}

# Setup models for production
setup_prod_models() {
    print_status "Setting up production models..."
    
    for model in "${PROD_MODELS[@]}"; do
        pull_model "$model" "required"
    done
}

# Display help
show_help() {
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  start           Start Ollama service and setup models"
    echo "  stop            Stop Ollama service"
    echo "  restart         Restart Ollama service"
    echo "  status          Check Ollama service status"
    echo "  test-setup      Start service and setup test models only"
    echo "  prod-setup      Start service and setup production models"
    echo "  models          List available models"
    echo "  help            Show this help message"
    echo ""
    echo "Environment variables:"
    echo "  OLLAMA_HOST     Host to bind Ollama (default: 127.0.0.1)"
    echo "  OLLAMA_PORT     Port to bind Ollama (default: 11434)"
}

# Main execution
main() {
    local command=${1:-"start"}
    
    # Ensure logs directory exists
    mkdir -p "${PROJECT_ROOT}/logs"
    
    case $command in
        "start")
            echo "============================================"
            echo "CrewAI Team - Starting Ollama Service"
            echo "============================================"
            check_ollama_installed
            
            if ! check_ollama_running; then
                start_ollama_service
            fi
            
            setup_test_models
            setup_prod_models
            
            print_success "Ollama setup complete!"
            echo ""
            echo "Service URL: ${OLLAMA_URL}"
            echo "Logs: ${PROJECT_ROOT}/logs/ollama.log"
            ;;
            
        "stop")
            echo "============================================"
            echo "CrewAI Team - Stopping Ollama Service"
            echo "============================================"
            stop_ollama_service
            ;;
            
        "restart")
            echo "============================================"
            echo "CrewAI Team - Restarting Ollama Service"
            echo "============================================"
            stop_ollama_service
            sleep 2
            start_ollama_service
            ;;
            
        "status")
            echo "============================================"
            echo "CrewAI Team - Ollama Service Status"
            echo "============================================"
            if check_ollama_running; then
                echo "Status: Running"
                echo "URL: ${OLLAMA_URL}"
                if [ -f "${PROJECT_ROOT}/logs/ollama.pid" ]; then
                    echo "PID: $(cat "${PROJECT_ROOT}/logs/ollama.pid")"
                fi
            else
                echo "Status: Not running"
            fi
            ;;
            
        "test-setup")
            echo "============================================"
            echo "CrewAI Team - Test Environment Setup"
            echo "============================================"
            check_ollama_installed
            
            if ! check_ollama_running; then
                start_ollama_service
            fi
            
            setup_test_models
            print_success "Test environment ready!"
            ;;
            
        "prod-setup")
            echo "============================================"
            echo "CrewAI Team - Production Environment Setup"
            echo "============================================"
            check_ollama_installed
            
            if ! check_ollama_running; then
                start_ollama_service
            fi
            
            setup_prod_models
            print_success "Production environment ready!"
            ;;
            
        "models")
            echo "============================================"
            echo "CrewAI Team - Available Models"
            echo "============================================"
            if check_ollama_running; then
                curl -s "${OLLAMA_URL}/api/tags" | jq -r '.models[] | "\(.name) (\(.size / 1024 / 1024 | round)MB)"' 2>/dev/null || \
                curl -s "${OLLAMA_URL}/api/tags"
            else
                print_error "Ollama service is not running"
                exit 1
            fi
            ;;
            
        "help"|"-h"|"--help")
            show_help
            ;;
            
        *)
            print_error "Unknown command: $command"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

# Handle script interruption
cleanup() {
    echo ""
    print_warning "Script interrupted. Cleaning up..."
    exit 130
}

trap cleanup INT

# Run main function
main "$@"