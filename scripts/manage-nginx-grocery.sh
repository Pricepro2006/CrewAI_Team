#!/bin/bash

# Walmart Grocery Agent Nginx Management Script
# Operations: start, stop, restart, status, logs, test, reload

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
SERVICE_NAME="nginx-grocery"
PROJECT_ROOT="/home/pricepro2006/CrewAI_Team"
NGINX_CONF="$PROJECT_ROOT/nginx/nginx.conf"
LOG_DIR="$PROJECT_ROOT/nginx/logs"

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

show_usage() {
    echo "Usage: $0 {start|stop|restart|reload|status|logs|test|health|config}"
    echo
    echo "Commands:"
    echo "  start    - Start the nginx service"
    echo "  stop     - Stop the nginx service"
    echo "  restart  - Restart the nginx service"
    echo "  reload   - Reload nginx configuration without stopping"
    echo "  status   - Show service status and health"
    echo "  logs     - Show recent logs"
    echo "  test     - Test configuration and connectivity"
    echo "  health   - Check health of all upstream services"
    echo "  config   - Validate nginx configuration"
    echo
    exit 1
}

check_service_status() {
    if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
        return 0
    else
        return 1
    fi
}

start_service() {
    log_info "Starting $SERVICE_NAME..."
    
    if check_service_status; then
        log_warning "Service is already running"
        return 0
    fi
    
    if sudo systemctl start "$SERVICE_NAME"; then
        log_success "Service started successfully"
        sleep 2
        show_status
    else
        log_error "Failed to start service"
        show_logs 20
        return 1
    fi
}

stop_service() {
    log_info "Stopping $SERVICE_NAME..."
    
    if ! check_service_status; then
        log_warning "Service is already stopped"
        return 0
    fi
    
    if sudo systemctl stop "$SERVICE_NAME"; then
        log_success "Service stopped successfully"
    else
        log_error "Failed to stop service"
        return 1
    fi
}

restart_service() {
    log_info "Restarting $SERVICE_NAME..."
    
    if sudo systemctl restart "$SERVICE_NAME"; then
        log_success "Service restarted successfully"
        sleep 2
        show_status
    else
        log_error "Failed to restart service"
        show_logs 20
        return 1
    fi
}

reload_service() {
    log_info "Reloading $SERVICE_NAME configuration..."
    
    if ! check_service_status; then
        log_error "Service is not running. Use 'start' instead of 'reload'"
        return 1
    fi
    
    # Test configuration first
    if ! sudo nginx -t -c "$NGINX_CONF"; then
        log_error "Configuration test failed. Reload aborted."
        return 1
    fi
    
    if sudo systemctl reload "$SERVICE_NAME"; then
        log_success "Configuration reloaded successfully"
    else
        log_error "Failed to reload configuration"
        return 1
    fi
}

show_status() {
    log_info "Service Status:"
    systemctl status "$SERVICE_NAME" --no-pager || true
    echo
    
    if check_service_status; then
        log_success "Service is running"
        
        # Check if ports are accessible
        log_info "Port Status:"
        local ports=(80 443 8000)
        for port in "${ports[@]}"; do
            if ss -tuln | grep -q ":$port "; then
                log_success "Port $port is listening"
            else
                log_warning "Port $port is not accessible"
            fi
        done
    else
        log_error "Service is not running"
    fi
}

show_logs() {
    local lines=${1:-50}
    log_info "Recent logs (last $lines lines):"
    
    echo "=== Systemd Logs ==="
    sudo journalctl -u "$SERVICE_NAME" -n "$lines" --no-pager || true
    
    echo
    echo "=== Access Logs ==="
    if [[ -f "$LOG_DIR/grocery.local.access.log" ]]; then
        tail -n "$lines" "$LOG_DIR/grocery.local.access.log" 2>/dev/null || true
    else
        log_warning "Access log not found"
    fi
    
    echo
    echo "=== Error Logs ==="
    if [[ -f "$LOG_DIR/grocery.local.error.log" ]]; then
        tail -n "$lines" "$LOG_DIR/grocery.local.error.log" 2>/dev/null || true
    else
        log_warning "Error log not found"
    fi
}

