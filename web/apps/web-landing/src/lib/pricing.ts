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

export const PRICING_TIERS: PricingTier[] = [
  {
    key: 'seed',
    name: 'Seed',
    price: '$19',
    period: '/ month',
    description: 'For builders validating verified AI execution.',
    features: [
      '1 project',
      '1 execution environment',
      '2,500 verified runs / month',
      'Signed execution records',
      'Execution events',
      'Basic receipt verification',
      'API + SDK access',
      '7-day retention',
    ],
    cta: 'Start with Seed',
    checkoutUrl: 'https://buy.polar.sh/polar_cl_glOcj9vjtqWIDXsJi2TARGLGR5ZJ3TxmaWUSY3D5Jhl',
    recommended: false,
  },
  {
    key: 'horizon',
    name: 'Horizon',
    price: '$79',
    period: '/ month',
    description: 'For teams running governed AI tasks.',
    features: [
      '5 projects',
      '10 execution environments',
      '50,000 verified runs / month',
      'Everything in Seed',
      'Failure-path configuration',
      'Tool and permission controls',
      'Team access',
      'Advanced event search',
      '60-day retention',
      'Priority email support',
    ],
    cta: 'Get Horizon',
    checkoutUrl: 'https://buy.polar.sh/polar_cl_UrT1qy0jLSgEtyCYtuSJPQnLfcwoOnLyeucnQ2rnF5O',
    recommended: true,
  },
  {
    key: 'infinite',
    name: 'Infinite',
    price: 'Custom',
    period: '',
    description: 'For private deployment and advanced governance.',
    features: [
      'Custom execution volume',
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
  { value: 'horizon', label: 'Horizon - $79/month' },
  { value: 'infinite', label: 'Infinite - Custom' },
] as const;

export const FLEET_GATING_COPY =
  'The fleet dashboard is included with every paid tier. Seed covers one execution environment with signed execution records, execution events, and baseline operator visibility. Horizon expands to 10 execution environments with team access, advanced event search, failure-path configuration, and tool controls. Infinite adds private deployment options, custom retention policy, advanced audit exports, dedicated onboarding, and security review support.';

export const RUNTIME_PLAN_COPY =
  'Deploy to one execution environment with Seed, expand to 10 environments plus team workflows with Horizon, or move to Infinite for private deployment and custom governance.';
