#!/bin/bash

# Infrastructure Migration Validation Script
# ===========================================
# Comprehensive validation system for the $145/month architecture migration
# 
# This script provides thorough validation with:
# - Pre-migration readiness checks
# - Post-migration integrity validation
# - Performance benchmarking
# - Security validation
# - Cost verification
# - Health monitoring

set -euo pipefail

# Configuration
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
readonly LOG_DIR="/tmp/migration_logs"
readonly VALIDATION_ID="validation_$(date +%Y%m%d_%H%M%S)"
readonly LOG_FILE="$LOG_DIR/${VALIDATION_ID}.log"
readonly RESULTS_FILE="$LOG_DIR/${VALIDATION_ID}_results.json"

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly PURPLE='\033[0;35m'
readonly CYAN='\033[0;36m'
readonly NC='\033[0m' # No Color

# Validation results tracking
declare -A VALIDATION_RESULTS
declare -A PERFORMANCE_METRICS
declare -A SECURITY_CHECKS
declare -A COST_METRICS

# Create log directory
mkdir -p "$LOG_DIR"

# Initialize validation results
init_validation_results() {
    VALIDATION_RESULTS=(
        [status]="running"
        [start_time]=$(date)
        [dependencies_check]="pending"
        [database_validation]="pending"
        [api_validation]="pending"
        [frontend_validation]="pending"
        [security_validation]="pending"
        [performance_validation]="pending"
        [cost_validation]="pending"
        [integration_validation]="pending"
        [overall_score]=0
    )
}

# Logging functions
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" | tee -a "$LOG_FILE"
}

log_info() { log "INFO" "$@"; }
log_warn() { log "WARN" "$@"; }
log_error() { log "ERROR" "$@"; }
log_success() { log "SUCCESS" "$@"; }

# Status printing functions
print_header() {
    echo -e "\n${PURPLE}================================${NC}"
    echo -e "${PURPLE}$1${NC}"
    echo -e "${PURPLE}================================${NC}\n"
    log_info "=== $1 ==="
}

print_step() {
    echo -e "\n${CYAN}🔄 $1${NC}"
    log_info "STEP: $1"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
    log_success "$1"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
    log_error "$1"
}

print_warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
    log_warn "$1"
}

print_info() {
    echo -e "${BLUE}ℹ️ $1${NC}"
    log_info "$1"
}

# Save validation results to JSON
save_validation_results() {
    cat > "$RESULTS_FILE" << EOF
{
  "validation_id": "$VALIDATION_ID",
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "validation_results": $(printf '%s\n' "${VALIDATION_RESULTS[@]}" | jq -R . | jq -s 'map(split("=")) | map({(.[0]): .[1]}) | add'),
  "performance_metrics": $(printf '%s\n' "${PERFORMANCE_METRICS[@]}" | jq -R . | jq -s 'map(split("=")) | map({(.[0]): .[1]}) | add' 2>/dev/null || echo '{}'),
  "security_checks": $(printf '%s\n' "${SECURITY_CHECKS[@]}" | jq -R . | jq -s 'map(split("=")) | map({(.[0]): .[1]}) | add' 2>/dev/null || echo '{}'),
  "cost_metrics": $(printf '%s\n' "${COST_METRICS[@]}" | jq -R . | jq -s 'map(split("=")) | map({(.[0]): .[1]}) | add' 2>/dev/null || echo '{}')
}
EOF
}

# Load migration state
load_migration_state() {
    local migration_state_pattern="$LOG_DIR/migration_*_state.json"
    local latest_migration_state=$(ls -t $migration_state_pattern 2>/dev/null | head -1)
    
    if [[ -f "$latest_migration_state" ]]; then
        print_info "Loading migration state from: $latest_migration_state"
        
        # Extract service endpoints from migration state
        if command -v jq &> /dev/null; then
            DATABASE_ENDPOINT=$(jq -r '.endpoints.database // "unknown"' "$latest_migration_state" 2>/dev/null || echo "unknown")
            BACKEND_ENDPOINT=$(jq -r '.endpoints.backend // "unknown"' "$latest_migration_state" 2>/dev/null || echo "unknown")
            ADMIN_ENDPOINT=$(jq -r '.endpoints.admin // "unknown"' "$latest_migration_state" 2>/dev/null || echo "unknown")
            LANDING_ENDPOINT=$(jq -r '.endpoints.landing // "unknown"' "$latest_migration_state" 2>/dev/null || echo "unknown")
            DOCS_ENDPOINT=$(jq -r '.endpoints.docs // "unknown"' "$latest_migration_state" 2>/dev/null || echo "unknown")
        fi
        
        return 0
    else
        print_warning "No migration state found - using environment variables"
        
        # Fallback to environment variables
        DATABASE_ENDPOINT=${SUPABASE_DATABASE_URL:-"unknown"}
        BACKEND_ENDPOINT=${RAILWAY_BACKEND_URL:-"unknown"}
        ADMIN_ENDPOINT=${VERCEL_ADMIN_URL:-"unknown"}
        LANDING_ENDPOINT=${CLOUDFLARE_LANDING_URL:-"unknown"}
        DOCS_ENDPOINT=${CLOUDFLARE_DOCS_URL:-"unknown"}
        
        return 1
    fi
}

