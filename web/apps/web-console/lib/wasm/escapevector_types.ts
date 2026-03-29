/**
 * TypeScript interfaces for the EscapeVector WASM module (wasm-bindgen generated).
 * These mirror the types in rust/escapevector-wasm/pkg/escapevector_wasm.d.ts.
 */

export interface WasmThompsonRouter {
  selectArm(healthy_indices: Uint32Array): number;
  updateSuccess(arm_idx: number, latency_ms: number): void;
  updateFailure(arm_idx: number, latency_ms: number): void;
  getState(): string;
  updateState(state_json: string): void;
  getArmCount(): number;
  getArm(idx: number): string;
  free(): void;
}

export interface WasmGlue {
  ThompsonRouter: { new(state_json: string): WasmThompsonRouter };
  initSync(arg: { module: WebAssembly.Module } | WebAssembly.Module): void;
  version(): string;
  module_name(): string;
}

/** BayesianState JSON format expected by ThompsonRouter constructor */
export interface BayesianStateJson {
  version: number;
  timestamp: number;
  arms: BanditArmJson[];
  exploration_rate: number;
  circuit_breaker_threshold: number;
  timeout_ms: number;
  max_retries: number;
  speculative_execution: boolean;
  max_latency_ms: number;
  max_cost_usd: number;
}

export interface BanditArmJson {
  provider_id: string;
  name: string;
  endpoint: string;
  api_key: null | string;
  alpha: number;
  beta: number;
  total_selections: number;
  total_successes: number;
  total_failures: number;
  avg_latency_score: number;
  avg_cost_efficiency: number;
  avg_success_rate: number;
  weight_latency: number;
  weight_cost: number;
  weight_success: number;
  updated_at: number;
}

/** Build a default BayesianState JSON for the given provider IDs */
export function buildDefaultState(providerIds: string[]): BayesianStateJson {
  const now = Date.now();
  return {
    version: 1,
    timestamp: now,
    arms: providerIds.map((id) => ({
      provider_id: id,
      name: id,
      endpoint: '',
      api_key: null,
      alpha: 1.0,
      beta: 1.0,
      total_selections: 0,
      total_successes: 0,
      total_failures: 0,
      avg_latency_score: 0.0,
      avg_cost_efficiency: 0.0,
      avg_success_rate: 0.0,
      weight_latency: 0.33,
      weight_cost: 0.33,
      weight_success: 0.34,
      updated_at: now,
    })),
    exploration_rate: 0.1,
    circuit_breaker_threshold: 5,
    timeout_ms: 10000,
    max_retries: 2,
    speculative_execution: false,
    max_latency_ms: 5000.0,
    max_cost_usd: 1.0,
  };
}
