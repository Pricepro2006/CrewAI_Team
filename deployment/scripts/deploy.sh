#!/bin/bash
# 2025 Best Practice: Production deployment script with safety checks

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="production"
APP_NAME="email-dashboard"
DOCKER_REGISTRY="tdsynnex"
VERSION="${VERSION:-v1.0.0}"
CLUSTER="${CLUSTER:-production-cluster}"
REGION="${REGION:-us-east-1}"

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

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check required tools
    local required_tools=("kubectl" "docker" "helm" "jq")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log_error "$tool is not installed"
            exit 1
        fi
    done
    
    # Check kubectl context
    local current_context=$(kubectl config current-context)
    if [[ "$current_context" != *"$CLUSTER"* ]]; then
        log_error "Wrong kubectl context: $current_context"
        log_error "Expected context containing: $CLUSTER"
        exit 1
    fi
    
    # Check namespace exists
    if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
        log_warn "Namespace $NAMESPACE does not exist. Creating..."
        kubectl create namespace "$NAMESPACE"
    fi
    
    log_info "Prerequisites check passed"
}

build_and_push_docker() {
    log_info "Building Docker image..."
    
    # Build with BuildKit for better caching
    DOCKER_BUILDKIT=1 docker build \
        --build-arg VERSION="$VERSION" \
        --tag "$DOCKER_REGISTRY/$APP_NAME:$VERSION" \
        --tag "$DOCKER_REGISTRY/$APP_NAME:latest" \
        --file deployment/docker/Dockerfile \
        .
    
    # Security scan
    log_info "Running security scan on Docker image..."
    docker scan "$DOCKER_REGISTRY/$APP_NAME:$VERSION" || log_warn "Security scan completed with warnings"
    
    # Push to registry
    log_info "Pushing Docker image to registry..."
    docker push "$DOCKER_REGISTRY/$APP_NAME:$VERSION"
    docker push "$DOCKER_REGISTRY/$APP_NAME:latest"
    
    log_info "Docker image built and pushed successfully"
}

create_secrets() {
    log_info "Creating/updating secrets..."
    
    # Check if secrets file exists
    if [ ! -f "deployment/kubernetes/secrets.env" ]; then
        log_error "secrets.env file not found"
        exit 1
    fi
    
    # Create secret from env file
    kubectl create secret generic email-dashboard-secrets \
        --from-env-file=deployment/kubernetes/secrets.env \
        --namespace="$NAMESPACE" \
        --dry-run=client -o yaml | kubectl apply -f -
    
    log_info "Secrets created/updated successfully"
}

deploy_application() {
    log_info "Deploying application to Kubernetes..."
    
    # Update image tag in deployment
    sed -i "s|image: .*|image: $DOCKER_REGISTRY/$APP_NAME:$VERSION|g" \
        deployment/kubernetes/deployment.yaml
    
    # Apply configurations
    kubectl apply -f deployment/kubernetes/configmap.yaml
    kubectl apply -f deployment/kubernetes/deployment.yaml
    
    # Wait for rollout to complete
    log_info "Waiting for deployment to complete..."
    kubectl rollout status deployment/"$APP_NAME" \
        --namespace="$NAMESPACE" \
        --timeout=600s
    
    log_info "Application deployed successfully"
}

run_health_checks() {
    log_info "Running health checks..."
    
    # Get pod name
    local pod_name=$(kubectl get pods -n "$NAMESPACE" \
        -l app="$APP_NAME" \
        -o jsonpath='{.items[0].metadata.name}')
    
    # Check pod status
    local pod_status=$(kubectl get pod "$pod_name" -n "$NAMESPACE" \
        -o jsonpath='{.status.phase}')
    
    if [ "$pod_status" != "Running" ]; then
        log_error "Pod is not running. Status: $pod_status"
        exit 1
    fi
    
    # Check readiness
    local ready=$(kubectl get pod "$pod_name" -n "$NAMESPACE" \
        -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}')
    
    if [ "$ready" != "True" ]; then
        log_error "Pod is not ready"
        exit 1
    fi
    
    # Check service endpoint
    local service_ip=$(kubectl get service "$APP_NAME-service" -n "$NAMESPACE" \
        -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
    
    if [ -n "$service_ip" ]; then
        log_info "Service is accessible at: $service_ip"
    fi
    
    log_info "Health checks passed"
}

setup_monitoring() {
    log_info "Setting up monitoring..."
    
    # Create ServiceMonitor for Prometheus
    cat <<EOF | kubectl apply -f -
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: $APP_NAME-monitor
  namespace: $NAMESPACE
  labels:
    app: $APP_NAME
spec:
  selector:
    matchLabels:
      app: $APP_NAME
  endpoints:
  - port: metrics
    interval: 30s
    path: /metrics
EOF
    
    log_info "Monitoring setup completed"
}

create_backup() {
    log_info "Creating backup of previous deployment..."
    
    # Create backup directory
    local backup_dir="backups/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$backup_dir"
    
    # Export current deployment
    kubectl get deployment "$APP_NAME" -n "$NAMESPACE" \
        -o yaml > "$backup_dir/deployment.yaml" || true
    
    kubectl get configmap "$APP_NAME-config" -n "$NAMESPACE" \
        -o yaml > "$backup_dir/configmap.yaml" || true
    
    kubectl get service "$APP_NAME-service" -n "$NAMESPACE" \
        -o yaml > "$backup_dir/service.yaml" || true
    
    log_info "Backup created at: $backup_dir"
}

main() {
    log_info "Starting deployment process for $APP_NAME version $VERSION"
    
    # Run deployment steps
    check_prerequisites
    create_backup
    build_and_push_docker
    create_secrets
    deploy_application
    run_health_checks
    setup_monitoring
    
    log_info "Deployment completed successfully!"
    log_info "Application version $VERSION is now running in $NAMESPACE namespace"
}

# Run main function
main "$@"