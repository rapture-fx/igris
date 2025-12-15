#!/bin/bash
set -e

# Igris Runtime v1.4 - Model Benchmark Script
# Compares models on reasoning, coding, math, and performance metrics

BENCHMARK_DIR="benchmark_results"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
RESULTS_FILE="$BENCHMARK_DIR/benchmark_${TIMESTAMP}.json"
CONFIG_FILE="config.json5"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}======================================"
echo "Igris Runtime v1.4 Model Benchmarking"
echo "======================================${NC}"
echo ""

# Create benchmark directory
mkdir -p "$BENCHMARK_DIR"

# Benchmark test cases
declare -a REASONING_TESTS=(
    "Explain why the sky appears blue during the day."
    "If you have 3 apples and give away 2, then receive 5 more, how many apples do you have?"
    "What is the capital of France and why is it historically significant?"
)

declare -a CODING_TESTS=(
    "Write a Python function to check if a string is a palindrome."
    "Create a JavaScript function that reverses an array in-place."
    "Write a function in any language that finds the factorial of a number recursively."
)

declare -a MATH_TESTS=(
    "Solve: 2x + 5 = 13"
    "What is the square root of 144?"
    "Calculate: (3 + 5) * 2 - 4"
)

# Model list (update based on downloaded models)
declare -a MODELS=("phi-3-mini-4k" "qwen3-8b" "qwen3-14b" "deepseek-v3-2-7b" "glm-4-9b")

# Function to update config with selected model
update_config() {
    local model_id=$1
    echo -e "${BLUE}Switching to model: $model_id${NC}"

    # Backup original config
    cp "$CONFIG_FILE" "${CONFIG_FILE}.backup"

    # Update selected_model in config (simple sed replacement)
    # This assumes the config has a selected_model field
    # For now, we'll create a temporary test config
    cat > "test-benchmark-config.json5" <<EOF
{
  server: { host: "127.0.0.1", port: 8080 },
  storage: { path: "igris.db" },
  local_fallback: {
    enabled: true,
    selected_model: "$model_id",
    context_size: 8192,
    threads: 4,
    max_tokens: 512,
    temperature: 0.7,
    cost_per_1k_tokens: 0.0
  },
  lora_training: { enabled: false },
  providers: [],
  routing: {
    thompson_sampling: { enabled: false },
    speculative: { enabled: false },
    council: { enabled: false }
  },
  auth: { api_key: "benchmark-key" }
}
EOF
}

