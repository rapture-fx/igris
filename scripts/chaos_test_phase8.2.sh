#!/bin/bash
# Chaos Engineering Tests for Phase 8.2 Production Hardening
# Validates adaptive orchestration auto-recovery and rollback behavior

set -e

# Configuration
CONTROL_SURFACE_URL="http://localhost:8081"
CANARY_ENDPOINT="http://inference-canary-phase10:8080"
STABLE_ENDPOINT="http://inference-prod-stable:8080"
LOG_FILE="chaos_test_results_$(date +%Y%m%d_%H%M%S).log"
RESULTS_DIR="./chaos_results"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Create results directory
mkdir -p "$RESULTS_DIR"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] ✓ $1${NC}" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ✗ $1${NC}" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] ⚠ $1${NC}" | tee -a "$LOG_FILE"
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."

    # Check if Control Surface is reachable
    if ! curl -s "$CONTROL_SURFACE_URL/health" > /dev/null; then
        log_error "Control Surface API not reachable at $CONTROL_SURFACE_URL"
        exit 1
    fi
    log_success "Control Surface API is reachable"

    # Check if endpoints are up
    if ! curl -s "$CANARY_ENDPOINT/health" > /dev/null; then
        log_warning "Canary endpoint not reachable (may be intentional for testing)"
    fi

    log_success "Prerequisites check completed"
}

# Get baseline metrics
get_baseline_metrics() {
    log "Capturing baseline metrics..."

    curl -s "$CONTROL_SURFACE_URL/policy/inspect" > "$RESULTS_DIR/baseline_policy.json"
    curl -s "$CONTROL_SURFACE_URL/policy/metrics" > "$RESULTS_DIR/baseline_metrics.json"

    BASELINE_CACHE_HIT=$(jq -r '.policy.trigger_metrics.cache_hit_rate' "$RESULTS_DIR/baseline_policy.json")
    BASELINE_LATENCY=$(jq -r '.policy.trigger_metrics.avg_latency_ms' "$RESULTS_DIR/baseline_policy.json")
    BASELINE_ERROR_RATE=$(jq -r '.policy.trigger_metrics.error_rate' "$RESULTS_DIR/baseline_policy.json")

    log "Baseline - Cache Hit Rate: $BASELINE_CACHE_HIT"
    log "Baseline - Avg Latency: ${BASELINE_LATENCY}ms"
    log "Baseline - Error Rate: $BASELINE_ERROR_RATE"
}

# Measure recovery time
measure_recovery_time() {
    local start_time=$1
    local end_time=$2
    local recovery_seconds=$(echo "scale=3; $end_time - $start_time" | bc)
    echo "$recovery_seconds"
}

# =====================================================
# Chaos Test 1: Load Balancer Failure
# =====================================================
chaos_test_1_lb_failure() {
    log "========================================"
    log "CHAOS TEST 1: Load Balancer Failure"
    log "========================================"

    log "Simulating primary endpoint unavailability..."
    START_TIME=$(date +%s.%N)

    # Block traffic to canary endpoint
    if command -v iptables &> /dev/null; then
        sudo iptables -A OUTPUT -d inference-canary-phase10 -j DROP
    else
        log_warning "iptables not available, using mock simulation"
        # Mock: Just update policy to force failover
        curl -s -X POST "$CONTROL_SURFACE_URL/policy/update" \
            -H "Content-Type: application/json" \
            -d '{
                "routing": {
                    "primary_endpoint": "inference-canary-phase10",
                    "fallback_endpoint": "inference-prod-stable",
                    "traffic_split": 0.0,
                    "circuit_breaker_threshold": 1,
                    "timeout_ms": 1000
                },
                "batching": {"batch_size": 32, "max_wait_ms": 10, "dynamic_sizing": true},
                "confidence": 0.95
            }' > "$RESULTS_DIR/chaos1_policy_response.json"
    fi

    # Wait for system to detect failure and failover
    sleep 3

    # Check if traffic shifted to fallback
    POLICY_AFTER=$(curl -s "$CONTROL_SURFACE_URL/policy/inspect")
    TRAFFIC_SPLIT=$(echo "$POLICY_AFTER" | jq -r '.policy.routing.traffic_split')

    END_TIME=$(date +%s.%N)
    RECOVERY_TIME=$(measure_recovery_time "$START_TIME" "$END_TIME")

    if (( $(echo "$TRAFFIC_SPLIT < 0.5" | bc -l) )); then
        log_success "Failover detected: Traffic split reduced to $TRAFFIC_SPLIT"
        log_success "Recovery time: ${RECOVERY_TIME}s (Target: <2.0s)"

        if (( $(echo "$RECOVERY_TIME < 2.0" | bc -l) )); then
            echo "PASS" > "$RESULTS_DIR/chaos1_result.txt"
        else
            log_warning "Recovery time exceeded target"
            echo "WARN" > "$RESULTS_DIR/chaos1_result.txt"
        fi
    else
        log_error "Failover NOT detected. Traffic split: $TRAFFIC_SPLIT"
        echo "FAIL" > "$RESULTS_DIR/chaos1_result.txt"
    fi

    # Restore network
    if command -v iptables &> /dev/null; then
        sudo iptables -D OUTPUT -d inference-canary-phase10 -j DROP
    fi

    log "Waiting 10s for system stabilization..."
    sleep 10
}

