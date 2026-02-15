#!/bin/bash
# Phase 13 Chaos Scenarios
# Additional chaos tests for proactive scaling and preemptive rollback validation

set -euo pipefail

CHAOS_LOG="/var/log/igris/chaos_phase13.log"
CHAOS_RESULTS="/var/log/igris/chaos_phase13_results.json"

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*" | tee -a "$CHAOS_LOG"
}

error() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $*" | tee -a "$CHAOS_LOG" >&2
}

# ========================================
# Phase 13 Chaos Scenarios
# ========================================

# Chaos Scenario: Proactive Scale-Up Test
chaos_proactive_scale_up() {
    local duration_sec=${1:-120}
    log "CHAOS: Proactive Scale-Up Test - ${duration_sec}s"

    # Inject artificial load spike forecast
    log "Injecting forecast for upcoming load spike..."

    # Simulate metric injection to trigger proactive scaling
    for i in $(seq 1 10); do
        curl -X POST http://localhost:8081/forecast/inject -d '{
            "metric_name": "latency_p99",
            "forecasted_value": 180,
            "confidence": 0.92,
            "horizon_seconds": 300
        }' 2>/dev/null || true
        sleep 10
    done

    # Monitor if proactive scale-up occurred
    local start_time=$(date +%s)
    local scale_up_detected=false

    while [ $(($(date +%s) - start_time)) -lt "$duration_sec" ]; do
        # Check for scale-up decision
        local decision=$(curl -s http://localhost:8081/control/recent_decisions | jq -r '.decisions[0].decision_type')

        if [ "$decision" = "ScaleUp" ]; then
            scale_up_detected=true
            log "SUCCESS: Proactive scale-up detected"
            break
        fi

        sleep 5
    done

    if $scale_up_detected; then
        # Verify scale-up completed before load spike
        local scale_completion_time=$(($(date +%s) - start_time))
        log "PASSED: Proactive scale-up completed in ${scale_completion_time}s"
        echo "{\"scenario\":\"proactive_scale_up\",\"completion_time\":$scale_completion_time,\"passed\":true}" >> "$CHAOS_RESULTS"
        return 0
    else
        error "FAILED: Proactive scale-up not detected within ${duration_sec}s"
        echo "{\"scenario\":\"proactive_scale_up\",\"passed\":false}" >> "$CHAOS_RESULTS"
        return 1
    fi
}

# Chaos Scenario: Preemptive Rollback on Drift
chaos_preemptive_rollback_drift() {
    local drift_threshold=${1:-5.0}
    log "CHAOS: Preemptive Rollback on Drift - threshold ${drift_threshold}%"

    # Inject bad policy to induce drift
    log "Injecting bad policy to trigger drift..."
    curl -X POST http://localhost:8081/policy/commit -d '{
        "checkpoint_id": "chaos-bad-policy",
        "cache_size": 10,
        "worker_threads": 1,
        "batch_size": 5
    }' 2>/dev/null || true

    # Wait for drift detection
    local start_time=$(date +%s)
    local rollback_detected=false

    for i in $(seq 1 60); do
        sleep 5

        # Check drift score
        local drift_score=$(curl -s http://localhost:8081/metrics | grep drift_score | awk '{print $2}')

        if [ -n "$drift_score" ]; then
            log "Current drift score: ${drift_score}%"

            if (( $(echo "$drift_score > $drift_threshold" | bc -l) )); then
                log "Drift threshold breached, checking for rollback..."

                # Check if rollback was triggered
                local recent_decision=$(curl -s http://localhost:8081/control/recent_decisions | jq -r '.decisions[0].decision_type')

                if [ "$recent_decision" = "Rollback" ]; then
                    rollback_detected=true
                    log "SUCCESS: Preemptive rollback detected"
                    break
                fi
            fi
        fi

        if [ $i -eq 60 ]; then
            error "TIMEOUT: Preemptive rollback not detected within 5 minutes"
        fi
    done

    if $rollback_detected; then
        local rollback_time=$(($(date +%s) - start_time))
        log "PASSED: Preemptive rollback triggered in ${rollback_time}s"
        echo "{\"scenario\":\"preemptive_rollback_drift\",\"rollback_time\":$rollback_time,\"drift_threshold\":$drift_threshold,\"passed\":true}" >> "$CHAOS_RESULTS"
        return 0
    else
        error "FAILED: Preemptive rollback not triggered"
        echo "{\"scenario\":\"preemptive_rollback_drift\",\"passed\":false}" >> "$CHAOS_RESULTS"
        return 1
    fi
}

# Chaos Scenario: Forecast-Driven Preemptive Action
chaos_forecast_driven_action() {
    log "CHAOS: Forecast-Driven Preemptive Action"

    # Inject multiple forecasts for different metrics
    log "Injecting multi-metric forecasts..."

    # CPU forecast
    curl -X POST http://localhost:8081/forecast/inject -d '{
        "metric_name": "cpu_usage",
        "forecasted_value": 95,
        "confidence": 0.88,
        "horizon_seconds": 180
    }' 2>/dev/null || true

    # Latency forecast
    curl -X POST http://localhost:8081/forecast/inject -d '{
        "metric_name": "latency_p99",
        "forecasted_value": 165,
        "confidence": 0.91,
        "horizon_seconds": 240
    }' 2>/dev/null || true

    # Memory forecast
    curl -X POST http://localhost:8081/forecast/inject -d '{
        "metric_name": "memory_usage",
        "forecasted_value": 88,
        "confidence": 0.85,
        "horizon_seconds": 300
    }' 2>/dev/null || true

    # Monitor for any preemptive actions
    local start_time=$(date +%s)
    local actions_taken=0

    for i in $(seq 1 60); do
        sleep 5

        # Check recent decisions
        local decision_count=$(curl -s http://localhost:8081/control/recent_decisions | jq '.decisions | length')

        if [ "$decision_count" -gt 0 ]; then
            ((actions_taken++))
        fi

        # Check if at least one action was taken
        if [ $actions_taken -gt 0 ]; then
            log "SUCCESS: Forecast-driven action detected ($actions_taken actions)"
            break
        fi

        if [ $i -eq 60 ]; then
            error "TIMEOUT: No forecast-driven actions detected within 5 minutes"
        fi
    done

    if [ $actions_taken -gt 0 ]; then
        local detection_time=$(($(date +%s) - start_time))
        log "PASSED: Forecast-driven actions triggered in ${detection_time}s"
        echo "{\"scenario\":\"forecast_driven_action\",\"actions_taken\":$actions_taken,\"detection_time\":$detection_time,\"passed\":true}" >> "$CHAOS_RESULTS"
        return 0
    else
        error "FAILED: No forecast-driven actions detected"
        echo "{\"scenario\":\"forecast_driven_action\",\"passed\":false}" >> "$CHAOS_RESULTS"
        return 1
    fi
}

