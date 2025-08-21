#!/bin/bash

# Walmart Grocery Agent Nginx Setup Script
# Phase 6 Task 3: Microservices Load Balancer Configuration

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="/home/pricepro2006/CrewAI_Team"
NGINX_DIR="$PROJECT_ROOT/nginx"
SYSTEMD_DIR="$PROJECT_ROOT/systemd"
NGINX_USER="www-data"
NGINX_GROUP="www-data"

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_root() {
    if [[ $EUID -eq 0 ]]; then
        log_error "This script should not be run as root for security reasons"
        log_info "Run as a regular user with sudo privileges"
        exit 1
    fi
}

check_dependencies() {
    log_info "Checking system dependencies..."
    
    local deps=("nginx" "systemctl")
    local missing_deps=()
    
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            missing_deps+=("$dep")
        fi
    done
    
    if [[ ${#missing_deps[@]} -gt 0 ]]; then
        log_error "Missing dependencies: ${missing_deps[*]}"
        log_info "Install with: sudo apt-get update && sudo apt-get install ${missing_deps[*]}"
        exit 1
    fi
    
    log_success "All dependencies satisfied"
}

create_directories() {
    log_info "Creating necessary directories..."
    
    local dirs=(
        "/var/cache/nginx/grocery"
        "/var/cache/nginx/temp"
        "/var/log/nginx"
        "$NGINX_DIR/logs"
    )
    
    for dir in "${dirs[@]}"; do
        if [[ ! -d "$dir" ]]; then
            sudo mkdir -p "$dir"
            sudo chown "$NGINX_USER:$NGINX_GROUP" "$dir"
            log_success "Created directory: $dir"
        fi
    done
}

setup_ssl_placeholder() {
    log_info "Setting up SSL certificate placeholders..."
    
    local ssl_dir="/etc/ssl/certs"
    local ssl_key_dir="/etc/ssl/private"
    
    if [[ ! -f "$ssl_dir/grocery.local.crt" ]]; then
        log_warning "SSL certificate not found, creating self-signed certificate for development"
        
        sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout "$ssl_key_dir/grocery.local.key" \
            -out "$ssl_dir/grocery.local.crt" \
            -subj "/C=US/ST=Development/L=Local/O=Grocery Local/CN=grocery.local" \
            2>/dev/null || {
            log_warning "Failed to create self-signed certificate"
            log_info "You'll need to provide SSL certificates manually"
        }
        
        if [[ -f "$ssl_dir/grocery.local.crt" ]]; then
            sudo chmod 644 "$ssl_dir/grocery.local.crt"
            sudo chmod 600 "$ssl_key_dir/grocery.local.key"
            log_success "Self-signed SSL certificate created"
        fi
    else
        log_success "SSL certificate already exists"
    fi
}

validate_config() {
    log_info "Validating Nginx configuration..."
    
    if sudo nginx -t -c "$NGINX_DIR/nginx.conf" 2>/dev/null; then
        log_success "Nginx configuration is valid"
        return 0
    else
        log_error "Nginx configuration validation failed"
        sudo nginx -t -c "$NGINX_DIR/nginx.conf"
        return 1
    fi
}

enable_site() {
    log_info "Enabling grocery.local site..."
    
    local sites_enabled="$NGINX_DIR/sites-enabled"
    local site_config="grocery.local"
    
    if [[ ! -L "$sites_enabled/$site_config" ]]; then
        ln -sf "$NGINX_DIR/sites-available/$site_config" "$sites_enabled/$site_config"
        log_success "Site enabled: $site_config"
    else
        log_info "Site already enabled: $site_config"
    fi
}

setup_systemd_service() {
    log_info "Setting up systemd service..."
    
    local service_file="$SYSTEMD_DIR/nginx-grocery.service"
    local target_file="/etc/systemd/system/nginx-grocery.service"
    
    if [[ -f "$service_file" ]]; then
        sudo cp "$service_file" "$target_file"
        sudo systemctl daemon-reload
        log_success "Systemd service installed"
    else
        log_error "Service file not found: $service_file"
        return 1
    fi
}

check_microservices() {
    log_info "Checking Walmart microservices status..."
    
    local services=(
        "walmart-api-server:3000"
        "walmart-websocket:8080"
        "walmart-pricing:3007"
        "walmart-nlp-queue:3008"
        "walmart-cache-warmer:3006"
        "walmart-memory-monitor:3009"
    )
    
    local healthy=0
    local total=${#services[@]}
    
    for service_port in "${services[@]}"; do
        local service="${service_port%:*}"
        local port="${service_port#*:}"
        
        if systemctl is-active --quiet "$service" 2>/dev/null; then
            if nc -z localhost "$port" 2>/dev/null; then
                log_success "$service (port $port) - Running and accessible"
                ((healthy++))
            else
                log_warning "$service - Running but port $port not accessible"
            fi
        else
            log_warning "$service - Not running"
        fi
    done
    
    log_info "Microservices health: $healthy/$total services healthy"
    
    if [[ $healthy -lt 3 ]]; then
        log_warning "Less than 3 microservices are healthy. Nginx may have upstream errors."
        log_info "Consider starting more services before enabling Nginx"
    fi
}

setup_hosts_file() {
    log_info "Setting up /etc/hosts entry..."
    
    if ! grep -q "grocery.local" /etc/hosts 2>/dev/null; then
        echo "127.0.0.1 grocery.local www.grocery.local" | sudo tee -a /etc/hosts
        log_success "Added grocery.local to /etc/hosts"
    else
        log_info "grocery.local already in /etc/hosts"
    fi
}

main() {
    log_info "Starting Walmart Grocery Agent Nginx setup..."
    
    check_root
    check_dependencies
    create_directories
    setup_ssl_placeholder
    enable_site
    
    if validate_config; then
        setup_systemd_service
        check_microservices
        setup_hosts_file
        
        log_success "Nginx configuration setup complete!"
        echo
        log_info "Next steps:"
        echo "1. Start/restart microservices: sudo systemctl start walmart-api-server walmart-websocket walmart-pricing"
        echo "2. Enable nginx service: sudo systemctl enable nginx-grocery"
        echo "3. Start nginx service: sudo systemctl start nginx-grocery"
        echo "4. Check status: sudo systemctl status nginx-grocery"
        echo "5. View logs: sudo journalctl -u nginx-grocery -f"
        echo "6. Test the setup:"
        echo "   - HTTP: curl -H 'Host: grocery.local' http://localhost:8000/health"
        echo "   - HTTPS: curl -k -H 'Host: grocery.local' https://localhost/health"
        echo "   - Browser: https://grocery.local (add certificate exception)"
        echo
        log_info "Configuration files:"
        echo "- Main config: $NGINX_DIR/nginx.conf"
        echo "- Site config: $NGINX_DIR/sites-available/grocery.local"
        echo "- Service file: /etc/systemd/system/nginx-grocery.service"
        echo "- Logs: $NGINX_DIR/logs/"
        
    else
        log_error "Configuration validation failed. Please check the configuration files."
        exit 1
    fi
}

# Script execution
main "$@"