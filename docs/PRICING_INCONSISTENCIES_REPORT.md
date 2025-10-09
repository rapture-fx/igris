# Critical Pricing Inconsistencies Report
**Generated:** 2025-10-08
**Severity:** HIGH - Requires immediate attention

---

## Executive Summary

Analysis of the frontend pricing presentation reveals **CRITICAL INCONSISTENCIES** across three different frontend applications. Users may see different prices, tier names, and features depending on their entry point into the application.

**Risk:** Legal liability, customer confusion, revenue loss, brand damage

---

## 1. THREE DIFFERENT PRICING STRUCTURES

### Structure A: Main Landing Page
**Location:** `/apps/web-landing/src/components/sections/Pricing.tsx`

```
┌─────────────────────────────────────────────────────────────┐
│  DEVELOP      │  GROWTH       │  SCALE                      │
│  $99/month    │  $299/month   │  $599/month                 │
├───────────────┼───────────────┼─────────────────────────────┤
│ 5M API calls  │ 25M API calls │ 100M API calls              │
│ 50GB/day      │ 200GB/day     │ 500GB/day                   │
│ $0.08/1k over │ $0.06/1k over │ $0.04/1k overage           │
│ 17% annual    │ 17% annual    │ 17% annual discount         │
└───────────────┴───────────────┴─────────────────────────────┘
```

### Structure B: Documentation Pricing
**Location:** `/apps/web-docs/src/app/introduction/pricing/page.tsx`

```
┌─────────────────────────────────────────────────────────────┐
│  FREE         │  PRO          │  ENTERPRISE                 │
│  $0/month     │  $49/month    │  Custom                     │
├───────────────┼───────────────┼─────────────────────────────┤
│ 1,000 rows    │ 100k rows     │ Unlimited rows              │
│ 10MB files    │ 100MB files   │ Custom file sizes           │
│ 60 API/min    │ 600 API/min   │ Custom rate limits          │
│ 20% annual    │ 20% annual    │ Custom discount             │
└───────────────┴───────────────┴─────────────────────────────┘
```

### Structure C: Frontend Package
**Location:** `/packages/frontend/src/app/pricing/page.tsx`

```
┌─────────────────────────────────────────────────────────────┐
│  STARTER      │  PROFESSIONAL │  ENTERPRISE                 │
│  $99/month    │  $299/month   │  Custom                     │
├───────────────┼───────────────┼─────────────────────────────┤
│ 10k API calls │ 100k API calls│ Unlimited calls             │
│ 50GB process  │ 500GB process │ Custom processing           │
│ Standard fmt  │ All formats   │ All + custom formats        │
│ 14-day trial  │ 14-day trial  │ Contact sales               │
└───────────────┴───────────────┴─────────────────────────────┘
```

---

## 2. COMPARISON TABLE: INCONSISTENCIES

### Tier Names
| Application | Tier 1 | Tier 2 | Tier 3 |
|-------------|--------|--------|--------|
| **Main Landing** | Develop | Growth | Scale |
| **Documentation** | Free | Pro | Enterprise |
| **Frontend Package** | Starter | Professional | Enterprise |
| **Status** | ❌ INCONSISTENT | ❌ INCONSISTENT | ❌ INCONSISTENT |

### Pricing
| Application | Tier 1 Price | Tier 2 Price | Tier 3 Price |
|-------------|--------------|--------------|--------------|
| **Main Landing** | $99 | $299 | $599 |
| **Documentation** | $0 | $49 | Custom |
| **Frontend Package** | $99 | $299 | Custom |
| **Status** | ⚠️ CONFLICT ($0 vs $99) | ⚠️ CONFLICT ($49 vs $299) | ⚠️ CONFLICT |

### Annual Discount
| Application | Discount Rate | Calculation |
|-------------|---------------|-------------|
| **Main Landing** | 17% | 2 months free (×10÷12) |
| **Documentation** | 20% | Standard discount |
| **Frontend Package** | Not mentioned | N/A |
| **Status** | ❌ INCONSISTENT | ❌ INCONSISTENT |