test_configuration() {
    log_info "Testing Nginx configuration..."
    
    if sudo nginx -t -c "$NGINX_CONF"; then
        log_success "Configuration test passed"
        return 0
    else
        log_error "Configuration test failed"
        return 1
    fi
}

test_connectivity() {
    log_info "Testing connectivity to grocery.local..."
    
    local tests=(
        "http://localhost:8000/health:Development HTTP"
        "https://localhost/health:Production HTTPS"
        "http://localhost:8000/api/health:API Health"
        "http://localhost:8000/health/api:Upstream API"
    )
    
    for test in "${tests[@]}"; do
        local url="${test%:*}"
        local desc="${test#*:}"
        
        log_info "Testing $desc ($url)..."
        
        if curl -s -f -m 5 -H "Host: grocery.local" "$url" >/dev/null 2>&1; then
            log_success "$desc - OK"
        elif [[ "$url" == *"https"* ]]; then
            # Try with -k flag for self-signed certificates
            if curl -s -f -k -m 5 -H "Host: grocery.local" "$url" >/dev/null 2>&1; then
                log_success "$desc - OK (self-signed cert)"
            else
                log_error "$desc - Failed"
            fi
        else
            log_error "$desc - Failed"
        fi
    done
}

check_upstream_health() {
    log_info "Checking upstream services health..."
    
    local services=(
        "walmart-api-server:3000:API Server"
        "walmart-websocket:8080:WebSocket"
        "walmart-pricing:3007:Pricing Service"
        "walmart-nlp-queue:3008:NLP Queue"
        "walmart-cache-warmer:3006:Cache Warmer"
        "walmart-memory-monitor:3009:Memory Monitor"
    )
    
    local healthy=0
    local total=${#services[@]}
    
    for service_info in "${services[@]}"; do
        IFS=':' read -r service port desc <<< "$service_info"
        
        # Check systemd service
        local service_running=false
        local port_accessible=false
        
        if systemctl is-active --quiet "$service" 2>/dev/null; then
            service_running=true
        fi
        
        # Check port
        if nc -z localhost "$port" 2>/dev/null; then
            port_accessible=true
        fi
        
        if $service_running && $port_accessible; then
            log_success "$desc - Healthy (service: ✓, port: ✓)"
            ((healthy++))
        elif $service_running; then
            log_warning "$desc - Service running but port $port not accessible"
        elif $port_accessible; then
            log_warning "$desc - Port accessible but systemd service not running"
        else
            log_error "$desc - Unhealthy (service: ✗, port: ✗)"
        fi
    done
    
    echo
    log_info "Overall upstream health: $healthy/$total services healthy"
    
    if [[ $healthy -eq $total ]]; then
        log_success "All upstream services are healthy"
    elif [[ $healthy -ge 3 ]]; then
        log_warning "Most services healthy, some issues detected"
    else
        log_error "Multiple upstream services unhealthy. Nginx may have issues."
    fi
}

run_comprehensive_test() {
    log_info "Running comprehensive test suite..."
    echo
    
    test_configuration
    echo
    
    if check_service_status; then
        test_connectivity
        echo
        check_upstream_health
    else
        log_warning "Service not running, skipping connectivity tests"
    fi
}

validate_config() {
    test_configuration
}

main() {
    if [[ $# -eq 0 ]]; then
        show_usage
    fi
    
    case "$1" in
        start)
            start_service
            ;;
        stop)
            stop_service
            ;;
        restart)
            restart_service
            ;;
        reload)
            reload_service
            ;;
        status)
            show_status
            ;;
        logs)
            show_logs "${2:-50}"
            ;;
        test)
            run_comprehensive_test
            ;;
        health)
            check_upstream_health
            ;;
        config)
            validate_config
            ;;
        *)
            log_error "Unknown command: $1"
            show_usage
            ;;
    esac
}

main "$@"