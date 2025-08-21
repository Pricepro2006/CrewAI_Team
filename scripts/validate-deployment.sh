#!/bin/bash

# CrewAI Team - Deployment Validation Script
# Comprehensive validation of llama.cpp deployment

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test results
TESTS_PASSED=0
TESTS_FAILED=0

# Test tracking
test_result() {
    local test_name="$1"
    local result="$2"
    local message="$3"
    
    if [[ "$result" == "PASS" ]]; then
        echo -e "  ${GREEN}✓${NC} $test_name: $message"
        ((TESTS_PASSED++))
    else
        echo -e "  ${RED}✗${NC} $test_name: $message"
        ((TESTS_FAILED++))
    fi
}

# Test 1: Environment Configuration
test_environment() {
    echo -e "${BLUE}Testing Environment Configuration...${NC}"
    
    # Check .env file
    if [[ -f "${PROJECT_ROOT}/.env" ]]; then
        test_result "Environment File" "PASS" ".env file exists"
        
        # Check required variables
        source "${PROJECT_ROOT}/.env" 2>/dev/null || true
        
        if [[ -n "$LLAMA_SERVER_URL" ]]; then
            test_result "LLAMA_SERVER_URL" "PASS" "Set to $LLAMA_SERVER_URL"
        else
            test_result "LLAMA_SERVER_URL" "FAIL" "Not configured"
        fi
        
        if [[ -n "$LLAMA_SERVER_PATH" && -f "$LLAMA_SERVER_PATH" ]]; then
            test_result "LLAMA_SERVER_PATH" "PASS" "Binary exists at $LLAMA_SERVER_PATH"
        else
            test_result "LLAMA_SERVER_PATH" "FAIL" "Binary not found or not configured"
        fi
        
        if [[ -n "$LLAMA_MODELS_PATH" && -d "$LLAMA_MODELS_PATH" ]]; then
            local model_count=$(find "$LLAMA_MODELS_PATH" -name "*.gguf" 2>/dev/null | wc -l)
            test_result "LLAMA_MODELS_PATH" "PASS" "Directory exists with $model_count GGUF models"
        else
            test_result "LLAMA_MODELS_PATH" "FAIL" "Models directory not found"
        fi
        
    else
        test_result "Environment File" "FAIL" ".env file missing"
    fi
}

# Test 2: Binary and Build Verification
test_binaries() {
    echo -e "${BLUE}Testing Binaries and Build...${NC}"
    
    # Check llama-server binary
    local server_bin="${PROJECT_ROOT}/llama.cpp/build/bin/llama-server"
    if [[ -f "$server_bin" && -x "$server_bin" ]]; then
        test_result "llama-server Binary" "PASS" "Executable found"
        
        # Test binary execution (version check)
        if timeout 10 "$server_bin" --help >/dev/null 2>&1; then
            test_result "Binary Execution" "PASS" "Binary runs successfully"
        else
            test_result "Binary Execution" "FAIL" "Binary fails to execute"
        fi
    else
        test_result "llama-server Binary" "FAIL" "Binary missing or not executable"
    fi
    
    # Check llama-cli binary (optional)
    local cli_bin="${PROJECT_ROOT}/llama.cpp/build/bin/llama-cli"
    if [[ -f "$cli_bin" && -x "$cli_bin" ]]; then
        test_result "llama-cli Binary" "PASS" "CLI binary available"
    else
        test_result "llama-cli Binary" "FAIL" "CLI binary missing (optional)"
    fi
}

# Test 3: Model Validation
test_models() {
    echo -e "${BLUE}Testing Models...${NC}"
    
    local models_dir="${PROJECT_ROOT}/models"
    if [[ -d "$models_dir" ]]; then
        local gguf_count=$(find "$models_dir" -name "*.gguf" 2>/dev/null | wc -l)
        
        if [[ $gguf_count -gt 0 ]]; then
            test_result "Model Files" "PASS" "$gguf_count GGUF models found"
            
            # Check default model
            source "${PROJECT_ROOT}/.env" 2>/dev/null || true
            local default_model="${LLAMA_MODEL:-llama-3.2-3b-instruct.Q4_K_M.gguf}"
            
            if [[ -f "${models_dir}/${default_model}" ]]; then
                test_result "Default Model" "PASS" "$default_model exists"
                
                # Check model file size (should be > 1GB for valid models)
                local model_size=$(stat -c%s "${models_dir}/${default_model}" 2>/dev/null || echo "0")
                local size_gb=$(echo "scale=1; $model_size / 1024 / 1024 / 1024" | bc 2>/dev/null || echo "0")
                
                if (( $(echo "$size_gb > 0.5" | bc -l) 2>/dev/null )); then
                    test_result "Model Size" "PASS" "${size_gb}GB (reasonable size)"
                else
                    test_result "Model Size" "FAIL" "Model file seems too small"
                fi
            else
                test_result "Default Model" "FAIL" "$default_model not found"
            fi
        else
            test_result "Model Files" "FAIL" "No GGUF models found"
        fi
    else
        test_result "Models Directory" "FAIL" "Models directory not found"
    fi
}

