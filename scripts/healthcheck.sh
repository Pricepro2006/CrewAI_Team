#!/bin/sh

# Docker health check script for Walmart Grocery Agent
# Tests that the application is running and responsive

set -e

# Configuration
HOST=${HOST:-localhost}
PORT=${PORT:-3000}
TIMEOUT=${HEALTH_TIMEOUT:-10}
MAX_RETRIES=3

echo "Health check starting for $HOST:$PORT..."

# Function to check HTTP endpoint
check_http() {
    local url="$1"
    local timeout="$2"
    
    if command -v curl >/dev/null 2>&1; then
        curl -f -s -m "$timeout" "$url" >/dev/null
    elif command -v wget >/dev/null 2>&1; then
        wget -q -T "$timeout" -O /dev/null "$url"
    else
        echo "ERROR: Neither curl nor wget available for health check"
        return 1
    fi
}

# Check main application health endpoint
check_app_health() {
    local url="http://$HOST:$PORT/api/health"
    
    if check_http "$url" "$TIMEOUT"; then
        echo "✓ Application health check passed"
        return 0
    else
        echo "✗ Application health check failed"
        return 1
    fi
}

# Check if server is responsive
check_server_responsive() {
    local url="http://$HOST:$PORT"
    
    if check_http "$url" "$TIMEOUT"; then
        echo "✓ Server is responsive"
        return 0
    else
        echo "✗ Server is not responsive"
        return 1
    fi
}

# Check database connectivity (if applicable)
check_database() {
    # This would connect to SQLite database file
    # For now, just check if the data directory exists
    if [ -d "/app/data" ]; then
        echo "✓ Database directory accessible"
        return 0
    else
        echo "✗ Database directory not accessible"
        return 1
    fi
}

# Check critical files
check_files() {
    local critical_files="
        /app/dist/api/server.js
        /app/package.json
    "
    
    for file in $critical_files; do
        if [ ! -f "$file" ]; then
            echo "✗ Critical file missing: $file"
            return 1
        fi
    done
    
    echo "✓ Critical files present"
    return 0
}

# Check memory usage
check_memory() {
    local memory_limit_mb=512  # 512MB limit
    
    # Get memory usage in MB (if available)
    if [ -f /proc/meminfo ]; then
        local memory_used=$(awk '/^MemAvailable:/ {print int(($2/1024))}' /proc/meminfo 2>/dev/null || echo "0")
        
        if [ "$memory_used" -gt 0 ] && [ "$memory_used" -lt 100 ]; then
            echo "⚠ Low memory available: ${memory_used}MB"
        else
            echo "✓ Memory usage acceptable"
        fi
    else
        echo "✓ Memory check skipped (not available)"
    fi
    
    return 0
}

# Main health check function
main() {
    local failed_checks=0
    local retry_count=0
    
    echo "Starting comprehensive health check..."
    
    # Retry loop
    while [ $retry_count -lt $MAX_RETRIES ]; do
        failed_checks=0
        
        # Run all health checks
        check_files || failed_checks=$((failed_checks + 1))
        check_database || failed_checks=$((failed_checks + 1))
        check_memory || failed_checks=$((failed_checks + 1))
        check_server_responsive || failed_checks=$((failed_checks + 1))
        check_app_health || failed_checks=$((failed_checks + 1))
        
        # If all checks passed, exit successfully
        if [ $failed_checks -eq 0 ]; then
            echo "🎉 All health checks passed!"
            exit 0
        fi
        
        # If this isn't the last retry, wait before retrying
        retry_count=$((retry_count + 1))
        if [ $retry_count -lt $MAX_RETRIES ]; then
            echo "⏳ Retrying health check ($retry_count/$MAX_RETRIES) in 2 seconds..."
            sleep 2
        fi
    done
    
    # All retries failed
    echo "❌ Health check failed after $MAX_RETRIES attempts"
    echo "Failed checks: $failed_checks"
    exit 1
}

# Run the health check
main "$@"