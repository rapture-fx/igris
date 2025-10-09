# Frontend Pricing Comparison Table
**Quick Visual Reference**

## Side-by-Side Comparison of All Three Pricing Structures

### STRUCTURE A: Main Landing Page
**File:** `/apps/web-landing/src/components/sections/Pricing.tsx`

| Feature | Develop | Growth | Scale |
|---------|---------|--------|-------|
| **Price** | $99/mo | $299/mo | $599/mo |
| **Annual** | ~$82.50/mo (17% off) | ~$249/mo (17% off) | ~$499/mo (17% off) |
| **API Calls** | 5M included | 25M included | 100M included |
| **Overage** | $0.08 per 1k | $0.06 per 1k | $0.04 per 1k |
| **Daily Processing** | 50GB/day | 200GB/day | 500GB/day |
| **File Size Limit** | 10GB | 25GB | 50GB |
| **ML Frameworks** | scikit-learn | +TensorFlow, PyTorch | All + large models (5GB) |
| **Training Jobs** | 5/day | 50/day | 500/day |
| **Inferences** | 100/hour | 1,000/hour | 10,000/hour |
| **Streaming** | 2 WebSocket | 10 connections | 100+ connections |
| **BYOS** | ✓ (claimed) | ✓ | ✓ |
| **SSO** | ✗ | ✓ | ✓ |
| **Team Size** | 3 | 15 | 50 |
| **SLA** | 99.0% | 99.5% | 99.9% |
| **Support** | Business hours | 24/7 | 24/7 + <4hr response |

---

### STRUCTURE B: Documentation Pricing
**File:** `/apps/web-docs/src/app/introduction/pricing/page.tsx`

| Feature | Free | Pro | Enterprise |
|---------|------|-----|------------|
| **Price** | $0/mo | $49/mo | Custom |
| **Annual** | N/A | ~$39/mo (20% off) | Custom |
| **Rows** | 1,000/month | 100,000/month | Unlimited |
| **File Size** | 10MB | 100MB | Custom |
| **API Rate** | 60/min | 600/min | Custom |
| **Concurrent Jobs** | 1 | 5 | Custom |
| **Overage** | N/A | $0.001 per row | N/A |
| **Data Profiling** | Basic | Advanced AI | Advanced AI |
| **Transformations** | Standard | Auto-labeling | Custom |
| **Webhooks** | ✗ | ✓ | ✓ |
| **Support** | Community | Priority | Dedicated |
| **Compliance** | ✗ | ✗ | SOC2, GDPR |

---

### STRUCTURE C: Frontend Package
**File:** `/packages/frontend/src/app/pricing/page.tsx`

| Feature | Starter | Professional | Enterprise |
|---------|---------|--------------|------------|
| **Price** | $99/mo | $299/mo | Custom |
| **Annual** | Not mentioned | Not mentioned | Not mentioned |
| **API Calls** | 10,000/month | 100,000/month | Unlimited |
| **Processing** | 50GB | 500GB | Custom |
| **File Formats** | Standard | All formats | All + custom |
| **ML Features** | ✗ | Custom models | Advanced ML |
| **Workflow** | ✗ | Automation | Advanced |
| **Collaboration** | ✗ | Team features | Enterprise |
| **SSO** | ✗ | ✓ | ✓ + SAML |
| **Deployment** | Cloud | Cloud | On-premise option |
| **Support** | Email | Priority | Dedicated |
| **Trial** | 14 days | 14 days | Contact sales |

---

## Key Differences Highlighted

### 1. Tier Names
```
Structure A: Develop   → Growth        → Scale
Structure B: Free      → Pro           → Enterprise  
Structure C: Starter   → Professional  → Enterprise
```
**Issue:** No consistency in naming

### 2. Entry Tier Pricing
```
Structure A: $99  (Develop)
Structure B: $0   (Free)        ← CONFLICT!
Structure C: $99  (Starter)
```
**Issue:** Does a free tier exist or not?

