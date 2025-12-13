#!/bin/bash

# Monitoring and Observability Setup Script for Schlep-engine
# This script sets up comprehensive monitoring, logging, and observability

set -e

echo "🚀 Setting up Monitoring and Observability for Schlep-engine..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if port is available
port_available() {
    ! nc -z localhost $1 2>/dev/null
}

# Function to create directory if it doesn't exist
create_directory() {
    if [ ! -d "$1" ]; then
        mkdir -p "$1"
        print_success "Created directory: $1"
    else
        print_status "Directory already exists: $1"
    fi
}

# Function to install Python package
install_package() {
    if pip show "$1" >/dev/null 2>&1; then
        print_status "Package already installed: $1"
    else
        print_status "Installing package: $1"
        pip install "$1"
        print_success "Installed package: $1"
    fi
}

# Function to check and install system dependencies
check_system_dependencies() {
    print_status "Checking system dependencies..."
    
    # Check for required commands
    local missing_deps=()
    
    if ! command_exists python3; then
        missing_deps+=("python3")
    fi
    
    if ! command_exists pip; then
        missing_deps+=("pip")
    fi
    
    if ! command_exists redis-server; then
        missing_deps+=("redis-server")
    fi
    
    if ! command_exists psql; then
        missing_deps+=("postgresql-client")
    fi
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        print_error "Missing system dependencies: ${missing_deps[*]}"
        print_status "Please install the missing dependencies and run this script again."
        exit 1
    fi
    
    print_success "All system dependencies are available"
}

# Function to install Python monitoring dependencies
install_monitoring_dependencies() {
    print_status "Installing monitoring dependencies..."
    
    # Core monitoring packages
    install_package "prometheus-client"
    install_package "sentry-sdk[fastapi]"
    install_package "psutil"
    install_package "httpx"
    
    # Logging packages
    install_package "structlog"
    install_package "python-json-logger"
    
    # Additional monitoring packages
    install_package "prometheus-api-client"
    install_package "grafana-api"
    
    print_success "Monitoring dependencies installed successfully"
}

