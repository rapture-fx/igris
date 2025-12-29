export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081';

export const API_ENDPOINTS = {
  // Auth
  LOGIN: '/v1/auth/login',
  REGISTER: '/v1/auth/register',
  REFRESH: '/v1/auth/refresh',
  LOGOUT: '/v1/auth/logout',
  SESSIONS: '/v1/auth/sessions',

  // Tenants
  TENANTS: '/v1/tenants',
  TENANT_CURRENT: '/v1/tenants/current',

  // Vault
  VAULT_KEYS: '/v1/vault/keys',
  VAULT_KEY: (id: string) => `/v1/vault/keys/${id}`,

  // Usage & Analytics
  USAGE: '/v1/usage',
  USAGE_SUMMARY: '/v1/usage/summary',
  METRICS: '/v1/metrics',

  // Policy
  POLICY: '/v1/policy',

  // Audit
  AUDIT_RECENT: '/v1/audit/recent',

  // Inference
  INFER: '/v1/infer',
  MODELS: '/v1/models',
};

export const COOKIE_KEYS = {
  JWT: 'jwt',
  REFRESH_TOKEN: 'refresh_token',
};

export const LOCAL_STORAGE_KEYS = {
  THEME: 'theme',
  SIDEBAR_COLLAPSED: 'sidebar_collapsed',
};

export const QUERY_KEYS = {
  TENANT: 'tenant',
  VAULT_KEYS: 'vault_keys',
  USAGE: 'usage',
  USAGE_SUMMARY: 'usage_summary',
  POLICY: 'policy',
  AUDIT: 'audit',
  MODELS: 'models',
};

export const ROUTES = {
  HOME: '/',
  LOGIN: '/auth/login',
  REGISTER: '/auth/register',
  DASHBOARD: '/dashboard',

  // Overture (Cloud Gateway)
  OVERTURE_PROVIDERS: '/dashboard/overture/providers',
  OVERTURE_ROUTING: '/dashboard/overture/routing',
  OVERTURE_COST: '/dashboard/overture/cost',
  OVERTURE_SHADOW: '/dashboard/overture/shadow',
  OVERTURE_ESCAPE: '/dashboard/overture/escape',

  // Runtime (Edge Execution)
  RUNTIME_FLEET: '/dashboard/runtime/fleet',
  RUNTIME_DEVICES: '/dashboard/runtime/devices',
  RUNTIME_CONFIG: '/dashboard/runtime/config',
  RUNTIME_SWARM: '/dashboard/runtime/swarm',

  // Agents
  AGENTS_PLANNING: '/dashboard/agents/planning',
  AGENTS_TOOLS: '/dashboard/agents/tools',
  AGENTS_QLORA: '/dashboard/agents/qlora',

  // Legacy routes (kept for backwards compatibility)
  USAGE: '/dashboard/usage',
  VAULT: '/dashboard/vault',
  PROVIDERS: '/dashboard/providers',
  POLICY: '/dashboard/policy',
  SETTINGS: '/dashboard/settings',
};

export const PROVIDERS = [
  { id: 'openai', name: 'OpenAI' },
  { id: 'anthropic', name: 'Anthropic' },
  { id: 'google', name: 'Google Gemini' },
  { id: 'xai', name: 'xAI (Grok)' },
  { id: 'moonshot', name: 'Moonshot AI (Kimi)' },
  { id: 'meta', name: 'Meta AI (Llama)' },
  { id: 'aws-bedrock', name: 'AWS Bedrock' },
  { id: 'azure-openai', name: 'Azure OpenAI' },
  { id: 'mistral', name: 'Mistral AI' },
  { id: 'cohere', name: 'Cohere' },
  { id: 'perplexity', name: 'Perplexity' },
  { id: 'groq', name: 'Groq' },
  { id: 'fireworks', name: 'Fireworks AI' },
  { id: 'together', name: 'Together AI' },
  { id: 'cerebras', name: 'Cerebras' },
  { id: 'deepseek', name: 'DeepSeek' },
  { id: 'octoai', name: 'OctoAI' },
  { id: 'replicate', name: 'Replicate' },
  { id: 'lepton', name: 'Lepton AI' },
  { id: 'hyperbolic', name: 'Hyperbolic' },
];

export const CHART_COLORS = {
  primary: '#114dcd',
  secondary: '#299a93',
  tertiary: '#1f53d0',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  gray: '#6b7280',
};