# Test 4: Dependencies and System Requirements
test_dependencies() {
    echo -e "${BLUE}Testing Dependencies...${NC}"
    
    # Check required commands
    local required_commands=("curl" "bc" "jq")
    for cmd in "${required_commands[@]}"; do
        if command -v "$cmd" >/dev/null 2>&1; then
            test_result "Command: $cmd" "PASS" "Available"
        else
            test_result "Command: $cmd" "FAIL" "Missing (install with: sudo apt install $cmd)"
        fi
    done
    
    # Check system resources
    local total_ram_gb=$(free -g | awk '/^Mem:/{print $2}')
    if [[ $total_ram_gb -ge 8 ]]; then
        test_result "System RAM" "PASS" "${total_ram_gb}GB available"
    else
        test_result "System RAM" "FAIL" "Only ${total_ram_gb}GB available (8GB+ recommended)"
    fi
    
    local cpu_cores=$(nproc)
    if [[ $cpu_cores -ge 4 ]]; then
        test_result "CPU Cores" "PASS" "$cpu_cores cores available"
    else
        test_result "CPU Cores" "FAIL" "Only $cpu_cores cores (4+ recommended)"
    fi
}

# Test 5: Script Files
test_scripts() {
    echo -e "${BLUE}Testing Script Files...${NC}"
    
    # Check management scripts
    local scripts=("start-llama-server.sh" "monitor-llama-cpp.sh" "deploy-llama-cpp.sh")
    for script in "${scripts[@]}"; do
        local script_path="${PROJECT_ROOT}/scripts/$script"
        if [[ -f "$script_path" && -x "$script_path" ]]; then
            test_result "Script: $script" "PASS" "Executable and ready"
        else
            test_result "Script: $script" "FAIL" "Missing or not executable"
        fi
    done
    
    # Check configuration files
    if [[ -f "${PROJECT_ROOT}/scripts/llama-server.service" ]]; then
        test_result "Systemd Service" "PASS" "Service file available"
    else
        test_result "Systemd Service" "FAIL" "Service file missing"
    fi
    
    if [[ -f "${PROJECT_ROOT}/scripts/ecosystem.config.js" ]]; then
        test_result "PM2 Config" "PASS" "PM2 configuration available"
    else
        test_result "PM2 Config" "FAIL" "PM2 configuration missing"
    fi
}

# Test 6: Server Startup Test
test_server_startup() {
    echo -e "${BLUE}Testing Server Startup...${NC}"
    
    # Check if server is already running
    if pgrep -f "llama-server" >/dev/null; then
        test_result "Server Process" "PASS" "Already running"
        local was_running=true
    else
        local was_running=false
        
        # Try to start server
        echo "  Starting server for testing..."
        if "${PROJECT_ROOT}/scripts/start-llama-server.sh" start >/dev/null 2>&1; then
            test_result "Server Startup" "PASS" "Started successfully"
            
            # Wait for server to be ready
            local attempts=0
            local max_attempts=30
            
            while [[ $attempts -lt $max_attempts ]]; do
                if curl -s "http://localhost:8081/health" >/dev/null 2>&1; then
                    break
                fi
                sleep 1
                ((attempts++))
            done
            
            if [[ $attempts -lt $max_attempts ]]; then
                test_result "Server Ready" "PASS" "Health endpoint responding"
            else
                test_result "Server Ready" "FAIL" "Health endpoint not responding"
            fi
        else
            test_result "Server Startup" "FAIL" "Failed to start"
        fi
    fi
    
    # Test HTTP endpoints
    if curl -s "http://localhost:8081/health" >/dev/null 2>&1; then
        test_result "Health Endpoint" "PASS" "Responding"
        
        # Test model loading endpoint
        if curl -s "http://localhost:8081/v1/models" >/dev/null 2>&1; then
            test_result "Models Endpoint" "PASS" "API responding"
        else
            test_result "Models Endpoint" "FAIL" "API not responding"
        fi
    else
        test_result "Health Endpoint" "FAIL" "Not responding"
    fi
    
    # Stop server if we started it
    if [[ "$was_running" == false ]] && pgrep -f "llama-server" >/dev/null; then
        echo "  Stopping test server..."
        "${PROJECT_ROOT}/scripts/start-llama-server.sh" stop >/dev/null 2>&1 || true
    fi
}

