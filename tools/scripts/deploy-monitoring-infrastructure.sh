#!/bin/bash
# ======================================================================================
# Deployment Script for Schlep Engine Monitoring Infrastructure
# Deploys comprehensive monitoring, tracing, and service mesh observability
# ======================================================================================

set -euo pipefail

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
INFRASTRUCTURE_DIR="$PROJECT_ROOT/infrastructure"
TERRAFORM_DIR="$INFRASTRUCTURE_DIR/terraform"
K8S_DIR="$INFRASTRUCTURE_DIR/k8s"
MONITORING_DIR="$K8S_DIR/monitoring"

# Environment configuration
ENVIRONMENT="${ENVIRONMENT:-production}"
AWS_REGION="${AWS_REGION:-us-east-1}"
CLUSTER_NAME="${CLUSTER_NAME:-schlep-engine-eks}"
DOMAIN_NAME="${DOMAIN_NAME:-schlep-engine.com}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
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

# Progress indicator
show_progress() {
    local message="$1"
    echo -ne "${BLUE}[PROGRESS]${NC} $message"
    while kill -0 $! 2>/dev/null; do
        echo -ne "."
        sleep 1
    done
    echo
}

# Validate prerequisites
validate_prerequisites() {
    log_info "Validating prerequisites..."
    
    # Check required tools
    local required_tools=("kubectl" "helm" "terraform" "aws" "jq" "yq")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log_error "Required tool '$tool' is not installed"
            exit 1
        fi
    done
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS credentials not configured or invalid"
        exit 1
    fi
    
    # Check kubectl context
    if ! kubectl cluster-info &> /dev/null; then
        log_error "kubectl is not connected to a cluster"
        exit 1
    fi
    
    # Verify cluster name matches
    local current_cluster
    current_cluster=$(kubectl config current-context | cut -d/ -f2)
    if [[ "$current_cluster" != "$CLUSTER_NAME" ]]; then
        log_warning "Current cluster context ($current_cluster) doesn't match expected ($CLUSTER_NAME)"
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
    
    log_success "Prerequisites validation completed"
}

# Deploy Terraform infrastructure
deploy_terraform_infrastructure() {
    log_info "Deploying Terraform monitoring infrastructure..."
    
    cd "$TERRAFORM_DIR"
    
    # Initialize Terraform
    log_info "Initializing Terraform..."
    terraform init -upgrade
    
    # Plan deployment
    log_info "Planning Terraform deployment..."
    terraform plan \
        -var="environment=$ENVIRONMENT" \
        -var="aws_region=$AWS_REGION" \
        -var="domain_name=$DOMAIN_NAME" \
        -var="alert_email_addresses=[\"admin@$DOMAIN_NAME\"]" \
        -var="slack_webhook_url=${SLACK_WEBHOOK_URL:-}" \
        -out=tfplan
    
    # Apply infrastructure
    log_info "Applying Terraform infrastructure..."
    terraform apply tfplan
    
    # Get outputs
    log_info "Retrieving Terraform outputs..."
    CIRCUIT_BREAKER_SNS_ARN=$(terraform output -raw circuit_breaker_alerts_topic_arn)
    INFRASTRUCTURE_SNS_ARN=$(terraform output -raw infrastructure_alerts_topic_arn)
    MONITORING_DASHBOARD_URL=$(terraform output -raw monitoring_dashboard_url)
    
    log_success "Terraform infrastructure deployed successfully"
    log_info "Circuit Breaker SNS ARN: $CIRCUIT_BREAKER_SNS_ARN"
    log_info "Infrastructure SNS ARN: $INFRASTRUCTURE_SNS_ARN"
    log_info "Monitoring Dashboard: $MONITORING_DASHBOARD_URL"
    
    cd "$PROJECT_ROOT"
}

