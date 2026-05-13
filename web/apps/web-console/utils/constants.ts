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

  // EscapeVector
  ESCAPEVECTOR_STATUS: '/v1/escapevector/status',
  ESCAPEVECTOR_CONFIG: '/v1/escapevector/config',
  ESCAPEVECTOR_HISTORY: '/v1/escapevector/history',
  ESCAPEVECTOR_ANALYTICS: '/v1/escapevector/analytics',
  ESCAPEVECTOR_REFRESH: '/v1/escapevector/refresh',
  ESCAPEVECTOR_CACHE: '/v1/escapevector/cache',

  // Shadow Mode
  SHADOW_STATUS: '/v1/shadow/status',
  SHADOW_CONFIG: '/v1/shadow/config',
  SHADOW_ANALYTICS: '/v1/shadow/analytics',
  SHADOW_LOGS: '/v1/shadow/logs',
  SHADOW_START: '/v1/shadow/start',
  SHADOW_STOP: '/v1/shadow/stop',
  SHADOW_PROMOTE: '/v1/shadow/promote',

  // Speculative Router
  SPECULATIVE_STATUS: '/v1/routing/speculative/status',
  SPECULATIVE_CONFIG: '/v1/routing/speculative/config',
  SPECULATIVE_ANALYTICS: '/v1/routing/speculative/analytics',
  SPECULATIVE_RACES: '/v1/routing/speculative/races',
  SPECULATIVE_SIMULATE: '/v1/routing/speculative/simulate',

  // Cognitive Advisor
  COGNITIVE_STATUS: '/v1/cognitive/status',
  COGNITIVE_OBSERVATIONS: '/v1/cognitive/observations',
  COGNITIVE_RECOMMENDATIONS: '/v1/cognitive/recommendations',
  COGNITIVE_HISTORY: '/v1/cognitive/history',
  COGNITIVE_CONFIG: '/v1/cognitive/config',

  // Council Mode
  COUNCIL_STATUS: '/v1/council/status',
  COUNCIL_CONFIG: '/v1/council/config',
  COUNCIL_ANALYTICS: '/v1/council/analytics',
  COUNCIL_HISTORY: '/v1/council/history',
  COUNCIL_TEST: '/v1/council/test',

  // Federated Learning
  FEDERATED_STATUS: '/v1/federated/status',
  FEDERATED_PARTICIPANTS: '/v1/federated/participants',
  FEDERATED_ROUNDS: '/v1/federated/rounds',
  FEDERATED_ROUNDS_START: '/v1/federated/rounds/start',
  FEDERATED_CONFIG: '/v1/federated/config',

  // Multimodal
  MULTIMODAL_INFER: '/v1/infer/multimodal',
  MULTIMODAL_STATS: '/v1/infer/multimodal/stats',

  // Durable Tasks (WAL-backed execution)
  TASKS_SUBMIT: '/v1/tasks/submit',
  TASKS_LIST: '/v1/tasks',
  TASKS_GET: (id: string) => `/v1/tasks/${id}`,
  TASKS_STEPS: (id: string) => `/v1/tasks/${id}/steps`,

  // LoRA Training
  LORA_STATUS: '/v1/lora/status',
  LORA_TRIGGER: '/v1/lora/trigger',
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
  TASKS_LIST: 'tasks_list',
  TASKS_DETAIL: 'tasks_detail',
  TASKS_STEPS: 'tasks_steps',
  VAULT_KEYS: 'vault_keys',
  USAGE: 'usage',
  USAGE_SUMMARY: 'usage_summary',
  POLICY: 'policy',
  AUDIT: 'audit',
  MODELS: 'models',
  ESCAPEVECTOR_STATUS: 'escapevector_status',
  ESCAPEVECTOR_CONFIG: 'escapevector_config',
  ESCAPEVECTOR_HISTORY: 'escapevector_history',
  ESCAPEVECTOR_ANALYTICS: 'escapevector_analytics',
  SHADOW_STATUS: 'shadow_status',
  SHADOW_CONFIG: 'shadow_config',
  SHADOW_ANALYTICS: 'shadow_analytics',
  SHADOW_LOGS: 'shadow_logs',
  SPECULATIVE_STATUS: 'speculative_status',
  SPECULATIVE_CONFIG: 'speculative_config',
  SPECULATIVE_ANALYTICS: 'speculative_analytics',
  SPECULATIVE_RACES: 'speculative_races',
  COGNITIVE_STATUS: 'cognitive_status',
  COGNITIVE_OBSERVATIONS: 'cognitive_observations',
  COGNITIVE_RECOMMENDATIONS: 'cognitive_recommendations',
  COGNITIVE_HISTORY: 'cognitive_history',
  COGNITIVE_CONFIG: 'cognitive_config',
  COUNCIL_STATUS: 'council_status',
  COUNCIL_CONFIG: 'council_config',
  COUNCIL_ANALYTICS: 'council_analytics',
  COUNCIL_HISTORY: 'council_history',
  FEDERATED_STATUS: 'federated_status',
  FEDERATED_PARTICIPANTS: 'federated_participants',
  FEDERATED_ROUNDS: 'federated_rounds',
  FEDERATED_CONFIG: 'federated_config',
  MULTIMODAL_STATS: 'multimodal_stats',
};

export const ROUTES = {
  HOME: '/',
  LOGIN: '/auth?mode=signin',
  REGISTER: '/auth?mode=signup',
  DASHBOARD: '/dashboard',

  // Execution
  EXECUTION_RUNS: '/execution/runs',
  EXECUTION_TASKS: '/execution/tasks',
  EXECUTION_AGENTS: '/execution/agents',

  // Infrastructure
  INFRASTRUCTURE_RUNTIMES: '/infrastructure/runtimes',

  // Models
  MODELS_ROUTING: '/models/routing',
  MODELS_PROVIDERS: '/models/providers',
  MODELS_COST: '/models/cost',

  // Policy
  POLICY_BOUNDS: '/policy/bounds',
  POLICY_CAPABILITIES: '/policy/capabilities',

  // Proof
  PROOF_RECEIPTS: '/proof/receipts',
  PROOF_VIOLATIONS: '/proof/violations',

  // History
  HISTORY_LOGS: '/history/logs',
  HISTORY_METRICS: '/history/metrics',
  HISTORY_ALERTS: '/history/alerts',

  // Settings
  SETTINGS_GENERAL: '/settings/general',
  SETTINGS_LICENSE: '/settings/license',
  SETTINGS_BILLING: '/settings/billing',
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
