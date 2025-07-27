#!/bin/bash

# ============================================================================
# Integration Test Runner for CrewAI Team
# ============================================================================
# This script runs integration tests with real Ollama instances, ensuring
# proper setup, error handling, and cleanup.
# ============================================================================

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
LOG_DIR="${PROJECT_ROOT}/logs"
TEST_LOG="${LOG_DIR}/integration-tests.log"

# Test configuration
OLLAMA_HOST=${OLLAMA_HOST:-"127.0.0.1"}
OLLAMA_PORT=${OLLAMA_PORT:-11434}
OLLAMA_URL="http://${OLLAMA_HOST}:${OLLAMA_PORT}"
TEST_TIMEOUT=${TEST_TIMEOUT:-300} # 5 minutes default

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$TEST_LOG"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$TEST_LOG"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$TEST_LOG"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$TEST_LOG"
}

# Setup logging
setup_logging() {
    mkdir -p "$LOG_DIR"
    echo "Integration Test Run - $(date)" > "$TEST_LOG"
    echo "============================================" >> "$TEST_LOG"
}

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check if Node.js is available
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed!"
        exit 1
    fi
    
    # Check if npm is available
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed!"
        exit 1
    fi
    
    # Check if Ollama is installed
    if ! command -v ollama &> /dev/null; then
        print_error "Ollama is not installed!"
        echo "Please install Ollama first: https://ollama.ai/"
        exit 1
    fi
    
    print_success "Prerequisites check passed"
}

# Setup Ollama for testing
setup_ollama() {
    print_status "Setting up Ollama for integration testing..."
    
    # Start Ollama if not running
    if ! curl -s "${OLLAMA_URL}/api/tags" &> /dev/null; then
        print_status "Starting Ollama service..."
        "${SCRIPT_DIR}/start-ollama.sh" test-setup
        
        # Wait for Ollama to be ready
        local max_attempts=30
        local attempt=1
        
        while [ $attempt -le $max_attempts ]; do
            if curl -s "${OLLAMA_URL}/api/tags" &> /dev/null; then
                print_success "Ollama is ready"
                break
            fi
            
            sleep 1
            attempt=$((attempt + 1))
        done
        
        if [ $attempt -gt $max_attempts ]; then
            print_error "Ollama failed to start within 30 seconds"
            exit 1
        fi
    else
        print_success "Ollama is already running"
    fi
    
    # Verify test models are available
    print_status "Verifying test models..."
    local models=$(curl -s "${OLLAMA_URL}/api/tags" | grep -o '"name":"[^"]*"' | cut -d'"' -f4 || echo "")
    
    if [[ -z "$models" ]]; then
        print_warning "No models found, setting up test models..."
        "${SCRIPT_DIR}/start-ollama.sh" test-setup
    else
        print_success "Models available: $models"
    fi
}

# Run integration tests
run_tests() {
    print_status "Running integration tests..."
    
    cd "$PROJECT_ROOT"
    
    # Set environment variables for tests
    export NODE_ENV=test
    export OLLAMA_BASE_URL="$OLLAMA_URL"
    export OLLAMA_TEST_MODEL="qwen2.5:0.5b"
    export LOG_LEVEL=error
    
    # Run integration tests with timeout
    local test_command="npm run test:integration"
    
    if command -v timeout &> /dev/null; then
        timeout "${TEST_TIMEOUT}" $test_command
    else
        # For systems without timeout command
        $test_command &
        local test_pid=$!
        
        # Monitor test execution
        local elapsed=0
        while kill -0 $test_pid 2>/dev/null; do
            sleep 1
            elapsed=$((elapsed + 1))
            
            if [ $elapsed -ge $TEST_TIMEOUT ]; then
                print_error "Tests timed out after ${TEST_TIMEOUT} seconds"
                kill $test_pid 2>/dev/null || true
                exit 1
            fi
        done
        
        wait $test_pid
    fi
}

# Cleanup after tests
cleanup() {
    print_status "Cleaning up test environment..."
    
    # Stop Ollama if we started it
    if [ -f "${LOG_DIR}/ollama.pid" ]; then
        local pid=$(cat "${LOG_DIR}/ollama.pid")
        if ps -p $pid > /dev/null 2>&1; then
            kill $pid
            print_success "Stopped Ollama service (PID: $pid)"
        fi
        rm -f "${LOG_DIR}/ollama.pid"
    fi
    
    # Clean up test artifacts
    rm -rf "./test-data/chroma-test" 2>/dev/null || true
    
    print_success "Cleanup completed"
}

# Error handler
handle_error() {
    local exit_code=$?
    print_error "Integration tests failed with exit code $exit_code"
    
    # Capture system information for debugging
    echo "" >> "$TEST_LOG"
    echo "=== DEBUG INFORMATION ===" >> "$TEST_LOG"
    echo "Date: $(date)" >> "$TEST_LOG"
    echo "Node version: $(node --version)" >> "$TEST_LOG"
    echo "NPM version: $(npm --version)" >> "$TEST_LOG"
    echo "Ollama status: $(curl -s "${OLLAMA_URL}/api/tags" | head -c 100 || echo "Not accessible")" >> "$TEST_LOG"
    echo "Environment: $(env | grep -E '^(NODE_ENV|OLLAMA_|LOG_LEVEL)' || true)" >> "$TEST_LOG"
    echo "==========================" >> "$TEST_LOG"
    
    cleanup
    exit $exit_code
}

# Display help
show_help() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --timeout SECONDS    Set test timeout (default: 300)"
    echo "  --verbose           Enable verbose output"
    echo "  --skip-setup        Skip Ollama setup (assume already configured)"
    echo "  --help              Show this help message"
    echo ""
    echo "Environment variables:"
    echo "  OLLAMA_HOST         Ollama host (default: 127.0.0.1)"
    echo "  OLLAMA_PORT         Ollama port (default: 11434)"
    echo "  TEST_TIMEOUT        Test timeout in seconds (default: 300)"
}

# Parse command line arguments
parse_args() {
    local skip_setup=false
    local verbose=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --timeout)
                TEST_TIMEOUT="$2"
                shift 2
                ;;
            --verbose)
                verbose=true
                export LOG_LEVEL=debug
                shift
                ;;
            --skip-setup)
                skip_setup=true
                shift
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # Export configuration
    export SKIP_SETUP="$skip_setup"
    export VERBOSE="$verbose"
}

# Main execution
main() {
    echo "============================================"
    echo "CrewAI Team - Integration Test Runner"
    echo "============================================"
    echo ""
    
    # Setup error handling
    trap handle_error ERR EXIT
    
    # Initialize logging
    setup_logging
    
    # Check prerequisites
    check_prerequisites
    
    # Setup Ollama unless skipped
    if [[ "$SKIP_SETUP" != "true" ]]; then
        setup_ollama
    fi
    
    # Run the tests
    run_tests
    
    # Success
    print_success "All integration tests passed!"
    echo ""
    echo "Test log: $TEST_LOG"
    
    # Disable error trap for normal exit
    trap - ERR EXIT
    cleanup
}

# Parse arguments and run
parse_args "$@"
main