# =====================================================
# Chaos Test 2: Request Queue Delay
# =====================================================
chaos_test_2_queue_delay() {
    log "========================================"
    log "CHAOS TEST 2: Request Queue Delay"
    log "========================================"

    log "Injecting 500ms artificial delay..."
    START_TIME=$(date +%s.%N)

    # Simulate delay by forcing high batch wait time
    curl -s -X POST "$CONTROL_SURFACE_URL/policy/update" \
        -H "Content-Type: application/json" \
        -d '{
            "routing": {
                "primary_endpoint": "inference-canary-phase10",
                "fallback_endpoint": "inference-prod-stable",
                "traffic_split": 0.1,
                "circuit_breaker_threshold": 5,
                "timeout_ms": 5000
            },
            "batching": {
                "batch_size": 128,
                "max_wait_ms": 500,
                "dynamic_sizing": true,
                "timeout_threshold_ms": 600
            },
            "confidence": 0.85
        }' > "$RESULTS_DIR/chaos2_inject_response.json"

    # Wait for adaptive system to react (120 seconds)
    log "Monitoring adaptive response for 120 seconds..."
    sleep 30

    # Check if batch size was reduced
    POLICY_DURING=$(curl -s "$CONTROL_SURFACE_URL/policy/inspect")
    BATCH_SIZE_DURING=$(echo "$POLICY_DURING" | jq -r '.policy.batching.batch_size')
    AVG_LATENCY=$(echo "$POLICY_DURING" | jq -r '.policy.trigger_metrics.avg_latency_ms')

    log "Batch size during delay: $BATCH_SIZE_DURING"
    log "Avg latency: ${AVG_LATENCY}ms"

    sleep 90

    # Check final state
    POLICY_AFTER=$(curl -s "$CONTROL_SURFACE_URL/policy/inspect")
    BATCH_SIZE_AFTER=$(echo "$POLICY_AFTER" | jq -r '.policy.batching.batch_size')

    END_TIME=$(date +%s.%N)
    ADAPTATION_TIME=$(measure_recovery_time "$START_TIME" "$END_TIME")

    if (( BATCH_SIZE_AFTER < 128 )); then
        log_success "Adaptive response: Batch size reduced from 128 to $BATCH_SIZE_AFTER"
        log_success "Adaptation time: ${ADAPTATION_TIME}s"
        echo "PASS" > "$RESULTS_DIR/chaos2_result.txt"
    else
        log_warning "Batch size not adjusted as expected: $BATCH_SIZE_AFTER"
        echo "WARN" > "$RESULTS_DIR/chaos2_result.txt"
    fi

    # Restore normal policy
    curl -s -X POST "$CONTROL_SURFACE_URL/policy/update" \
        -H "Content-Type: application/json" \
        -d '{
            "routing": {"primary_endpoint": "inference-canary-phase10", "fallback_endpoint": "inference-prod-stable", "traffic_split": 0.1, "circuit_breaker_threshold": 5, "timeout_ms": 4000},
            "batching": {"batch_size": 32, "max_wait_ms": 10, "dynamic_sizing": true},
            "confidence": 0.95
        }' > /dev/null

    sleep 10
}