# Function to test a single prompt
test_prompt() {
    local prompt=$1
    local category=$2
    local model=$3

    local start_time=$(date +%s%N)

    # Call the local LLM via API
    local response=$(curl -s -X POST http://localhost:8080/v1/infer \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer benchmark-key" \
        -d "{\"model\":\"local\",\"messages\":[{\"role\":\"user\",\"content\":\"$prompt\"}],\"max_tokens\":512}")

    local end_time=$(date +%s%N)
    local latency_ms=$(( (end_time - start_time) / 1000000 ))

    # Extract response text (basic JSON parsing)
    local response_text=$(echo "$response" | grep -o '"content":"[^"]*"' | sed 's/"content":"//' | sed 's/"$//')

    # Count tokens (rough estimate: ~4 chars per token)
    local response_length=${#response_text}
    local estimated_tokens=$(( response_length / 4 ))

    # Calculate tokens per second
    local tokens_per_sec=0
    if [ "$latency_ms" -gt 0 ]; then
        tokens_per_sec=$(( (estimated_tokens * 1000) / latency_ms ))
    fi

    echo "$response_text|$latency_ms|$estimated_tokens|$tokens_per_sec"
}

# Function to benchmark a single model
benchmark_model() {
    local model_id=$1
    local model_file="models/${model_id}.gguf"

    # Check if model exists
    if [ ! -f "models/"*"$model_id"* ] && [ ! -f "$model_file" ]; then
        echo -e "${YELLOW}Model $model_id not found, skipping...${NC}"
        return
    fi

    echo -e "${GREEN}======================================"
    echo "Benchmarking: $model_id"
    echo "======================================${NC}"

    # Update config
    update_config "$model_id"

    # Restart server (if running)
    # pkill -f igris-server || true
    # sleep 2
    # cargo run --release --bin igris-server -- --config test-benchmark-config.json5 &
    # SERVER_PID=$!
    # sleep 5

    echo -e "${BLUE}Note: Please start the server with test-benchmark-config.json5 manually${NC}"
    read -p "Press Enter when server is ready..."

    local total_latency=0
    local total_tokens=0
    local test_count=0

    # Test reasoning
    echo -e "${YELLOW}Testing reasoning capabilities...${NC}"
    for test in "${REASONING_TESTS[@]}"; do
        result=$(test_prompt "$test" "reasoning" "$model_id")
        latency=$(echo "$result" | cut -d'|' -f2)
        tokens=$(echo "$result" | cut -d'|' -f3)
        total_latency=$((total_latency + latency))
        total_tokens=$((total_tokens + tokens))
        test_count=$((test_count + 1))
        echo "  ✓ Test $test_count: ${latency}ms, ${tokens} tokens"
    done

    # Test coding
    echo -e "${YELLOW}Testing coding capabilities...${NC}"
    for test in "${CODING_TESTS[@]}"; do
        result=$(test_prompt "$test" "coding" "$model_id")
        latency=$(echo "$result" | cut -d'|' -f2)
        tokens=$(echo "$result" | cut -d'|' -f3)
        total_latency=$((total_latency + latency))
        total_tokens=$((total_tokens + tokens))
        test_count=$((test_count + 1))
        echo "  ✓ Test $test_count: ${latency}ms, ${tokens} tokens"
    done

    # Test math
    echo -e "${YELLOW}Testing math capabilities...${NC}"
    for test in "${MATH_TESTS[@]}"; do
        result=$(test_prompt "$test" "math" "$model_id")
        latency=$(echo "$result" | cut -d'|' -f2)
        tokens=$(echo "$result" | cut -d'|' -f3)
        total_latency=$((total_latency + latency))
        total_tokens=$((total_tokens + tokens))
        test_count=$((test_count + 1))
        echo "  ✓ Test $test_count: ${latency}ms, ${tokens} tokens"
    done

    # Calculate averages
    local avg_latency=$((total_latency / test_count))
    local avg_tokens=$((total_tokens / test_count))
    local avg_tokens_per_sec=$((avg_tokens * 1000 / avg_latency))

    echo ""
    echo -e "${GREEN}Results for $model_id:${NC}"
    echo "  Average Latency: ${avg_latency}ms"
    echo "  Average Tokens: ${avg_tokens}"
    echo "  Average Speed: ${avg_tokens_per_sec} tokens/sec"
    echo ""

    # Save results to JSON
    cat >> "$RESULTS_FILE" <<EOF
{
  "model": "$model_id",
  "timestamp": "$(date -Iseconds)",
  "tests_run": $test_count,
  "avg_latency_ms": $avg_latency,
  "avg_tokens": $avg_tokens,
  "avg_tokens_per_sec": $avg_tokens_per_sec
},
EOF

    # Stop server
    # kill $SERVER_PID || true
    # sleep 2

    echo "Press Enter to continue to next model..."
    read
}

# Main benchmark loop
echo "Starting benchmark suite..."
echo "This will test all available models on reasoning, coding, and math tasks."
echo ""
echo "Available models to benchmark:"
for model in "${MODELS[@]}"; do
    echo "  - $model"
done
echo ""

read -p "Press Enter to start benchmarking (or Ctrl+C to cancel)..."

# Initialize results file
echo "[" > "$RESULTS_FILE"

# Benchmark each model
for model in "${MODELS[@]}"; do
    benchmark_model "$model"
done

# Finalize results file
echo "{}]" >> "$RESULTS_FILE"

# Restore original config
if [ -f "${CONFIG_FILE}.backup" ]; then
    mv "${CONFIG_FILE}.backup" "$CONFIG_FILE"
fi

echo -e "${GREEN}======================================"
echo "Benchmarking Complete!"
echo "======================================${NC}"
echo ""
echo "Results saved to: $RESULTS_FILE"
echo ""
echo -e "${BLUE}Summary:${NC}"
cat "$RESULTS_FILE"
echo ""
echo -e "${YELLOW}For detailed analysis, see the JSON file.${NC}"
echo ""