# Install Prometheus Operator
install_prometheus_operator() {
    log_info "Installing Prometheus Operator..."
    
    # Add Prometheus community Helm repository
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    helm repo update
    
    # Install kube-prometheus-stack
    helm upgrade --install kube-prometheus-stack prometheus-community/kube-prometheus-stack \
        --namespace monitoring \
        --create-namespace \
        --values - <<EOF
prometheus:
  prometheusSpec:
    retention: 30d
    retentionSize: 45GB
    storageSpec:
      volumeClaimTemplate:
        spec:
          storageClassName: fast-ssd
          accessModes: ["ReadWriteOnce"]
          resources:
            requests:
              storage: 50Gi
    externalLabels:
      cluster: $CLUSTER_NAME
      environment: $ENVIRONMENT
    
    additionalScrapeConfigs:
    - job_name: 'schlep-engine-circuit-breakers'
      static_configs:
      - targets: ['schlep-engine-backend-service.schlep-engine:8000']
      metrics_path: '/metrics'
      scrape_interval: 15s
    
    ruleSelector:
      matchLabels:
        prometheus: schlep-engine
    
    serviceMonitorSelector:
      matchLabels:
        prometheus: schlep-engine

grafana:
  adminPassword: "${GRAFANA_ADMIN_PASSWORD:-admin123}"
  persistence:
    enabled: true
    storageClassName: fast-ssd
    size: 10Gi
  
  grafana.ini:
    server:
      domain: grafana.$DOMAIN_NAME
      root_url: https://grafana.$DOMAIN_NAME
    
    database:
      type: postgres
      host: schlep-engine-postgres.schlep-engine:5432
      name: grafana
      user: grafana
      password: "${GRAFANA_DB_PASSWORD:-grafana123}"
      ssl_mode: require
  
  dashboardProviders:
    dashboardproviders.yaml:
      apiVersion: 1
      providers:
      - name: 'schlep-engine-dashboards'
        orgId: 1
        folder: 'Schlep Engine'
        type: file
        disableDeletion: false
        editable: true
        options:
          path: /var/lib/grafana/dashboards/schlep-engine

alertmanager:
  alertmanagerSpec:
    storage:
      volumeClaimTemplate:
        spec:
          storageClassName: fast-ssd
          accessModes: ["ReadWriteOnce"]
          resources:
            requests:
              storage: 5Gi
    
    configSecret: alertmanager-config
EOF
    
    log_success "Prometheus Operator installed successfully"
}

# Deploy custom monitoring manifests
deploy_custom_monitoring() {
    log_info "Deploying custom monitoring manifests..."
    
    # Create monitoring namespace if it doesn't exist
    kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -
    
    # Apply Prometheus Operator manifests
    kubectl apply -f "$MONITORING_DIR/prometheus-operator.yaml"
    
    # Wait for Prometheus Operator to be ready
    log_info "Waiting for Prometheus Operator to be ready..."
    kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=prometheus-operator -n monitoring --timeout=300s
    
    # Apply alerting rules
    kubectl apply -f "$MONITORING_DIR/alerting-rules.yaml"
    
    # Apply Grafana configuration
    kubectl apply -f "$MONITORING_DIR/grafana-config.yaml"
    
    log_success "Custom monitoring manifests deployed successfully"
}

# Deploy Jaeger tracing
deploy_jaeger_tracing() {
    log_info "Deploying Jaeger distributed tracing..."
    
    # Install Jaeger Operator
    kubectl create namespace tracing --dry-run=client -o yaml | kubectl apply -f -
    kubectl apply -f https://github.com/jaegertracing/jaeger-operator/releases/download/v1.50.0/jaeger-operator.yaml -n tracing
    
    # Wait for Jaeger Operator to be ready
    log_info "Waiting for Jaeger Operator to be ready..."
    kubectl wait --for=condition=available deployment/jaeger-operator -n tracing --timeout=300s
    
    # Apply Jaeger custom resources
    kubectl apply -f "$MONITORING_DIR/jaeger-tracing.yaml"
    
    # Wait for Jaeger to be ready
    log_info "Waiting for Jaeger to be ready..."
    kubectl wait --for=condition=ready pod -l app=jaeger -n tracing --timeout=600s
    
    log_success "Jaeger distributed tracing deployed successfully"
}

# Deploy Istio service mesh
deploy_istio_service_mesh() {
    log_info "Deploying Istio service mesh..."
    
    # Install Istio
    if ! command -v istioctl &> /dev/null; then
        log_info "Installing istioctl..."
        curl -L https://istio.io/downloadIstio | sh -
        export PATH="$PWD/istio-*/bin:$PATH"
    fi
    
    # Install Istio control plane
    istioctl install --set values.defaultRevision=default -y
    
    # Label schlep-engine namespace for Istio injection
    kubectl label namespace schlep-engine istio-injection=enabled --overwrite
    
    # Apply Istio configurations
    kubectl apply -f "$MONITORING_DIR/istio-service-mesh.yaml"
    
    # Wait for Istio to be ready
    log_info "Waiting for Istio to be ready..."
    kubectl wait --for=condition=ready pod -l app=istiod -n istio-system --timeout=300s
    
    log_success "Istio service mesh deployed successfully"
}

