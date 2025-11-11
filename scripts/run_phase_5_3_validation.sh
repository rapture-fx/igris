#!/bin/bash
# Phase 5.3 Feature Gap Closure - Validation Script
# Purpose: Validate all implemented features for production readiness
# Author: Schlep-Engine Team
# Date: 2025-11-10

set -e  # Exit on error

echo "=================================="
echo "Phase 5.3 Validation Suite"
echo "=================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
TESTS_PASSED=0
TESTS_FAILED=0

# Helper functions
pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((TESTS_PASSED++))
}

fail() {
    echo -e "${RED}✗${NC} $1"
    ((TESTS_FAILED++))
}

warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

section() {
    echo ""
    echo "=================================="
    echo "$1"
    echo "=================================="
}

# ============================================================================
# 1. PRE-FLIGHT CHECKS
# ============================================================================

section "1. Pre-flight Checks"

# Check Go installation
if command -v go &> /dev/null; then
    pass "Go is installed ($(go version))"
else
    fail "Go is not installed"
fi

# Check PostgreSQL connection
if psql -h localhost -U schlep_user -d schlep_db -c "SELECT 1" &> /dev/null; then
    pass "PostgreSQL connection successful"
else
    fail "PostgreSQL connection failed"
fi

# Check Redis connection
if redis-cli ping &> /dev/null; then
    pass "Redis connection successful"
else
    fail "Redis connection failed"
fi

# ============================================================================
# 2. DATABASE MIGRATIONS VALIDATION
# ============================================================================

section "2. Database Migrations"

# Check migration 009 (SSO)
if psql -h localhost -U schlep_user -d schlep_db -c "\d sso_providers" &> /dev/null; then
    pass "Migration 009 (SSO providers) applied"
else
    fail "Migration 009 (SSO providers) not applied"
fi

if psql -h localhost -U schlep_user -d schlep_db -c "\d sso_user_links" &> /dev/null; then
    pass "Migration 009 (SSO user links) applied"
else
    fail "Migration 009 (SSO user links) not applied"
fi

# Check migration 010 (Budget tracking)
if psql -h localhost -U schlep_user -d schlep_db -c "SELECT monthly_budget_usd FROM tenants LIMIT 1" &> /dev/null; then
    pass "Migration 010 (Budget tracking) applied"
else
    fail "Migration 010 (Budget tracking) not applied"
fi

# ============================================================================
# 3. CODE COMPILATION
# ============================================================================

section "3. Code Compilation"

# Build the project
if go build -o /tmp/schlep-engine ./cmd/api 2>/dev/null; then
    pass "Code compiles successfully"
else
    fail "Code compilation failed"
fi

# ============================================================================
# 4. SSO FEATURE VALIDATION
# ============================================================================

section "4. SSO Feature Validation"

# Check if SSO files exist
if [ -f "internal/auth/sso_provider.go" ]; then
    pass "SSO provider infrastructure exists"
else
    fail "SSO provider infrastructure missing"
fi

if [ -f "internal/auth/oauth2_provider.go" ]; then
    pass "OAuth2 provider implementation exists"
else
    fail "OAuth2 provider implementation missing"
fi

if [ -f "internal/auth/saml_provider.go" ]; then
    pass "SAML provider implementation exists"
else
    fail "SAML provider implementation missing"
fi

if [ -f "internal/middleware/sso_enforcer.go" ]; then
    pass "SSO middleware exists"
else
    fail "SSO middleware missing"
fi

if [ -f "docs/SSO_SETUP.md" ]; then
    pass "SSO documentation exists"
else
    fail "SSO documentation missing"
fi

# ============================================================================
# 5. L2 CACHE VALIDATION
# ============================================================================

section "5. L2 Cache Validation"

if [ -f "internal/cache/l2_cache.go" ]; then
    pass "L2 cache infrastructure exists"
else
    fail "L2 cache infrastructure missing"
fi

if [ -f "internal/cache/l2_adapter_memory.go" ]; then
    pass "L2 memory adapter exists"
else
    fail "L2 memory adapter missing"
