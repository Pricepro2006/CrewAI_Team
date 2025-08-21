#!/bin/bash

# CrewAI Team - Llama.cpp Deployment Script
# Handles complete deployment setup for llama.cpp integration

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_FILE="${PROJECT_ROOT}/logs/deployment.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create log directory
mkdir -p "${PROJECT_ROOT}/logs"

# Logging function
log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case $level in
        "INFO")
            echo -e "${GREEN}[INFO]${NC} $message" | tee -a "$LOG_FILE"
            ;;
        "WARN")
            echo -e "${YELLOW}[WARN]${NC} $message" | tee -a "$LOG_FILE"
            ;;
        "ERROR")
            echo -e "${RED}[ERROR]${NC} $message" | tee -a "$LOG_FILE"
            ;;
        "DEBUG")
            echo -e "${BLUE}[DEBUG]${NC} $message" | tee -a "$LOG_FILE"
            ;;
    esac
    
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
}

# Function to check prerequisites
check_prerequisites() {
    log "INFO" "Checking prerequisites..."
    
    # Check if running on supported system
    if [[ ! "$OSTYPE" == "linux-gnu"* ]]; then
        log "ERROR" "This script is designed for Linux systems only"
        exit 1
    fi
    
    # Check for required commands
    local required_commands=("git" "make" "curl" "node" "npm")
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            log "ERROR" "Required command '$cmd' not found"
            exit 1
        fi
    done
    
    # Check if llama.cpp is built
    if [[ ! -f "${PROJECT_ROOT}/llama.cpp/build/bin/llama-server" ]]; then
        log "WARN" "llama-server binary not found, will need to build"
        return 1
    fi
    
    log "INFO" "Prerequisites check passed"
    return 0
}

# Function to build llama.cpp if needed
build_llama_cpp() {
    log "INFO" "Building llama.cpp..."
    
    cd "${PROJECT_ROOT}/llama.cpp"
    
    # Clean previous build if exists
    if [[ -d "build" ]]; then
        log "DEBUG" "Cleaning previous build"
        rm -rf build
    fi
    
    # Build with optimizations for AMD Ryzen
    log "DEBUG" "Building with CPU optimizations"
    make clean 2>/dev/null || true
    make -j$(nproc) llama-server GGML_NATIVE=1 GGML_CPU_ALL_VARIANTS=1
    
    # Verify build
    if [[ -f "llama-server" && -x "llama-server" ]]; then
        log "INFO" "llama-server built successfully"
        
        # Create build/bin directory structure
        mkdir -p build/bin
        cp llama-server build/bin/
        cp llama-cli build/bin/ 2>/dev/null || log "WARN" "llama-cli not found, may need separate build"
        
        return 0
    else
        log "ERROR" "Failed to build llama-server"
        return 1
    fi
}

# Function to setup environment configuration
setup_environment() {
    log "INFO" "Setting up environment configuration..."
    
    # Copy .env.example if .env doesn't exist
    if [[ ! -f "${PROJECT_ROOT}/.env" ]]; then
        log "INFO" "Creating .env from template"
        cp "${PROJECT_ROOT}/.env.example" "${PROJECT_ROOT}/.env"
        
        # Update paths in .env
        sed -i "s|/path/to/CrewAI_Team|${PROJECT_ROOT}|g" "${PROJECT_ROOT}/.env"
        
        log "WARN" "Please review and update .env file with your specific configuration"
    else
        log "DEBUG" ".env file already exists"
    fi
    
    # Ensure models directory exists
    mkdir -p "${PROJECT_ROOT}/models"
    
    # Check if default model exists
    local default_model="${PROJECT_ROOT}/models/llama-3.2-3b-instruct.Q4_K_M.gguf"
    if [[ ! -f "$default_model" ]]; then
        log "WARN" "Default model not found at $default_model"
        log "INFO" "Available models:"
        ls -la "${PROJECT_ROOT}/models/" 2>/dev/null || log "WARN" "No models found"
    fi
}

# Function to setup systemd service
setup_systemd() {
    log "INFO" "Setting up systemd service..."
    
    local service_file="${PROJECT_ROOT}/scripts/llama-server.service"
    local systemd_target="/etc/systemd/system/llama-server.service"
    
    if [[ -f "$service_file" ]]; then
        # Check if we can write to systemd directory
        if [[ -w "/etc/systemd/system/" ]] || sudo -n true 2>/dev/null; then
            log "DEBUG" "Installing systemd service"
            sudo cp "$service_file" "$systemd_target"
            sudo systemctl daemon-reload
            sudo systemctl enable llama-server.service
            
            log "INFO" "Systemd service installed and enabled"
            log "INFO" "Use: sudo systemctl start llama-server"
        else
            log "WARN" "Cannot install systemd service without sudo access"
            log "INFO" "Service file available at: $service_file"
        fi
    else
        log "ERROR" "Service file not found at $service_file"
    fi
}

# Function to setup PM2
setup_pm2() {
    log "INFO" "Setting up PM2 process management..."
    
    # Check if PM2 is installed globally
    if ! command -v pm2 &> /dev/null; then
        log "INFO" "Installing PM2 globally"
        npm install -g pm2 || {
            log "WARN" "Failed to install PM2 globally, trying local install"
            npm install pm2
        }
    fi
    
    local ecosystem_file="${PROJECT_ROOT}/scripts/ecosystem.config.js"
    if [[ -f "$ecosystem_file" ]]; then
        log "DEBUG" "PM2 ecosystem file found"
        
        # Test PM2 configuration
        cd "$PROJECT_ROOT"
        pm2 start "$ecosystem_file" --env production --dry-run && {
            log "INFO" "PM2 configuration validated"
        } || {
            log "WARN" "PM2 configuration validation failed"
        }
    else
        log "ERROR" "PM2 ecosystem file not found"
    fi
}

