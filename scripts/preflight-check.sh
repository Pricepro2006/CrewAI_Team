#!/bin/bash

# ============================================================================
# Pre-flight Check Script for CrewAI Team
# ============================================================================
# This script verifies that all required dependencies and models are installed
# before starting the application.
# ============================================================================

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Counters
ERRORS=0
WARNINGS=0

# Functions
print_header() {
    echo
    echo -e "${BLUE}==== $1 ====${NC}"
}

print_check() {
    echo -ne "  Checking $1... "
}

print_pass() {
    echo -e "${GREEN}PASS${NC}"
}

print_fail() {
    echo -e "${RED}FAIL${NC}"
    echo -e "  ${RED}↳ $1${NC}"
    ((ERRORS++))
}

print_warning() {
    echo -e "${YELLOW}WARNING${NC}"
    echo -e "  ${YELLOW}↳ $1${NC}"
    ((WARNINGS++))
}

# Check Node.js
check_nodejs() {
    print_check "Node.js"
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node -v)
        if [[ "$NODE_VERSION" =~ ^v1[89]\.|^v[2-9][0-9]\. ]]; then
            print_pass
            echo "    Version: $NODE_VERSION"
        else
            print_fail "Node.js 18+ required (found $NODE_VERSION)"
        fi
    else
        print_fail "Node.js not installed"
    fi
}

# Check pnpm
check_pnpm() {
    print_check "pnpm"
    if command -v pnpm &> /dev/null; then
        print_pass
        echo "    Version: $(pnpm -v)"
    else
        print_fail "pnpm not installed (run: npm install -g pnpm)"
    fi
}

# Check Ollama
check_ollama() {
    print_check "Ollama"
    if command -v ollama &> /dev/null; then
        print_pass
        
        # Check if service is running
        print_check "Ollama service"
        if ollama list &> /dev/null; then
            print_pass
        else
            print_fail "Ollama service not running (run: ollama serve)"
        fi
    else
        print_fail "Ollama not installed (visit: https://ollama.ai/)"
    fi
}

# Check required Ollama models
check_models() {
    if ! command -v ollama &> /dev/null; then
        return
    fi
    
    # Get list of installed models
    INSTALLED_MODELS=$(ollama list 2>/dev/null | tail -n +2 | awk '{print $1}' | cut -d':' -f1-2 || echo "")
    
    # Required models for three-stage pipeline
    REQUIRED_MODELS=("llama3.2:3b" "nomic-embed-text")
    OPTIONAL_MODELS=("phi3:14b")
    
    # Additional models from config
    CONFIG_MODELS=("granite3.3:2b" "qwen3:0.6b" "qwen3:1.7b" "granite3.3:8b")
    
    # Check required models
    for model in "${REQUIRED_MODELS[@]}"; do
        print_check "$model (required)"
        if echo "$INSTALLED_MODELS" | grep -q "^$model"; then
            print_pass
        else
            print_fail "Required model not installed (run: ollama pull $model)"
        fi
    done
    
    # Check optional models
    for model in "${OPTIONAL_MODELS[@]}"; do
        print_check "$model (optional)"
        if echo "$INSTALLED_MODELS" | grep -q "^$model"; then
            print_pass
        else
            print_warning "Optional model not installed (run: ollama pull $model)"
        fi
    done
    
    # Check config models
    for model in "${CONFIG_MODELS[@]}"; do
        print_check "$model (config)"
        if echo "$INSTALLED_MODELS" | grep -q "^$model"; then
            print_pass
        else
            print_warning "Config model not installed (run: ollama pull $model)"
        fi
    done
}

# Check ChromaDB (optional)
check_chromadb() {
    print_check "ChromaDB (optional)"
    if pgrep -f "chroma" > /dev/null 2>&1; then
        print_pass
    else
        print_warning "ChromaDB not running (RAG will use fallback)"
    fi
}

# Check environment file
check_env() {
    print_check ".env file"
    if [ -f ".env" ]; then
        print_pass
    else
        print_warning ".env file not found (using defaults)"
    fi
}

# Check dependencies
check_dependencies() {
    print_check "node_modules"
    if [ -d "node_modules" ]; then
        print_pass
    else
        print_fail "Dependencies not installed (run: pnpm install)"
    fi
}

# Check database
check_database() {
    print_check "SQLite database"
    if [ -f "data/app.db" ] || [ -f "./data/app.db" ]; then
        print_pass
    else
        print_warning "Database not initialized (run: pnpm init:db)"
    fi
}

# Main execution
main() {
    echo "============================================"
    echo "CrewAI Team - Pre-flight Check"
    echo "============================================"
    
    print_header "System Requirements"
    check_nodejs
    check_pnpm
    check_ollama
    
    print_header "Ollama Models"
    check_models
    
    print_header "Optional Services"
    check_chromadb
    
    print_header "Project Setup"
    check_env
    check_dependencies
    check_database
    
    echo
    echo "============================================"
    echo -e "Results: ${RED}$ERRORS errors${NC}, ${YELLOW}$WARNINGS warnings${NC}"
    echo "============================================"
    
    if [ $ERRORS -gt 0 ]; then
        echo
        echo -e "${RED}Pre-flight check failed!${NC}"
        echo "Please fix the errors above before starting the application."
        echo
        echo "Quick fixes:"
        echo "1. Install missing models: ./scripts/install-ollama-models.sh"
        echo "2. Install dependencies: pnpm install && pnpm approve-builds"
        echo "3. Initialize database: pnpm init:db"
        exit 1
    else
        echo
        echo -e "${GREEN}Pre-flight check passed!${NC}"
        if [ $WARNINGS -gt 0 ]; then
            echo "Some optional features may be limited due to warnings above."
        fi
        echo
        echo "Ready to start the application with: pnpm dev"
    fi
}

# Run from project root
if [ ! -f "package.json" ]; then
    echo "Error: This script must be run from the project root directory"
    exit 1
fi

main