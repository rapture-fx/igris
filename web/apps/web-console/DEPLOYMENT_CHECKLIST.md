# Production Deployment Checklist

Use this checklist to verify the Igris Inertial Dashboard is production-ready before deployment.

## Pre-Deployment Configuration

### Environment Variables

- [ ] `NEXT_PUBLIC_ENV=production` is set
- [ ] `NEXT_PUBLIC_ENABLE_MOCK_DATA=false` is set (or variable is removed)
- [ ] `NEXT_PUBLIC_API_URL` points to production backend (NOT localhost)
- [ ] `NEXT_PUBLIC_API_HEALTH_CHECK_URL=/health` is configured
- [ ] `BETTER_AUTH_SECRET` is set (strong random value)
- [ ] `BETTER_AUTH_URL` points to production app URL
- [ ] `DATABASE_URL` points to production database
- [ ] All environment variables are in CI/CD or hosting platform

### Backend Verification

- [ ] Backend `/health` endpoint exists and returns 200 OK
- [ ] Backend API is accessible from deployment environment
- [ ] CORS is configured to allow dashboard domain
- [ ] Database migrations are up to date
- [ ] Redis is running and accessible

## Build Verification

### Local Build Test

```bash
# Set production environment
export NEXT_PUBLIC_ENV=production
export NEXT_PUBLIC_ENABLE_MOCK_DATA=false
export NEXT_PUBLIC_API_URL=https://api.igris.com

# Build
npm run build

# Check for build errors
# Check bundle size
# Verify no warnings about mock data
```

- [ ] Build completes without errors
- [ ] No warnings in build output
- [ ] Bundle size is reasonable (check .next folder)

### Production Build Test

```bash
# Run production build locally
npm run start

# Test in browser
# Check console for errors
# Verify no mock data appears
```

- [ ] Dashboard loads correctly
- [ ] No console errors
- [ ] No mock data visible
- [ ] Health check works
- [ ] Authentication works

## Safety Validation Tests

### Test 1: Backend Down - Health Check Gate

**Setup**: Stop backend API or set wrong API URL

**Steps**:
1. Start dashboard with backend down
2. Navigate to /dashboard

**Expected Results**:
- [ ] Health check shows loading spinner
- [ ] After timeout, "Service Unavailable" page appears
- [ ] NO dashboard content renders
- [ ] NO mock data appears
- [ ] Retry button attempts to reconnect
- [ ] Clear message: "Service temporarily unavailable"

**FAIL CONDITIONS**:
- ❌ Dashboard loads with empty/mock data
- ❌ White screen or crashes
- ❌ Console errors visible to user

### Test 2: Individual API Failure - Error Handling

**Setup**: Backend running, but one API endpoint returns errors

**Steps**:
1. Dashboard loads successfully
2. Simulate 500 error on `/v1/usage` endpoint
3. Observe dashboard behavior

**Expected Results**:
- [ ] Error boundary catches the error
- [ ] Error state UI shows "Data unavailable"
- [ ] NO mock data appears for failed endpoint
- [ ] Other working endpoints still show real data
- [ ] Retry action reloads the component

**FAIL CONDITIONS**:
- ❌ Mock data appears for failed endpoint
- ❌ Entire dashboard crashes
- ❌ Silent failure (no indication of error)

### Test 3: Fresh User - Empty State

**Setup**: Backend healthy, new tenant with zero data

**Steps**:
1. Create new account
2. Complete onboarding
3. View dashboard

**Expected Results**:
- [ ] Dashboard loads successfully
- [ ] Empty state components show
- [ ] Clear messaging: "No data yet"
- [ ] Call-to-action buttons present
- [ ] NO mock data appears
- [ ] NO confusing empty charts

**FAIL CONDITIONS**:
- ❌ Mock data appears for empty tenant
- ❌ Broken/confusing empty dashboard
- ❌ No guidance for new users

