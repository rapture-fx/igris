import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/apiClient';
import { API_ENDPOINTS, QUERY_KEYS } from '@/utils/constants';

export interface MultimodalRequest {
  prompt: string;
  image_data?: string;
  image_mime?: string;
  audio_data?: string;
  audio_mime?: string;
  provider?: string;
  model?: string;
}

export interface MultimodalResponse {
  id: string;
  content: string;
  input_tokens: number;
  output_tokens: number;
  latency_ms: number;
  provider: string;
  model: string;
  created_at: string;
  modalities: string[];
}

export interface MultimodalStats {
  total_requests: number;
  image_requests: number;
  audio_requests: number;
  avg_latency_ms: number;
  success_rate: number;
  top_provider: string;
}

export function useMultimodalStats() {
  return useQuery<MultimodalStats>({
    queryKey: [QUERY_KEYS.MULTIMODAL_STATS],
    queryFn: () => api.get(API_ENDPOINTS.MULTIMODAL_STATS),
    refetchInterval: 30000,
  });
}

export function useMultimodalInfer() {
  return useMutation<MultimodalResponse, Error, MultimodalRequest>({
    mutationFn: (req) => api.post(API_ENDPOINTS.MULTIMODAL_INFER, req),
  });
}
