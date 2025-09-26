#!/bin/bash

# Schlep Engine Phase One Health Check Script for Vultr VPS
# Comprehensive health monitoring for all services

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
COMPOSE_FILE="docker-compose.phase-one.yml"
PROJECT_NAME="schlep-engine-phase-one"
ENV_FILE=".env.phase-one"

# Health check results
OVERALL_STATUS="healthy"
FAILED_CHECKS=()

# Load environment variables
if [[ -f "$ENV_FILE" ]]; then
    set -a
    source $ENV_FILE
    set +a
fi

# Logging functions
log() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')] $1${NC}"
}

success() {
    echo -e "${GREEN}✓ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
    if [[ "$OVERALL_STATUS" == "healthy" ]]; then
        OVERALL_STATUS="degraded"
    fi
}

error() {
    echo -e "${RED}✗ $1${NC}"
    OVERALL_STATUS="unhealthy"
    FAILED_CHECKS+=("$1")
}

info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Function to check if service is running
check_service_status() {
    local service_name=$1
    local container_name=$2

    log "Checking $service_name status..."

    if docker ps --filter "name=$container_name" --filter "status=running" | grep -q $container_name; then
        success "$service_name is running"
        return 0
    else
        error "$service_name is not running"
        return 1
    fi
}

# Function to check service health
check_service_health() {
    local service_name=$1
    local container_name=$2

    log "Checking $service_name health..."

    local health_status=$(docker inspect --format='{{.State.Health.Status}}' $container_name 2>/dev/null || echo "no-healthcheck")

    case $health_status in
        "healthy")
            success "$service_name is healthy"
            return 0
            ;;
        "unhealthy")
            error "$service_name is unhealthy"
            return 1
            ;;
        "starting")
            warning "$service_name is still starting up"
            return 1
            ;;
        "no-healthcheck")
            warning "$service_name has no health check configured"
            return 0
            ;;
        *)
            warning "$service_name health status unknown: $health_status"
            return 1
            ;;
    esac
}

# Function to check HTTP endpoint
check_http_endpoint() {
    local service_name=$1
    local url=$2
    local expected_status=${3:-200}

    log "Checking $service_name HTTP endpoint..."

    local http_status=$(curl -s -o /dev/null -w "%{http_code}" $url 2>/dev/null || echo "000")

    if [[ "$http_status" == "$expected_status" ]]; then
        success "$service_name HTTP endpoint is responding (HTTP $http_status)"
        return 0
    else
        error "$service_name HTTP endpoint failed (HTTP $http_status)"
        return 1
    fi
}