### Quota Units
| Application | Primary Metric | Secondary Metric |
|-------------|----------------|------------------|
| **Main Landing** | API calls (5M/25M/100M) | Daily GB (50/200/500) |
| **Documentation** | Monthly rows (1k/100k/unlimited) | File MB (10/100/custom) |
| **Frontend Package** | Monthly API calls (10k/100k/unlimited) | Processing GB (50/500/custom) |
| **Status** | ❌ COMPLETELY DIFFERENT | ❌ COMPLETELY DIFFERENT |

### Trial Period
| Application | Trial Duration | Details |
|-------------|----------------|---------|
| **Main Landing** | Unspecified | "free trial period" |
| **Documentation** | 14 days | "14-day free trial" |
| **Frontend Package** | 14 days | "14-day free trial • No credit card" |
| **Status** | ⚠️ INCONSISTENT |

---

## 3. FEATURE CLAIM CONFLICTS

### ML Framework Support

**Main Pricing FAQ:**
```
Develop tier: "includes scikit-learn access"
Growth tier: "adds TensorFlow and PyTorch support"
Scale tier: "all ML frameworks plus large model support up to 5GB"
```

**Feature Matrix (Same Page):**
```
Develop tier: "TensorFlow integration"  ← CONFLICTS with FAQ!
Growth tier: "Multi-framework support"
Scale tier: "Advanced ML Operations"
```

**Detailed Features:**
```
Develop: "scikit-learn only"  ← CONFLICTS with both above!
Growth: "+ TensorFlow + PyTorch"
Scale: "All frameworks + large models (5GB)"
```

### BYOS (Bring Your Own Storage)

**Feature Matrix:**
```
Develop: ✓ (checkmark shown)
Growth: ✓ (checkmark shown)
Scale: ✓ (checkmark shown)
```

**Plan Highlights:**
```
Develop: NOT LISTED in highlights
Growth: "Bring Your Own Storage" ← Listed
Scale: "Bring Your Own Storage" ← Listed
```

**Conclusion:** Unclear if Develop tier actually has BYOS access

### Data Processing Claims

**Performance Page:**
```
"6x faster processing" - No baseline specified
"40-60% less memory" (Develop)
"50-70% less memory" (Growth)
"70-80% less memory" (Scale)
```

**Question:** Compared to what? No reference implementation mentioned.

---

## 4. AMBIGUOUS QUOTA CONVERSIONS

### The Row vs API Call Problem

**Documentation says:**
- Free: 1,000 rows/month
- Pro: 100,000 rows/month
- Enterprise: Unlimited rows

**Main pricing says:**
- Develop: 5,000,000 API calls/month
- Growth: 25,000,000 API calls/month
- Scale: 100,000,000 API calls/month

**Question:** How do rows convert to API calls?
- Is 1 row = 1 API call?
- Is processing 1,000 rows = 1 API call?
- No documentation exists to reconcile these metrics

### The GB vs Row Problem

**Main pricing:**
- Develop: 50GB/day processing limit

**Documentation:**
- Free: 1,000 rows/month limit

**Question:** How many rows fit in 1GB?
- CSV file size varies by column count/types
- No conversion factor provided

---

## 5. MISSING CROSS-REFERENCES

### Features Mentioned in One Place Only

**Only in Documentation Pricing:**
- Rate limits (60/600/custom API calls per minute)
- Concurrent jobs (1/5/custom)
- Row-based quotas
- Overage: $0.001 per additional row

**Only in Main Pricing:**
- Overage: $0.08/$0.06/$0.04 per 1k API calls
- Streaming connection limits (2/10/100+)
- ML training quotas (5/50/500 jobs per day)
- ML inference quotas (100/1k/10k per hour)
- Daily GB processing limits

**Only in Frontend Package:**
- SOC 2, GDPR compliance mentions
- SSO + SAML for Enterprise
- On-premise deployment
- Dedicated support

---

## 6. SUPPORT & SLA INCONSISTENCIES

### Support Claims

**Main Pricing:**
```
Develop: Business hours (9am-5pm)
Growth: 24/7 support
Scale: 24/7 support + <4 hour response
```

**Frontend Package:**
```
Starter: Email support
Professional: Priority support
Enterprise: Dedicated support
```

**Question:** What's the actual support level per tier?

### SLA Guarantees

**Main Pricing:**
```
Develop: 99.0% uptime
Growth: 99.5% uptime
Scale: 99.9% uptime
```