### 3. Mid Tier Pricing
```
Structure A: $299 (Growth)
Structure B: $49  (Pro)         ← CONFLICT!
Structure C: $299 (Professional)
```
**Issue:** $49 vs $299 - huge discrepancy

### 4. Annual Discount
```
Structure A: 17% discount
Structure B: 20% discount       ← CONFLICT!
Structure C: Not mentioned
```
**Issue:** Different discount percentages

### 5. Quota Units
```
Structure A: 5M API calls + 50GB/day
Structure B: 1,000 rows/month + 10MB files
Structure C: 10k API calls/month + 50GB
```
**Issue:** Completely different metrics

### 6. Trial Period
```
Structure A: Unspecified "free trial"
Structure B: 14-day free trial
Structure C: 14-day free trial
```
**Issue:** Duration unclear in main pricing

---

## Feature Availability Matrix

| Feature Category | Struct A (Main) | Struct B (Docs) | Struct C (Frontend) |
|------------------|-----------------|-----------------|---------------------|
| **Free Tier** | ✗ ($99 minimum) | ✓ ($0 tier exists) | ✗ ($99 minimum) |
| **ML Training Quotas** | ✓ Detailed (5/50/500 jobs) | ✗ Not mentioned | ✓ Generic mention |
| **Streaming Connections** | ✓ Detailed (2/10/100+) | ✗ Not mentioned | ✗ Not mentioned |
| **Daily GB Limits** | ✓ (50/200/500) | ✗ Not mentioned | ✓ (50/500) |
| **Row-based Limits** | ✗ Not mentioned | ✓ (1k/100k/unlimited) | ✗ Not mentioned |
| **API Rate Limits** | ✗ Not mentioned | ✓ (60/600/custom per min) | ✗ Not mentioned |
| **Overage Pricing** | ✓ ($0.08/0.06/0.04 per 1k calls) | ✓ ($0.001 per row) | ✗ Not mentioned |
| **BYOS Feature** | ✓ All tiers (claimed) | ✗ Not mentioned | ✗ Not mentioned |
| **SSO** | ✓ Growth+ | ✗ Not mentioned | ✓ Professional+ |
| **On-Premise** | ✗ Not mentioned | ✗ Not mentioned | ✓ Enterprise only |
| **Compliance Certs** | ✗ Generic mention | ✓ Enterprise | ✓ Generic mention |

---

## Price-to-Feature Ratio Comparison

### If you pay $99/month:

**Structure A (Develop):**
- 5,000,000 API calls
- 50GB/day processing
- 10GB file size limit
- scikit-learn ML
- 2 WebSocket connections
- 3 team members

**Structure B (Would be Pro at $49):**
- N/A - need to upgrade to $49 tier

**Structure C (Starter):**
- 10,000 API calls (0.2% of Structure A!)
- 50GB processing
- Standard formats only
- No ML features
- No collaboration

**Conclusion:** Massively different value propositions for same price!

### If you pay $299/month:

**Structure A (Growth):**
- 25,000,000 API calls
- 200GB/day processing
- 25GB file size limit
- TensorFlow + PyTorch
- 10 streaming connections
- 15 team members
- 24/7 support

**Structure B (Would be Enterprise - Custom pricing):**
- N/A - need custom quote

**Structure C (Professional):**
- 100,000 API calls (0.4% of Structure A!)
- 500GB processing
- All formats
- Custom ML models
- Team collaboration
- Priority support

**Conclusion:** Wildly different capabilities for same price!

---

## Conversion Table (Attempted)

### Converting Between Metrics

**Question:** How do the different quota units relate?

| Metric | Structure A | Structure B | Structure C | Conversion Factor |
|--------|-------------|-------------|-------------|-------------------|
| **API Calls** | 5M/25M/100M | Not specified | 10k/100k/unlimited | ??? |
| **Rows** | Not specified | 1k/100k/unlimited | Not specified | ??? |
| **Daily GB** | 50/200/500 | Not specified | 50/500 (total?) | ??? |
| **File Size** | 10/25/50 GB | 10/100 MB (!) | Not specified | ??? |