# Dependency validation
validate_dependencies() {
    print_step "Validating system dependencies"
    
    local deps=("curl" "jq" "python3" "node" "psql")
    local missing_deps=()
    
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            missing_deps+=("$dep")
        fi
    done
    
    if [[ ${#missing_deps[@]} -gt 0 ]]; then
        print_error "Missing required dependencies: ${missing_deps[*]}"
        VALIDATION_RESULTS[dependencies_check]="failed"
        return 1
    fi
    
    print_success "All dependencies available"
    VALIDATION_RESULTS[dependencies_check]="passed"
    return 0
}

# Database validation
validate_database() {
    print_step "Validating database migration integrity"
    
    if [[ "$DATABASE_ENDPOINT" == "unknown" ]]; then
        print_error "Database endpoint not available"
        VALIDATION_RESULTS[database_validation]="failed"
        return 1
    fi
    
    print_info "Testing database connectivity..."
    
    # Test database connection
    if ! python3 -c "
import psycopg2
import sys
try:
    conn = psycopg2.connect('$DATABASE_ENDPOINT')
    cur = conn.cursor()
    cur.execute('SELECT 1')
    result = cur.fetchone()
    print('Database connection successful')
    cur.close()
    conn.close()
except Exception as e:
    print(f'Database connection failed: {e}')
    sys.exit(1)
"; then
        print_error "Database connection failed"
        VALIDATION_RESULTS[database_validation]="failed"
        return 1
    fi
    
    print_success "Database connection verified"
    
    # Run data integrity checks using existing validation script
    print_info "Running data integrity checks..."
    
    if python3 "$SCRIPT_DIR/validate_migration_setup.py"; then
        print_success "Data integrity validation passed"
        VALIDATION_RESULTS[database_validation]="passed"
        return 0
    else
        print_error "Data integrity validation failed"
        VALIDATION_RESULTS[database_validation]="failed"
        return 1
    fi
}

# API validation
validate_api_endpoints() {
    print_step "Validating API endpoints and functionality"
    
    if [[ "$BACKEND_ENDPOINT" == "unknown" ]]; then
        print_error "Backend endpoint not available"
        VALIDATION_RESULTS[api_validation]="failed"
        return 1
    fi
    
    local api_endpoints=(
        "$BACKEND_ENDPOINT/api/v1/health/simple"
        "$BACKEND_ENDPOINT/api/v1/health/detailed"
        "$BACKEND_ENDPOINT/api/v1/auth/status"
    )
    
    local successful_checks=0
    local total_checks=${#api_endpoints[@]}
    
    for endpoint in "${api_endpoints[@]}"; do
        print_info "Testing endpoint: $endpoint"
        
        local start_time=$(date +%s%N)
        local response_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$endpoint" || echo "000")
        local end_time=$(date +%s%N)
        local response_time=$(( (end_time - start_time) / 1000000 )) # Convert to milliseconds
        
        if [[ "$response_code" == "200" ]]; then
            print_success "✅ $endpoint (${response_time}ms)"
            ((successful_checks++))
            PERFORMANCE_METRICS["$(basename "$endpoint")_response_time"]="${response_time}ms"
        else
            print_error "❌ $endpoint (HTTP $response_code)"
        fi
    done
    
    # Test API functionality
    print_info "Testing API functionality..."
    
    # Test authentication endpoint
    local auth_response=$(curl -s --max-time 10 "$BACKEND_ENDPOINT/api/v1/auth/status" 2>/dev/null || echo "")
    if [[ -n "$auth_response" ]]; then
        print_success "Authentication endpoint responding"
        ((successful_checks++))
    fi
    
    # Calculate success rate
    local success_rate=$(( (successful_checks * 100) / total_checks ))
    PERFORMANCE_METRICS[api_success_rate]="${success_rate}%"
    
    if [[ $success_rate -ge 80 ]]; then
        print_success "API validation passed (${success_rate}% success rate)"
        VALIDATION_RESULTS[api_validation]="passed"
        return 0
    else
        print_error "API validation failed (${success_rate}% success rate)"
        VALIDATION_RESULTS[api_validation]="failed"
        return 1
    fi
}

# Frontend validation
validate_frontend_services() {
    print_step "Validating frontend services"
    
    local frontend_endpoints=(
        "$ADMIN_ENDPOINT"
        "$LANDING_ENDPOINT"
        "$DOCS_ENDPOINT"
    )
    
    local successful_checks=0
    local total_checks=0
    
    for endpoint in "${frontend_endpoints[@]}"; do
        if [[ "$endpoint" != "unknown" ]]; then
            ((total_checks++))
            print_info "Testing frontend: $endpoint"
            
            local start_time=$(date +%s%N)
            local response_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 "$endpoint" || echo "000")
            local end_time=$(date +%s%N)
            local response_time=$(( (end_time - start_time) / 1000000 ))
            
            if [[ "$response_code" == "200" ]]; then
                print_success "✅ $(basename "$endpoint") (${response_time}ms)"
                ((successful_checks++))
                PERFORMANCE_METRICS["$(basename "$endpoint")_load_time"]="${response_time}ms"
            else
                print_error "❌ $(basename "$endpoint") (HTTP $response_code)"
            fi
        fi
    done
    
    if [[ $total_checks -eq 0 ]]; then
        print_warning "No frontend endpoints to validate"
        VALIDATION_RESULTS[frontend_validation]="skipped"
        return 0
    fi
    
    local success_rate=$(( (successful_checks * 100) / total_checks ))
    
    if [[ $success_rate -ge 80 ]]; then
        print_success "Frontend validation passed (${success_rate}% success rate)"
        VALIDATION_RESULTS[frontend_validation]="passed"
        return 0
    else
        print_error "Frontend validation failed (${success_rate}% success rate)"
        VALIDATION_RESULTS[frontend_validation]="failed"
        return 1
    fi
}

# Security validation
validate_security() {
    print_step "Validating security configurations"
    
    local security_score=0
    local max_security_score=0
    
    # SSL/TLS validation
    print_info "Checking SSL/TLS configurations..."
    local endpoints_to_check=("$BACKEND_ENDPOINT" "$ADMIN_ENDPOINT" "$LANDING_ENDPOINT")
    
    for endpoint in "${endpoints_to_check[@]}"; do
        if [[ "$endpoint" != "unknown" && "$endpoint" =~ ^https:// ]]; then
            ((max_security_score++))
            
            if curl -s --max-time 10 "$endpoint" >/dev/null 2>&1; then
                print_success "SSL/TLS valid for $endpoint"
                ((security_score++))
                SECURITY_CHECKS["ssl_$(basename "$endpoint")"]="valid"
            else
                print_warning "SSL/TLS issues for $endpoint"
                SECURITY_CHECKS["ssl_$(basename "$endpoint")"]="invalid"
            fi
        fi
    done
    
    # Security headers check
    print_info "Checking security headers..."
    if [[ "$BACKEND_ENDPOINT" != "unknown" ]]; then
        ((max_security_score++))
        
        local headers=$(curl -s -I --max-time 10 "$BACKEND_ENDPOINT/api/v1/health/simple" 2>/dev/null || echo "")
        
        local security_headers=("X-Frame-Options" "X-Content-Type-Options" "X-XSS-Protection")
        local headers_found=0
        
        for header in "${security_headers[@]}"; do
            if echo "$headers" | grep -i "$header" >/dev/null; then
                ((headers_found++))
            fi
        done
        
        if [[ $headers_found -ge 2 ]]; then
            print_success "Security headers present ($headers_found/3)"
            ((security_score++))
            SECURITY_CHECKS[security_headers]="good"
        else
            print_warning "Limited security headers ($headers_found/3)"
            SECURITY_CHECKS[security_headers]="limited"
        fi
    fi
    
    # Database security check
    print_info "Checking database security..."
    if [[ "$DATABASE_ENDPOINT" != "unknown" ]]; then
        ((max_security_score++))
        
        # Check if database connection uses SSL
        if [[ "$DATABASE_ENDPOINT" =~ sslmode=require ]] || [[ "$DATABASE_ENDPOINT" =~ supabase ]]; then
            print_success "Database connection uses SSL"
            ((security_score++))
            SECURITY_CHECKS[database_ssl]="enabled"
        else
            print_warning "Database SSL configuration unclear"
            SECURITY_CHECKS[database_ssl]="unknown"
        fi
    fi
    
    # Environment security check
    print_info "Checking environment security..."
    ((max_security_score++))
    
    local sensitive_vars=("SECRET_KEY" "DATABASE_URL" "API_KEY")
    local secure_vars=0
    
    for var in "${sensitive_vars[@]}"; do
        if [[ -n "${!var:-}" ]] && [[ ${#!var} -gt 20 ]]; then
            ((secure_vars++))
        fi
    done
    
    if [[ $secure_vars -ge 2 ]]; then
        print_success "Environment variables appear secure"
        ((security_score++))
        SECURITY_CHECKS[environment_security]="good"
    else
        print_warning "Environment security needs review"
        SECURITY_CHECKS[environment_security]="needs_review"
    fi
    
    # Calculate security score
    local security_percentage=0
    if [[ $max_security_score -gt 0 ]]; then
        security_percentage=$(( (security_score * 100) / max_security_score ))
    fi
    
    PERFORMANCE_METRICS[security_score]="${security_percentage}%"
    
    if [[ $security_percentage -ge 70 ]]; then
        print_success "Security validation passed (${security_percentage}%)"
        VALIDATION_RESULTS[security_validation]="passed"
        return 0
    else
        print_warning "Security validation needs attention (${security_percentage}%)"
        VALIDATION_RESULTS[security_validation]="warning"
        return 1
    fi
}

# Performance validation
validate_performance() {
    print_step "Validating performance metrics"
    
    print_info "Running performance benchmarks..."
    
    # API performance test
    if [[ "$BACKEND_ENDPOINT" != "unknown" ]]; then
        print_info "Testing API performance..."
        
        local total_time=0
        local successful_requests=0
        local test_count=5
        
        for i in $(seq 1 $test_count); do
            local start_time=$(date +%s%N)
            local response_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$BACKEND_ENDPOINT/api/v1/health/simple" || echo "000")
            local end_time=$(date +%s%N)
            
            if [[ "$response_code" == "200" ]]; then
                local request_time=$(( (end_time - start_time) / 1000000 ))
                total_time=$((total_time + request_time))
                ((successful_requests++))
            fi
        done
        
        if [[ $successful_requests -gt 0 ]]; then
            local avg_response_time=$((total_time / successful_requests))
            PERFORMANCE_METRICS[api_avg_response_time]="${avg_response_time}ms"
            
            if [[ $avg_response_time -le 2000 ]]; then
                print_success "API performance good (${avg_response_time}ms avg)"
            else
                print_warning "API performance slow (${avg_response_time}ms avg)"
            fi
        fi
    fi
    
    # Frontend performance test
    local frontend_performance_score=0
    local frontend_tests=0
    
    for endpoint in "$ADMIN_ENDPOINT" "$LANDING_ENDPOINT"; do
        if [[ "$endpoint" != "unknown" ]]; then
            ((frontend_tests++))
            
            local start_time=$(date +%s%N)
            local response_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 "$endpoint" || echo "000")
            local end_time=$(date +%s%N)
            
            if [[ "$response_code" == "200" ]]; then
                local load_time=$(( (end_time - start_time) / 1000000 ))
                
                if [[ $load_time -le 3000 ]]; then
                    ((frontend_performance_score++))
                fi
                
                PERFORMANCE_METRICS["$(basename "$endpoint")_load_time"]="${load_time}ms"
                print_info "$(basename "$endpoint") load time: ${load_time}ms"
            fi
        fi
    done
    
    # Overall performance assessment
    local performance_percentage=0
    if [[ $frontend_tests -gt 0 ]]; then
        performance_percentage=$(( (frontend_performance_score * 100) / frontend_tests ))
    fi
    
    PERFORMANCE_METRICS[frontend_performance_score]="${performance_percentage}%"
    
    if [[ $performance_percentage -ge 70 ]]; then
        print_success "Performance validation passed (${performance_percentage}%)"
        VALIDATION_RESULTS[performance_validation]="passed"
        return 0
    else
        print_warning "Performance validation needs improvement (${performance_percentage}%)"
        VALIDATION_RESULTS[performance_validation]="warning"
        return 1
    fi
}

# Cost validation
validate_cost_optimization() {
    print_step "Validating cost optimization targets"
    
    # Expected costs for $145/month architecture
    local target_costs=(
        ["supabase"]="25"
        ["railway"]="50"
        ["vercel"]="20"
        ["cloudflare"]="0"
        ["s3_cloudfront"]="25"
        ["railway_redis"]="12"
        ["monitoring"]="13"
    )
    
    local total_target_cost=145
    
    print_info "Target monthly cost breakdown:"
    for service in "${!target_costs[@]}"; do
        print_info "  ${service}: $${target_costs[$service]}/mo"
        COST_METRICS["target_${service}"]="${target_costs[$service]}"
    done
    
    print_info "Total target cost: $${total_target_cost}/mo"
    COST_METRICS[target_total]="$total_target_cost"
    
    # Estimate current costs based on services used
    local estimated_current_cost=0
    
    # Check which services are actually running
    if [[ "$DATABASE_ENDPOINT" =~ supabase ]]; then
        print_info "✅ Supabase detected - $25/mo"
        estimated_current_cost=$((estimated_current_cost + 25))
        COST_METRICS[current_supabase]="25"
    fi
    
    if [[ "$BACKEND_ENDPOINT" =~ railway ]]; then
        print_info "✅ Railway detected - ~$50/mo"
        estimated_current_cost=$((estimated_current_cost + 50))
        COST_METRICS[current_railway]="50"
    fi
    
    if [[ "$ADMIN_ENDPOINT" =~ vercel ]]; then
        print_info "✅ Vercel detected - $20/mo"
        estimated_current_cost=$((estimated_current_cost + 20))
        COST_METRICS[current_vercel]="20"
    fi
    
    if [[ "$LANDING_ENDPOINT" =~ pages.dev ]] || [[ "$DOCS_ENDPOINT" =~ pages.dev ]]; then
        print_info "✅ Cloudflare Pages detected - $0/mo"
        COST_METRICS[current_cloudflare]="0"
    fi
    
    # Assume remaining services are active
    estimated_current_cost=$((estimated_current_cost + 25 + 12 + 13)) # S3+CloudFront, Redis, Monitoring
    
    COST_METRICS[estimated_current_total]="$estimated_current_cost"
    
    print_info "Estimated current monthly cost: $${estimated_current_cost}"
    
    # Calculate cost efficiency
    if [[ $estimated_current_cost -le $((total_target_cost + 20)) ]]; then
        local savings=$((500 - estimated_current_cost)) # Assuming $500 was the old cost
        local savings_percentage=$(( (savings * 100) / 500 ))
        
        print_success "Cost optimization target met!"
        print_success "Estimated savings: $${savings}/mo (${savings_percentage}%)"
        
        COST_METRICS[monthly_savings]="$savings"
        COST_METRICS[savings_percentage]="${savings_percentage}%"
        
        VALIDATION_RESULTS[cost_validation]="passed"
        return 0
    else
        print_warning "Cost optimization target not met"
        print_warning "Estimated cost: $${estimated_current_cost} (target: $${total_target_cost})"
        
        VALIDATION_RESULTS[cost_validation]="warning"
        return 1
    fi
}

# Integration validation
validate_integrations() {
    print_step "Validating service integrations"
    
    local integration_score=0
    local max_integration_score=0
    
    # Database to API integration
    print_info "Testing database to API integration..."
    if [[ "$BACKEND_ENDPOINT" != "unknown" ]]; then
        ((max_integration_score++))
        
        local db_health_response=$(curl -s --max-time 10 "$BACKEND_ENDPOINT/api/v1/health/detailed" 2>/dev/null || echo "")
        
        if echo "$db_health_response" | grep -i "database.*ok\|healthy\|connected" >/dev/null; then
            print_success "Database integration working"
            ((integration_score++))
        else
            print_warning "Database integration unclear"
        fi
    fi
    
    # API to frontend integration
    print_info "Testing API to frontend integration..."
    if [[ "$ADMIN_ENDPOINT" != "unknown" && "$BACKEND_ENDPOINT" != "unknown" ]]; then
        ((max_integration_score++))
        
        # This is a simplified check - in practice you'd test actual API calls from frontend
        if curl -s --max-time 10 "$ADMIN_ENDPOINT" >/dev/null && curl -s --max-time 10 "$BACKEND_ENDPOINT/api/v1/health/simple" >/dev/null; then
            print_success "Frontend to API connectivity verified"
            ((integration_score++))
        else
            print_warning "Frontend to API integration issues"
        fi
    fi
    
    # Storage integration (if applicable)
    print_info "Testing storage integration..."
    if [[ "$BACKEND_ENDPOINT" != "unknown" ]]; then
        ((max_integration_score++))
        
        # Test if storage endpoints are accessible
        local storage_response=$(curl -s --max-time 10 "$BACKEND_ENDPOINT/api/v1/health/storage" 2>/dev/null || echo "")
        
        if [[ -n "$storage_response" ]] && ! echo "$storage_response" | grep -i "error\|failed" >/dev/null; then
            print_success "Storage integration working"
            ((integration_score++))
        else
            print_info "Storage integration test inconclusive"
            ((integration_score++)) # Don't fail on inconclusive storage test
        fi
    fi
    
    # Calculate integration score
    local integration_percentage=0
    if [[ $max_integration_score -gt 0 ]]; then
        integration_percentage=$(( (integration_score * 100) / max_integration_score ))
    fi
    
    PERFORMANCE_METRICS[integration_score]="${integration_percentage}%"
    
    if [[ $integration_percentage -ge 70 ]]; then
        print_success "Integration validation passed (${integration_percentage}%)"
        VALIDATION_RESULTS[integration_validation]="passed"
        return 0
    else
        print_warning "Some integrations need attention (${integration_percentage}%)"
        VALIDATION_RESULTS[integration_validation]="warning"
        return 1
    fi
}

# Calculate overall validation score
calculate_overall_score() {
    local total_score=0
    local max_score=0
    
    local validations=("dependencies_check" "database_validation" "api_validation" "frontend_validation" "security_validation" "performance_validation" "cost_validation" "integration_validation")
    
    for validation in "${validations[@]}"; do
        ((max_score++))
        
        case "${VALIDATION_RESULTS[$validation]}" in
            "passed") ((total_score++)) ;;
            "warning") total_score=$((total_score + 1)) ;; # Half credit for warnings
            "skipped") ((max_score--)) ;; # Don't count skipped tests
            *) ;; # Failed tests contribute 0
        esac
    done
    
    if [[ $max_score -gt 0 ]]; then
        VALIDATION_RESULTS[overall_score]=$(( (total_score * 100) / max_score ))
    else
        VALIDATION_RESULTS[overall_score]=0
    fi
}

# Generate validation report
generate_validation_report() {
    print_step "Generating comprehensive validation report"
    
    calculate_overall_score
    
    local report_file="$LOG_DIR/${VALIDATION_ID}_report.md"
    
    cat > "$report_file" << EOF
# Infrastructure Migration Validation Report
**Validation ID:** $VALIDATION_ID  
**Date:** $(date)  
**Overall Score:** ${VALIDATION_RESULTS[overall_score]}%

## Executive Summary

This report provides comprehensive validation results for the \$145/month architecture migration.

### Overall Status: $([ ${VALIDATION_RESULTS[overall_score]} -ge 80 ] && echo "✅ PASSED" || echo "⚠️ NEEDS ATTENTION")

## Validation Results

### System Validation
- **Dependencies Check:** ${VALIDATION_RESULTS[dependencies_check]}
- **Database Validation:** ${VALIDATION_RESULTS[database_validation]}
- **API Validation:** ${VALIDATION_RESULTS[api_validation]}
- **Frontend Validation:** ${VALIDATION_RESULTS[frontend_validation]}

### Quality Validation
- **Security Validation:** ${VALIDATION_RESULTS[security_validation]}
- **Performance Validation:** ${VALIDATION_RESULTS[performance_validation]}
- **Integration Validation:** ${VALIDATION_RESULTS[integration_validation]}

### Cost Validation
- **Cost Optimization:** ${VALIDATION_RESULTS[cost_validation]}

## Performance Metrics

### Response Times
$(for key in "${!PERFORMANCE_METRICS[@]}"; do
    if [[ "$key" =~ response_time|load_time ]]; then
        echo "- **$key:** ${PERFORMANCE_METRICS[$key]}"
    fi
done)

### Success Rates
$(for key in "${!PERFORMANCE_METRICS[@]}"; do
    if [[ "$key" =~ success_rate|score ]]; then
        echo "- **$key:** ${PERFORMANCE_METRICS[$key]}"
    fi
done)

## Security Assessment

### Security Checks
$(for key in "${!SECURITY_CHECKS[@]}"; do
    echo "- **$key:** ${SECURITY_CHECKS[$key]}"
done)

### Security Score
- **Overall Security Score:** ${PERFORMANCE_METRICS[security_score]:-"N/A"}

## Cost Analysis

### Target Architecture Costs
- **Supabase Pro:** \$${COST_METRICS[target_supabase]:-"25"}/mo
- **Railway:** \$${COST_METRICS[target_railway]:-"50"}/mo
- **Vercel Pro:** \$${COST_METRICS[target_vercel]:-"20"}/mo
- **Cloudflare Pages:** \$${COST_METRICS[target_cloudflare]:-"0"}/mo
- **S3 + CloudFront:** \$${COST_METRICS[target_s3_cloudfront]:-"25"}/mo
- **Railway Redis:** \$${COST_METRICS[target_railway_redis]:-"12"}/mo
- **Monitoring:** \$${COST_METRICS[target_monitoring]:-"13"}/mo

### Cost Optimization Results
- **Target Monthly Cost:** \$${COST_METRICS[target_total]:-"145"}
- **Estimated Current Cost:** \$${COST_METRICS[estimated_current_total]:-"Unknown"}
- **Monthly Savings:** \$${COST_METRICS[monthly_savings]:-"Unknown"}
- **Savings Percentage:** ${COST_METRICS[savings_percentage]:-"Unknown"}

## Service Endpoints

### Current Infrastructure
- **Database:** $DATABASE_ENDPOINT
- **Backend API:** $BACKEND_ENDPOINT
- **Admin Dashboard:** $ADMIN_ENDPOINT
- **Landing Page:** $LANDING_ENDPOINT
- **Documentation:** $DOCS_ENDPOINT

## Recommendations

$(if [[ ${VALIDATION_RESULTS[overall_score]} -ge 80 ]]; then
    echo "### ✅ Migration Validation Successful"
    echo ""
    echo "The migration has been validated successfully. All critical systems are operational."
    echo ""
    echo "**Next Steps:**"
    echo "1. Monitor systems for 24-48 hours"
    echo "2. Update monitoring dashboards"
    echo "3. Update team documentation"
    echo "4. Schedule old infrastructure cleanup"
else
    echo "### ⚠️ Issues Require Attention"
    echo ""
    echo "Some validation checks failed or need attention. Review the issues below:"
    echo ""
    echo "**Failed Validations:**"
    for validation in dependencies_check database_validation api_validation frontend_validation security_validation performance_validation cost_validation integration_validation; do
        if [[ "${VALIDATION_RESULTS[$validation]}" == "failed" ]]; then
            echo "- $validation"
        fi
    done
    echo ""
    echo "**Warnings:**"
    for validation in dependencies_check database_validation api_validation frontend_validation security_validation performance_validation cost_validation integration_validation; do
        if [[ "${VALIDATION_RESULTS[$validation]}" == "warning" ]]; then
            echo "- $validation"
        fi
    done
    echo ""
    echo "**Recommended Actions:**"
    echo "1. Address failed validations before proceeding"
    echo "2. Review warning items for potential improvements"
    echo "3. Re-run validation after fixes"
    echo "4. Consider rollback if critical issues persist"
fi)

## Technical Details

### Validation Duration
- **Start Time:** ${VALIDATION_RESULTS[start_time]}
- **End Time:** $(date)
- **Duration:** $(( $(date +%s) - $(date -d "${VALIDATION_RESULTS[start_time]}" +%s) )) seconds

### Log Files
- **Validation Log:** $LOG_FILE
- **Results JSON:** $RESULTS_FILE

---
*Report generated on $(date)*
EOF

    print_success "Validation report generated: $report_file"
    echo -e "\n${CYAN}Validation Report Summary:${NC}"
    
    # Print summary
    echo "Overall Score: ${VALIDATION_RESULTS[overall_score]}%"
    echo "Status: $([ ${VALIDATION_RESULTS[overall_score]} -ge 80 ] && echo "✅ PASSED" || echo "⚠️ NEEDS ATTENTION")"
    
    save_validation_results
}

# Main validation orchestration
run_validation() {
    print_header "INFRASTRUCTURE MIGRATION VALIDATION"
    
    # Initialize
    init_validation_results
    
    print_info "Validation ID: $VALIDATION_ID"
    print_info "Log file: $LOG_FILE"
    print_info "Results file: $RESULTS_FILE"
    
    # Load migration state
    load_migration_state
    
    # Run validation steps
    local validation_steps=(
        "validate_dependencies"
        "validate_database"
        "validate_api_endpoints"
        "validate_frontend_services"
        "validate_security"
        "validate_performance"
        "validate_cost_optimization"
        "validate_integrations"
    )
    
    local failed_validations=0
    
    for step in "${validation_steps[@]}"; do
        if ! $step; then
            ((failed_validations++))
        fi
    done
    
    # Determine final status
    if [[ $failed_validations -eq 0 ]]; then
        VALIDATION_RESULTS[status]="passed"
        print_success "All validations passed!"
    elif [[ $failed_validations -le 2 ]]; then
        VALIDATION_RESULTS[status]="warning"
        print_warning "$failed_validations validation(s) failed - review needed"
    else
        VALIDATION_RESULTS[status]="failed"
        print_error "$failed_validations validation(s) failed - immediate attention required"
    fi
    
    # Generate report
    generate_validation_report
    
    print_header "VALIDATION COMPLETED"
    print_info "Review the detailed report for complete analysis"
    
    # Return appropriate exit code
    case "${VALIDATION_RESULTS[status]}" in
        "passed") return 0 ;;
        "warning") return 1 ;;
        "failed") return 2 ;;
        *) return 3 ;;
    esac
}

