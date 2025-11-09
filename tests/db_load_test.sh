#!/bin/bash
# ============================================================================
# Database Load Test Script
# Simulates 30-day telemetry growth and measures query performance
# ============================================================================

set -euo pipefail

# Configuration
DATABASE_URL="${DATABASE_URL:-postgres://schlep:schlep_ci_password@localhost:5433/schlep_test?sslmode=disable}"
TEST_DURATION_DAYS=30
REQUESTS_PER_DAY=10000
SEMANTIC_CLASSES=("code_generation" "question_answering" "translation" "summarization" "creative_writing" "data_analysis" "conversational" "default")
PROVIDERS=("openai" "anthropic" "cohere" "google")

echo "========================================"
echo "Schlep-Engine Database Load Test"
echo "========================================"
echo "Duration: ${TEST_DURATION_DAYS} days (simulated)"
echo "Requests/day: ${REQUESTS_PER_DAY}"
echo "Total requests: $((TEST_DURATION_DAYS * REQUESTS_PER_DAY))"
echo ""

# Check database connection
echo "[1/7] Verifying database connection..."
if ! psql "$DATABASE_URL" -c "SELECT 1" > /dev/null 2>&1; then
    echo "ERROR: Cannot connect to database"
    exit 1
fi
echo "✓ Database connection successful"

# Get initial table sizes
echo ""
echo "[2/7] Recording initial database size..."
INITIAL_SIZE=$(psql "$DATABASE_URL" -t -c "
    SELECT pg_size_pretty(pg_database_size(current_database()))
")
echo "Initial database size: $INITIAL_SIZE"

# Seed feedback events (simulated 30-day growth)
echo ""
echo "[3/7] Seeding feedback events (30-day simulation)..."
echo "This may take 2-5 minutes..."

START_TIME=$(date +%s)

psql "$DATABASE_URL" <<EOF
DO \$\$
DECLARE
    day_offset INT;
    request_num INT;
    semantic_class TEXT;
    provider TEXT;
    latency FLOAT;
    cost FLOAT;
    success BOOLEAN;
    reward FLOAT;
BEGIN
    FOR day_offset IN 0..${TEST_DURATION_DAYS}-1 LOOP
        FOR request_num IN 1..${REQUESTS_PER_DAY} LOOP
            -- Random semantic class
            semantic_class := (ARRAY['code_generation', 'question_answering', 'translation', 'summarization', 'creative_writing', 'data_analysis', 'conversational', 'default'])[1 + floor(random() * 8)::int];

            -- Random provider
            provider := (ARRAY['openai', 'anthropic', 'cohere', 'google'])[1 + floor(random() * 4)::int];

            -- Random latency (50-300ms)
            latency := 50 + random() * 250;

            -- Random cost (\$0.001-\$0.005)
            cost := 0.001 + random() * 0.004;

            -- Random success (90% success rate)
            success := random() < 0.90;

            -- Composite reward
            IF success THEN
                reward := 0.4 * (1 - latency/500.0) + 0.3 * (1 - cost/0.01) + 0.3 * 1.0;
            ELSE
                reward := 0.0;
            END IF;

            -- Insert feedback event
            INSERT INTO feedback_events (
                semantic_class, provider, latency_ms, cost_usd, success, reward, created_at
            ) VALUES (
                semantic_class, provider, latency, cost, success, reward,
                NOW() - INTERVAL '1 day' * day_offset - INTERVAL '1 second' * request_num
            );

            -- Batch commit every 1000 records
            IF request_num % 1000 = 0 THEN
                COMMIT;
            END IF;
        END LOOP;
    END LOOP;
END \$\$;
EOF

END_TIME=$(date +%s)
SEED_DURATION=$((END_TIME - START_TIME))

echo "✓ Seeded $((TEST_DURATION_DAYS * REQUESTS_PER_DAY)) feedback events in ${SEED_DURATION}s"

# Measure final database size
echo ""
echo "[4/7] Measuring database growth..."
FINAL_SIZE=$(psql "$DATABASE_URL" -t -c "
    SELECT pg_size_pretty(pg_database_size(current_database()))
")
GROWTH_MB=$(psql "$DATABASE_URL" -t -c "
    SELECT ROUND((pg_database_size(current_database()) -
                  (SELECT setting::bigint FROM pg_settings WHERE name = 'segment_size') * 8192) / 1024.0 / 1024.0, 2)
")

echo "Final database size: $FINAL_SIZE"
echo "Growth: ${GROWTH_MB} MB"

# Validate storage growth (should be <10GB per month)
MONTHLY_GROWTH_GB=$(echo "scale=2; ${GROWTH_MB} / ${TEST_DURATION_DAYS} * 30 / 1024" | bc)
echo "Projected monthly growth: ${MONTHLY_GROWTH_GB} GB/month"

if (( $(echo "$MONTHLY_GROWTH_GB > 10" | bc -l) )); then
    echo "⚠️  WARNING: Storage growth exceeds 10GB/month target"
else
    echo "✓ Storage growth within acceptable limits"
fi

# Test query performance
echo ""
echo "[5/7] Testing query performance..."

# Query 1: P95 latency calculation
echo "Query 1: P95 latency by provider (last 7 days)"
QUERY1_START=$(date +%s.%N)
psql "$DATABASE_URL" -c "
    SELECT
        provider,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95_latency_ms,
        COUNT(*) AS request_count
    FROM feedback_events
    WHERE created_at >= NOW() - INTERVAL '7 days'
    GROUP BY provider
    ORDER BY p95_latency_ms DESC;
" > /dev/null
QUERY1_END=$(date +%s.%N)
QUERY1_TIME=$(echo "$QUERY1_END - $QUERY1_START" | bc)
QUERY1_MS=$(echo "$QUERY1_TIME * 1000" | bc | cut -d. -f1)

echo "  ⏱  Query time: ${QUERY1_MS}ms"

# Query 2: Bandit arm aggregation
echo "Query 2: Bandit arm performance (last 24 hours)"
QUERY2_START=$(date +%s.%N)
psql "$DATABASE_URL" -c "
    SELECT
        semantic_class,
        provider,
        AVG(reward) AS avg_reward,
        COUNT(*) AS selections
    FROM feedback_events
    WHERE created_at >= NOW() - INTERVAL '24 hours'
    GROUP BY semantic_class, provider
    ORDER BY semantic_class, avg_reward DESC;
" > /dev/null
QUERY2_END=$(date +%s.%N)
QUERY2_TIME=$(echo "$QUERY2_END - $QUERY2_START" | bc)
QUERY2_MS=$(echo "$QUERY2_TIME * 1000" | bc | cut -d. -f1)

echo "  ⏱  Query time: ${QUERY2_MS}ms"

# Query 3: SLA violation detection
echo "Query 3: SLA violation detection (last hour)"
QUERY3_START=$(date +%s.%N)
psql "$DATABASE_URL" -c "
    SELECT
        provider,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95_latency,
        PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY latency_ms) AS p99_latency,
        SUM(CASE WHEN success THEN 1 ELSE 0 END)::FLOAT / COUNT(*) AS uptime_percent
    FROM feedback_events
    WHERE created_at >= NOW() - INTERVAL '1 hour'
    GROUP BY provider
    HAVING PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) > 150
        OR PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY latency_ms) > 200;