**Other Pages:**
- No SLA mentioned in Documentation pricing
- No SLA mentioned in Frontend package pricing

**Question:** Are SLAs contractual or aspirational?

---

## 7. IMPACT ASSESSMENT

### User Experience Impact
| Scenario | Impact | Severity |
|----------|--------|----------|
| User enters via docs, sees $49 Pro plan | Confused when checkout shows $299 Growth | 🔴 CRITICAL |
| User expects Free tier from docs | No free tier exists in main pricing | 🔴 CRITICAL |
| User calculates cost based on rows | Billing is based on API calls | 🔴 CRITICAL |
| Annual discount varies by page | Financial discrepancy (17% vs 20%) | 🟠 HIGH |
| Trial duration unclear | User expectations mismatch | 🟡 MEDIUM |

### Business Impact
- **Revenue Risk:** Users may claim false advertising if charged different amounts
- **Legal Risk:** Inconsistent pricing could violate consumer protection laws
- **Brand Risk:** Erodes trust in product professionalism
- **Sales Risk:** Confusion leads to abandoned purchases
- **Support Risk:** Increased tickets from confused customers

### Technical Debt Impact
- **Maintenance:** Three separate pricing implementations to maintain
- **Testing:** Need to test three different pricing flows
- **Updates:** Changes must be synchronized across three codebases
- **Documentation:** Impossible to document "correct" pricing

---

## 8. ROOT CAUSE ANALYSIS

### Why This Happened

1. **No Single Source of Truth:**
   - Each frontend team implemented their own pricing
   - No shared pricing configuration library
   - No centralized pricing constants

2. **No Cross-App Validation:**
   - No automated tests comparing pricing across apps
   - No design review process for pricing changes
   - No product owner enforcing consistency

3. **Divergent Evolution:**
   - Main landing updated to Develop/Growth/Scale
   - Docs kept Free/Pro/Enterprise
   - Frontend package created separate structure

4. **Metric Confusion:**
   - Product team uses "rows" in requirements
   - Engineering team uses "API calls" in implementation
   - No agreement on primary unit of measurement

---

## 9. RECOMMENDED RESOLUTION PATH

### Phase 1: Immediate (This Week)

1. **Establish Single Source of Truth:**
   ```typescript
   // Create: packages/config/pricing/tiers.ts
   export const PRICING_TIERS = {
     develop: { name: 'Develop', price: 99, ... },
     growth: { name: 'Growth', price: 299, ... },
     scale: { name: 'Scale', price: 599, ... }
   }
   ```

2. **Disable Conflicting Pages:**
   - Add warning banner to docs pricing page
   - Redirect to main pricing
   - Or update to match main structure

3. **Emergency Product Meeting:**
   - Decide: Which structure is correct?
   - Decide: Which tier names to use?
   - Decide: Primary quota metric (rows vs API calls vs GB)

### Phase 2: Short-term (Next Sprint)

1. **Update All Frontend Apps:**
   - Import from shared pricing config
   - Remove local pricing definitions
   - Ensure consistent rendering

2. **Reconcile Metrics:**
   - Document conversion: rows ↔ API calls ↔ GB
   - Or pick single metric and deprecate others
   - Update all documentation

3. **Add Validation:**
   ```typescript
   // Automated test
   test('all apps show same pricing', () => {
     const mainPricing = getMainPricing()
     const docsPricing = getDocsPricing()
     const frontendPricing = getFrontendPricing()
     expect(mainPricing).toEqual(docsPricing)
     expect(docsPricing).toEqual(frontendPricing)
   })
   ```

### Phase 3: Long-term (Next Quarter)

1. **Centralized Pricing Service:**
   - Backend API provides pricing configuration
   - Frontend apps fetch pricing from API
   - Single database of truth

2. **Pricing Admin Panel:**
   - Product team can update pricing
   - Changes propagate to all frontends
   - Version history and rollback

3. **Comprehensive Documentation:**
   - Pricing strategy document
   - Feature-to-tier mapping
   - Quota conversion tables
   - Migration guides

---

## 10. DECISION MATRIX

### Option A: Use Main Landing Structure
✅ **Pros:**
- Most comprehensive feature set
- Dynamic pricing calculator
- Well-designed UI
- Includes overage pricing

