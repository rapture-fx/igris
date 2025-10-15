// Pricing configuration data structure
export interface PricingTier {
  name: string;
  base_price_monthly: number;
  base_price_yearly: number;
  inference_included_cpu: number;
  inference_included_gpu: number;
  models_included: number;
  model_types_allowed: string[];
  overage_cpu_per_1k: number;
  overage_gpu_per_1k: number | null;
  extra_model_cpu_monthly: number;
  extra_model_gpu_monthly: number | null;
  sla_uptime: number;
  features: string[];
}

export interface PricingConfig {
  version: string;
  effective_date: string;
  model: string;
  tiers: {
    starter: PricingTier;
    professional: PricingTier;
    enterprise: PricingTier;
  };
}

// Embedded pricing configuration (parsed from pricing.yaml at build time)
// This makes the data available in both browser and server contexts without Node.js dependencies
export const pricing: PricingConfig = {
  "version": "2.0.0",
  "effective_date": "2025-10-15",
  "model": "inference_orchestration",
  "tiers": {
    "starter": {
      "name": "Starter",
      "base_price_monthly": 99,
      "base_price_yearly": 1010,
      "inference_included_cpu": 500000,
      "inference_included_gpu": 0,
      "models_included": 2,
      "model_types_allowed": ["cpu"],
      "overage_cpu_per_1k": 0.20,
      "overage_gpu_per_1k": null,
      "extra_model_cpu_monthly": 75,
      "extra_model_gpu_monthly": null,
      "sla_uptime": 99.0,
      "features": [
        "gRPC Inference API",
        "REST API Endpoints",
        "Basic Monitoring",
        "Community Support"
      ]
    },
    "professional": {
      "name": "Professional",
      "base_price_monthly": 299,
      "base_price_yearly": 3051,
      "inference_included_cpu": 5000000,
      "inference_included_gpu": 500000,
      "models_included": 5,
      "model_types_allowed": ["cpu", "gpu"],
      "overage_cpu_per_1k": 0.15,
      "overage_gpu_per_1k": 1.50,
      "extra_model_cpu_monthly": 75,
      "extra_model_gpu_monthly": 250,
      "sla_uptime": 99.5,
      "features": [
        "Everything in Starter",
        "GPU Acceleration",
        "Multi-Model Routing (Thompson Sampling)",
        "Streaming Inference (WebSocket/SSE)",
        "Advanced Monitoring Dashboard",
        "Email Support (24/7)"
      ]
    },
    "enterprise": {
      "name": "Enterprise",
      "base_price_monthly": 999,
      "base_price_yearly": 10190,
      "inference_included_cpu": 50000000,
      "inference_included_gpu": 5000000,
      "models_included": 25,
      "model_types_allowed": ["cpu", "gpu"],
      "overage_cpu_per_1k": 0.10,
      "overage_gpu_per_1k": 1.00,
      "extra_model_cpu_monthly": 50,
      "extra_model_gpu_monthly": 200,
      "sla_uptime": 99.9,
      "features": [
        "Everything in Professional",
        "Drift Detection & Monitoring",
        "Distributed Tracing (Jaeger Access)",
        "Priority Support (<4hr response)",
        "Dedicated Account Manager",
        "Custom SLA Agreements"
      ]
    }
  }
};

/**
 * Calculate monthly bill for a given tier and usage
 * @param tier - The pricing tier (starter, professional, enterprise)
 * @param cpuInferences - Number of CPU inferences used
 * @param gpuInferences - Number of GPU inferences used
 * @param cpuModels - Number of CPU models deployed
 * @param gpuModels - Number of GPU models deployed
 * @param annual - Whether to calculate annual pricing
 * @returns Total monthly cost in dollars
 */
export function calculateMonthlyBill(
  tier: keyof PricingConfig['tiers'],
  cpuInferences: number,
  gpuInferences: number,
  cpuModels: number,
  gpuModels: number,
  annual: boolean = false
): number {
  const config = pricing.tiers[tier];
  let total = annual ? config.base_price_yearly / 12 : config.base_price_monthly;

  // Inference overages
  const cpuOverage = Math.max(0, cpuInferences - config.inference_included_cpu);
  const gpuOverage = Math.max(0, gpuInferences - config.inference_included_gpu);

  total += (cpuOverage / 1000) * config.overage_cpu_per_1k;
  if (config.overage_gpu_per_1k) {
    total += (gpuOverage / 1000) * config.overage_gpu_per_1k;
  }

  // Model-hour charges (simplified to monthly for MVP)
  const extraCPU = Math.max(0, cpuModels - config.models_included);
  total += extraCPU * config.extra_model_cpu_monthly;

  if (config.extra_model_gpu_monthly) {
    // For Starter tier, all GPU models are extra (limit is 0)
    // For other tiers, count GPU models above included limit
    const extraGPU = tier === 'starter' ? gpuModels : Math.max(0, gpuModels - Math.floor(config.models_included / 2));
    total += extraGPU * config.extra_model_gpu_monthly;
  }

  return Math.round(total * 100) / 100; // Round to 2 decimal places
}

/**
 * Get the recommended tier based on usage patterns
 * @param cpuInferences - Expected monthly CPU inferences
 * @param gpuInferences - Expected monthly GPU inferences
 * @param models - Total number of models
 * @returns Recommended tier key
 */
export function getRecommendedTier(
  cpuInferences: number,
  gpuInferences: number,
  models: number
): keyof PricingConfig['tiers'] {
  // If GPU is needed, at least Professional tier
  if (gpuInferences > 0) {
    if (cpuInferences > 5000000 || gpuInferences > 500000 || models > 5) {
      return 'enterprise';
    }
    return 'professional';
  }

  // CPU-only workloads
  if (cpuInferences > 5000000 || models > 5) {
    return 'professional';
  }

  if (cpuInferences > 50000000 || models > 25) {
    return 'enterprise';
  }

  return 'starter';
}

/**
 * Check if a tier supports a specific feature
 * @param tier - The tier to check
 * @param feature - The feature name
 * @returns Whether the tier includes the feature
 */
export function tierHasFeature(tier: keyof PricingConfig['tiers'], feature: string): boolean {
  const tierConfig = pricing.tiers[tier];
  return tierConfig.features.some(f => f.toLowerCase().includes(feature.toLowerCase()));
}

export default pricing;