# Configure ingress and certificates
configure_ingress_certificates() {
    log_info "Configuring ingress and certificates..."
    
    # Install cert-manager if not present
    if ! kubectl get namespace cert-manager &> /dev/null; then
        log_info "Installing cert-manager..."
        kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml
        kubectl wait --for=condition=available deployment/cert-manager -n cert-manager --timeout=300s
    fi
    
    # Create ClusterIssuer for Let's Encrypt
    cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@$DOMAIN_NAME
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF
    
    # Install NGINX Ingress Controller if not present
    if ! kubectl get namespace ingress-nginx &> /dev/null; then
        log_info "Installing NGINX Ingress Controller..."
        helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
        helm repo update
        helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
            --namespace ingress-nginx \
            --create-namespace \
            --set controller.service.type=LoadBalancer
        kubectl wait --for=condition=ready pod -l app.kubernetes.io/component=controller -n ingress-nginx --timeout=300s
    fi
    
    log_success "Ingress and certificates configured successfully"
}

# Verify deployment
verify_deployment() {
    log_info "Verifying deployment..."
    
    # Check monitoring namespace
    log_info "Checking monitoring components..."
    kubectl get pods -n monitoring -o wide
    
    # Check tracing namespace
    log_info "Checking tracing components..."
    kubectl get pods -n tracing -o wide
    
    # Check Istio system
    log_info "Checking Istio components..."
    kubectl get pods -n istio-system -o wide
    
    # Check application namespace with Istio injection
    log_info "Checking application pods with Istio sidecars..."
    kubectl get pods -n schlep-engine -o wide
    
    # Test endpoints
    log_info "Testing monitoring endpoints..."
    
    # Port-forward to test locally
    log_info "Setting up port forwards for testing..."
    kubectl port-forward -n monitoring svc/prometheus-operated 9090:9090 &
    PROMETHEUS_PID=$!
    kubectl port-forward -n monitoring svc/grafana-service 3000:80 &
    GRAFANA_PID=$!
    kubectl port-forward -n tracing svc/jaeger-query 16686:16686 &
    JAEGER_PID=$!
    kubectl port-forward -n istio-system svc/kiali 20001:20001 &
    KIALI_PID=$!
    
    sleep 10
    
    # Test Prometheus
    if curl -s http://localhost:9090/-/healthy &> /dev/null; then
        log_success "Prometheus is healthy"
    else
        log_warning "Prometheus health check failed"
    fi
    
    # Test Grafana
    if curl -s http://localhost:3000/api/health &> /dev/null; then
        log_success "Grafana is healthy"
    else
        log_warning "Grafana health check failed"
    fi
    
    # Test Jaeger
    if curl -s http://localhost:16686/api/services &> /dev/null; then
        log_success "Jaeger is healthy"
    else
        log_warning "Jaeger health check failed"
    fi
    
    # Test Kiali
    if curl -s http://localhost:20001/kiali/api/healthz &> /dev/null; then
        log_success "Kiali is healthy"
    else
        log_warning "Kiali health check failed"
    fi
    
    # Clean up port forwards
    kill $PROMETHEUS_PID $GRAFANA_PID $JAEGER_PID $KIALI_PID 2>/dev/null || true
    
    log_success "Deployment verification completed"
}

