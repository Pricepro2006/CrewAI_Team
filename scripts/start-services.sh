#!/bin/bash

# CrewAI Team - Services Startup Script
# This script starts all required backend services for the application

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DOCKER_COMPOSE_FILE="$PROJECT_ROOT/docker-compose.yml"
OLLAMA_MODEL="phi3:mini"
OLLAMA_EMBED_MODEL="nomic-embed-text"
CHROME_TOKEN="test-token"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] ✓${NC} $1"
}

print_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] ⚠${NC} $1"
}

# Function to check if a port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Function to check if Docker is running
check_docker() {
    if ! docker info >/dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker first."
        exit 1
    fi
    print_success "Docker is running"
}

# Function to check if docker-compose is installed
check_docker_compose() {
    if ! command -v docker-compose &> /dev/null; then
        print_error "docker-compose is not installed. Please install it first."
        print_status "Installing docker-compose..."
        # Try to install docker-compose
        sudo apt-get update && sudo apt-get install -y docker-compose
    fi
    print_success "docker-compose is installed"
}

# Function to wait for service
wait_for_service() {
    local service_name=$1
    local url=$2
    local max_attempts=30
    local attempt=0
    
    print_status "Waiting for $service_name to be ready..."
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -s "$url" >/dev/null 2>&1; then
            print_success "$service_name is ready"
            return 0
        fi
        
        attempt=$((attempt + 1))
        echo -n "."
        sleep 2
    done
    
    print_error "$service_name failed to become ready after $max_attempts attempts"
    return 1
}

# Main execution
main() {
    print_status "Starting CrewAI Team Backend Services..."
    echo ""
    
    # Check prerequisites
    check_docker
    check_docker_compose
    
    # Navigate to project root
    cd "$PROJECT_ROOT"
    
    # Check if any services are already running on required ports
    print_status "Checking for conflicting services..."
    local ports=(6379 8000 11434 8888)
    local services=("Redis" "ChromaDB" "Ollama" "SearXNG")
    local conflicts=false
    
    for i in "${!ports[@]}"; do
        if check_port ${ports[$i]}; then
            print_warning "${services[$i]} port ${ports[$i]} is already in use"
            conflicts=true
        fi
    done
    
    if [ "$conflicts" = true ]; then
        read -p "Stop conflicting services and continue? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            docker-compose -f "$DOCKER_COMPOSE_FILE" down
        else
            exit 1
        fi
    fi
    
    # Start services
    print_status "Starting services with docker-compose..."
    docker-compose -f "$DOCKER_COMPOSE_FILE" up -d
    
    # Wait for services to be ready
    echo ""
    wait_for_service "Redis" "http://localhost:6379" || true
    wait_for_service "ChromaDB" "http://localhost:8000/api/v1/heartbeat"
    wait_for_service "Ollama" "http://localhost:11434/api/version"
    wait_for_service "SearXNG" "http://localhost:8888/healthz"
    
    # Pull Ollama models if not exists
    print_status "Checking Ollama models..."
    if ! docker exec crewai-ollama ollama list | grep -q "$OLLAMA_MODEL"; then
        print_warning "Model $OLLAMA_MODEL not found. Pulling..."
        docker exec crewai-ollama ollama pull "$OLLAMA_MODEL"
        print_success "Model $OLLAMA_MODEL pulled successfully"
    else
        print_success "Model $OLLAMA_MODEL already available"
    fi
    
    if ! docker exec crewai-ollama ollama list | grep -q "$OLLAMA_EMBED_MODEL"; then
        print_warning "Model $OLLAMA_EMBED_MODEL not found. Pulling..."
        docker exec crewai-ollama ollama pull "$OLLAMA_EMBED_MODEL"
        print_success "Model $OLLAMA_EMBED_MODEL pulled successfully"
    else
        print_success "Model $OLLAMA_EMBED_MODEL already available"
    fi
    
    # Display service status
    echo ""
    print_status "Service Status:"
    docker-compose -f "$DOCKER_COMPOSE_FILE" ps
    
    echo ""
    print_success "All services started successfully!"
    echo ""
    echo "Service URLs:"
    echo "  - Redis:    redis://localhost:6379"
    echo "  - ChromaDB: http://localhost:8000 (Token: $CHROME_TOKEN)"
    echo "  - Ollama:   http://localhost:11434"
    echo "  - SearXNG:  http://localhost:8888"
    echo ""
    echo "To stop all services, run:"
    echo "  $0 stop"
    echo ""
    echo "🎯 Ready to start the API server with: npm run dev"
}

# Handle command line arguments
case "${1:-start}" in
    start)
        main
        ;;
    stop)
        print_status "Stopping all services..."
        cd "$PROJECT_ROOT"
        docker-compose -f "$DOCKER_COMPOSE_FILE" down
        print_success "All services stopped"
        ;;
    restart)
        "$0" stop
        sleep 2
        "$0" start
        ;;
    status)
        cd "$PROJECT_ROOT"
        docker-compose -f "$DOCKER_COMPOSE_FILE" ps
        ;;
    logs)
        cd "$PROJECT_ROOT"
        docker-compose -f "$DOCKER_COMPOSE_FILE" logs -f "${2:-}"
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|logs [service_name]}"
        exit 1
        ;;
esac