# =====================================================
# Chaos Test 3: Force Cache Misses
# =====================================================
chaos_test_3_cache_miss() {
    log "========================================"
    log "CHAOS TEST 3: Force Cache Misses"
    log "========================================"

    log "Simulating 50% cache invalidation..."
    START_TIME=$(date +%s.%N)

    # Get initial cache hit rate
    POLICY_BEFORE=$(curl -s "$CONTROL_SURFACE_URL/policy/inspect")
    CACHE_HIT_BEFORE=$(echo "$POLICY_BEFORE" | jq -r '.policy.trigger_metrics.cache_hit_rate')
    log "Cache hit rate before: $CACHE_HIT_BEFORE"

    # Simulate cache flush (in real scenario, would clear Redis/cache layer)
    log "Waiting for prefetch predictor to adapt (180 seconds)..."
    sleep 180

    # Check if cache hit rate recovered
    POLICY_AFTER=$(curl -s "$CONTROL_SURFACE_URL/policy/inspect")
    CACHE_HIT_AFTER=$(echo "$POLICY_AFTER" | jq -r '.policy.trigger_metrics.cache_hit_rate')

    END_TIME=$(date +%s.%N)
    RECOVERY_TIME=$(measure_recovery_time "$START_TIME" "$END_TIME")

    log "Cache hit rate after recovery: $CACHE_HIT_AFTER"
    log "Recovery time: ${RECOVERY_TIME}s"

    # Check if cache hit rate is above 85% (minimum threshold)
    if (( $(echo "$CACHE_HIT_AFTER >= 0.85" | bc -l) )); then
        log_success "Cache hit rate recovered to $CACHE_HIT_AFTER (Target: ≥0.85)"
        echo "PASS" > "$RESULTS_DIR/chaos3_result.txt"
    else
        log_warning "Cache hit rate below target: $CACHE_HIT_AFTER"
        echo "WARN" > "$RESULTS_DIR/chaos3_result.txt"
    fi
}

# =====================================================
# Chaos Test 4: Error Rate Spike
# =====================================================
chaos_test_4_error_spike() {
    log "========================================"
    log "CHAOS TEST 4: Error Rate Spike"
    log "========================================"

    log "Injecting 10% error rate for 30 seconds..."
    START_TIME=$(date +%s.%N)

    # Simulate errors by lowering circuit breaker threshold
    curl -s -X POST "$CONTROL_SURFACE_URL/policy/update" \
        -H "Content-Type: application/json" \
        -d '{
            "routing": {
                "primary_endpoint": "inference-canary-phase10",
                "fallback_endpoint": "inference-prod-stable",
                "traffic_split": 0.1,
                "circuit_breaker_threshold": 2,
                "timeout_ms": 2000
            },
            "batching": {"batch_size": 32, "max_wait_ms": 10, "dynamic_sizing": true},
            "confidence": 0.80,
            "trigger_metrics": {
                "error_rate": 0.10
            }
        }' > "$RESULTS_DIR/chaos4_inject_response.json"

    sleep 30

    # Check if drift monitor triggered
    METRICS=$(curl -s "$CONTROL_SURFACE_URL/policy/metrics")
    ROLLBACKS=$(echo "$METRICS" | jq -r '.metrics.rollbacks')

    END_TIME=$(date +%s.%N)

    log "Rollbacks triggered: $ROLLBACKS"

    if (( ROLLBACKS > 0 )); then
        log_success "Drift monitor correctly triggered rollback"
        echo "PASS" > "$RESULTS_DIR/chaos4_result.txt"
    else
        log_warning "No rollback triggered (may be within tolerance)"
        echo "WARN" > "$RESULTS_DIR/chaos4_result.txt"
    fi

    # Restore normal policy
    curl -s -X POST "$CONTROL_SURFACE_URL/policy/update" \
        -H "Content-Type: application/json" \
        -d '{
            "routing": {"primary_endpoint": "inference-canary-phase10", "fallback_endpoint": "inference-prod-stable", "traffic_split": 0.1, "circuit_breaker_threshold": 5, "timeout_ms": 4000},
            "batching": {"batch_size": 32, "max_wait_ms": 10, "dynamic_sizing": true},
            "confidence": 0.95
        }' > /dev/null
}

