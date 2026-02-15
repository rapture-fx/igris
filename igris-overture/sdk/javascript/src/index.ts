/**
 * Igris Inertial JavaScript SDK
 *
 * Official JavaScript/TypeScript SDK for Igris Inertial - Intelligent AI routing and cost optimization.
 *
 * @packageDocumentation
 */

import fetch, { Response } from 'node-fetch';

/**
 * Message format for chat completions
 */
export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Request options for inference
 */
export interface InferRequest {
  model: string;
  messages: Message[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  [key: string]: any;
}

/**
 * Response from inference endpoint
 */
export interface InferResponse {
  id?: string;
  object?: string;
  created?: number;
  model: string;
  choices: Array<{
    index: number;
    message: Message;
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  [key: string]: any;
}

/**
 * Model information
 */
export interface Model {
  id: string;
  object: string;
  created?: number;
  owned_by?: string;
  [key: string]: any;
}

/**
 * Models list response
 */
export interface ModelsResponse {
  object: string;
  data: Model[];
}

/**
 * Health check response
 */
export interface HealthResponse {
  status: string;
  version?: string;
  timestamp?: string;
  [key: string]: any;
}

/**
 * Provider statistics
 */
export interface ProviderStats {
  [provider: string]: any;
}

/**
 * Client configuration options
 */
export interface ClientConfig {
  /** Base URL of the Igris Inertial API */
  baseUrl?: string;
  /** API key for authentication */
  apiKey?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Custom headers to include in requests */
  headers?: Record<string, string>;
}

/**
 * Custom error class for Igris API errors
 */
export class IgrisError extends Error {
  statusCode?: number;
  response?: any;

  constructor(message: string, statusCode?: number, response?: any) {
    super(message);
    this.name = 'IgrisError';
    this.statusCode = statusCode;
    this.response = response;
  }
}

/**
 * Authentication error
 */
export class AuthenticationError extends IgrisError {
  constructor(message: string = 'Authentication failed') {
    super(message, 401);
    this.name = 'AuthenticationError';
  }
}

/**
 * Network error
 */
export class NetworkError extends IgrisError {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

/**
 * Main Igris Inertial client class
 *
 * Features EscapeVector Mode - Thompson Sampling-powered resilience that
 * continues Bayesian optimization even during total control plane outages.
 *
 * @example
 * ```typescript
 * import { Igris } from 'igris-inertial';
 *
 * const client = new Igris({
 *   baseUrl: 'http://localhost:8081',
 *   apiKey: 'your-api-key' // optional
 * });
 *
 * const response = await client.infer({
 *   model: 'gpt-4',
 *   messages: [{ role: 'user', content: 'Hello!' }]
 * });
 * ```
 */
export class Igris {
  private baseUrl: string;
  private apiKey?: string;
  private timeout: number;
  private headers: Record<string, string>;
  private escapeVectorPromise: Promise<any> | null = null;

  /**
   * Create a new Igris client
   *
   * @param config - Client configuration
   */
  constructor(config: ClientConfig = {}) {
    this.baseUrl = config.baseUrl?.replace(/\/$/, '') || 'http://localhost:8081';
    this.apiKey = config.apiKey;
    this.timeout = config.timeout || 30000;
    this.headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'igris-inertial-sdk/1.0.0',
      ...config.headers,
    };

    if (this.apiKey) {
      this.headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    // Initialize EscapeVector Mode (async, non-blocking)
    this.escapeVectorPromise = this.initEscapeVector().catch((err) => {
      console.warn('EscapeVector Mode initialization failed:', err);
      return null;
    });
  }

  private async initEscapeVector(): Promise<any> {
    const { EscapeVectorMode } = await import('./escapevector');
    return await EscapeVectorMode.create(this.apiKey);
  }

  /**
   * Make an HTTP request to the API
   */
  private async request<T>(
    method: string,
    endpoint: string,
    body?: any
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response: Response = await fetch(url, {
        method,
        headers: this.headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle authentication errors
      if (response.status === 401) {
        throw new AuthenticationError('Authentication failed. Check your API key.');
      }

      // Handle other HTTP errors
      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
          throw new IgrisError(errorMessage, response.status, errorData);
        } catch (e) {
          if (e instanceof IgrisError) throw e;
          throw new IgrisError(errorMessage, response.status);
        }
      }

      // Parse response
      if (response.status === 204) {
        return {} as T;
      }

      return await response.json() as T;
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw new NetworkError('Request timeout');
      }

      if (error instanceof IgrisError) {
        throw error;
      }

      throw new NetworkError(`Request failed: ${error.message}`);
    }
  }

  /**
   * Make an inference request using Igris Inertial's intelligent routing
   *
   * @param request - Inference request parameters
   * @returns Inference response
   *
   * @example
   * ```typescript
   * const response = await client.infer({
   *   model: 'gpt-4',
   *   messages: [
   *     { role: 'system', content: 'You are a helpful assistant.' },
   *     { role: 'user', content: 'Explain quantum computing.' }
   *   ],
   *   max_tokens: 200
   * });
   *
   * console.log(response.choices[0].message.content);
   * ```
   */
  async infer(request: InferRequest): Promise<InferResponse> {
    return this.request<InferResponse>('POST', '/v1/infer', request);
  }

  /**
   * OpenAI-compatible chat completion endpoint
   *
   * @param request - Chat completion request
   * @returns Chat completion response
   */
  async chatCompletion(request: InferRequest): Promise<InferResponse> {
    return this.request<InferResponse>('POST', '/v1/chat/completions', request);
  }

  /**
   * List available models
   *
   * @returns List of available models
   *
   * @example
   * ```typescript
   * const models = await client.listModels();
   * console.log(models.data.map(m => m.id));
   * ```
   */
  async listModels(): Promise<ModelsResponse> {
    return this.request<ModelsResponse>('GET', '/v1/models');
  }

  /**
   * Check API health status
   *
   * @returns Health status
   *
   * @example
   * ```typescript
   * const health = await client.health();
   * console.log(health.status); // 'healthy'
   * ```
   */
  async health(): Promise<HealthResponse> {
    return this.request<HealthResponse>('GET', '/v1/health');
  }

  /**
   * Get provider statistics
   *
   * @returns Provider statistics
   */
  async providerStats(): Promise<ProviderStats> {
    return this.request<ProviderStats>('GET', '/v1/providers/stats');
  }
}

// Backward compatibility alias
export { Igris as Igris };

// Export EscapeVector components
export { EscapeVectorMode } from './escapevector';
export type { BayesianState, BanditArm } from './escapevector/bayesian-state';
export type { InferRequest as EscapeVectorInferRequest, InferResponse as EscapeVectorInferResponse } from './escapevector/thompson-router';
export { RustThompsonRouter, RustCircuitBreaker, RustBayesianSigner } from './escapevector/wasm-wrapper';

// Export default for CommonJS compatibility
export default Igris;
