import { useQuery, useQueryClient } from '@tanstack/react-query';

type RequestTag = 'expected' | 'bug' | 'reviewed' | 'spam' | 'golden' | null;

interface RequestTrace {
  id: string;
  timestamp: string;
  model: string;
  model_version?: string;
  model_fingerprint?: string;
  provider: string;
  status: number;
  latency: number;
  cost: number;
  cost_breakdown: {
    input: number;
    output: number;
    overhead: number;
  };
  tokens: {
    input: number;
    output: number;
    total: number;
  };
  user_id?: string;
  session_id?: string;
  client_ip?: string;
  user_agent?: string;
  request_id: string;
  parent_request_id?: string;
  child_request_ids?: string[];
  headers?: Record<string, string>;
  request_body?: any;
  response_body?: any;
  prompt?: string;
  completion?: string;
  generation_params?: any;
  error?: {
    message: string;
    stack?: string;
    provider_error?: string;
  };
  token_timeline?: Array<{ token_index: number; timestamp: number; is_first?: boolean; is_last?: boolean }>;
  speculative_traces?: any[];
  retry_attempts?: any[];
  retry_count?: number;
  tag?: RequestTag;
  shared_url?: string;
  curl_command?: string;
  was_streamed: boolean;
  used_speculative: boolean;
  cache_hit?: boolean;
  cache_savings?: number;
  evaluation_score?: number;
  human_feedback?: 'positive' | 'negative' | null;
  timeline_markers?: any[];
}