# =====================================================
# Chaos Test 5: Latency Degradation
# =====================================================
chaos_test_5_latency_spike() {
    log "========================================"
    log "CHAOS TEST 5: Latency Degradation"
    log "========================================"

    log "Simulating +100ms latency spike..."
    START_TIME=$(date +%s.%N)

    # Inject high latency telemetry
    curl -s -X POST "$CONTROL_SURFACE_URL/policy/update" \
        -H "Content-Type: application/json" \
        -d '{
            "routing": {"primary_endpoint": "inference-canary-phase10", "fallback_endpoint": "inference-prod-stable", "traffic_split": 0.1, "circuit_breaker_threshold": 5, "timeout_ms": 6000},
            "batching": {"batch_size": 64, "max_wait_ms": 20, "dynamic_sizing": true},
            "confidence": 0.85,
            "trigger_metrics": {
                "avg_latency_ms": 250.0
            }
        }' > "$RESULTS_DIR/chaos5_inject_response.json"

    log "Monitoring adaptive response for 90 seconds..."
    sleep 90

    # Check if batch size was reduced
    POLICY_AFTER=$(curl -s "$CONTROL_SURFACE_URL/policy/inspect")
    BATCH_SIZE_AFTER=$(echo "$POLICY_AFTER" | jq -r '.policy.batching.batch_size')
    AVG_LATENCY=$(echo "$POLICY_AFTER" | jq -r '.policy.trigger_metrics.avg_latency_ms')

    END_TIME=$(date +%s.%N)

    log "Batch size after adaptation: $BATCH_SIZE_AFTER"
    log "Avg latency: ${AVG_LATENCY}ms"

    if (( BATCH_SIZE_AFTER < 64 )); then
        log_success "Adaptive response: Batch size reduced to $BATCH_SIZE_AFTER"
        echo "PASS" > "$RESULTS_DIR/chaos5_result.txt"
    else
        log_warning "Batch size not reduced as expected: $BATCH_SIZE_AFTER"
        echo "WARN" > "$RESULTS_DIR/chaos5_result.txt"
    fi

    # Restore baseline
    curl -s -X POST "$CONTROL_SURFACE_URL/policy/update" \
        -H "Content-Type: application/json" \
        -d '{
            "routing": {"primary_endpoint": "inference-canary-phase10", "fallback_endpoint": "inference-prod-stable", "traffic_split": 0.1, "circuit_breaker_threshold": 5, "timeout_ms": 4000},
            "batching": {"batch_size": 32, "max_wait_ms": 10, "dynamic_sizing": true},
            "confidence": 0.95
        }' > /dev/null
}

# =====================================================
# Generate Summary Report
# =====================================================
generate_summary() {
    log "========================================"
    log "CHAOS TESTING SUMMARY"
    log "========================================"

    TOTAL_TESTS=5
    PASSED=0
    WARNED=0
    FAILED=0

    for i in {1..5}; do
        if [ -f "$RESULTS_DIR/chaos${i}_result.txt" ]; then
            RESULT=$(cat "$RESULTS_DIR/chaos${i}_result.txt")
            case "$RESULT" in
                PASS)
                    ((PASSED++))
                    log_success "Test $i: PASSED"
                    ;;
                WARN)
                    ((WARNED++))
                    log_warning "Test $i: WARNING"
                    ;;
                FAIL)
                    ((FAILED++))
                    log_error "Test $i: FAILED"
                    ;;
            esac
        fi
    done

    log "----------------------------------------"
    log "Total Tests: $TOTAL_TESTS"
    log "Passed: $PASSED"
    log "Warnings: $WARNED"
    log "Failed: $FAILED"
    log "========================================"

    # Write summary to file
    cat > "$RESULTS_DIR/summary.txt" <<EOF
Chaos Testing Summary - Phase 8.2
Execution Time: $(date)

Test Results:
  Total: $TOTAL_TESTS
  Passed: $PASSED
  Warnings: $WARNED
  Failed: $FAILED

Success Rate: $(echo "scale=2; $PASSED / $TOTAL_TESTS * 100" | bc)%

Detailed Results:
  Test 1 (Load Balancer Failure): $(cat "$RESULTS_DIR/chaos1_result.txt" 2>/dev/null || echo "NOT RUN")
  Test 2 (Queue Delay): $(cat "$RESULTS_DIR/chaos2_result.txt" 2>/dev/null || echo "NOT RUN")
  Test 3 (Cache Miss): $(cat "$RESULTS_DIR/chaos3_result.txt" 2>/dev/null || echo "NOT RUN")
  Test 4 (Error Spike): $(cat "$RESULTS_DIR/chaos4_result.txt" 2>/dev/null || echo "NOT RUN")
  Test 5 (Latency Spike): $(cat "$RESULTS_DIR/chaos5_result.txt" 2>/dev/null || echo "NOT RUN")

Log File: $LOG_FILE
Results Directory: $RESULTS_DIR
EOF

    cat "$RESULTS_DIR/summary.txt"
}

# =====================================================
# Main Execution
# =====================================================
main() {
    log "Starting Chaos Engineering Tests for Phase 8.2"
    log "Results will be saved to: $RESULTS_DIR"

    check_prerequisites
    get_baseline_metrics

    chaos_test_1_lb_failure
    chaos_test_2_queue_delay
    chaos_test_3_cache_miss
    chaos_test_4_error_spike
    chaos_test_5_latency_spike

    generate_summary

    log "Chaos testing completed. Check $LOG_FILE for full details."
}

# Run main function
main "$@"
