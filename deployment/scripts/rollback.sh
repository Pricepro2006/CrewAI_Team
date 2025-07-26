#!/bin/bash
# 2025 Best Practice: Safe rollback procedure with validation

set -euo pipefail

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
NAMESPACE="production"
APP_NAME="email-dashboard"
ROLLBACK_TO_REVISION="${1:-}"

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

check_current_status() {
    log_info "Checking current deployment status..."
    
    # Get current revision
    local current_revision=$(kubectl get deployment "$APP_NAME" \
        -n "$NAMESPACE" \
        -o jsonpath='{.metadata.annotations.deployment\.kubernetes\.io/revision}')
    
    log_info "Current revision: $current_revision"
    
    # Get rollout history
    log_info "Deployment history:"
    kubectl rollout history deployment/"$APP_NAME" -n "$NAMESPACE"
}

validate_revision() {
    if [ -z "$ROLLBACK_TO_REVISION" ]; then
        log_error "No revision specified"
        log_info "Usage: $0 <revision_number>"
        log_info "Use 'kubectl rollout history deployment/$APP_NAME -n $NAMESPACE' to see available revisions"
        exit 1
    fi
    
    # Check if revision exists
    if ! kubectl rollout history deployment/"$APP_NAME" -n "$NAMESPACE" \
        --revision="$ROLLBACK_TO_REVISION" &> /dev/null; then
        log_error "Revision $ROLLBACK_TO_REVISION does not exist"
        exit 1
    fi
    
    log_info "Validated revision $ROLLBACK_TO_REVISION exists"
}

create_rollback_backup() {
    log_info "Creating backup before rollback..."
    
    local backup_dir="backups/rollback_$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$backup_dir"
    
    # Save current state
    kubectl get deployment "$APP_NAME" -n "$NAMESPACE" \
        -o yaml > "$backup_dir/current_deployment.yaml"
    
    # Save events for troubleshooting
    kubectl get events -n "$NAMESPACE" \
        --field-selector involvedObject.name="$APP_NAME" \
        > "$backup_dir/events.log"
    
    # Save pod logs
    local pods=$(kubectl get pods -n "$NAMESPACE" \
        -l app="$APP_NAME" \
        -o jsonpath='{.items[*].metadata.name}')
    
    for pod in $pods; do
        kubectl logs "$pod" -n "$NAMESPACE" \
            --tail=1000 > "$backup_dir/${pod}_logs.log" || true
    done
    
    log_info "Backup created at: $backup_dir"
}

perform_rollback() {
    log_info "Rolling back to revision $ROLLBACK_TO_REVISION..."
    
    # Perform the rollback
    kubectl rollout undo deployment/"$APP_NAME" \
        -n "$NAMESPACE" \
        --to-revision="$ROLLBACK_TO_REVISION"
    
    # Wait for rollback to complete
    log_info "Waiting for rollback to complete..."
    if ! kubectl rollout status deployment/"$APP_NAME" \
        -n "$NAMESPACE" \
        --timeout=600s; then
        log_error "Rollback failed or timed out"
        exit 1
    fi
    
    log_info "Rollback completed successfully"
}

verify_rollback() {
    log_info "Verifying rollback..."
    
    # Check deployment status
    local deployment_status=$(kubectl get deployment "$APP_NAME" \
        -n "$NAMESPACE" \
        -o jsonpath='{.status.conditions[?(@.type=="Progressing")].status}')
    
    if [ "$deployment_status" != "True" ]; then
        log_error "Deployment is not progressing correctly"
        exit 1
    fi
    
    # Check pod readiness
    local ready_replicas=$(kubectl get deployment "$APP_NAME" \
        -n "$NAMESPACE" \
        -o jsonpath='{.status.readyReplicas}')
    
    local desired_replicas=$(kubectl get deployment "$APP_NAME" \
        -n "$NAMESPACE" \
        -o jsonpath='{.spec.replicas}')
    
    if [ "$ready_replicas" != "$desired_replicas" ]; then
        log_warn "Not all replicas are ready: $ready_replicas/$desired_replicas"
    else
        log_info "All replicas are ready: $ready_replicas/$desired_replicas"
    fi
    
    # Run basic health check
    run_health_checks
}

run_health_checks() {
    log_info "Running health checks..."
    
    # Get a running pod
    local pod_name=$(kubectl get pods -n "$NAMESPACE" \
        -l app="$APP_NAME" \
        -o jsonpath='{.items[0].metadata.name}')
    
    if [ -z "$pod_name" ]; then
        log_error "No pods found"
        exit 1
    fi
    
    # Check pod health endpoint
    if kubectl exec "$pod_name" -n "$NAMESPACE" -- \
        wget -q -O- http://localhost:3000/health &> /dev/null; then
        log_info "Health check passed"
    else
        log_warn "Health check failed - application may need time to warm up"
    fi
}

notify_rollback() {
    log_info "Sending rollback notification..."
    
    # In production, this would send alerts to monitoring systems
    # For now, we'll just log the event
    local message="Rollback performed on $APP_NAME to revision $ROLLBACK_TO_REVISION"
    
    # Create an event in Kubernetes
    kubectl create -f - <<EOF
apiVersion: v1
kind: Event
metadata:
  name: rollback-$(date +%s)
  namespace: $NAMESPACE
involvedObject:
  apiVersion: apps/v1
  kind: Deployment
  name: $APP_NAME
  namespace: $NAMESPACE
message: "$message"
reason: "ManualRollback"
type: "Normal"
EOF
    
    log_info "Rollback notification sent"
}

main() {
    log_info "Starting rollback process for $APP_NAME"
    
    check_current_status
    validate_revision
    
    # Confirm rollback
    echo -e "${YELLOW}Are you sure you want to rollback to revision $ROLLBACK_TO_REVISION? (yes/no)${NC}"
    read -r confirmation
    
    if [ "$confirmation" != "yes" ]; then
        log_info "Rollback cancelled"
        exit 0
    fi
    
    create_rollback_backup
    perform_rollback
    verify_rollback
    notify_rollback
    
    log_info "Rollback completed successfully!"
    log_info "Application has been rolled back to revision $ROLLBACK_TO_REVISION"
}

# Run main function
main "$@"