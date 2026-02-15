#!/bin/bash
# Chaos-as-a-Service Harness for Phase 12
# Continuously validate autonomy with intermittent, scheduled chaos tests

set -euo pipefail

CHAOS_LOG="/var/log/igris/chaos_harness.log"
CHAOS_RESULTS="/var/log/igris/chaos_results.json"
CHAOS_CONFIG="${CHAOS_CONFIG:-/etc/igris/chaos_config.json}"

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*" | tee -a "$CHAOS_LOG"
}

error() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $*" | tee -a "$CHAOS_LOG" >&2
}

# Chaos Scenario: Node Kill
chaos_node_kill() {
    local node_id=${1:-}
    log "CHAOS: Node Kill - Target: ${node_id}"

    # Kill random node if not specified
    if [ -z "$node_id" ]; then
        node_id=$(kubectl get nodes -o jsonpath='{.items[*].metadata.name}' | tr ' ' '\n' | shuf -n 1)
    fi

    log "Killing node: $node_id"
    kubectl drain "$node_id" --ignore-daemonsets --delete-emptydir-data --force
    kubectl delete node "$node_id"

    # Wait for recovery
    local start_time=$(date +%s)
    while true; do
        local ready_nodes=$(kubectl get nodes --no-headers | grep -c " Ready " || true)
        if [ "$ready_nodes" -ge 3 ]; then
            local end_time=$(date +%s)
            local recovery_time=$((end_time - start_time))
            log "RECOVERY: Node cluster recovered in ${recovery_time}s"
            echo "{\"scenario\":\"node_kill\",\"recovery_time\":$recovery_time,\"passed\":true}" >> "$CHAOS_RESULTS"
            return 0
        fi

        if [ $(($(date +%s) - start_time)) -gt 300 ]; then
            error "FAILED: Node recovery timeout after 5 minutes"
            echo "{\"scenario\":\"node_kill\",\"recovery_time\":300,\"passed\":false}" >> "$CHAOS_RESULTS"
            return 1
        fi
        sleep 5
    done
}

# Chaos Scenario: Network Latency
chaos_network_latency() {
    local latency_ms=${1:-500}
    local duration_sec=${2:-60}
    log "CHAOS: Network Latency - ${latency_ms}ms for ${duration_sec}s"

    # Inject latency using tc (traffic control)
    local nodes=$(kubectl get nodes -o jsonpath='{.items[*].metadata.name}')

    for node in $nodes; do
        kubectl exec -n kube-system "$(kubectl get pods -n kube-system -l component=kube-proxy -o jsonpath='{.items[0].metadata.name}')" -- \
            tc qdisc add dev eth0 root netem delay "${latency_ms}ms" 2>/dev/null || true
    done

    log "Latency injected, monitoring for ${duration_sec}s"
    local start_time=$(date +%s)
    sleep "$duration_sec"

    # Remove latency
    for node in $nodes; do
        kubectl exec -n kube-system "$(kubectl get pods -n kube-system -l component=kube-proxy -o jsonpath='{.items[0].metadata.name}')" -- \
            tc qdisc del dev eth0 root 2>/dev/null || true
    done

    local end_time=$(date +%s)
    local elapsed=$((end_time - start_time))

    # Check if system remained stable
    local slo_breaches=$(curl -s http://localhost:9200/_search -d '{
        "query": {
            "bool": {
                "must": [
                    {"match": {"status": "breached"}},
                    {"range": {"timestamp": {"gte": '"$start_time"'}}}
                ]
            }
        }
    }' | jq '.hits.total.value')

    if [ "$slo_breaches" -eq 0 ]; then
        log "PASSED: Network latency test, no SLO breaches"
        echo "{\"scenario\":\"network_latency\",\"latency_ms\":$latency_ms,\"slo_breaches\":0,\"passed\":true}" >> "$CHAOS_RESULTS"
        return 0
    else
        error "FAILED: Network latency caused $slo_breaches SLO breaches"
        echo "{\"scenario\":\"network_latency\",\"latency_ms\":$latency_ms,\"slo_breaches\":$slo_breaches,\"passed\":false}" >> "$CHAOS_RESULTS"
        return 1
    fi
}