interface RealTimeMetrics {
  requestsPerSecond: number;
  avgLatency: number;
  errorRate: number;
  totalTokens: number;
  totalCost: number;
  cacheHitRate: number;
  activeProviders: string[];
  statusDistribution: Record<string, number>;
  requestsSparkline?: Array<{ time: number; value: number }>;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081';

// Mock data generator for traces
const generateMockTraces = (count: number): RequestTrace[] => {
  const providerModels = {
    OpenAI: {
      models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo', 'gpt-4o'],
      versions: ['gpt-4-0613', 'gpt-4-turbo-2024-04-09', 'gpt-3.5-turbo-0125', 'gpt-4o-2024-05-13'],
    },
    Anthropic: {
      models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku', 'claude-3.5-sonnet'],
      versions: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307', 'claude-3-5-sonnet-20241022'],
    },
    Google: {
      models: ['gemini-pro', 'gemini-ultra', 'gemini-1.5-pro', 'palm-2'],
      versions: ['gemini-pro-1.5', 'gemini-ultra-1.0', 'gemini-1.5-pro-002', 'palm-2-chat-bison'],
    },
    xAI: {
      models: ['grok-1', 'grok-2', 'grok-1.5'],
      versions: ['grok-1-20240401', 'grok-2-20240815', 'grok-1.5-20240610'],
    },
    Cohere: {
      models: ['command', 'command-light', 'command-r', 'command-r-plus'],
      versions: ['command-2024-03', 'command-light-2024-03', 'command-r-08-2024', 'command-r-plus-08-2024'],
    },
  };

  const providers = Object.keys(providerModels);
  const statuses = [200, 200, 200, 200, 200, 429, 500];
  const tags: RequestTag[] = [null, null, null, 'expected', 'bug', 'reviewed', 'golden'];
  const samplePrompts = [
    'Explain quantum computing in simple terms',
    'Write a Python function to sort a list',
    'What are the benefits of TypeScript over JavaScript?',
    'Create a marketing email for a new product launch',
    'Summarize the key points from this document',
  ];

  return Array.from({ length: count }, (_, i) => {
    const provider = providers[Math.floor(Math.random() * providers.length)];
    const modelInfo = providerModels[provider as keyof typeof providerModels];
    const modelIndex = Math.floor(Math.random() * modelInfo.models.length);
    const model = modelInfo.models[modelIndex];
    const modelVersion = modelInfo.versions[modelIndex];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const latency = 50 + Math.random() * 3000;
    const inputTokens = Math.floor(50 + Math.random() * 500);
    const outputTokens = Math.floor(20 + Math.random() * 300);
    const totalTokens = inputTokens + outputTokens;
    const costPerToken = 0.00001 + Math.random() * 0.00009;
    const cost = totalTokens * costPerToken;
    const wasStreamed = Math.random() > 0.5;
    const usedSpeculative = Math.random() > 0.6;
    const cacheHit = Math.random() > 0.7;

    return {
      id: `trace-${Date.now()}-${i}`,
      timestamp: new Date(Date.now() - Math.random() * 86400000).toISOString(),
      model,
      model_version: modelVersion,
      model_fingerprint: `fp_${Math.random().toString(36).substring(2, 10)}`,
      provider,
      status,
      latency,
      cost,
      cost_breakdown: {
        input: cost * 0.6,
        output: cost * 0.35,
        overhead: cost * 0.05,
      },
      tokens: {
        input: inputTokens,
        output: outputTokens,
        total: totalTokens,
      },
      user_id: `user_${Math.floor(Math.random() * 100)}`,
      session_id: `session_${Math.random().toString(36).substring(2, 10)}`,
      client_ip: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
      user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      request_id: `req_${Math.random().toString(36).substring(2, 15)}`,
      prompt: samplePrompts[Math.floor(Math.random() * samplePrompts.length)],
      completion: 'This is a sample completion text. In production, this would be the actual AI model response.',
      generation_params: {
        temperature: 0.7,
        top_p: 0.9,
        max_tokens: outputTokens,
      },
      tag: tags[Math.floor(Math.random() * tags.length)],
      was_streamed: wasStreamed,
      used_speculative: usedSpeculative,
      cache_hit: cacheHit,
      cache_savings: cacheHit ? cost * 0.8 : undefined,
      evaluation_score: status === 200 ? 0.7 + Math.random() * 0.3 : undefined,
      human_feedback: Math.random() > 0.8 ? (Math.random() > 0.5 ? 'positive' : 'negative') : null,
      retry_count: status !== 200 ? Math.floor(Math.random() * 3) : 0,
    };
  });
};

export function useTraces() {
  return useQuery<RequestTrace[]>({
    queryKey: ['traces'],
    queryFn: async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/v1/traces?limit=150`, {
          headers: { 'Content-Type': 'application/json' },
        });
        if (!response.ok) throw new Error('Failed to fetch traces');
        const data = await response.json();
        return data?.traces || [];
      } catch (error) {
        // Return comprehensive mock data when API is unavailable
        return generateMockTraces(150);
      }
    },
    refetchInterval: 5000,
    staleTime: 3000,
    retry: false, // Don't retry on error
    refetchOnWindowFocus: false,
  });
}

export function useRealTimeMetrics() {
  return useQuery<RealTimeMetrics>({
    queryKey: ['realTimeMetrics'],
    queryFn: async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/v1/metrics/realtime`, {
          headers: { 'Content-Type': 'application/json' },
        });
        if (!response.ok) throw new Error('Failed to fetch metrics');
        return response.json();
      } catch (error) {
        // Generate sparkline data for the last 30 points (30 seconds at 1 second intervals)
        const now = Date.now();
        const requestsSparkline = Array.from({ length: 30 }, (_, i) => ({
          time: now - (29 - i) * 1000,
          value: 10 + Math.random() * 15 + Math.sin(i / 5) * 5, // Realistic varying pattern
        }));

        // Return comprehensive mock metrics when API is unavailable
        return {
          requestsPerSecond: 12.5 + Math.random() * 5,
          avgLatency: 150 + Math.random() * 100,
          errorRate: 2.3 + Math.random() * 2,
          totalTokens: 1234567 + Math.floor(Math.random() * 100000),
          totalCost: 523.47 + Math.random() * 50,
          cacheHitRate: 23.5 + Math.random() * 10,
          activeProviders: ['OpenAI', 'Anthropic', 'Google', 'xAI', 'Cohere'],
          statusDistribution: {
            '200': 145 + Math.floor(Math.random() * 20),
            '201': 5 + Math.floor(Math.random() * 3),
            '400': 2 + Math.floor(Math.random() * 2),
            '429': 3 + Math.floor(Math.random() * 2),
            '500': 1 + Math.floor(Math.random() * 2),
          },
          requestsSparkline,
        } as RealTimeMetrics;
      }
    },
    refetchInterval: 5000,
    staleTime: 3000,
    retry: false, // Don't retry on error
    refetchOnWindowFocus: false,
  });
}

export function useInvalidateTraces() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['traces'] });
    queryClient.invalidateQueries({ queryKey: ['realTimeMetrics'] });
  };
}