# Function to setup logging directories
setup_logging() {
    print_status "Setting up logging directories..."
    
    # Create logs directory
    create_directory "logs"
    
    # Create log subdirectories
    create_directory "logs/app"
    create_directory "logs/security"
    create_directory "logs/audit"
    create_directory "logs/performance"
    
    # Set permissions
    chmod 755 logs
    chmod 644 logs/* 2>/dev/null || true
    
    print_success "Logging directories setup complete"
}

# Function to setup Prometheus
setup_prometheus() {
    print_status "Setting up Prometheus..."
    
    # Check if Prometheus is already running
    if ! port_available 9090; then
        print_warning "Prometheus is already running on port 9090"
        return
    fi
    
    # Create Prometheus configuration
    cat > prometheus.yml << EOF
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  # - "first_rules.yml"
  # - "second_rules.yml"

scrape_configs:
  - job_name: 'igris-inertial'
    static_configs:
      - targets: ['localhost:8000']
    metrics_path: '/metrics'
    scrape_interval: 15s

  - job_name: 'igris-inertial-health'
    static_configs:
      - targets: ['localhost:8000']
    metrics_path: '/api/v1/health'
    scrape_interval: 30s

  - job_name: 'redis'
    static_configs:
      - targets: ['localhost:6379']

  - job_name: 'postgres'
    static_configs:
      - targets: ['localhost:5432']
EOF
    
    print_success "Prometheus configuration created: prometheus.yml"
    
    # Download Prometheus if not available
    if ! command_exists prometheus; then
        print_status "Prometheus not found. Please install Prometheus manually or use Docker."
        print_status "You can download it from: https://prometheus.io/download/"
    else
        print_success "Prometheus is available"
    fi
}

# Function to setup Grafana
setup_grafana() {
    print_status "Setting up Grafana..."
    
    # Check if Grafana is already running
    if ! port_available 3000; then
        print_warning "Grafana is already running on port 3000"
        return
    fi
    
    # Create Grafana configuration
    create_directory "grafana"
    create_directory "grafana/dashboards"
    create_directory "grafana/provisioning"
    create_directory "grafana/provisioning/dashboards"
    create_directory "grafana/provisioning/datasources"
    
    # Create datasource configuration
    cat > grafana/provisioning/datasources/prometheus.yml << EOF
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://localhost:9090
    isDefault: true
EOF
    
    # Create dashboard configuration
    cat > grafana/provisioning/dashboards/dashboards.yml << EOF
apiVersion: 1

providers:
  - name: 'default'
    orgId: 1
    folder: ''
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    allowUiUpdates: true
    options:
      path: /var/lib/grafana/dashboards
EOF
    
    # Create basic dashboard
    cat > grafana/dashboards/igris-inertial-dashboard.json << EOF
{
  "dashboard": {
    "id": null,
    "title": "Schlep-engine Dashboard",
    "tags": ["igris-inertial"],
    "timezone": "browser",
    "panels": [
      {
        "id": 1,
        "title": "HTTP Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "{{method}} {{endpoint}}"
          }
        ]
      },
      {
        "id": 2,
        "title": "Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "95th percentile"
          }
        ]
      },
      {
        "id": 3,
        "title": "Error Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total{status_code=~\"5..\"}[5m])",
            "legendFormat": "5xx errors"
          }
        ]
      },
      {
        "id": 4,
        "title": "System Resources",
        "type": "graph",
        "targets": [
          {
            "expr": "system_cpu_usage_percent",
            "legendFormat": "CPU Usage"
          },
          {
            "expr": "system_memory_usage_bytes / 1024 / 1024 / 1024",
            "legendFormat": "Memory Usage (GB)"
          }
        ]
      }
    ],
    "time": {
      "from": "now-1h",
      "to": "now"
    },
    "refresh": "30s"
  }
}
EOF
    
    print_success "Grafana configuration created"
    
    # Download Grafana if not available
    if ! command_exists grafana-server; then
        print_status "Grafana not found. Please install Grafana manually or use Docker."
        print_status "You can download it from: https://grafana.com/grafana/download/"
    else
        print_success "Grafana is available"
    fi
}

# Function to setup Sentry
setup_sentry() {
    print_status "Setting up Sentry integration..."
    
    # Create Sentry configuration template
    cat > sentry_config_template.py << EOF
# Sentry Configuration Template
# Copy this to your settings and update with your Sentry DSN

SENTRY_DSN = "your-sentry-dsn-here"
SENTRY_ENVIRONMENT = "development"  # or "production"
SENTRY_TRACES_SAMPLE_RATE = 0.1
SENTRY_PROFILES_SAMPLE_RATE = 0.1

# Optional: Configure Sentry before_send to filter events
def before_send(event, hint):
    # Filter out certain types of errors
    if 'exception' in event:
        exception = event['exception']
        if exception and 'values' in exception:
            for value in exception['values']:
                if 'type' in value:
                    # Filter out validation errors
                    if value['type'] in ['ValidationError', 'HTTPException']:
                        return None
    return event
EOF
    
    print_success "Sentry configuration template created: sentry_config_template.py"
    print_status "Please update your settings with your Sentry DSN"
}

# Function to setup monitoring scripts
setup_monitoring_scripts() {
    print_status "Setting up monitoring scripts..."
    
    # Create monitoring start script
    cat > start_monitoring.sh << 'EOF'
#!/bin/bash

# Start Monitoring Services Script

echo "🚀 Starting monitoring services..."

# Start Prometheus
if command -v prometheus >/dev/null 2>&1; then
    echo "Starting Prometheus..."
    prometheus --config.file=prometheus.yml --storage.tsdb.path=./prometheus_data &
    echo $! > prometheus.pid
fi

# Start Grafana
if command -v grafana-server >/dev/null 2>&1; then
    echo "Starting Grafana..."
    grafana-server --config=grafana/grafana.ini --homepath=grafana &
    echo $! > grafana.pid
fi

echo "✅ Monitoring services started"
echo "Prometheus: http://localhost:9090"
echo "Grafana: http://localhost:3000 (admin/admin)"
EOF
    
    chmod +x start_monitoring.sh
    
    # Create monitoring stop script
    cat > stop_monitoring.sh << 'EOF'
#!/bin/bash

# Stop Monitoring Services Script

echo "🛑 Stopping monitoring services..."

# Stop Prometheus
if [ -f prometheus.pid ]; then
    kill $(cat prometheus.pid) 2>/dev/null || true
    rm prometheus.pid
fi

# Stop Grafana
if [ -f grafana.pid ]; then
    kill $(cat grafana.pid) 2>/dev/null || true
    rm grafana.pid
fi

echo "✅ Monitoring services stopped"
EOF
    
    chmod +x stop_monitoring.sh
    
    # Create health check script
    cat > health_check.sh << 'EOF'
#!/bin/bash

# Health Check Script

echo "🏥 Checking system health..."

# Check if services are running
services=("redis-server" "postgres" "prometheus" "grafana-server")

for service in "${services[@]}"; do
    if pgrep -x "$service" >/dev/null; then
        echo "✅ $service is running"
    else
        echo "❌ $service is not running"
    fi
done

# Check ports
ports=(6379 5432 8000 9090 3000)

for port in "${ports[@]}"; do
    if nc -z localhost $port 2>/dev/null; then
        echo "✅ Port $port is open"
    else
        echo "❌ Port $port is closed"
    fi
done

echo "🏥 Health check complete"
EOF
    
    chmod +x health_check.sh
    
    print_success "Monitoring scripts created"
}

# Function to setup Docker Compose for monitoring
setup_docker_monitoring() {
    print_status "Setting up Docker Compose for monitoring..."
    
    # Create docker-compose.monitoring.yml
    cat > docker-compose.monitoring.yml << EOF
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    container_name: schlep-prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
      - '--storage.tsdb.retention.time=200h'
      - '--web.enable-lifecycle'

  grafana:
    image: grafana/grafana:latest
    container_name: schlep-grafana
    ports:
      - "3000:3000"
    volumes:
      - grafana_data:/var/lib/grafana
      - ./grafana/provisioning:/etc/grafana/provisioning
      - ./grafana/dashboards:/var/lib/grafana/dashboards
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_USERS_ALLOW_SIGN_UP=false

  alertmanager:
    image: prom/alertmanager:latest
    container_name: schlep-alertmanager
    ports:
      - "9093:9093"
    volumes:
      - ./alertmanager.yml:/etc/alertmanager/alertmanager.yml
      - alertmanager_data:/alertmanager

volumes:
  prometheus_data:
  grafana_data:
  alertmanager_data:
EOF
    
    # Create AlertManager configuration
    cat > alertmanager.yml << EOF
global:
  resolve_timeout: 5m

route:
  group_by: ['alertname']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'web.hook'
receivers:
- name: 'web.hook'
  webhook_configs:
  - url: 'http://127.0.0.1:5001/'
inhibit_rules:
  - source_match:
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['alertname', 'dev', 'instance']
EOF
    
    print_success "Docker Compose monitoring configuration created"
}

# Function to run database migrations
run_migrations() {
    print_status "Running database migrations..."
    
    # Check if alembic is available
    if ! command_exists alembic; then
        print_error "Alembic not found. Please install it first."
        return 1
    fi
    
    # Run migrations
    cd packages/backend
    alembic upgrade head
    
    print_success "Database migrations completed"
}

# Function to test monitoring setup
test_monitoring() {
    print_status "Testing monitoring setup..."
    
    # Test health endpoint
    if curl -s http://localhost:8000/api/v1/health >/dev/null 2>&1; then
        print_success "Health endpoint is accessible"
    else
        print_warning "Health endpoint is not accessible (make sure the app is running)"
    fi
    
    # Test metrics endpoint
    if curl -s http://localhost:8000/api/v1/metrics >/dev/null 2>&1; then
        print_success "Metrics endpoint is accessible"
    else
        print_warning "Metrics endpoint is not accessible (make sure the app is running)"
    fi
    
    # Test Prometheus
    if curl -s http://localhost:9090/api/v1/status/config >/dev/null 2>&1; then
        print_success "Prometheus is accessible"
    else
        print_warning "Prometheus is not accessible (make sure it's running)"
    fi
    
    # Test Grafana
    if curl -s http://localhost:3000/api/health >/dev/null 2>&1; then
        print_success "Grafana is accessible"
    else
        print_warning "Grafana is not accessible (make sure it's running)"
    fi
    
    print_success "Monitoring setup test completed"
}

# Function to display setup summary
display_summary() {
    echo ""
    echo "🎉 Monitoring and Observability Setup Complete!"
    echo ""
    echo "📋 Setup Summary:"
    echo "  ✅ System dependencies checked"
    echo "  ✅ Python monitoring packages installed"
    echo "  ✅ Logging directories created"
    echo "  ✅ Prometheus configuration created"
    echo "  ✅ Grafana configuration created"
    echo "  ✅ Sentry configuration template created"
    echo "  ✅ Monitoring scripts created"
    echo "  ✅ Docker Compose configuration created"
    echo "  ✅ Database migrations run"
    echo ""
    echo "🚀 Next Steps:"
    echo "  1. Start your application: python -m app.main"
    echo "  2. Start monitoring services: ./start_monitoring.sh"
    echo "  3. Access monitoring dashboards:"
    echo "     - Prometheus: http://localhost:9090"
    echo "     - Grafana: http://localhost:3000 (admin/admin)"
    echo "  4. Configure Sentry DSN in your settings"
    echo "  5. Run health check: ./health_check.sh"
    echo ""
    echo "📚 Documentation:"
    echo "  - Prometheus: https://prometheus.io/docs/"
    echo "  - Grafana: https://grafana.com/docs/"
    echo "  - Sentry: https://docs.sentry.io/"
    echo ""
}

# Main setup function
main() {
    echo "🚀 Starting Monitoring and Observability Setup..."
    echo ""
    
    # Check system dependencies
    check_system_dependencies
    
    # Install monitoring dependencies
    install_monitoring_dependencies
    
    # Setup logging
    setup_logging
    
    # Setup Prometheus
    setup_prometheus
    
    # Setup Grafana
    setup_grafana
    
    # Setup Sentry
    setup_sentry
    
    # Setup monitoring scripts
    setup_monitoring_scripts
    
    # Setup Docker monitoring
    setup_docker_monitoring
    
    # Run migrations
    run_migrations
    
    # Test setup
    test_monitoring
    
    # Display summary
    display_summary
}

# Run main function
main "$@" 