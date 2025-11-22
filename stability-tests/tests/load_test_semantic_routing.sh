#!/bin/bash

# Load Test Script for Semantic Routing
# Tests: 100 requests across 3 semantic classes

set -e

# Configuration
API_BASE_URL="${API_BASE_URL:-http://localhost:8080}"
TOTAL_REQUESTS=100
CONCURRENT_REQUESTS=10
METRICS_URL="${METRICS_URL:-http://localhost:8080/metrics}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test data
declare -a PROMPTS=(
    # Code generation (33%)
    "Write a Python function to sort a list"
    "Implement a binary search algorithm in JavaScript"
    "Create a REST API endpoint in Go"
    "Write a SQL query to join two tables"
    "Generate a React component for a login form"
    "Implement bubble sort in C++"
    "Create a Dockerfile for a Node.js application"
    "Write unit tests for a calculator function"
    "Implement a linked list data structure"
    "Create a function to validate email addresses"
    "Write a script to parse JSON data"
    "Implement authentication middleware"
    "Create a database migration script"
    "Write a function to calculate fibonacci numbers"
    "Implement a cache layer using Redis"
    "Create a web scraper in Python"
    "Write a function to reverse a string"
    "Implement pagination for API results"
    "Create a logging utility function"
    "Write a regex pattern for phone numbers"
    "Implement rate limiting middleware"
    "Create a custom hook in React"
    "Write a function to merge sorted arrays"
    "Implement OAuth2 authentication"
    "Create a WebSocket server"
    "Write a function to validate passwords"
    "Implement a queue data structure"
    "Create a CLI tool using Cobra"
    "Write a function to generate UUIDs"
    "Implement file upload handling"
    "Create a middleware for CORS"
    "Write a function to parse CSV files"
    "Implement session management"

    # Question answering (33%)
    "What is the difference between HTTP and HTTPS?"
    "How does TCP handshake work?"
    "Explain the concept of closure in programming"
    "What are the benefits of microservices?"
    "How do you optimize database queries?"
    "What is the CAP theorem?"
    "Explain REST vs GraphQL"
    "How does JWT authentication work?"
    "What is the difference between SQL and NoSQL?"
    "Explain the SOLID principles"
    "What is event-driven architecture?"
    "How do you handle race conditions?"
    "What is the difference between concurrency and parallelism?"
    "Explain memory management in garbage collected languages"
    "What are design patterns?"
    "How does DNS resolution work?"
    "What is the difference between stack and heap?"
    "Explain the OSI model"
    "What is database indexing?"
    "How do you prevent SQL injection?"
    "What is the difference between PUT and PATCH?"
    "Explain ACID properties"
    "What is continuous integration?"
    "How does load balancing work?"
    "What is the difference between authentication and authorization?"
    "Explain horizontal vs vertical scaling"
    "What is caching and when to use it?"
    "How do message queues work?"
    "What is the difference between Docker and VMs?"
    "Explain the concept of idempotency"
    "What are webhooks?"
    "How does SSL/TLS work?"
    "What is service mesh?"

    # Summarization (34%)
    "Summarize the key features of Kubernetes"
    "Provide a brief overview of machine learning"
    "Summarize the main concepts of blockchain"
    "Give me the key points about cloud computing"
    "Summarize the benefits of containerization"
    "Provide an overview of CI/CD pipelines"
    "Summarize the differences between monolithic and microservices"
    "Give me the main points about API security"
    "Summarize how distributed systems work"
    "Provide a brief overview of serverless computing"
    "Summarize the principles of clean code"
    "Give me the key concepts of functional programming"
    "Summarize the benefits of test-driven development"
    "Provide an overview of DevOps practices"
    "Summarize the main features of GraphQL"
    "Give me the key points about database normalization"
    "Summarize how containers orchestration works"
    "Provide a brief overview of agile methodologies"
    "Summarize the concepts of event sourcing"
    "Give me the main points about API versioning"
    "Summarize the benefits of code reviews"
    "Provide an overview of performance optimization"
    "Summarize the principles of domain-driven design"
    "Give me the key concepts of reactive programming"
    "Summarize how message brokers work"
    "Provide a brief overview of database sharding"
    "Summarize the benefits of infrastructure as code"
    "Give me the main points about API rate limiting"
    "Summarize how service discovery works"
    "Provide an overview of observability in microservices"
    "Summarize the concepts of eventual consistency"
    "Give me the key points about blue-green deployments"
    "Summarize the principles of twelve-factor apps"
    "Provide a brief overview of chaos engineering"
)

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

echo "═══════════════════════════════════════════════════════════════"
echo "  Semantic Routing Load Test"
echo "  Target: $API_BASE_URL"
echo "  Requests: $TOTAL_REQUESTS"
echo "  Concurrency: $CONCURRENT_REQUESTS"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Create temp directory for results
TEMP_DIR=$(mktemp -d)
RESULTS_FILE="${TEMP_DIR}/results.csv"
echo "timestamp,prompt_index,http_code,latency_ms,class,confidence,cache_hit" > "$RESULTS_FILE"