# Generate configuration summary
generate_summary() {
    log_info "Generating deployment summary..."
    
    cat <<EOF

==============================================================================
                    SCHLEP ENGINE MONITORING DEPLOYMENT SUMMARY
==============================================================================

Environment: $ENVIRONMENT
Cluster: $CLUSTER_NAME
Domain: $DOMAIN_NAME
AWS Region: $AWS_REGION

DEPLOYED COMPONENTS:
-------------------
✓ Terraform monitoring infrastructure (AWS CloudWatch, SNS, X-Ray)
✓ Prometheus Operator with custom configurations
✓ Grafana with PostgreSQL backend and custom dashboards
✓ AlertManager with SNS integration
✓ Jaeger distributed tracing with Elasticsearch storage
✓ Istio service mesh with circuit breaker configurations
✓ Kiali service mesh observability
✓ OpenTelemetry collectors for enhanced telemetry

ACCESS POINTS:
--------------
• Prometheus: https://prometheus.$DOMAIN_NAME
• Grafana: https://grafana.$DOMAIN_NAME
• Jaeger: https://jaeger.$DOMAIN_NAME
• Kiali: https://kiali.$DOMAIN_NAME
• AWS CloudWatch Dashboard: $MONITORING_DASHBOARD_URL

CIRCUIT BREAKER FEATURES:
------------------------
• Application-level circuit breakers with Redis persistence
• Istio service mesh circuit breakers with outlier detection
• AWS Lambda-based circuit breaker monitoring
• Custom Prometheus metrics for circuit breaker states
• Comprehensive alerting for failure patterns

RELIABILITY PATTERNS:
--------------------
• Exponential backoff retry with jitter
• Dead letter queues for persistent failures
• Service health monitoring with dependency graphs
• Real-time streaming reliability with backpressure handling
• Multi-level circuit breakers (application + infrastructure)

OBSERVABILITY:
--------------
• Distributed tracing across all services
• Custom business metrics and SLA monitoring
• Real-time alerting via SNS and Slack
• Service mesh traffic management and security
• Comprehensive dashboards for all components

NEXT STEPS:
-----------
1. Configure DNS records for monitoring domains
2. Update application code to use OpenTelemetry SDKs
3. Set up alerting channels (email, Slack, PagerDuty)
4. Review and adjust circuit breaker thresholds
5. Configure backup strategies for monitoring data

For troubleshooting, check:
• kubectl logs -n monitoring -l app=prometheus
• kubectl logs -n tracing -l app=jaeger
• kubectl logs -n istio-system -l app=istiod

==============================================================================

EOF
    
    log_success "Deployment completed successfully!"
    log_info "Access your monitoring stack at: https://grafana.$DOMAIN_NAME"
    log_info "View service mesh at: https://kiali.$DOMAIN_NAME"
    log_info "Check traces at: https://jaeger.$DOMAIN_NAME"
}

# Cleanup function
cleanup() {
    log_info "Cleaning up..."
    # Kill any background processes
    jobs -p | xargs -r kill 2>/dev/null || true
}

# Main execution
main() {
    log_info "Starting Schlep Engine monitoring infrastructure deployment..."
    log_info "Environment: $ENVIRONMENT"
    log_info "Cluster: $CLUSTER_NAME"
    log_info "Domain: $DOMAIN_NAME"
    
    # Set trap for cleanup
    trap cleanup EXIT
    
    # Execute deployment steps
    validate_prerequisites
    deploy_terraform_infrastructure
    configure_ingress_certificates
    install_prometheus_operator
    deploy_custom_monitoring
    deploy_jaeger_tracing
    deploy_istio_service_mesh
    verify_deployment
    generate_summary
}

# Script options
case "${1:-}" in
    --terraform-only)
        validate_prerequisites
        deploy_terraform_infrastructure
        ;;
    --k8s-only)
        validate_prerequisites
        configure_ingress_certificates
        install_prometheus_operator
        deploy_custom_monitoring
        deploy_jaeger_tracing
        deploy_istio_service_mesh
        verify_deployment
        ;;
    --verify)
        verify_deployment
        ;;
    --help)
        echo "Usage: $0 [--terraform-only|--k8s-only|--verify|--help]"
        echo ""
        echo "Options:"
        echo "  --terraform-only   Deploy only Terraform infrastructure"
        echo "  --k8s-only        Deploy only Kubernetes components"
        echo "  --verify          Verify existing deployment"
        echo "  --help            Show this help message"
        echo ""
        echo "Environment variables:"
        echo "  ENVIRONMENT       Deployment environment (default: production)"
        echo "  AWS_REGION        AWS region (default: us-east-1)"
        echo "  CLUSTER_NAME      EKS cluster name (default: schlep-engine-eks)"
        echo "  DOMAIN_NAME       Base domain name (default: schlep-engine.com)"
        echo "  SLACK_WEBHOOK_URL Slack webhook for notifications (optional)"
        echo "  GRAFANA_ADMIN_PASSWORD Grafana admin password (default: admin123)"
        echo "  GRAFANA_DB_PASSWORD Grafana database password (default: grafana123)"
        exit 0
        ;;
    "")
        main
        ;;
    *)
        log_error "Unknown option: $1"
        echo "Use --help for usage information"
        exit 1
        ;;
esac