❌ **Cons:**
- Most expensive (no free tier)
- Complex overage calculations
- Higher barrier to entry

### Option B: Use Documentation Structure
✅ **Pros:**
- Includes free tier (lead generation)
- Simple row-based pricing
- Lower entry price ($49)

❌ **Cons:**
- Less comprehensive features
- Doesn't match backend implementation (assumed)
- Row-based quotas hard to enforce

### Option C: Hybrid Approach
✅ **Pros:**
- Best of both worlds
- Free tier + growth tiers
- Clear upgrade path

❌ **Cons:**
- Requires new implementation
- More tiers to maintain
- Higher complexity

---

## 11. IMMEDIATE ACTION ITEMS

### Critical (Do Today):
- [ ] **Identify authoritative source:** Which pricing structure is correct?
- [ ] **Check backend:** What tiers does the backend actually enforce?
- [ ] **Disable conflicting pages:** Add "under review" banner to incorrect pages
- [ ] **Communicate to team:** Alert sales, support, marketing about inconsistencies

### High Priority (This Week):
- [ ] **Product decision:** Finalize tier names (Develop/Growth/Scale vs Free/Pro/Enterprise)
- [ ] **Product decision:** Finalize pricing ($99/$299/$599 vs $0/$49/Custom)
- [ ] **Product decision:** Primary quota metric (API calls vs rows vs GB)
- [ ] **Engineering:** Create shared pricing config package
- [ ] **Update all apps:** Import from shared config
- [ ] **Testing:** Add cross-app pricing validation tests

### Medium Priority (Next Sprint):
- [ ] **Documentation:** Update all docs to match chosen structure
- [ ] **FAQ:** Consolidate FAQs and ensure consistency
- [ ] **Analytics:** Track which pages users see before signup
- [ ] **A/B Testing:** Test different pricing structures for conversion

---

## 12. STAKEHOLDER COMMUNICATION

### To Product Team:
```
URGENT: Pricing inconsistencies discovered across frontend apps.
Three different structures exist with conflicting tiers and prices.
Need decision on authoritative source by EOW.
```

### To Engineering Team:
```
Found pricing config in 3 separate locations with different values.
Need to consolidate into shared package.
Backend validation required - which tiers are actually implemented?
```

### To Sales/Marketing:
```
IMPORTANT: Multiple pricing pages show different prices.
Do not reference specific tiers/prices until resolved.
Use "contact sales" for all pricing inquiries.
```

### To Support Team:
```
HEADS UP: Users may report seeing different prices.
Known issue - being resolved this week.
Script: "We're updating our pricing presentation. Please refer to [CHOSEN PAGE]."
```

---

## 13. VALIDATION CHECKLIST

### Before Going Live:
- [ ] All frontend apps show identical tier names
- [ ] All frontend apps show identical prices
- [ ] All frontend apps show identical quotas (in consistent units)
- [ ] All frontend apps show identical annual discounts
- [ ] All frontend apps show identical trial periods
- [ ] Backend enforcement matches frontend claims
- [ ] Overage pricing is consistent (if applicable)
- [ ] Feature availability matches tier claims
- [ ] SLA guarantees are contractually binding
- [ ] Support levels are resourced and staffed
- [ ] Legal review of pricing terms completed
- [ ] Marketing materials updated
- [ ] Sales team trained on new structure
- [ ] Support scripts updated
- [ ] Analytics tracking implemented

---

## CONCLUSION

**Status:** 🔴 CRITICAL - Multiple pricing structures in production

**Recommendation:** IMMEDIATE consolidation required

**Next Steps:**
1. Emergency product meeting (today)
2. Identify authoritative source (today)
3. Create shared config package (this week)
4. Update all apps (next sprint)
5. Validate with backend (next sprint)

**Owner:** Product + Engineering Leadership

**Timeline:** Resolution required within 1 week

---

**Report Generated:** 2025-10-08
**Analyzed Files:**
- `/apps/web-landing/src/components/sections/Pricing.tsx`
- `/apps/web-landing/app/pricing/page.tsx`
- `/apps/web-docs/src/app/introduction/pricing/page.tsx`
- `/packages/frontend/src/app/pricing/page.tsx`

**Severity Level:** 🔴 CRITICAL
