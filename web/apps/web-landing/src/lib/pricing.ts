export type PricingTierKey = 'seed' | 'horizon' | 'infinite';

export interface PricingTier {
  key: PricingTierKey;
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  cta: string;
  checkoutUrl: string;
  recommended: boolean;
}

export const PRICING_SUBTITLE =
  'Start with hosted action runs. Add workers when actions need private access.';

export const PRICING_TIERS: PricingTier[] = [
  {
    key: 'seed',
    name: 'Seed',
    price: '$19',
    period: '/ month',
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
    cta: 'Start with Seed',
    checkoutUrl: 'https://buy.polar.sh/polar_cl_glOcj9vjtqWIDXsJi2TARGLGR5ZJ3TxmaWUSY3D5Jhl',
    recommended: false,
  },
  {
    key: 'horizon',
    name: 'Horizon',
    price: '$149',
    period: '/ month',
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
    cta: 'Start Horizon',
    checkoutUrl: 'https://buy.polar.sh/polar_cl_UrT1qy0jLSgEtyCYtuSJPQnLfcwoOnLyeucnQ2rnF5O',
    recommended: true,
  },
  {
    key: 'infinite',
    name: 'Infinite',
    price: 'Custom',
    period: '',
    description: 'For private deployments, custom retention, and advanced governance.',
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
    cta: 'Contact sales',
    checkoutUrl: 'mailto:sales@igrisinertial.com',
    recommended: false,
  },
];

export const PLAN_INTEREST_OPTIONS = [
  { value: '', label: 'Select a plan' },
  { value: 'seed', label: 'Seed - $19/month' },
  { value: 'horizon', label: 'Horizon - $149/month' },
  { value: 'infinite', label: 'Infinite - Custom' },
] as const;

export const FLEET_GATING_COPY =
  'The fleet dashboard is included with every paid tier. Seed covers one execution environment with hosted actions, signed receipts, and baseline operator visibility. Horizon expands to 10 execution environments with connected workers, team access, advanced event search, recovery configuration, and tool controls. Infinite adds private deployment options, custom retention policy, advanced audit exports, dedicated onboarding, and security review support.';

export const RUNTIME_PLAN_COPY =
  'Deploy to one execution environment with Seed, expand to 10 environments plus team workflows with Horizon, or move to Infinite for private deployment and custom governance.';