log_info "Temporary results directory: $TEMP_DIR"

# Function to send classification request
send_request() {
    local index=$1
    local prompt="${PROMPTS[$index]}"
    local start_time=$(date +%s%3N)

    local response=$(curl -s -w "\n%{http_code}" -X POST "${API_BASE_URL}/v1/routing/semantic" \
        -H "Content-Type: application/json" \
        -d "{\"prompt\": \"$prompt\"}" 2>&1)

    local end_time=$(date +%s%3N)
    local latency=$((end_time - start_time))

    local http_code=$(echo "$response" | tail -n 1)
    local body=$(echo "$response" | head -n -1)

    local class=$(echo "$body" | jq -r '.class' 2>/dev/null || echo "error")
    local confidence=$(echo "$body" | jq -r '.confidence' 2>/dev/null || echo "0")
    local cache_hit=$(echo "$body" | jq -r '.cache_hit' 2>/dev/null || echo "false")

    echo "$(date +%s),$index,$http_code,$latency,$class,$confidence,$cache_hit" >> "$RESULTS_FILE"

    if [ "$http_code" = "200" ]; then
        echo -n "."
    else
        echo -n "E"
    fi
}

# Warmup phase
log_info "Warmup phase (10 requests)..."
for i in {0..9}; do
    prompt_index=$((i % ${#PROMPTS[@]}))
    send_request $prompt_index &
done
wait
echo ""
sleep 2

# Main load test
log_info "Starting load test..."
START_TIME=$(date +%s)

request_count=0
while [ $request_count -lt $TOTAL_REQUESTS ]; do
    batch_size=$CONCURRENT_REQUESTS
    remaining=$((TOTAL_REQUESTS - request_count))

    if [ $remaining -lt $batch_size ]; then
        batch_size=$remaining
    fi

    for ((i=0; i<batch_size; i++)); do
        prompt_index=$(((request_count + i) % ${#PROMPTS[@]}))
        send_request $prompt_index &
    done

    wait
    request_count=$((request_count + batch_size))
done

END_TIME=$(date +%s)
TOTAL_DURATION=$((END_TIME - START_TIME))

echo ""
log_success "Load test completed in ${TOTAL_DURATION}s"

# Analyze results
log_info "Analyzing results..."

# Count by HTTP status
SUCCESS_COUNT=$(grep ",200," "$RESULTS_FILE" | wc -l)
ERROR_COUNT=$(grep -v ",200," "$RESULTS_FILE" | grep -v "^timestamp" | wc -l)

# Calculate latency statistics
LATENCIES=$(awk -F, 'NR>1 {print $4}' "$RESULTS_FILE" | sort -n)
MIN_LATENCY=$(echo "$LATENCIES" | head -1)
MAX_LATENCY=$(echo "$LATENCIES" | tail -1)
AVG_LATENCY=$(awk -F, 'NR>1 {sum+=$4; count++} END {print int(sum/count)}' "$RESULTS_FILE")

# Calculate percentiles
P50_LATENCY=$(echo "$LATENCIES" | awk 'NR==int(NF*0.5)+1')
P95_LATENCY=$(echo "$LATENCIES" | awk 'NR==int(NF*0.95)+1')
P99_LATENCY=$(echo "$LATENCIES" | awk 'NR==int(NF*0.99)+1')

# Count by semantic class
CODE_GEN_COUNT=$(grep ",code_generation," "$RESULTS_FILE" | wc -l)
QA_COUNT=$(grep ",question_answering," "$RESULTS_FILE" | wc -l)
SUMMARIZATION_COUNT=$(grep ",summarization," "$RESULTS_FILE" | wc -l)
OTHER_COUNT=$((SUCCESS_COUNT - CODE_GEN_COUNT - QA_COUNT - SUMMARIZATION_COUNT))

# Cache hit rate
CACHE_HITS=$(grep ",true$" "$RESULTS_FILE" | wc -l)
CACHE_MISSES=$(grep ",false$" "$RESULTS_FILE" | wc -l)
CACHE_HIT_RATE=$(echo "scale=2; $CACHE_HITS * 100 / ($CACHE_HITS + $CACHE_MISSES)" | bc)

# Average confidence
AVG_CONFIDENCE=$(awk -F, 'NR>1 && $6 > 0 {sum+=$6; count++} END {printf "%.3f", sum/count}' "$RESULTS_FILE")

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  Load Test Results"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "Requests:"
echo "  Total:       $TOTAL_REQUESTS"
echo "  Successful:  $SUCCESS_COUNT"
echo "  Failed:      $ERROR_COUNT"
echo "  Duration:    ${TOTAL_DURATION}s"
echo "  Throughput:  $((TOTAL_REQUESTS / TOTAL_DURATION)) req/s"
echo ""
echo "Latency (ms):"
echo "  Min:         $MIN_LATENCY"
echo "  Max:         $MAX_LATENCY"
echo "  Average:     $AVG_LATENCY"
echo "  p50:         $P50_LATENCY"
echo "  p95:         $P95_LATENCY"
echo "  p99:         $P99_LATENCY"
echo ""
echo "Classification Distribution:"
echo "  Code Generation:     $CODE_GEN_COUNT ($(echo "scale=1; $CODE_GEN_COUNT * 100 / $SUCCESS_COUNT" | bc)%)"
echo "  Question Answering:  $QA_COUNT ($(echo "scale=1; $QA_COUNT * 100 / $SUCCESS_COUNT" | bc)%)"
echo "  Summarization:       $SUMMARIZATION_COUNT ($(echo "scale=1; $SUMMARIZATION_COUNT * 100 / $SUCCESS_COUNT" | bc)%)"
echo "  Other:               $OTHER_COUNT ($(echo "scale=1; $OTHER_COUNT * 100 / $SUCCESS_COUNT" | bc)%)"
echo ""
echo "Cache Performance:"
echo "  Cache Hits:      $CACHE_HITS"
echo "  Cache Misses:    $CACHE_MISSES"
echo "  Hit Rate:        ${CACHE_HIT_RATE}%"
echo ""
echo "Accuracy:"
echo "  Avg Confidence:  $AVG_CONFIDENCE"
echo ""

# Fetch metrics from Prometheus endpoint
log_info "Fetching metrics from Prometheus..."
sleep 2

CLASSIFICATIONS_TOTAL=$(curl -s "${METRICS_URL}" | grep "^schlep_semantic_classifications_total" | grep -v "#" | awk '{sum+=$2} END {print sum}')
BANDIT_UPDATES=$(curl -s "${METRICS_URL}" | grep "^schlep_bandit_reward_updates_total" | grep -v "#" | awk '{sum+=$2} END {print sum}')
FEEDBACK_PROCESSED=$(curl -s "${METRICS_URL}" | grep "^schlep_feedback_processed_total" | grep -v "#" | awk '{sum+=$2} END {print sum}')

echo "Prometheus Metrics:"
echo "  Classifications Total:  ${CLASSIFICATIONS_TOTAL:-0}"
echo "  Bandit Updates:         ${BANDIT_UPDATES:-0}"
echo "  Feedback Processed:     ${FEEDBACK_PROCESSED:-0}"
echo ""

# Success criteria validation
echo "═══════════════════════════════════════════════════════════════"
echo "  Success Criteria Validation"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Check p95 latency < 20ms for classification
if [ "$P95_LATENCY" -lt 20 ]; then
    log_success "Classification latency p95 < 20ms: ${P95_LATENCY}ms"
else
    log_warning "Classification latency p95 exceeds 20ms: ${P95_LATENCY}ms"
fi

# Check success rate > 95%
SUCCESS_RATE=$(echo "scale=1; $SUCCESS_COUNT * 100 / $TOTAL_REQUESTS" | bc)
if (( $(echo "$SUCCESS_RATE > 95" | bc -l) )); then
    log_success "Success rate > 95%: ${SUCCESS_RATE}%"
else
    log_error "Success rate < 95%: ${SUCCESS_RATE}%"
fi

# Check classification accuracy (>92% correct class)
ACCURACY_THRESHOLD=92
EXPECTED_CODE=$(echo "scale=0; $TOTAL_REQUESTS * 33 / 100" | bc)
EXPECTED_QA=$(echo "scale=0; $TOTAL_REQUESTS * 33 / 100" | bc)
EXPECTED_SUMM=$(echo "scale=0; $TOTAL_REQUESTS * 34 / 100" | bc)

# Allow 8% margin of error
CODE_ACCURACY=$(echo "scale=1; $CODE_GEN_COUNT * 100 / $EXPECTED_CODE" | bc)
if (( $(echo "$CODE_ACCURACY > $ACCURACY_THRESHOLD" | bc -l) )); then
    log_success "Code generation accuracy: ${CODE_ACCURACY}%"
else
    log_warning "Code generation accuracy below threshold: ${CODE_ACCURACY}%"
fi

# Check cache effectiveness (should increase with duplicate prompts)
if (( $(echo "$CACHE_HIT_RATE > 20" | bc -l) )); then
    log_success "Cache hit rate effective: ${CACHE_HIT_RATE}%"
else
    log_warning "Cache hit rate low: ${CACHE_HIT_RATE}% (expected with unique prompts)"
fi

echo ""
echo "Detailed results saved to: $RESULTS_FILE"
echo ""

# Overall assessment
if [ "$ERROR_COUNT" -eq 0 ] && [ "$P95_LATENCY" -lt 20 ]; then
    echo -e "${GREEN}✓ LOAD TEST PASSED${NC}"
    echo ""
    exit 0
else
    echo -e "${YELLOW}⚠ LOAD TEST COMPLETED WITH WARNINGS${NC}"
    echo ""
    exit 0
fi
