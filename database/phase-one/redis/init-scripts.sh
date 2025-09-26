#!/bin/bash

# Redis initialization scripts for Schlep Engine
# Sets up data structures compatible with both Redis and DragonflyDB

set -e

echo "Initializing Redis for Schlep Engine Phase One..."

# Wait for Redis to be ready
until redis-cli -a "${REDIS_PASSWORD:-schlep_redis_dev_password}" ping; do
  echo "Waiting for Redis to start..."
  sleep 2
done

echo "Redis is ready. Initializing data structures..."

# Set Redis password from environment variable
REDIS_PASSWORD="${REDIS_PASSWORD:-schlep_redis_dev_password}"

# Function to execute Redis commands
redis_exec() {
    redis-cli -a "$REDIS_PASSWORD" "$@"
}

# Create task queues using Redis Streams (DragonflyDB compatible)
echo "Creating task queues..."

# High priority queue
redis_exec XGROUP CREATE "schlep:tasks:high" "processors" ID MKSTREAM || echo "High priority queue already exists"

# Normal priority queue
redis_exec XGROUP CREATE "schlep:tasks:normal" "processors" ID MKSTREAM || echo "Normal priority queue already exists"

# Low priority queue
redis_exec XGROUP CREATE "schlep:tasks:low" "processors" ID MKSTREAM || echo "Low priority queue already exists"

# Dead letter queue for failed tasks
redis_exec XGROUP CREATE "schlep:tasks:failed" "processors" ID MKSTREAM || echo "Failed tasks queue already exists"

# Create notification streams
echo "Creating notification streams..."

# User notifications
redis_exec XGROUP CREATE "schlep:notifications:users" "notifiers" ID MKSTREAM || echo "User notifications stream already exists"

# System events
redis_exec XGROUP CREATE "schlep:events:system" "event_handlers" ID MKSTREAM || echo "System events stream already exists"

# Audit log stream
redis_exec XGROUP CREATE "schlep:audit:logs" "audit_processors" ID MKSTREAM || echo "Audit log stream already exists"

# Initialize configuration keys
echo "Setting up configuration..."

# Session configuration
redis_exec HSET "schlep:config:sessions" \
    "default_ttl" "86400" \
    "max_sessions_per_user" "5" \
    "session_key_prefix" "sess:" \
    "cleanup_interval" "3600"

# Task execution configuration
redis_exec HSET "schlep:config:tasks" \
    "default_timeout" "300" \
    "max_retries" "3" \
    "retry_delay" "60" \
    "max_concurrent_tasks" "100" \
    "priority_weights" '{"high": 10, "normal": 5, "low": 1}'

# Cache configuration
redis_exec HSET "schlep:config:cache" \
    "default_ttl" "3600" \
    "user_data_ttl" "1800" \
    "api_response_ttl" "300" \
    "task_result_ttl" "86400"

# Rate limiting configuration
redis_exec HSET "schlep:config:rate_limits" \
    "api_requests_per_minute" "1000" \
    "task_submissions_per_minute" "100" \
    "login_attempts_per_hour" "10"

# Initialize metrics tracking
echo "Setting up metrics tracking..."

# Counters for basic metrics
redis_exec SET "schlep:metrics:tasks:total" 0
redis_exec SET "schlep:metrics:tasks:completed" 0
redis_exec SET "schlep:metrics:tasks:failed" 0
redis_exec SET "schlep:metrics:users:active_sessions" 0
redis_exec SET "schlep:metrics:api:requests:total" 0

# Create sorted sets for leaderboards and rankings
redis_exec ZADD "schlep:leaderboard:active_users" 0 "placeholder"
redis_exec ZADD "schlep:leaderboard:task_completions" 0 "placeholder"

# Initialize cache namespaces with sample data
echo "Setting up cache namespaces..."

# User profile cache namespace
redis_exec HSET "schlep:cache:user_profiles" \
    "cache_version" "1.0" \
    "last_cleanup" "$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# API response cache namespace
redis_exec HSET "schlep:cache:api_responses" \
    "cache_version" "1.0" \
    "compression_enabled" "true"