### Test 4: Production Environment Validation

**Setup**: Production environment variables set

**Steps**:
1. Open browser developer console
2. Load dashboard
3. Check console output

**Expected Results**:
- [ ] NO warnings about mock data
- [ ] NO "development mode" messages
- [ ] NO detailed error stack traces visible
- [ ] NO console errors
- [ ] Environment detected as "production"

**FAIL CONDITIONS**:
- ❌ Mock data warning in console
- ❌ Development mode active
- ❌ Stack traces visible to user

### Test 5: Error Recovery

**Setup**: Start with backend running

**Steps**:
1. Load dashboard successfully
2. Stop backend while dashboard open
3. Wait for health check to fail
4. Restart backend
5. Click retry/refresh

**Expected Results**:
- [ ] Dashboard detects backend failure (within 30s)
- [ ] Service Unavailable page appears
- [ ] After backend restart, retry succeeds
- [ ] Dashboard loads with real data
- [ ] NO residual errors or broken state

**FAIL CONDITIONS**:
- ❌ Dashboard doesn't detect backend failure
- ❌ Retry doesn't work after recovery
- ❌ Mixed real/mock data appears

## Security Verification

- [ ] No sensitive data in client-side code
- [ ] No API keys hardcoded in frontend
- [ ] Authentication required for all dashboard routes
- [ ] HTTPS enforced in production
- [ ] No development tools accessible in production build

## Performance Verification

- [ ] Health check doesn't block initial load (loads async)
- [ ] Dashboard loads in < 3 seconds on good connection
- [ ] No memory leaks in long-running sessions
- [ ] Polling intervals are reasonable (30s health check)

## Monitoring Setup

- [ ] Error logging configured (Sentry/LogRocket/etc)
- [ ] Health check metrics tracked
- [ ] API error rates monitored
- [ ] Alerts configured for sustained health check failures
- [ ] Dashboard uptime monitoring active

## User Acceptance Testing

- [ ] Marketing team can access dashboard
- [ ] Support team trained on error states
- [ ] Documentation updated for customers
- [ ] Known limitations documented
- [ ] Support runbook created

## Rollback Plan

- [ ] Previous version tagged in git
- [ ] Rollback procedure documented
- [ ] Database migrations are reversible
- [ ] Backend API compatible with previous frontend

## Final Go/No-Go Decision

### GO Criteria (All must be ✅)

- ✅ All environment variables configured correctly
- ✅ Health check gate blocks unsafe rendering
- ✅ Error boundaries catch all failures
- ✅ No mock data appears in any test scenario
- ✅ Clear UI states for all conditions
- ✅ Backend health endpoint working
- ✅ Authentication working
- ✅ All safety validation tests PASS

### NO-GO Criteria (Any ❌ = Do Not Deploy)

- ❌ Mock data appears in production test
- ❌ Health check gate doesn't work
- ❌ Error boundaries don't catch errors
- ❌ Backend health endpoint missing/broken
- ❌ Authentication not working
- ❌ Any critical safety test FAILS

## Post-Deployment Verification

### Within 1 Hour of Deployment

- [ ] Health check endpoint accessible
- [ ] Dashboard loads for authenticated users
- [ ] No error spikes in monitoring
- [ ] Real data displays correctly
- [ ] No customer reports of mock data

### Within 24 Hours

- [ ] Monitor error rates (should be < 1%)
- [ ] Check health check success rate (should be > 99%)
- [ ] Verify API latency is normal
- [ ] No unusual support tickets
- [ ] Customer feedback positive

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Engineer | __________ | ______ | __________ |
| QA | __________ | ______ | __________ |
| DevOps | __________ | ______ | __________ |
| Product | __________ | ______ | __________ |

---

**Deployment Date**: __________
**Version**: __________
**Approved By**: __________

**REMEMBER**: The dashboard must never lie. If any safety test fails, DO NOT DEPLOY.
