export type PricingTierKey = 'seed' | 'horizon' | 'infinite';
export type BillingInterval = 'monthly' | 'yearly';

export interface TierBillingOption {
  price: string;
  period: string;
  comparePrice?: string;
  detail?: string;
  checkoutUrl: string;
  cta: string;
}

export interface PricingTier {
  key: PricingTierKey;
  name: string;
  description: string;
  features: string[];
  recommended: boolean;
  monthly: TierBillingOption;
  yearly: TierBillingOption | null;
}

export const YEARLY_TOGGLE_LABEL = '2 months free';

export const PRICING_SUBTITLE =
  'Start with hosted action runs. Add workers when actions need private access.';

export const PRICING_TIERS: PricingTier[] = [
  {
    key: 'seed',
    name: 'Seed',
    description: 'For solo builders testing controlled agent actions.',
    features: [
      '1 project',
      '1 execution environment',
      '2,500 action runs / month',
      'Hosted actions',
      'Signed receipts',
      'Basic receipt verification',
      'API + MCP access',
      '7-day retention',
    ],
    recommended: false,
    monthly: {
      price: '$19',
      period: '/ month',
      checkoutUrl: 'https://buy.polar.sh/polar_cl_glOcj9vjtqWIDXsJi2TARGLGR5ZJ3TxmaWUSY3D5Jhl',
      cta: 'Start with Seed',
    },
    yearly: {
      price: '$15',
      period: '/ mo',
      comparePrice: '$19',
      detail: 'Billed annually · Save $48/year',
      checkoutUrl: 'https://buy.polar.sh/polar_cl_glOcj9vjtqWIDXsJi2TARGLGR5ZJ3TxmaWUSY3D5Jhl',
      cta: 'Start Seed yearly',
    },
  },
  {
    key: 'horizon',
    name: 'Horizon',
    description: 'For teams running agent actions in production.',
    features: [
      '5 projects',
      '10 execution environments',
      '50,000 action runs / month',
      'Everything in Seed',
      'Connected workers',
      'Recovery configuration',
      'Tool and permission controls',
      'Team access',
      'Advanced event search',
      '60-day retention',
      'Priority support',
    ],
    recommended: true,
    monthly: {
      price: '$149',
      period: '/ month',
      checkoutUrl: 'https://buy.polar.sh/polar_cl_UrT1qy0jLSgEtyCYtuSJPQnLfcwoOnLyeucnQ2rnF5O',
      cta: 'Start Horizon',
    },
    yearly: {
      price: '$119',
      period: '/ mo',
      comparePrice: '$149',
      detail: 'Billed annually · Save $360/year',
      checkoutUrl: 'https://buy.polar.sh/polar_cl_UrT1qy0jLSgEtyCYtuSJPQnLfcwoOnLyeucnQ2rnF5O',
      cta: 'Start Horizon yearly',
    },
  },
  {
    key: 'infinite',
    name: 'Infinite',
    description: 'For private deployments, custom retention, and custom controls.',
    features: [
      'Custom action volume',
      'Custom execution environments',
      'Everything in Horizon',
      'Private deployment options',
      'Custom retention policy',
      'Advanced audit exports',
      'Dedicated onboarding',
      'Security review support',
    ],
    recommended: false,
    monthly: {
      price: 'Custom',
      period: '',
      checkoutUrl: 'mailto:sales@igrisinertial.com',
      cta: 'Contact sales',
    },
    yearly: null,
  },
];

export function getTierBilling(tier: PricingTier, interval: BillingInterval): TierBillingOption {
  if (interval === 'yearly' && tier.yearly) return tier.yearly;
  return tier.monthly;
}

export const PLAN_INTEREST_OPTIONS = [
  { value: '', label: 'Select a plan' },
  { value: 'seed', label: 'Seed - $19/month' },
  { value: 'horizon', label: 'Horizon - $149/month' },
  { value: 'infinite', label: 'Infinite - Custom' },
] as const;

export const FLEET_GATING_COPY =
  'The fleet dashboard is included with every paid tier. Seed covers one execution environment with hosted actions, signed receipts, and baseline operator visibility. Horizon expands to 10 execution environments with connected workers, team access, advanced event search, recovery configuration, and tool controls. Infinite adds private deployment options, custom retention policy, advanced audit exports, dedicated onboarding, and security review support.';

export const RUNTIME_PLAN_COPY =
  'Deploy to one execution environment with Seed, expand to 10 environments plus team workflows with Horizon, or move to Infinite for private deployment and custom controls.';