# Function to test llama-server
test_llama_server() {
    log "INFO" "Testing llama-server..."
    
    # Start server in background for testing
    log "DEBUG" "Starting llama-server for testing"
    "${PROJECT_ROOT}/scripts/start-llama-server.sh" start
    
    # Wait for server to start
    local max_attempts=30
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        if curl -s "http://localhost:8081/health" >/dev/null 2>&1; then
            log "INFO" "Llama-server is responding"
            break
        fi
        
        log "DEBUG" "Waiting for server to start (attempt $attempt/$max_attempts)"
        sleep 2
        ((attempt++))
    done
    
    if [[ $attempt -gt $max_attempts ]]; then
        log "ERROR" "Server failed to start within timeout"
        return 1
    fi
    
    # Test health endpoint
    local health_response
    health_response=$(curl -s "http://localhost:8081/health" 2>/dev/null)
    
    if [[ -n "$health_response" ]]; then
        log "INFO" "Health check passed: $health_response"
    else
        log "WARN" "Health endpoint returned empty response"
    fi
    
    # Stop test server
    "${PROJECT_ROOT}/scripts/start-llama-server.sh" stop
    
    return 0
}

# Function to generate deployment summary
generate_summary() {
    log "INFO" "Deployment Summary:"
    log "INFO" "===================="
    
    # System information
    log "INFO" "System: $(uname -a)"
    log "INFO" "Project Root: $PROJECT_ROOT"
    
    # Llama.cpp information
    if [[ -f "${PROJECT_ROOT}/llama.cpp/build/bin/llama-server" ]]; then
        log "INFO" "✓ Llama.cpp server: Built and ready"
    else
        log "WARN" "✗ Llama.cpp server: Not built"
    fi
    
    # Models information
    local model_count
    model_count=$(find "${PROJECT_ROOT}/models" -name "*.gguf" 2>/dev/null | wc -l)
    log "INFO" "Models available: $model_count GGUF files"
    
    # Configuration files
    [[ -f "${PROJECT_ROOT}/.env" ]] && log "INFO" "✓ Environment: Configured" || log "WARN" "✗ Environment: .env missing"
    [[ -f "${PROJECT_ROOT}/scripts/llama-server.service" ]] && log "INFO" "✓ Systemd: Service file ready" || log "WARN" "✗ Systemd: Service file missing"
    [[ -f "${PROJECT_ROOT}/scripts/ecosystem.config.js" ]] && log "INFO" "✓ PM2: Configuration ready" || log "WARN" "✗ PM2: Configuration missing"
    
    # Next steps
    log "INFO" ""
    log "INFO" "Next Steps:"
    log "INFO" "1. Review and update .env configuration"
    log "INFO" "2. Download required models to ./models/ directory"
    log "INFO" "3. Start services:"
    log "INFO" "   - Manual: ./scripts/start-llama-server.sh start"
    log "INFO" "   - PM2: pm2 start ./scripts/ecosystem.config.js"
    log "INFO" "   - Systemd: sudo systemctl start llama-server"
    log "INFO" "4. Test connection: curl http://localhost:8081/health"
}

# Main deployment function
main() {
    log "INFO" "Starting CrewAI Team Llama.cpp deployment"
    log "INFO" "Project root: $PROJECT_ROOT"
    
    # Check prerequisites
    if ! check_prerequisites; then
        log "INFO" "Building llama.cpp due to missing binary"
        build_llama_cpp || {
            log "ERROR" "Failed to build llama.cpp"
            exit 1
        }
    fi
    
    # Setup environment
    setup_environment
    
    # Setup process management
    case "${1:-pm2}" in
        "systemd")
            setup_systemd
            ;;
        "pm2")
            setup_pm2
            ;;
        "both")
            setup_systemd
            setup_pm2
            ;;
        *)
            log "INFO" "No process manager specified, setting up PM2"
            setup_pm2
            ;;
    esac
    
    # Test the setup
    if [[ "${2:-}" != "--no-test" ]]; then
        test_llama_server || log "WARN" "Server test failed, but deployment completed"
    fi
    
    # Generate summary
    generate_summary
    
    log "INFO" "Deployment completed successfully!"
}

# Handle script arguments
case "${1:-deploy}" in
    "deploy")
        main "${2:-pm2}" "$3"
        ;;
    "build")
        check_prerequisites || true
        build_llama_cpp
        ;;
    "test")
        test_llama_server
        ;;
    "help"|"--help"|"-h")
        echo "CrewAI Team Llama.cpp Deployment Script"
        echo ""
        echo "Usage: $0 [command] [options]"
        echo ""
        echo "Commands:"
        echo "  deploy [pm2|systemd|both] [--no-test]  Full deployment (default)"
        echo "  build                                   Build llama.cpp only"
        echo "  test                                    Test llama-server"
        echo "  help                                    Show this help"
        echo ""
        echo "Examples:"
        echo "  $0 deploy pm2                          Deploy with PM2"
        echo "  $0 deploy systemd --no-test            Deploy with systemd, skip test"
        echo "  $0 build                               Build llama.cpp only"
        ;;
    *)
        log "ERROR" "Unknown command: $1"
        echo "Use '$0 help' for usage information"
        exit 1
        ;;
esac