" > /dev/null
QUERY3_END=$(date +%s.%N)
QUERY3_TIME=$(echo "$QUERY3_END - $QUERY3_START" | bc)
QUERY3_MS=$(echo "$QUERY3_TIME * 1000" | bc | cut -d. -f1)

echo "  ⏱  Query time: ${QUERY3_MS}ms"

# Validate query latency (target: <50ms)
echo ""
echo "Query Performance Summary:"
echo "  P95 Latency Query: ${QUERY1_MS}ms"
echo "  Bandit Aggregation Query: ${QUERY2_MS}ms"
echo "  SLA Detection Query: ${QUERY3_MS}ms"

if [[ $QUERY1_MS -lt 50 && $QUERY2_MS -lt 50 && $QUERY3_MS -lt 50 ]]; then
    echo "✓ All queries meet <50ms latency target"
else
    echo "⚠️  WARNING: Some queries exceed 50ms latency target"
fi

# Test write throughput
echo ""
echo "[6/7] Testing write throughput..."
WRITE_START=$(date +%s.%N)

psql "$DATABASE_URL" <<EOF > /dev/null
DO \$\$
DECLARE
    i INT;
BEGIN
    FOR i IN 1..1000 LOOP
        INSERT INTO feedback_events (semantic_class, provider, latency_ms, cost_usd, success, reward)
        VALUES ('code_generation', 'openai', 150.0, 0.002, true, 0.85);
    END LOOP;
END \$\$;
EOF

WRITE_END=$(date +%s.%N)
WRITE_TIME=$(echo "$WRITE_END - $WRITE_START" | bc)
WRITE_TPS=$(echo "1000 / $WRITE_TIME" | bc | cut -d. -f1)

echo "Write throughput: ${WRITE_TPS} TPS (1000 inserts in ${WRITE_TIME}s)"

if [[ $WRITE_TPS -lt 500 ]]; then
    echo "⚠️  WARNING: Write throughput below 500 TPS target"
else
    echo "✓ Write throughput meets target"
fi

# Generate summary report
echo ""
echo "[7/7] Generating summary report..."

cat > db_load_test_results.txt <<EOF
======================================
Schlep-Engine Database Load Test Report
======================================
Test Date: $(date)
Test Duration: ${TEST_DURATION_DAYS} days (simulated)
Total Requests: $((TEST_DURATION_DAYS * REQUESTS_PER_DAY))

DATABASE GROWTH
---------------
Initial Size: $INITIAL_SIZE
Final Size: $FINAL_SIZE
Growth: ${GROWTH_MB} MB
Projected Monthly Growth: ${MONTHLY_GROWTH_GB} GB/month
Target: <10 GB/month
Status: $(if (( $(echo "$MONTHLY_GROWTH_GB <= 10" | bc -l) )); then echo "PASS"; else echo "FAIL"; fi)

QUERY PERFORMANCE
-----------------
P95 Latency Query: ${QUERY1_MS}ms (target: <50ms)
Bandit Aggregation: ${QUERY2_MS}ms (target: <50ms)
SLA Detection: ${QUERY3_MS}ms (target: <50ms)
Status: $(if [[ $QUERY1_MS -lt 50 && $QUERY2_MS -lt 50 && $QUERY3_MS -lt 50 ]]; then echo "PASS"; else echo "FAIL"; fi)

WRITE THROUGHPUT
----------------
TPS: ${WRITE_TPS}
Target: >500 TPS
Status: $(if [[ $WRITE_TPS -ge 500 ]]; then echo "PASS"; else echo "FAIL"; fi)

OVERALL STATUS
--------------
$(if [[ $QUERY1_MS -lt 50 && $QUERY2_MS -lt 50 && $QUERY3_MS -lt 50 && $WRITE_TPS -ge 500 && $(echo "$MONTHLY_GROWTH_GB <= 10" | bc -l) -eq 1 ]]; then echo "✅ ALL TESTS PASSED"; else echo "❌ SOME TESTS FAILED"; fi)
EOF

cat db_load_test_results.txt

echo ""
echo "========================================"
echo "Load test complete!"
echo "Results saved to: db_load_test_results.txt"
echo "========================================"