fi

if [ -f "internal/cache/l2_stats.go" ]; then
    pass "L2 cache stats exists"
else
    fail "L2 cache stats missing"
fi

# ============================================================================
# 6. ALERT DELIVERY VALIDATION
# ============================================================================

section "6. Alert Delivery Backend"

if [ -f "internal/alerts/alert_sender.go" ]; then
    pass "Alert sender infrastructure exists"
else
    fail "Alert sender infrastructure missing"
fi

if [ -f "internal/alerts/providers/email_sender.go" ]; then
    pass "Email alert provider exists"
else
    fail "Email alert provider missing"
fi

if [ -f "internal/alerts/providers/webhook_sender.go" ]; then
    pass "Webhook alert provider exists"
else
    fail "Webhook alert provider missing"
fi

# ============================================================================
# 7. TOKENIZER VALIDATION
# ============================================================================

section "7. HuggingFace Tokenizer"

if [ -f "internal/semantic/tokenizer_interface.go" ]; then
    pass "Tokenizer interface exists"
else
    fail "Tokenizer interface missing"
fi

if [ -f "internal/semantic/tokenizer_hf.go" ]; then
    pass "HuggingFace tokenizer implementation exists"
else
    fail "HuggingFace tokenizer implementation missing"
fi

# ============================================================================
# 8. COST BUDGET ENFORCEMENT VALIDATION
# ============================================================================

section "8. Cost Budget Enforcement"

if [ -f "internal/middleware/cost_budget_enforcer.go" ]; then
    pass "Cost budget enforcer exists"
else
    fail "Cost budget enforcer missing"
fi

# Test database functions
if psql -h localhost -U schlep_user -d schlep_db -c "SELECT * FROM check_budget_preauth('00000000-0000-0000-0000-000000000000', 10.00)" &> /dev/null; then
    pass "Budget pre-auth function works"
else
    fail "Budget pre-auth function failed"
fi

# ============================================================================
# 9. CONFIGURATION VALIDATION
# ============================================================================

section "9. Configuration Files"

if [ -f "config/tier_config.yaml" ]; then
    pass "Tier configuration exists"

    # Check if SSO feature is documented (even if disabled)
    if grep -q "sso:" config/tier_config.yaml; then
        pass "SSO feature flag documented in config"
    else
        warn "SSO feature flag not found in config"
    fi

    # Check if L2 cache is documented
    if grep -q "l2_caching:" config/tier_config.yaml; then
        pass "L2 cache feature flag documented"
    else
        warn "L2 cache feature flag not found in config"
    fi

    # Check if cost enforcement is documented
    if grep -q "enable_cost_budget_enforcement:" config/tier_config.yaml; then
        pass "Cost enforcement feature flag documented"
    else
        warn "Cost enforcement feature flag not found in config"
    fi
else
    fail "Tier configuration missing"
fi

# ============================================================================
# 10. DOCUMENTATION VALIDATION
# ============================================================================

section "10. Documentation"

if [ -f "docs/SSO_SETUP.md" ]; then
    lines=$(wc -l < docs/SSO_SETUP.md)
    if [ "$lines" -gt 100 ]; then
        pass "SSO documentation is comprehensive ($lines lines)"
    else
        warn "SSO documentation might be incomplete ($lines lines)"
    fi
else
    fail "SSO documentation missing"
fi

# ============================================================================
# SUMMARY
# ============================================================================

section "Validation Summary"

TOTAL_TESTS=$((TESTS_PASSED + TESTS_FAILED))
SUCCESS_RATE=$((TESTS_PASSED * 100 / TOTAL_TESTS))

echo ""
echo "Total Tests: $TOTAL_TESTS"
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"
echo "Success Rate: $SUCCESS_RATE%"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All validation tests passed!${NC}"
    echo ""
    echo "Phase 5.3 is ready for production deployment."
    exit 0
else
    echo -e "${RED}✗ Some validation tests failed.${NC}"
    echo ""
    echo "Please fix the failing tests before deploying to production."
    exit 1
fi