**Problem:** No documented conversion between rows, API calls, and GB processing

**Example Scenarios:**
- If I process 100,000 rows, how many API calls is that?
- If I upload a 50GB file with 1 million rows, which quota applies?
- If I make 5M API calls processing 500GB of data, which limit do I hit first?

**Answer:** Unknown - metrics are incompatible without conversion factors

---

## User Journey Confusion

### Scenario 1: User Reads Docs First
1. User sees "Free" tier at $0/month with 1,000 rows
2. User clicks "Get Started Free"
3. Arrives at main pricing showing $99 minimum (no Free tier)
4. **Result:** Confusion, possible abandonment

### Scenario 2: User Compares Prices
1. User sees $49 Pro tier in docs (100k rows)
2. User sees $299 Growth tier in main page (25M API calls)
3. User can't determine which is better value
4. **Result:** Decision paralysis

### Scenario 3: User Plans Budget
1. User budgets based on $49/month Pro tier from docs
2. Actual tier (Growth) costs $299/month
3. **Result:** Budget mismatch, potential churn

### Scenario 4: Sales Conversation
1. Sales shows Develop/Growth/Scale tiers
2. User references Free/Pro/Enterprise from website
3. Sales and user are talking about different products
4. **Result:** Lost trust, lost sale

---

## Recommended Resolution

### Option 1: Adopt Structure A (Main Landing)
**Pros:**
- Most comprehensive feature documentation
- Clear usage-based pricing with overages
- Well-designed UI with calculator
- Detailed tier differentiation

**Cons:**
- No free tier (potential lead generation loss)
- Higher entry price ($99 vs $0 or $49)
- Complex overage calculations

### Option 2: Adopt Structure B (Docs)
**Pros:**
- Free tier for lead generation
- Lower entry price ($49 Pro tier)
- Simple row-based pricing
- Clear rate limits

**Cons:**
- Less detailed feature documentation
- Row-based quotas harder to enforce
- Doesn't align with API-first architecture
- Missing many advanced features

### Option 3: Create Hybrid Structure
**Pros:**
- Best of all worlds
- Free tier + growth tiers
- Comprehensive features
- Clear upgrade path

**Cons:**
- Requires new implementation
- More tiers = more complexity
- Higher maintenance burden

### ✅ Recommended: **Adopt Structure A with Free Tier Addition**

**Final Structure:**
```
Free:         $0/mo    → 1M API calls, 5GB/day, basic features
Develop:      $99/mo   → 5M API calls, 50GB/day (current Develop)
Growth:       $299/mo  → 25M API calls, 200GB/day (current Growth)
Scale:        $599/mo  → 100M API calls, 500GB/day (current Scale)
Enterprise:   Custom   → Unlimited, custom features
```

**Rationale:**
- Maintains comprehensive feature documentation from Structure A
- Adds free tier for lead generation (from Structure B)
- Keeps API call-based quotas (easier to track than rows)
- Provides clear upgrade path
- Matches API-first product positioning

---

## Action Items Summary

### Immediate (This Week):
- [ ] **Day 1:** Decide which structure is authoritative
- [ ] **Day 2:** Disable or update conflicting pricing pages
- [ ] **Day 3:** Create shared pricing configuration package
- [ ] **Day 4:** Update most visible pricing page
- [ ] **Day 5:** Validate backend implementation matches

### Short-term (Next Sprint):
- [ ] **Week 1:** Update all frontend apps to use shared config
- [ ] **Week 2:** Complete backend validation checklist
- [ ] **Week 3:** Resolve all documented conflicts
- [ ] **Week 4:** Update all documentation and FAQs

### Long-term (Next Quarter):
- [ ] **Month 1:** Implement pricing API backend
- [ ] **Month 2:** Build pricing admin panel
- [ ] **Month 3:** Add usage calculator and comparison tools

---

**Last Updated:** 2025-10-08
**Status:** 🔴 CRITICAL - Requires Immediate Resolution
**Owner:** Product + Engineering Leads
**Next Review:** After decision on authoritative structure
