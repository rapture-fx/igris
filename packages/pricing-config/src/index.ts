import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

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

// Load pricing configuration from YAML file
const pricingYamlPath = path.join(__dirname, '..', 'pricing.yaml');
const pricingYamlContent = fs.readFileSync(pricingYamlPath, 'utf8');
export const pricing: PricingConfig = yaml.load(pricingYamlContent) as PricingConfig;

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
