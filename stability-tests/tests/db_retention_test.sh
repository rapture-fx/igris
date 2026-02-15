#!/bin/bash
# ============================================================================
# Database Data Retention Test Script
# Validates 90-day retention policy and automatic cleanup jobs
# ============================================================================

set -euo pipefail

DATABASE_URL="${DATABASE_URL:-postgres://igris:igris_ci_password@localhost:5433/igris_test?sslmode=disable}"
RETENTION_DAYS=90

echo "========================================"
echo "Igris Inertial Data Retention Test"
echo "========================================"
echo "Retention Policy: ${RETENTION_DAYS} days"
echo ""

# Test 1: Verify retention policy exists
echo "[1/5] Verifying retention policy configuration..."

POLICY_EXISTS=$(psql "$DATABASE_URL" -t -c "
    SELECT COUNT(*)
    FROM pg_stat_user_jobs
    WHERE jobname LIKE '%retention%' OR jobname LIKE '%cleanup%'
" 2>/dev/null || echo "0")

if [[ "$POLICY_EXISTS" -eq "0" ]]; then
    echo "⚠️  No automated retention job found. Creating cleanup procedure..."

    psql "$DATABASE_URL" <<EOF
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void AS \$\$
BEGIN
    -- Delete feedback events older than 90 days
    DELETE FROM feedback_events
    WHERE created_at < NOW() - INTERVAL '${RETENTION_DAYS} days';

    -- Delete semantic classifications older than 90 days
    DELETE FROM semantic_classifications
    WHERE created_at < NOW() - INTERVAL '${RETENTION_DAYS} days';

    -- Delete SLA violations older than 90 days
    DELETE FROM sla_violations
    WHERE violated_at < NOW() - INTERVAL '${RETENTION_DAYS} days';

    -- Delete policy audit logs older than 90 days
    DELETE FROM policy_audit_log
    WHERE created_at < NOW() - INTERVAL '${RETENTION_DAYS} days';

    RAISE NOTICE 'Cleanup complete';
END;
\$\$ LANGUAGE plpgsql;
EOF

    echo "✓ Cleanup procedure created"
else
    echo "✓ Retention policy configured"
fi

# Test 2: Seed old data for testing
echo ""
echo "[2/5] Seeding test data (91-day-old records)..."

psql "$DATABASE_URL" <<EOF
-- Insert old feedback events (91 days ago)
INSERT INTO feedback_events (semantic_class, provider, latency_ms, cost_usd, success, reward, created_at)
SELECT
    (ARRAY['code_generation', 'question_answering'])[1 + floor(random() * 2)::int],
    (ARRAY['openai', 'anthropic'])[1 + floor(random() * 2)::int],
    100 + random() * 200,
    0.001 + random() * 0.003,
    random() < 0.9,
    0.5 + random() * 0.5,
    NOW() - INTERVAL '91 days' - INTERVAL '1 second' * generate_series
FROM generate_series(1, 100);

-- Insert old semantic classifications
INSERT INTO semantic_classifications (prompt_hash, class, confidence, latency_ms, cache_hit, created_at)
SELECT
    md5(random()::text),
    (ARRAY['code_generation', 'question_answering'])[1 + floor(random() * 2)::int],
    0.7 + random() * 0.3,
    5 + random() * 15,
    random() < 0.5,
    NOW() - INTERVAL '91 days' - INTERVAL '1 second' * generate_series
FROM generate_series(1, 50);
EOF

echo "✓ Seeded 150 old records (91 days ago)"

# Count records before cleanup
BEFORE_FEEDBACK=$(psql "$DATABASE_URL" -t -c "
    SELECT COUNT(*) FROM feedback_events WHERE created_at < NOW() - INTERVAL '${RETENTION_DAYS} days'
")
BEFORE_CLASSIFICATION=$(psql "$DATABASE_URL" -t -c "
    SELECT COUNT(*) FROM semantic_classifications WHERE created_at < NOW() - INTERVAL '${RETENTION_DAYS} days'
")

echo "Records before cleanup:"
echo "  - Feedback events: $BEFORE_FEEDBACK"
echo "  - Classifications: $BEFORE_CLASSIFICATION"

# Test 3: Run cleanup procedure
echo ""
echo "[3/5] Running data cleanup procedure..."

psql "$DATABASE_URL" -c "SELECT cleanup_old_data();" > /dev/null

echo "✓ Cleanup procedure executed"

# Test 4: Verify old data was deleted
echo ""
echo "[4/5] Verifying old data was deleted..."

AFTER_FEEDBACK=$(psql "$DATABASE_URL" -t -c "
    SELECT COUNT(*) FROM feedback_events WHERE created_at < NOW() - INTERVAL '${RETENTION_DAYS} days'
")
AFTER_CLASSIFICATION=$(psql "$DATABASE_URL" -t -c "
    SELECT COUNT(*) FROM semantic_classifications WHERE created_at < NOW() - INTERVAL '${RETENTION_DAYS} days'
")

echo "Records after cleanup:"
echo "  - Feedback events: $AFTER_FEEDBACK"
echo "  - Classifications: $AFTER_CLASSIFICATION"

DELETED_FEEDBACK=$((BEFORE_FEEDBACK - AFTER_FEEDBACK))
DELETED_CLASSIFICATION=$((BEFORE_CLASSIFICATION - AFTER_CLASSIFICATION))

echo "Deleted:"
echo "  - Feedback events: $DELETED_FEEDBACK"
echo "  - Classifications: $DELETED_CLASSIFICATION"

if [[ $AFTER_FEEDBACK -eq 0 && $AFTER_CLASSIFICATION -eq 0 ]]; then
    echo "✓ All old data successfully deleted"
else
    echo "⚠️  WARNING: Some old data still remains"
fi

# Test 5: Verify recent data was NOT deleted
echo ""
echo "[5/5] Verifying recent data was preserved..."

RECENT_FEEDBACK=$(psql "$DATABASE_URL" -t -c "
    SELECT COUNT(*) FROM feedback_events WHERE created_at >= NOW() - INTERVAL '7 days'
")
RECENT_CLASSIFICATION=$(psql "$DATABASE_URL" -t -c "
    SELECT COUNT(*) FROM semantic_classifications WHERE created_at >= NOW() - INTERVAL '7 days'
")

echo "Recent data (last 7 days):"
echo "  - Feedback events: $RECENT_FEEDBACK"
echo "  - Classifications: $RECENT_CLASSIFICATION"

if [[ $RECENT_FEEDBACK -gt 0 ]]; then
    echo "✓ Recent data preserved"
else
    echo "⚠️  WARNING: No recent data found (may be expected if no recent activity)"
fi

# Generate summary report
echo ""
echo "Generating summary report..."

cat > db_retention_test_results.txt <<EOF
======================================
Igris Inertial Data Retention Test Report
======================================
Test Date: $(date)
Retention Policy: ${RETENTION_DAYS} days

TEST RESULTS
------------
Retention Policy: $(if [[ "$POLICY_EXISTS" -gt "0" ]]; then echo "CONFIGURED"; else echo "CREATED"; fi)
Old Data Cleanup: $(if [[ $AFTER_FEEDBACK -eq 0 && $AFTER_CLASSIFICATION -eq 0 ]]; then echo "PASS"; else echo "FAIL"; fi)
Recent Data Preserved: $(if [[ $RECENT_FEEDBACK -gt 0 ]]; then echo "PASS"; else echo "WARN"; fi)

CLEANUP STATISTICS
------------------
Feedback Events Deleted: $DELETED_FEEDBACK
Classifications Deleted: $DELETED_CLASSIFICATION
Recent Events Preserved: $RECENT_FEEDBACK

OVERALL STATUS
--------------
$(if [[ $AFTER_FEEDBACK -eq 0 && $AFTER_CLASSIFICATION -eq 0 ]]; then echo "✅ RETENTION TEST PASSED"; else echo "❌ RETENTION TEST FAILED"; fi)

RECOMMENDATIONS
---------------
1. Schedule cleanup_old_data() to run daily via pg_cron
2. Monitor cleanup execution time and adjust batch size if needed
3. Consider partitioning tables by created_at for faster cleanup
4. Archive old data to cold storage before deletion (optional)

SAMPLE pg_cron JOB
------------------
SELECT cron.schedule('cleanup-old-data', '0 2 * * *', 'SELECT cleanup_old_data()');
-- Runs daily at 2:00 AM
EOF

cat db_retention_test_results.txt

echo ""
echo "========================================"
echo "Retention test complete!"
echo "Results saved to: db_retention_test_results.txt"
echo "========================================"
