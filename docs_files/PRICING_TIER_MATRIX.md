# Pricing Tier Feature Matrix
**Quick Reference Guide**

## Primary Pricing Structure (Authoritative Source)
**Source:** `/apps/web-landing/src/components/sections/Pricing.tsx`

---

## Tier Overview

| Metric | Develop | Growth | Scale |
|--------|---------|--------|-------|
| **Monthly Price** | $99 | $299 | $599 |
| **Annual Price** | ~$82.50/mo | ~$249/mo | ~$499/mo |
| **Discount** | 17% (2 months free) | 17% (2 months free) | 17% (2 months free) |

---

## API & Processing Quotas

| Quota Type | Develop | Growth | Scale |
|------------|---------|--------|-------|
| **API Calls Included** | 5,000,000 | 25,000,000 | 100,000,000 |
| **Overage Cost (per 1k calls)** | $0.08 | $0.06 | $0.04 |
| **Daily Processing Limit** | 50 GB | 200 GB | 500 GB |
| **Max File Size** | 10 GB | 25 GB | 50 GB |
| **Processing Architecture** | Streaming pipeline | Memory-optimized | Parallel distributed |
| **Memory Efficiency** | 40-60% reduction | 50-70% reduction | 70-80% reduction |

---

## ML & AI Capabilities

| Feature | Develop | Growth | Scale |
|---------|---------|--------|-------|
| **ML Frameworks** | scikit-learn only | + TensorFlow, PyTorch | All frameworks + large models (5GB) |
| **Training Jobs/Day** | 5 | 50 | 500 |
| **Inferences/Hour** | 100 | 1,000 | 10,000 |
| **ML Resource Memory** | 2 GB | 8 GB | 32 GB |
| **Framework Export** | TensorFlow only | TensorFlow + PyTorch | All + Custom |
| **Data Registry** | ✗ | ✓ | ✓ |
| **Feature Engineering** | Basic | Advanced | Custom Pipelines |

---

## Data Integration

| Feature | Develop | Growth | Scale |
|---------|---------|--------|-------|
| **Database Connectors** | PostgreSQL, MySQL, MongoDB | + Snowflake, Elasticsearch | + Enterprise DBs |
| **Streaming Connections** | 2 WebSocket | 10 (WS, Kafka, Redis) | 100+ (incl. MQTT, SSE, gRPC) |
| **Real-time Processing** | ✗ | ✓ | ✓ |
| **Webhook Integration** | ✗ | ✓ | ✓ |
| **Stream-to-Webhook** | ✗ | 10/min rate limit | 100/min rate limit |
| **Advanced Patterns** | ✗ | Basic | GraphQL, MQTT, SSE, gRPC |
| **BYOS (Bring Your Own Storage)** | ✓ | ✓ | ✓ |
| **Automated Error Recovery** | ✗ | ✓ | ✓ |

---

## Security & Compliance

| Feature | Develop | Growth | Scale |
|---------|---------|--------|-------|
| **Multi-Factor Auth (MFA)** | ✓ | ✓ | ✓ |
| **Single Sign-On (SSO)** | ✗ | ✓ | ✓ |
| **Data Encryption** | Basic | Advanced | Advanced Plus |
| **Security Controls** | ✗ | Advanced | Advanced |
| **Request Monitoring** | ✗ | Basic tracking | Advanced analytics |

---

## Monitoring & Operations

| Feature | Develop | Growth | Scale |
|---------|---------|--------|-------|
| **SLA Uptime** | 99.0% | 99.5% | 99.9% |
| **Metrics Dashboard** | Basic | Live with quota viz | Advanced + custom |
| **Integration Health** | ✗ | Connector monitoring | Full suite + alerting |
| **Performance Monitoring** | Essential | Advanced dashboards | Comprehensive analytics |
| **Smart Alerting** | ✗ | ✓ | ✓ |
| **Analytics & Reporting** | Essential | Advanced insights | Custom dashboards |
| **High Availability** | ✗ | ✗ | Priority infrastructure |

---

## Team & Support

| Feature | Develop | Growth | Scale |
|---------|---------|--------|-------|
| **Team Members** | 3 | 15 | 50 |
| **API Key Management** | Basic | Advanced | Full management |
| **Team Roles** | Basic | Advanced + invites | Full RBAC + SSO |
| **Self-Service Portal** | ✗ | Usage + basic mgmt | Dedicated portal |
| **Support Hours** | Business hours (9-5) | 24/7 | 24/7 |
| **Response Time** | Standard | Standard | <4 hours |
| **Load Testing** | ✗ | ✗ | Performance validation |