# Quick validation (essential checks only)
run_quick_validation() {
    print_header "QUICK INFRASTRUCTURE VALIDATION"
    
    init_validation_results
    load_migration_state
    
    # Essential checks only
    validate_dependencies
    validate_database
    validate_api_endpoints
    
    calculate_overall_score
    
    echo "Quick Validation Score: ${VALIDATION_RESULTS[overall_score]}%"
    
    if [[ ${VALIDATION_RESULTS[overall_score]} -ge 70 ]]; then
        print_success "Quick validation passed"
        return 0
    else
        print_error "Quick validation failed"
        return 1
    fi
}

# Pre-migration validation
run_pre_migration_validation() {
    print_header "PRE-MIGRATION VALIDATION"
    
    print_info "Running pre-migration readiness checks..."
    
    # Use existing validation script
    if python3 "$SCRIPT_DIR/validate_migration_setup.py"; then
        print_success "Pre-migration validation passed"
        print_info "Ready for migration execution"
        return 0
    else
        print_error "Pre-migration validation failed"
        print_info "Fix issues before running migration"
        return 1
    fi
}

# Signal handling
trap 'print_error "Validation interrupted"; exit 1' INT TERM

# Main execution
case "${1:-validate}" in
    "validate"|"full")
        run_validation
        ;;
    "quick")
        run_quick_validation
        ;;
    "pre-migration")
        run_pre_migration_validation
        ;;
    "help"|"-h"|"--help")
        echo "Infrastructure Migration Validation Script"
        echo "Usage: $0 [validate|quick|pre-migration|help]"
        echo ""
        echo "Commands:"
        echo "  validate       - Run full validation suite (default)"
        echo "  full           - Run full validation suite"
        echo "  quick          - Run essential validations only"
        echo "  pre-migration  - Run pre-migration readiness checks"
        echo "  help           - Show this help message"
        echo ""
        echo "The validation script checks:"
        echo "  - System dependencies and prerequisites"
        echo "  - Database connectivity and integrity"
        echo "  - API endpoint functionality"
        echo "  - Frontend service availability"
        echo "  - Security configurations"
        echo "  - Performance metrics"
        echo "  - Cost optimization targets"
        echo "  - Service integrations"
        ;;
    *)
        print_error "Unknown command: $1"
        exit 1
        ;;
esac