# Test 7: Performance and Resource Usage
test_performance() {
    echo -e "${BLUE}Testing Performance Configuration...${NC}"
    
    # Check if server is running for performance test
    local test_performance=false
    if pgrep -f "llama-server" >/dev/null; then
        local pid=$(pgrep -f "llama-server" | head -1)
        
        # Check memory usage
        local rss_kb=$(ps -o rss= -p "$pid" 2>/dev/null || echo "0")
        local mem_gb=$(echo "scale=1; $rss_kb / 1024 / 1024" | bc 2>/dev/null || echo "0")
        
        if (( $(echo "$mem_gb < 32" | bc -l) 2>/dev/null )); then
            test_result "Memory Usage" "PASS" "${mem_gb}GB (within reasonable limits)"
        else
            test_result "Memory Usage" "FAIL" "${mem_gb}GB (high memory usage)"
        fi
        
        # Check CPU affinity
        if command -v taskset >/dev/null 2>&1; then
            local cpu_affinity=$(taskset -p "$pid" 2>/dev/null | grep -o '[0-9a-f]*$' || echo "")
            if [[ -n "$cpu_affinity" ]]; then
                test_result "CPU Affinity" "PASS" "Configured"
            else
                test_result "CPU Affinity" "PASS" "Using default"
            fi
        else
            test_result "CPU Affinity" "PASS" "taskset not available"
        fi
        
        test_performance=true
    else
        test_result "Performance Test" "FAIL" "Server not running for performance check"
    fi
}

# Test 8: Security and Permissions
test_security() {
    echo -e "${BLUE}Testing Security and Permissions...${NC}"
    
    # Check file permissions
    local server_bin="${PROJECT_ROOT}/llama.cpp/build/bin/llama-server"
    if [[ -f "$server_bin" ]]; then
        local perms=$(stat -c "%a" "$server_bin" 2>/dev/null || echo "000")
        if [[ "$perms" == "755" || "$perms" == "750" ]]; then
            test_result "Binary Permissions" "PASS" "Secure permissions ($perms)"
        else
            test_result "Binary Permissions" "FAIL" "Insecure permissions ($perms)"
        fi
    fi
    
    # Check .env file permissions
    if [[ -f "${PROJECT_ROOT}/.env" ]]; then
        local env_perms=$(stat -c "%a" "${PROJECT_ROOT}/.env" 2>/dev/null || echo "000")
        if [[ "$env_perms" == "600" || "$env_perms" == "640" ]]; then
            test_result ".env Permissions" "PASS" "Secure permissions ($env_perms)"
        else
            test_result ".env Permissions" "FAIL" "Insecure permissions ($env_perms) - should be 600"
        fi
    fi
    
    # Check if running as root
    if [[ $EUID -eq 0 ]]; then
        test_result "User Context" "FAIL" "Running as root (security risk)"
    else
        test_result "User Context" "PASS" "Running as non-root user"
    fi
}

# Generate summary report
generate_report() {
    echo ""
    echo "=========================================="
    echo "          VALIDATION SUMMARY"
    echo "=========================================="
    echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
    echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
    echo -e "Total Tests:  $(($TESTS_PASSED + $TESTS_FAILED))"
    echo ""
    
    if [[ $TESTS_FAILED -eq 0 ]]; then
        echo -e "${GREEN}🎉 ALL TESTS PASSED! Deployment is ready for production.${NC}"
        echo ""
        echo "Next Steps:"
        echo "1. Start the server: ./scripts/start-llama-server.sh start"
        echo "2. Monitor health: ./scripts/monitor-llama-cpp.sh status"
        echo "3. Test API: curl http://localhost:8081/health"
        
        return 0
    else
        echo -e "${RED}⚠️  $TESTS_FAILED TESTS FAILED. Please address issues before production deployment.${NC}"
        echo ""
        echo "Common fixes:"
        echo "1. Run deployment setup: ./scripts/deploy-llama-cpp.sh"
        echo "2. Check .env configuration"
        echo "3. Download required models"
        echo "4. Install missing dependencies"
        
        return 1
    fi
}

# Main validation function
main() {
    echo "CrewAI Team - Llama.cpp Deployment Validation"
    echo "============================================="
    echo ""
    
    # Run all tests
    test_environment
    echo ""
    test_binaries
    echo ""
    test_models
    echo ""
    test_dependencies
    echo ""
    test_scripts
    echo ""
    test_server_startup
    echo ""
    test_performance
    echo ""
    test_security
    echo ""
    
    # Generate final report
    generate_report
}

# Handle script arguments
case "${1:-validate}" in
    "validate")
        main
        ;;
    "quick")
        echo "Quick Validation (Essential Tests Only)"
        echo "======================================"
        test_environment
        test_binaries
        test_models
        generate_report
        ;;
    "help"|"--help"|"-h")
        echo "CrewAI Team Deployment Validation Script"
        echo ""
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  validate    Run full validation suite (default)"
        echo "  quick       Run essential tests only"
        echo "  help        Show this help"
        ;;
    *)
        echo "Unknown command: $1"
        echo "Use '$0 help' for usage information"
        exit 1
        ;;
esac