---

## Key Feature Highlights

### Develop Tier
- Entry-level for individual developers and small teams
- 5M API calls, 50GB daily processing
- Basic ML with scikit-learn
- 2 WebSocket connections
- 3 team members
- Business hours support

### Growth Tier (Most Popular)
- Enhanced performance for growing teams
- 25M API calls, 200GB daily processing
- TensorFlow + PyTorch support
- 10 streaming connections (WebSocket, Kafka, Redis)
- Real-time metrics and monitoring
- Bring Your Own Storage (BYOS)
- 15 team members
- 24/7 support

### Scale Tier
- Maximum performance for high-volume workloads
- 100M API calls, 500GB daily processing
- All ML frameworks + large models (5GB)
- 100+ streaming connections (MQTT, SSE, gRPC)
- Advanced integration patterns (GraphQL, MQTT, SSE)
- Dedicated self-service portal
- 50 team members
- Priority support with <4hr response

---

## Pricing Calculation Examples

### Example 1: Within Included Quota
- Tier: Growth ($299)
- API Calls: 20M (within 25M included)
- **Total Cost:** $299/month

### Example 2: With Overage
- Tier: Growth ($299)
- API Calls: 30M (5M over limit)
- Overage: 5,000,000 calls = 5,000 blocks of 1k
- Overage Cost: 5,000 × $0.06 = $300
- **Total Cost:** $299 + $300 = $599/month

### Example 3: Tier Comparison for High Usage
**50M API Calls/month:**
- Develop: $99 + (45M × $0.08/1k) = $99 + $3,600 = $3,699
- Growth: $299 + (25M × $0.06/1k) = $299 + $1,500 = $1,799
- Scale: $599 (within 100M limit) = $599
- **Recommended:** Scale tier (lowest cost)

---

## Validation Checklist

### Critical Validations Required:
- [ ] Verify tier names match backend (Develop/Growth/Scale)
- [ ] Confirm API call quota enforcement (5M/25M/100M)
- [ ] Validate overage pricing ($0.08/$0.06/$0.04 per 1k)
- [ ] Check daily processing limits (50GB/200GB/500GB)
- [ ] Verify file size limits (10GB/25GB/50GB)
- [ ] Confirm ML framework access per tier
- [ ] Validate streaming connection limits (2/10/100+)
- [ ] Check training job quotas (5/50/500 per day)
- [ ] Verify inference quotas (100/1k/10k per hour)
- [ ] Confirm SLA enforcement (99.0%/99.5%/99.9%)
- [ ] Validate BYOS availability (all tiers or Growth+?)
- [ ] Check SSO implementation (Growth+ only?)
- [ ] Verify support hours and response times
- [ ] Confirm annual discount calculation (17%)

### Inconsistencies to Resolve:
- [ ] Multiple pricing structures across frontend apps
- [ ] Conflicting annual discounts (17% vs 20%)
- [ ] Inconsistent quota units (API calls vs rows vs GB)
- [ ] Different tier names (Develop/Growth/Scale vs Free/Pro/Enterprise)
- [ ] ML framework support claims (FAQ vs feature matrix)
- [ ] BYOS availability (all tiers vs Growth+ only)
- [ ] Trial period duration (unspecified vs 14 days)

---

## FAQ Quick Reference

**Q: What's included in API calls?**
- Each API request counts as one call
- Includes: upload, extract, transform, train, inference

**Q: How does BYOS work?**
- Connect to AWS S3, Google Cloud, or Azure storage
- Process data in your infrastructure
- No data transfer costs
- Daily limits apply only to API processing

**Q: Can I upgrade/downgrade anytime?**
- Yes, immediate effect with prorated billing

**Q: What happens if I exceed my quota?**
- Receive notifications near limits
- Automatic overage charges apply
- Can upgrade plan or purchase additional capacity

**Q: What's the annual discount?**
- 17% discount (equivalent to 2 months free)
- Calculated as: (monthly × 10) / 12

**Q: What's the refund policy?**
- 30-day money-back guarantee on all paid plans

---

**Last Updated:** 2025-10-08
**Source Files:**
- Primary: `/apps/web-landing/src/components/sections/Pricing.tsx`
- Page: `/apps/web-landing/app/pricing/page.tsx`