# Task result cache namespace
redis_exec HSET "schlep:cache:task_results" \
    "cache_version" "1.0" \
    "max_size_mb" "100"

# Set up health check keys
echo "Setting up health checks..."

redis_exec SET "schlep:health:redis" "OK"
redis_exec EXPIRE "schlep:health:redis" 30

redis_exec HSET "schlep:health:info" \
    "initialized_at" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    "version" "phase-one-v1.0" \
    "compatible_with" "dragonfly-db" \
    "feature_flags" '{"streams": true, "json": true, "search": false}'

# Create lookup indexes (using Redis Sets - DragonflyDB compatible)
echo "Creating lookup indexes..."

# Organization member indexes
redis_exec SADD "schlep:index:org_members:550e8400-e29b-41d4-a716-446655440000" \
    "660e8400-e29b-41d4-a716-446655440000" \
    "660e8400-e29b-41d4-a716-446655440001"

redis_exec SADD "schlep:index:org_members:550e8400-e29b-41d4-a716-446655440001" \
    "660e8400-e29b-41d4-a716-446655440002"

# User role indexes
redis_exec SADD "schlep:index:role:admin" \
    "660e8400-e29b-41d4-a716-446655440000" \
    "660e8400-e29b-41d4-a716-446655440002"

redis_exec SADD "schlep:index:role:user" \
    "660e8400-e29b-41d4-a716-446655440001" \
    "660e8400-e29b-41d4-a716-446655440003"

# Task definition indexes by organization
redis_exec SADD "schlep:index:task_defs:550e8400-e29b-41d4-a716-446655440000" \
    "880e8400-e29b-41d4-a716-446655440000" \
    "880e8400-e29b-41d4-a716-446655440001"

redis_exec SADD "schlep:index:task_defs:550e8400-e29b-41d4-a716-446655440001" \
    "880e8400-e29b-41d4-a716-446655440002"

# Set up pub/sub channels for real-time features
echo "Setting up pub/sub channels..."

# Publish a test message to verify pub/sub is working
redis_exec PUBLISH "schlep:events:system" '{"event": "redis_initialized", "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'", "phase": "one"}'

# Create scheduled task tracking
echo "Setting up scheduled tasks..."

# Use sorted sets for scheduled tasks (by execution time)
redis_exec ZADD "schlep:scheduled:tasks" \
    "$(date -d '+1 hour' +%s)" "990e8400-e29b-41d4-a716-446655440003"

# Performance testing data structures
echo "Setting up performance testing structures..."

# Create sample session data
redis_exec HSET "schlep:session:sess:550e8400-e29b-41d4-a716-446655440000:1705123456" \
    "user_id" "660e8400-e29b-41d4-a716-446655440000" \
    "created_at" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    "last_accessed" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    "data" '{"cart_items": ["item-123", "item-456"], "theme": "dark"}'

redis_exec EXPIRE "schlep:session:sess:550e8400-e29b-41d4-a716-446655440000:1705123456" 86400

# Create sample cache entries
redis_exec SET "schlep:cache:user:660e8400-e29b-41d4-a716-446655440000" \
    '{"id": "660e8400-e29b-41d4-a716-446655440000", "email": "admin@acme.com", "full_name": "Alice Administrator", "role": "admin"}' \
    EX 1800

redis_exec SET "schlep:cache:api_response:/api/v1/tasks?status=running" \
    '{"data": [{"id": "990e8400-e29b-41d4-a716-446655440001", "status": "running"}], "count": 1, "cached_at": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' \
    EX 300

echo "Redis initialization complete!"
echo "Structures created:"
echo "  - Task queues: high, normal, low priority + failed queue"
echo "  - Notification streams for users and system events"
echo "  - Configuration hashes for sessions, tasks, cache, and rate limiting"
echo "  - Metrics counters and leaderboards"
echo "  - Cache namespaces for user profiles, API responses, and task results"
echo "  - Health check keys with TTL"
echo "  - Lookup indexes using Redis Sets"
echo "  - Sample session and cache data"
echo "  - Scheduled task tracking with sorted sets"
echo ""
echo "All structures are compatible with DragonflyDB for Phase Two migration"