# Function to check database connectivity
check_database_connectivity() {
    log "Checking PostgreSQL connectivity..."

    local db_check=$(docker exec schlep-postgres-phase-one pg_isready -U ${POSTGRES_USER:-schlep_user} -d ${POSTGRES_DB:-schlep_engine} 2>/dev/null || echo "failed")

    if [[ "$db_check" == *"accepting connections"* ]]; then
        success "PostgreSQL is accepting connections"

        # Check database size and connections
        local db_info=$(docker exec schlep-postgres-phase-one psql -U ${POSTGRES_USER:-schlep_user} -d ${POSTGRES_DB:-schlep_engine} -t -c "
            SELECT
                pg_database_size('${POSTGRES_DB:-schlep_engine}')/1024/1024 as size_mb,
                (SELECT count(*) FROM pg_stat_activity WHERE datname='${POSTGRES_DB:-schlep_engine}') as connections
        " 2>/dev/null || echo "0|0")

        local db_size=$(echo $db_info | cut -d'|' -f1 | xargs)
        local db_connections=$(echo $db_info | cut -d'|' -f2 | xargs)

        info "Database size: ${db_size}MB, Active connections: $db_connections"

        return 0
    else
        error "PostgreSQL is not accepting connections"
        return 1
    fi
}

# Function to check Redis connectivity
check_redis_connectivity() {
    log "Checking Redis connectivity..."

    local redis_check=$(docker exec schlep-redis-phase-one redis-cli -a "${REDIS_PASSWORD}" ping 2>/dev/null || echo "failed")

    if [[ "$redis_check" == "PONG" ]]; then
        success "Redis is responding to ping"

        # Get Redis info
        local redis_info=$(docker exec schlep-redis-phase-one redis-cli -a "${REDIS_PASSWORD}" info server 2>/dev/null | grep -E "(redis_version|uptime_in_seconds|connected_clients)" || echo "")

        if [[ -n "$redis_info" ]]; then
            local version=$(echo "$redis_info" | grep redis_version | cut -d':' -f2 | tr -d '\r')
            local uptime=$(echo "$redis_info" | grep uptime_in_seconds | cut -d':' -f2 | tr -d '\r')
            local clients=$(echo "$redis_info" | grep connected_clients | cut -d':' -f2 | tr -d '\r')

            info "Redis version: $version, Uptime: ${uptime}s, Clients: $clients"
        fi

        return 0
    else
        error "Redis is not responding"
        return 1
    fi
}

# Function to check MinIO connectivity
check_minio_connectivity() {
    log "Checking MinIO connectivity..."

    local minio_check=$(curl -s -f http://localhost:9000/minio/health/live 2>/dev/null && echo "healthy" || echo "failed")

    if [[ "$minio_check" == "healthy" ]]; then
        success "MinIO is healthy"
        return 0
    else
        error "MinIO health check failed"
        return 1
    fi
}

# Function to check monitoring services
check_monitoring_services() {
    log "Checking monitoring services..."

    # Prometheus
    if check_http_endpoint "Prometheus" "http://localhost:9090/-/healthy"; then
        # Check if Prometheus is scraping targets
        local targets_up=$(curl -s http://localhost:9090/api/v1/query?query=up | jq -r '.data.result | length' 2>/dev/null || echo "0")
        info "Prometheus monitoring $targets_up targets"
    fi

    # Grafana
    check_http_endpoint "Grafana" "http://localhost:3100/api/health"

    # PostgreSQL Exporter
    if check_http_endpoint "PostgreSQL Exporter" "http://localhost:9187/metrics" 200; then
        local pg_metrics=$(curl -s http://localhost:9187/metrics | grep -c "^pg_" || echo "0")
        info "PostgreSQL exporter providing $pg_metrics metrics"
    fi

    # Redis Exporter
    if check_http_endpoint "Redis Exporter" "http://localhost:9121/metrics" 200; then
        local redis_metrics=$(curl -s http://localhost:9121/metrics | grep -c "^redis_" || echo "0")
        info "Redis exporter providing $redis_metrics metrics"
    fi
}

# Function to check system resources
check_system_resources() {
    log "Checking system resources..."

    # Memory usage
    local memory_info=$(free | grep Mem)
    local total_mem=$(echo $memory_info | awk '{print $2}')
    local used_mem=$(echo $memory_info | awk '{print $3}')
    local mem_percent=$((used_mem * 100 / total_mem))

    if [ $mem_percent -lt 80 ]; then
        success "Memory usage: ${mem_percent}% (${used_mem}/${total_mem})"
    elif [ $mem_percent -lt 90 ]; then
        warning "Memory usage high: ${mem_percent}%"
    else
        error "Memory usage critical: ${mem_percent}%"
    fi

    # Disk usage
    local disk_usage=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
    if [ $disk_usage -lt 80 ]; then
        success "Disk usage: ${disk_usage}%"
    elif [ $disk_usage -lt 90 ]; then
        warning "Disk usage high: ${disk_usage}%"
    else
        error "Disk usage critical: ${disk_usage}%"
    fi

    # Load average
    local load_avg=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
    local cpu_count=$(nproc)
    local load_percent=$(echo "$load_avg $cpu_count" | awk '{printf "%.0f", ($1/$2)*100}')

    if [ $load_percent -lt 80 ]; then
        success "CPU load: ${load_percent}% (${load_avg})"
    elif [ $load_percent -lt 100 ]; then
        warning "CPU load high: ${load_percent}%"
    else
        error "CPU load critical: ${load_percent}%"
    fi
}

# Function to check Docker resources
check_docker_resources() {
    log "Checking Docker container resources..."

    # Get container stats
    local stats_output=$(docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}" 2>/dev/null || echo "")

    if [[ -n "$stats_output" ]]; then
        info "Container resource usage:"
        echo "$stats_output" | grep -E "(NAME|schlep-)" | while read line; do
            if [[ "$line" != *"NAME"* ]]; then
                local container_name=$(echo "$line" | awk '{print $1}')
                local cpu_perc=$(echo "$line" | awk '{print $2}' | sed 's/%//')
                local mem_perc=$(echo "$line" | awk '{print $4}' | sed 's/%//')

                if [[ -n "$cpu_perc" ]] && [[ -n "$mem_perc" ]]; then
                    if (( $(echo "$cpu_perc < 80" | bc -l) )) && (( $(echo "$mem_perc < 80" | bc -l) )); then
                        success "$container_name: CPU ${cpu_perc}%, Memory ${mem_perc}%"
                    else
                        warning "$container_name: CPU ${cpu_perc}%, Memory ${mem_perc}%"
                    fi
                fi
            fi
        done
    fi
}

# Function to check application endpoints
check_application_endpoints() {
    log "Checking application endpoints..."

    # API Health endpoint
    check_http_endpoint "API Health" "http://localhost:3001/health"

    # Web applications (if accessible)
    check_http_endpoint "Landing Page" "http://localhost:3000" 200
    check_http_endpoint "Admin Dashboard" "http://localhost:3002" 200
    check_http_endpoint "Documentation" "http://localhost:3003" 200
}

# Function to check SSL certificates (if configured)
check_ssl_certificates() {
    if [[ -d "./ssl" ]] && [[ "$(ls -A ./ssl 2>/dev/null)" ]]; then
        log "Checking SSL certificates..."

        for cert_file in ./ssl/*.crt; do
            if [[ -f "$cert_file" ]]; then
                local cert_info=$(openssl x509 -in "$cert_file" -noout -dates 2>/dev/null || echo "")
                if [[ -n "$cert_info" ]]; then
                    local not_after=$(echo "$cert_info" | grep notAfter | cut -d'=' -f2)
                    local expiry_date=$(date -d "$not_after" +%s 2>/dev/null || echo "0")
                    local current_date=$(date +%s)
                    local days_until_expiry=$(( (expiry_date - current_date) / 86400 ))

                    if [ $days_until_expiry -gt 30 ]; then
                        success "SSL certificate valid for $days_until_expiry days"
                    elif [ $days_until_expiry -gt 7 ]; then
                        warning "SSL certificate expires in $days_until_expiry days"
                    else
                        error "SSL certificate expires in $days_until_expiry days"
                    fi
                fi
            fi
        done
    else
        info "No SSL certificates found"
    fi
}

# Function to run performance tests
run_performance_tests() {
    log "Running basic performance tests..."

    # Database performance test
    local db_test_start=$(date +%s%N)
    local db_test_result=$(docker exec schlep-postgres-phase-one psql -U ${POSTGRES_USER:-schlep_user} -d ${POSTGRES_DB:-schlep_engine} -t -c "SELECT 1;" 2>/dev/null || echo "failed")
    local db_test_end=$(date +%s%N)
    local db_response_time=$(( (db_test_end - db_test_start) / 1000000 ))

    if [[ "$db_test_result" == *"1"* ]]; then
        if [ $db_response_time -lt 100 ]; then
            success "Database response time: ${db_response_time}ms"
        else
            warning "Database response time slow: ${db_response_time}ms"
        fi
    else
        error "Database performance test failed"
    fi

    # Redis performance test
    local redis_test_start=$(date +%s%N)
    local redis_test_result=$(docker exec schlep-redis-phase-one redis-cli -a "${REDIS_PASSWORD}" ping 2>/dev/null || echo "failed")
    local redis_test_end=$(date +%s%N)
    local redis_response_time=$(( (redis_test_end - redis_test_start) / 1000000 ))

    if [[ "$redis_test_result" == "PONG" ]]; then
        if [ $redis_response_time -lt 10 ]; then
            success "Redis response time: ${redis_response_time}ms"
        else
            warning "Redis response time slow: ${redis_response_time}ms"
        fi
    else
        error "Redis performance test failed"
    fi
}

# Function to generate health report
generate_health_report() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local report_file="health-report-$(date +%Y%m%d-%H%M%S).json"

    log "Generating health report..."

    cat > "$report_file" << EOF
{
  "timestamp": "$timestamp",
  "overall_status": "$OVERALL_STATUS",
  "failed_checks": [$(printf '"%s",' "${FAILED_CHECKS[@]}" | sed 's/,$//')],
  "services": {
    "postgres": {
      "status": "$(docker inspect --format='{{.State.Status}}' schlep-postgres-phase-one 2>/dev/null || echo "unknown")",
      "health": "$(docker inspect --format='{{.State.Health.Status}}' schlep-postgres-phase-one 2>/dev/null || echo "no-healthcheck")"
    },
    "redis": {
      "status": "$(docker inspect --format='{{.State.Status}}' schlep-redis-phase-one 2>/dev/null || echo "unknown")",
      "health": "$(docker inspect --format='{{.State.Health.Status}}' schlep-redis-phase-one 2>/dev/null || echo "no-healthcheck")"
    },
    "minio": {
      "status": "$(docker inspect --format='{{.State.Status}}' schlep-minio-phase-one 2>/dev/null || echo "unknown")",
      "health": "$(docker inspect --format='{{.State.Health.Status}}' schlep-minio-phase-one 2>/dev/null || echo "no-healthcheck")"
    },
    "api": {
      "status": "$(docker inspect --format='{{.State.Status}}' schlep-api-phase-one 2>/dev/null || echo "unknown")",
      "health": "$(docker inspect --format='{{.State.Health.Status}}' schlep-api-phase-one 2>/dev/null || echo "no-healthcheck")"
    }
  },
  "system": {
    "memory_usage_percent": $(free | grep Mem | awk '{printf "%.1f", ($3/$2)*100}'),
    "disk_usage_percent": $(df / | tail -1 | awk '{print $5}' | sed 's/%//'),
    "load_average": "$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')"
  }
}
EOF

    info "Health report saved to: $report_file"
}

# Function to display summary
display_summary() {
    echo
    echo "=================================================="
    echo "         SCHLEP ENGINE HEALTH CHECK SUMMARY"
    echo "=================================================="
    echo

    case $OVERALL_STATUS in
        "healthy")
            success "Overall Status: HEALTHY ✓"
            ;;
        "degraded")
            warning "Overall Status: DEGRADED ⚠"
            ;;
        "unhealthy")
            error "Overall Status: UNHEALTHY ✗"
            ;;
    esac

    echo
    echo "Timestamp: $(date)"
    echo

    if [ ${#FAILED_CHECKS[@]} -gt 0 ]; then
        echo -e "${RED}Failed Checks:${NC}"
        for check in "${FAILED_CHECKS[@]}"; do
            echo "  • $check"
        done
        echo
    fi

    echo -e "${BLUE}Quick Commands:${NC}"
    echo "  • View logs: sl-logs"
    echo "  • Restart services: sl-restart"
    echo "  • Service status: sl-status"
    echo "  • System resources: sl-resources"
    echo

    # Exit with appropriate code
    case $OVERALL_STATUS in
        "healthy") exit 0 ;;
        "degraded") exit 1 ;;
        "unhealthy") exit 2 ;;
    esac
}

# Main health check function
main() {
    echo -e "${BLUE}"
    echo "=================================================="
    echo "      SCHLEP ENGINE PHASE ONE HEALTH CHECK"
    echo "=================================================="
    echo -e "${NC}"

    # Check if Docker is running
    if ! docker info >/dev/null 2>&1; then
        error "Docker is not running or not accessible"
        exit 3
    fi

    # Run all health checks
    log "Starting comprehensive health check..."
    echo

    # Service status checks
    check_service_status "PostgreSQL" "schlep-postgres-phase-one"
    check_service_status "Redis" "schlep-redis-phase-one"
    check_service_status "MinIO" "schlep-minio-phase-one"
    check_service_status "API" "schlep-api-phase-one"
    check_service_status "Nginx" "schlep-nginx-phase-one"

    echo

    # Service health checks
    check_service_health "PostgreSQL" "schlep-postgres-phase-one"
    check_service_health "Redis" "schlep-redis-phase-one"
    check_service_health "MinIO" "schlep-minio-phase-one"
    check_service_health "API" "schlep-api-phase-one"

    echo

    # Connectivity checks
    check_database_connectivity
    check_redis_connectivity
    check_minio_connectivity

    echo

    # Application endpoint checks
    check_application_endpoints

    echo

    # Monitoring service checks
    check_monitoring_services

    echo

    # System resource checks
    check_system_resources

    echo

    # Docker resource checks
    check_docker_resources

    echo

    # SSL certificate checks
    check_ssl_certificates

    echo

    # Performance tests
    run_performance_tests

    echo

    # Generate report
    generate_health_report

    # Display summary
    display_summary
}

# Error handling
trap 'error "Health check script encountered an error"' ERR

# Run main function
main "$@"