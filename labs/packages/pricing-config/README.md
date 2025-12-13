# @schlep/pricing-config

Canonical pricing configuration package for Igris Overture's inference orchestration platform.

## Overview

This package provides a single source of truth for pricing tiers, quotas, and billing calculations across the Igris Overture platform.

## Features

- **Single Source of Truth**: All pricing data defined in `pricing.yaml`
- **Type-Safe**: Full TypeScript type definitions
- **Billing Calculator**: Built-in functions for cost calculations
- **Tier Recommendations**: Intelligent tier selection based on usage

## Installation

```bash
pnpm add @schlep/pricing-config
```

## Usage

### Import Pricing Data

```typescript
import { pricing, calculateMonthlyBill, getRecommendedTier } from '@schlep/pricing-config';

// Access tier information
console.log(pricing.tiers.professional.base_price_monthly); // 299

// Get all features for a tier
console.log(pricing.tiers.enterprise.features);
```

### Calculate Monthly Costs

```typescript
import { calculateMonthlyBill } from '@schlep/pricing-config';

// Calculate bill for Professional tier with usage
const cost = calculateMonthlyBill(
  'professional',  // tier
  6000000,        // CPU inferences (1M over limit)
  0,              // GPU inferences
  5,              // CPU models (at limit)
  0,              // GPU models
  false           // monthly (not annual)
);

console.log(`Monthly cost: $${cost}`); // $449 (base $299 + $150 overage)
```

### Get Tier Recommendations

```typescript
import { getRecommendedTier } from '@schlep/pricing-config';

const recommended = getRecommendedTier(
  10000000,  // 10M CPU inferences
  100000,    // 100K GPU inferences
  8          // 8 models
);

console.log(recommended); // 'professional'
```

## Pricing Structure

### Starter ($99/month)
- 500K CPU inferences included
- 2 CPU models
- $0.20 per 1K additional inferences
- 99.0% SLA

### Professional ($299/month)
- 5M CPU inferences OR 500K GPU inferences
- 5 models (any mix of CPU/GPU)
- $0.15 per 1K additional CPU inferences
- $1.50 per 1K additional GPU inferences
- 99.5% SLA

### Enterprise ($999/month)
- 50M CPU inferences OR 5M GPU inferences
- 25 models (any mix)
- $0.10 per 1K additional CPU inferences
- $1.00 per 1K additional GPU inferences
- 99.9% SLA

## Model-Hour Billing

Additional charges for deployed models beyond included quota:

| Tier | CPU Model (per month) | GPU Model (per month) |
|------|----------------------|----------------------|
| Starter | $75 | Not available |
| Professional | $75 | $250 |
| Enterprise | $50 | $200 |

## Development

```bash
# Build the package
pnpm build

# Run tests
pnpm test

# Lint code
pnpm lint
```

## License

MIT
