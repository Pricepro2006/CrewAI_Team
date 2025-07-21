#!/bin/bash

# Staging Deployment Script for CrewAI Team
# This script deploys the application to a staging environment using Docker Compose

set -euo pipefail

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
STAGING_DIR="${STAGING_DIR:-/opt/crewai-staging}"
COMPOSE_FILE="docker/docker-compose.yml"
COMPOSE_OVERRIDE="docker/docker-compose.staging.yml"
ENV_FILE=".env.staging"

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi
    
    # Check if Docker daemon is running
    if ! docker info > /dev/null 2>&1; then
        log_error "Docker daemon is not running"
        exit 1
    fi
    
    log_info "Prerequisites check passed"
}

# Create staging environment file
create_env_file() {
    log_info "Creating staging environment file..."
    
    cat > "$ENV_FILE" << EOF
# Staging Environment Configuration
NODE_ENV=staging
PORT=3001
WS_PORT=3002

# Database
DATABASE_PATH=./data/app.db

# Ollama Configuration
OLLAMA_URL=http://ollama:11434
OLLAMA_MODEL=phi3:mini

# ChromaDB Configuration
CHROMA_HOST=chromadb
CHROMA_PORT=8000

# Security
JWT_SECRET=$(openssl rand -base64 32)
SESSION_SECRET=$(openssl rand -base64 32)

# Email Service
EMAIL_POLLING_INTERVAL=60000
EMAIL_BATCH_SIZE=10

# Logging
LOG_LEVEL=info
LOG_FILE=./data/logs/app.log

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
EOF
    
    log_info "Environment file created"
}

# Build Docker images
build_images() {
    log_info "Building Docker images..."
    
    # Build with BuildKit for better performance
    export DOCKER_BUILDKIT=1
    
    # Build the application image with both compose files
    docker-compose -f "$COMPOSE_FILE" -f "$COMPOSE_OVERRIDE" build --no-cache app
    
    log_info "Docker images built successfully"
}

# Prepare data directories
prepare_directories() {
    log_info "Preparing data directories..."
    
    # Create necessary directories
    mkdir -p data/logs data/vectordb data/documents
    
    # Set permissions
    chmod -R 755 data
    
    log_info "Directories prepared"
}

# Deploy to staging
deploy_staging() {
    log_info "Deploying to staging environment..."
    
    # Stop existing containers if any
    docker-compose -f "$COMPOSE_FILE" -f "$COMPOSE_OVERRIDE" down || true
    
    # Start services with override
    docker-compose -f "$COMPOSE_FILE" -f "$COMPOSE_OVERRIDE" up -d
    
    # Wait for services to be ready
    log_info "Waiting for services to start..."
    sleep 30
    
    # Check service health
    check_service_health
}

# Check service health
check_service_health() {
    log_info "Checking service health..."
    
    local services=("ollama" "chromadb" "app")
    local all_healthy=true
    
    for service in "${services[@]}"; do
        if docker-compose -f "$COMPOSE_FILE" -f "$COMPOSE_OVERRIDE" ps | grep -q "${service}.*healthy"; then
            log_info "✅ $service is healthy"
        else
            log_error "❌ $service is not healthy"
            all_healthy=false
        fi
    done
    
    if [ "$all_healthy" = true ]; then
        log_info "All services are healthy!"
    else
        log_error "Some services are not healthy. Check logs with: docker-compose logs"
        exit 1
    fi
}

# Install Ollama models
install_models() {
    log_info "Installing required Ollama models..."
    
    # Install Phi-3 mini model
    docker exec ai-agent-ollama ollama pull phi3:mini || log_warn "Failed to pull phi3:mini model"
    
    # Install embedding model
    docker exec ai-agent-ollama ollama pull nomic-embed-text || log_warn "Failed to pull nomic-embed-text model"
    
    log_info "Model installation completed"
}

# Run post-deployment tests
run_tests() {
    log_info "Running post-deployment tests..."
    
    # Test API health endpoint
    if curl -s http://localhost:3001/health | grep -q "ok"; then
        log_info "✅ API health check passed"
    else
        log_error "❌ API health check failed"
    fi
    
    # Test Ollama
    if curl -s http://localhost:11434/api/tags | grep -q "models"; then
        log_info "✅ Ollama is responding"
    else
        log_error "❌ Ollama is not responding"
    fi
    
    # Test ChromaDB
    if curl -s http://localhost:8000/api/v1/heartbeat | grep -q "nanosecond"; then
        log_info "✅ ChromaDB is responding"
    else
        log_error "❌ ChromaDB is not responding"
    fi
}

# Show deployment info
show_deployment_info() {
    echo ""
    echo "🎉 Staging deployment completed successfully!"
    echo ""
    echo "📋 Service URLs:"
    echo "   - Frontend: http://localhost:3000"
    echo "   - API: http://localhost:3001"
    echo "   - WebSocket: ws://localhost:3002"
    echo "   - Ollama: http://localhost:11434"
    echo "   - ChromaDB: http://localhost:8000"
    echo ""
    echo "📝 Useful commands:"
    echo "   - View logs: docker-compose -f $COMPOSE_FILE -f $COMPOSE_OVERRIDE logs -f"
    echo "   - Stop services: docker-compose -f $COMPOSE_FILE -f $COMPOSE_OVERRIDE down"
    echo "   - Restart services: docker-compose -f $COMPOSE_FILE -f $COMPOSE_OVERRIDE restart"
    echo "   - View service status: docker-compose -f $COMPOSE_FILE -f $COMPOSE_OVERRIDE ps"
    echo ""
}

# Main deployment flow
main() {
    log_info "Starting staging deployment..."
    
    # Run deployment steps
    check_prerequisites
    create_env_file
    prepare_directories
    build_images
    deploy_staging
    install_models
    run_tests
    show_deployment_info
    
    log_info "Deployment process completed!"
}

# Handle errors
trap 'log_error "Deployment failed! Check logs for details."; exit 1' ERR

# Run main function
main "$@"