# Chaos Scenario: Disk IO Pressure
chaos_disk_io_pressure() {
    local duration_sec=${1:-120}
    log "CHAOS: Disk IO Pressure for ${duration_sec}s"

    # Use stress-ng or dd to create disk pressure
    local pods=$(kubectl get pods -l app=igris-worker -o jsonpath='{.items[*].metadata.name}')

    for pod in $pods; do
        kubectl exec "$pod" -- sh -c "
            for i in {1..10}; do
                dd if=/dev/zero of=/tmp/chaos_io_\$i bs=1M count=100 oflag=direct &
            done
        " 2>/dev/null || true
    done

    sleep "$duration_sec"

    # Cleanup
    for pod in $pods; do
        kubectl exec "$pod" -- sh -c "rm -f /tmp/chaos_io_* && pkill dd" 2>/dev/null || true
    done

    # Check recovery time and SLO impact
    local p99_latency=$(curl -s http://localhost:8081/metrics | grep p99_latency_ms | awk '{print $2}')

    if [ "${p99_latency%.*}" -lt 150 ]; then
        log "PASSED: Disk IO pressure test, p99=${p99_latency}ms"
        echo "{\"scenario\":\"disk_io_pressure\",\"p99_latency\":$p99_latency,\"passed\":true}" >> "$CHAOS_RESULTS"
        return 0
    else
        error "FAILED: Disk IO pressure caused p99=${p99_latency}ms (> 150ms)"
        echo "{\"scenario\":\"disk_io_pressure\",\"p99_latency\":$p99_latency,\"passed\":false}" >> "$CHAOS_RESULTS"
        return 1
    fi
}

# Chaos Scenario: Mempool Pressure
chaos_mempool_pressure() {
    local duration_sec=${1:-60}
    log "CHAOS: Mempool Pressure for ${duration_sec}s"

    # Allocate large objects to stress memory pool
    local pods=$(kubectl get pods -l app=igris-worker -o jsonpath='{.items[*].metadata.name}')

    for pod in $pods; do
        kubectl exec "$pod" -- sh -c "
            python3 -c '
import time
large_list = []
for _ in range(1000):
    large_list.append(bytearray(10 * 1024 * 1024))  # 10MB each
time.sleep($duration_sec)
' " &
    done

    sleep "$duration_sec"

    # Kill memory pressure processes
    pkill -f "python3 -c" || true

    # Check memory recovery
    local mem_usage=$(kubectl top nodes | awk 'NR>1 {sum+=$5} END {print sum/NR}')

    if [ "${mem_usage%\%}" -lt 80 ]; then
        log "PASSED: Mempool pressure test, memory recovered to ${mem_usage}%"
        echo "{\"scenario\":\"mempool_pressure\",\"mem_usage_pct\":${mem_usage%\%},\"passed\":true}" >> "$CHAOS_RESULTS"
        return 0
    else
        error "FAILED: Mempool pressure, memory still at ${mem_usage}%"
        echo "{\"scenario\":\"mempool_pressure\",\"mem_usage_pct\":${mem_usage%\%},\"passed\":false}" >> "$CHAOS_RESULTS"
        return 1
    fi
}

# Chaos Scenario: Random Pod Kills
chaos_random_pod_kills() {
    local count=${1:-5}
    local interval_sec=${2:-30}
    log "CHAOS: Random Pod Kills - $count pods every ${interval_sec}s"

    local failures=0
    local start_time=$(date +%s)

    for i in $(seq 1 "$count"); do
        local pod=$(kubectl get pods -l app=igris-worker -o jsonpath='{.items[*].metadata.name}' | tr ' ' '\n' | shuf -n 1)
        log "Killing pod: $pod"
        kubectl delete pod "$pod" --force --grace-period=0

        sleep "$interval_sec"

        # Check if all pods recovered
        local ready_pods=$(kubectl get pods -l app=igris-worker --no-headers | grep -c "Running" || true)
        if [ "$ready_pods" -lt 3 ]; then
            ((failures++))
        fi
    done

    local end_time=$(date +%s)
    local total_time=$((end_time - start_time))

    if [ "$failures" -eq 0 ]; then
        log "PASSED: Random pod kills test, all pods recovered"
        echo "{\"scenario\":\"random_pod_kills\",\"count\":$count,\"failures\":0,\"duration\":$total_time,\"passed\":true}" >> "$CHAOS_RESULTS"
        return 0
    else
        error "FAILED: Random pod kills, $failures recovery failures"
        echo "{\"scenario\":\"random_pod_kills\",\"count\":$count,\"failures\":$failures,\"duration\":$total_time,\"passed\":false}" >> "$CHAOS_RESULTS"
        return 1
    fi
}

# Chaos Scenario: Network Partition
chaos_network_partition() {
    local duration_sec=${1:-60}
    log "CHAOS: Network Partition for ${duration_sec}s"

    # Use iptables to create network partition
    local nodes=$(kubectl get nodes -o jsonpath='{.items[*].metadata.name}' | tr ' ' '\n')
    local node_array=($nodes)
    local half=$((${#node_array[@]} / 2))

    # Partition nodes
    for i in $(seq 0 $((half - 1))); do
        for j in $(seq "$half" $((${#node_array[@]} - 1))); do
            ssh "${node_array[$i]}" "iptables -A INPUT -s ${node_array[$j]} -j DROP" 2>/dev/null || true
            ssh "${node_array[$j]}" "iptables -A INPUT -s ${node_array[$i]} -j DROP" 2>/dev/null || true
        done
    done

    sleep "$duration_sec"

    # Heal partition
    for node in "${node_array[@]}"; do
        ssh "$node" "iptables -F" 2>/dev/null || true
    done

    # Verify cluster recovers
    sleep 30
    local ready_nodes=$(kubectl get nodes --no-headers | grep -c " Ready " || true)

    if [ "$ready_nodes" -ge 3 ]; then
        log "PASSED: Network partition healed successfully"
        echo "{\"scenario\":\"network_partition\",\"duration\":$duration_sec,\"passed\":true}" >> "$CHAOS_RESULTS"
        return 0
    else
        error "FAILED: Network partition recovery incomplete"
        echo "{\"scenario\":\"network_partition\",\"duration\":$duration_sec,\"passed\":false}" >> "$CHAOS_RESULTS"
        return 1
    fi
}

# Verify Rollback Capability
verify_rollback() {
    log "VERIFY: Testing rollback capability"

    # Trigger a known-bad policy
    curl -X POST http://localhost:8081/policy/commit -d '{
        "checkpoint_id": "chaos-test-bad",
        "cache_size": 1,
        "worker_threads": 1
    }'

    sleep 30

    # Check if auto-rollback occurred
    local current_policy=$(curl -s http://localhost:8081/policy/current | jq -r '.checkpoint_id')

    if [ "$current_policy" != "chaos-test-bad" ]; then
        log "PASSED: Auto-rollback detected bad policy"
        echo "{\"scenario\":\"rollback_verification\",\"passed\":true}" >> "$CHAOS_RESULTS"
        return 0
    else
        error "FAILED: Auto-rollback did not trigger"
        echo "{\"scenario\":\"rollback_verification\",\"passed\":false}" >> "$CHAOS_RESULTS"
        return 1
    fi
}

# Run Full Chaos Suite
run_chaos_suite() {
    log "=== STARTING CHAOS SUITE ==="

    local total_tests=0
    local passed_tests=0

    # Clear previous results
    > "$CHAOS_RESULTS"

    # Run all chaos scenarios
    scenarios=(
        "chaos_node_kill"
        "chaos_network_latency 500 60"
        "chaos_disk_io_pressure 120"
        "chaos_mempool_pressure 60"
        "chaos_random_pod_kills 5 30"
        "chaos_network_partition 60"
        "verify_rollback"
    )

    for scenario in "${scenarios[@]}"; do
        ((total_tests++))
        if eval "$scenario"; then
            ((passed_tests++))
        fi

        # Wait between scenarios
        sleep 60
    done

    log "=== CHAOS SUITE COMPLETE ==="
    log "Results: $passed_tests/$total_tests passed"

    # Generate summary
    jq -s '.' "$CHAOS_RESULTS" > "${CHAOS_RESULTS}.summary"

    if [ "$passed_tests" -eq "$total_tests" ]; then
        log "SUCCESS: All chaos tests passed"
        return 0
    else
        error "FAILURE: $((total_tests - passed_tests)) chaos tests failed"
        return 1
    fi
}

# Scheduled Chaos Run (for cron)
scheduled_chaos_run() {
    log "=== SCHEDULED CHAOS RUN (Weekly Canary) ==="

    # Check if we're in production (don't run chaos in prod by default)
    if [ "${CHAOS_ENV:-staging}" = "production" ]; then
        log "SKIPPED: Chaos testing disabled in production (set CHAOS_ENV=production-enabled to override)"
        exit 0
    fi

    run_chaos_suite
}

# Main entry point
main() {
    case "${1:-}" in
        node-kill)
            chaos_node_kill "${2:-}"
            ;;
        network-latency)
            chaos_network_latency "${2:-500}" "${3:-60}"
            ;;
        disk-io)
            chaos_disk_io_pressure "${2:-120}"
            ;;
        mempool)
            chaos_mempool_pressure "${2:-60}"
            ;;
        pod-kills)
            chaos_random_pod_kills "${2:-5}" "${3:-30}"
            ;;
        partition)
            chaos_network_partition "${2:-60}"
            ;;
        rollback)
            verify_rollback
            ;;
        suite)
            run_chaos_suite
            ;;
        scheduled)
            scheduled_chaos_run
            ;;
        *)
            echo "Usage: $0 {node-kill|network-latency|disk-io|mempool|pod-kills|partition|rollback|suite|scheduled}"
            echo ""
            echo "Examples:"
            echo "  $0 node-kill node-1                  # Kill specific node"
            echo "  $0 network-latency 500 60            # 500ms latency for 60s"
            echo "  $0 disk-io 120                       # Disk IO pressure for 120s"
            echo "  $0 mempool 60                        # Memory pressure for 60s"
            echo "  $0 pod-kills 5 30                    # Kill 5 pods, 30s apart"
            echo "  $0 partition 60                      # Network partition for 60s"
            echo "  $0 rollback                          # Verify rollback capability"
            echo "  $0 suite                             # Run full chaos suite"
            echo "  $0 scheduled                         # Weekly scheduled chaos run"
            exit 1
            ;;
    esac
}

main "$@"