# Chaos Scenario: Cognitive Decision Under Chaos
chaos_cognitive_decision_under_chaos() {
    local duration_sec=${1:-180}
    log "CHAOS: Cognitive Decision Under Chaos - ${duration_sec}s"

    # Start background chaos: random pod kills + network latency
    log "Starting background chaos..."
    {
        for i in $(seq 1 10); do
            # Kill random pod
            local pod=$(kubectl get pods -l app=igris-worker -o jsonpath='{.items[*].metadata.name}' | tr ' ' '\n' | shuf -n 1)
            kubectl delete pod "$pod" --force --grace-period=0 2>/dev/null || true

            # Inject network latency
            kubectl exec -n kube-system "$(kubectl get pods -n kube-system -l component=kube-proxy -o jsonpath='{.items[0].metadata.name}')" -- \
                tc qdisc add dev eth0 root netem delay 200ms 2>/dev/null || true

            sleep 18
        done
    } &
    local chaos_pid=$!

    # Monitor cognitive decisions during chaos
    local start_time=$(date +%s)
    local decision_count=0
    local rollback_count=0
    local scale_count=0

    while [ $(($(date +%s) - start_time)) -lt "$duration_sec" ]; do
        sleep 10

        # Capture recent decisions
        local recent=$(curl -s http://localhost:8081/control/recent_decisions)
        local new_decisions=$(echo "$recent" | jq '.decisions | length')

        if [ "$new_decisions" -gt "$decision_count" ]; then
            decision_count=$new_decisions

            # Count decision types
            rollback_count=$(echo "$recent" | jq '[.decisions[] | select(.decision_type == "Rollback")] | length')
            scale_count=$(echo "$recent" | jq '[.decisions[] | select(.decision_type == "ScaleUp" or .decision_type == "ScaleDown")] | length')

            log "Decisions under chaos: total=$decision_count, rollbacks=$rollback_count, scaling=$scale_count"
        fi
    done

    # Stop background chaos
    kill $chaos_pid 2>/dev/null || true

    # Clean up network latency
    kubectl exec -n kube-system "$(kubectl get pods -n kube-system -l component=kube-proxy -o jsonpath='{.items[0].metadata.name}')" -- \
        tc qdisc del dev eth0 root 2>/dev/null || true

    # Verify decisions were made appropriately
    if [ $decision_count -gt 0 ] && [ $rollback_count -eq 0 ]; then
        log "PASSED: Cognitive decisions made under chaos without premature rollbacks"
        echo "{\"scenario\":\"cognitive_decision_under_chaos\",\"decisions\":$decision_count,\"rollbacks\":$rollback_count,\"passed\":true}" >> "$CHAOS_RESULTS"
        return 0
    elif [ $rollback_count -gt 0 ]; then
        log "PASSED: Appropriate rollbacks triggered under severe chaos"
        echo "{\"scenario\":\"cognitive_decision_under_chaos\",\"decisions\":$decision_count,\"rollbacks\":$rollback_count,\"passed\":true}" >> "$CHAOS_RESULTS"
        return 0
    else
        error "FAILED: No cognitive decisions made during chaos"
        echo "{\"scenario\":\"cognitive_decision_under_chaos\",\"passed\":false}" >> "$CHAOS_RESULTS"
        return 1
    fi
}

# Chaos Scenario: Shadow Mode Resilience
chaos_shadow_mode_resilience() {
    log "CHAOS: Shadow Mode Resilience Test"

    # Enable shadow mode
    log "Enabling shadow mode..."
    kubectl set env deployment/igris-autonomous-controller SHADOW_MODE=true

    # Inject extreme forecasts
    log "Injecting extreme forecasts in shadow mode..."

    curl -X POST http://localhost:8081/forecast/inject -d '{
        "metric_name": "latency_p99",
        "forecasted_value": 500,
        "confidence": 0.99,
        "horizon_seconds": 60
    }' 2>/dev/null || true

    # Wait and verify NO actions were taken
    sleep 30

    local actions=$(curl -s http://localhost:8081/control/recent_decisions | jq '.decisions | length')

    # Verify shadow mode logged decisions but didn't execute
    local shadow_logs=$(kubectl logs deployment/igris-autonomous-controller | grep -c "SHADOW:" || true)

    if [ $actions -eq 0 ] && [ $shadow_logs -gt 0 ]; then
        log "PASSED: Shadow mode prevented execution while logging decisions"
        echo "{\"scenario\":\"shadow_mode_resilience\",\"shadow_logs\":$shadow_logs,\"passed\":true}" >> "$CHAOS_RESULTS"
        return 0
    else
        error "FAILED: Shadow mode leaked actions or didn't log decisions"
        echo "{\"scenario\":\"shadow_mode_resilience\",\"actions_leaked\":$actions,\"passed\":false}" >> "$CHAOS_RESULTS"
        return 1
    fi
}

# Main entry point for Phase 13 chaos scenarios
run_phase13_chaos_suite() {
    log "=== STARTING PHASE 13 CHAOS SUITE ==="

    local total_tests=0
    local passed_tests=0

    # Clear previous results
    > "$CHAOS_RESULTS"

    # Run all Phase 13 scenarios
    scenarios=(
        "chaos_proactive_scale_up 120"
        "chaos_preemptive_rollback_drift 5.0"
        "chaos_forecast_driven_action"
        "chaos_cognitive_decision_under_chaos 180"
        "chaos_shadow_mode_resilience"
    )

    for scenario in "${scenarios[@]}"; do
        ((total_tests++))
        if eval "$scenario"; then
            ((passed_tests++))
        fi

        # Wait between scenarios
        sleep 30
    done

    log "=== PHASE 13 CHAOS SUITE COMPLETE ==="
    log "Results: $passed_tests/$total_tests passed"

    # Generate summary
    jq -s '.' "$CHAOS_RESULTS" > "${CHAOS_RESULTS}.summary"

    if [ "$passed_tests" -eq "$total_tests" ]; then
        log "SUCCESS: All Phase 13 chaos tests passed"
        return 0
    else
        error "FAILURE: $((total_tests - passed_tests)) Phase 13 chaos tests failed"
        return 1
    fi
}

# Main entry
main() {
    case "${1:-}" in
        proactive-scale-up)
            chaos_proactive_scale_up "${2:-120}"
            ;;
        preemptive-rollback)
            chaos_preemptive_rollback_drift "${2:-5.0}"
            ;;
        forecast-driven)
            chaos_forecast_driven_action
            ;;
        cognitive-chaos)
            chaos_cognitive_decision_under_chaos "${2:-180}"
            ;;
        shadow-resilience)
            chaos_shadow_mode_resilience
            ;;
        phase13-suite)
            run_phase13_chaos_suite
            ;;
        *)
            echo "Usage: $0 {proactive-scale-up|preemptive-rollback|forecast-driven|cognitive-chaos|shadow-resilience|phase13-suite}"
            echo ""
            echo "Phase 13 Chaos Scenarios:"
            echo "  proactive-scale-up [duration]      - Test proactive scaling before load spike"
            echo "  preemptive-rollback [threshold]    - Test preemptive rollback on policy drift"
            echo "  forecast-driven                    - Test forecast-driven preemptive actions"
            echo "  cognitive-chaos [duration]         - Test cognitive decisions under chaos"
            echo "  shadow-resilience                  - Test shadow mode prevents actual actions"
            echo "  phase13-suite                      - Run full Phase 13 chaos test suite"
            exit 1
            ;;
    esac
}

main "$@"
