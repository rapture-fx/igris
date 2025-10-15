/**
 * HTTP client for Schlep-engine JavaScript SDK
 * Provides universal fetch-based HTTP client for browser and Node.js
 */

import EventEmitter from 'eventemitter3';
import fetch from 'cross-fetch';

import {
  HTTPMethod,
  RequestConfig,
  RetryConfig,
  RateLimitInfo,
  APIResponse
} from '../types/common';

import {
  SchlepEngineError,
  APIError,
  NetworkError,
  TimeoutError,
  parseAPIError,
  RateLimitError,
  getRetryAfter
} from './errors';

import { RetryHandler, DEFAULT_RETRY_CONFIG } from './retry';

/**
 * Request interceptor function type
 */
export type RequestInterceptor = (
  url: string,
  init: RequestInit
) => Promise<{ url: string; init: RequestInit }> | { url: string; init: RequestInit };

/**
 * Response interceptor function type
 */
export type ResponseInterceptor = (response: Response) => Promise<Response> | Response;

/**
 * HTTP client configuration
 */
export interface HTTPClientConfig {
  baseUrl: string;
  timeout?: number;
  retryConfig?: Partial<RetryConfig>;
  userAgent?: string;
  debug?: boolean;
  headers?: Record<string, string>;
  enableRateLimiting?: boolean;
  abortSignal?: AbortSignal;
}

/**
 * Rate limiter for managing API calls
 */
class RateLimiter {
  private requests: number[] = [];
  private limit = 100; // requests per minute
  private window = 60000; // 1 minute in ms
  private retryAfter?: number;

  /**
   * Check if request can be made immediately
   */
  canMakeRequest(): boolean {
    this.cleanOldRequests();
    
    if (this.retryAfter && Date.now() < this.retryAfter) {
      return false;
    }

    return this.requests.length < this.limit;
  }

  /**
   * Record a new request
   */
  recordRequest(): void {
    this.requests.push(Date.now());
  }

  /**
   * Update rate limit info from response headers
   */
  updateRateLimit(headers: Headers): void {
    const limit = headers.get('x-ratelimit-limit');
    const remaining = headers.get('x-ratelimit-remaining');
    const reset = headers.get('x-ratelimit-reset');
    const retryAfter = getRetryAfter(headers);

    if (limit) this.limit = parseInt(limit, 10);
    
    if (retryAfter) {
      this.retryAfter = Date.now() + (retryAfter * 1000);
    } else if (reset) {
      this.retryAfter = parseInt(reset, 10) * 1000;
    }
  }

  /**
   * Get current rate limit info
   */
  getRateLimitInfo(): RateLimitInfo {
    this.cleanOldRequests();
    
    return {
      limit: this.limit,
      remaining: Math.max(0, this.limit - this.requests.length),
      reset: this.retryAfter || 0,
      resetTime: new Date(this.retryAfter || Date.now())
    };
  }

  /**
   * Wait until next request can be made
   */
  async waitForAvailability(): Promise<void> {
    while (!this.canMakeRequest()) {
      const waitTime = this.retryAfter ? Math.max(0, this.retryAfter - Date.now()) : 1000;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  private cleanOldRequests(): void {
    const cutoff = Date.now() - this.window;
    this.requests = this.requests.filter(timestamp => timestamp > cutoff);
  }
}

/**
 * Universal HTTP client for Schlep-engine API
 */
export class HTTPClient extends EventEmitter {
  private baseUrl: string;
  private timeout: number;
  private retryHandler: RetryHandler;
  private userAgent: string;
  private debug: boolean;
  private defaultHeaders: Record<string, string>;
  private rateLimiter: RateLimiter;
  private requestInterceptors: RequestInterceptor[] = [];
  private responseInterceptors: ResponseInterceptor[] = [];
  private abortController?: AbortController;

  constructor(config: HTTPClientConfig) {
    super();
    
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.timeout = config.timeout || 30000;
    this.retryHandler = new RetryHandler({
      ...DEFAULT_RETRY_CONFIG,
      ...config.retryConfig
    });
    
    this.userAgent = config.userAgent || this.getDefaultUserAgent();
    this.debug = config.debug || false;
    
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': this.userAgent,
      ...config.headers
    };

    this.rateLimiter = new RateLimiter();
    
    // Set up abort signal if provided
    if (config.abortSignal) {
      this.abortController = new AbortController();
      config.abortSignal.addEventListener('abort', () => {
        this.abortController?.abort();
      });
    }

    if (this.debug) {
      this.emit('debug', 'HTTPClient initialized', { baseUrl: this.baseUrl });
    }
  }

  /**
   * Add request interceptor
   */
  addRequestInterceptor(interceptor: RequestInterceptor): void {
    this.requestInterceptors.push(interceptor);
  }

  /**
   * Add response interceptor
   */
  addResponseInterceptor(interceptor: ResponseInterceptor): void {
    this.responseInterceptors.push(interceptor);
  }

  /**
   * Make HTTP request
   */
  async request<T = unknown>(
    method: HTTPMethod,
    path: string,
    config: RequestConfig = {}
  ): Promise<APIResponse<T>> {
    return this.retryHandler.executeWithRetry(async () => {
      return this._makeRequest<T>(method, path, config);
    });
  }

  /**
   * Make GET request
   */
  async get<T = unknown>(path: string, config?: RequestConfig): Promise<APIResponse<T>> {
    return this.request<T>('GET', path, config);
  }

  /**
   * Make POST request
   */
  async post<T = unknown>(path: string, config?: RequestConfig): Promise<APIResponse<T>> {
    return this.request<T>('POST', path, config);
  }

  /**
   * Make PUT request
   */
  async put<T = unknown>(path: string, config?: RequestConfig): Promise<APIResponse<T>> {
    return this.request<T>('PUT', path, config);
  }

  /**
   * Make PATCH request
   */
  async patch<T = unknown>(path: string, config?: RequestConfig): Promise<APIResponse<T>> {
    return this.request<T>('PATCH', path, config);
  }

  /**
   * Make DELETE request
   */
  async delete<T = unknown>(path: string, config?: RequestConfig): Promise<APIResponse<T>> {
    return this.request<T>('DELETE', path, config);
  }

  /**
   * Upload file with progress tracking
   */
  async uploadFile<T = unknown>(
    path: string,
    file: File | Blob,
    config: RequestConfig = {}
  ): Promise<APIResponse<T>> {
    const formData = new FormData();
    
    if (file instanceof File) {
      formData.append('file', file, file.name);
    } else {
      formData.append('file', file, 'blob');
    }

    // Add any additional form data
    if (config.params) {
      Object.entries(config.params).forEach(([key, value]) => {
        formData.append(key, String(value));
      });
    }

    const uploadConfig: RequestConfig = {
      ...config,
      headers: {
        ...config.headers
        // Don't set Content-Type - let the browser set it with boundary
      }
    };

    // Remove Content-Type from default headers for file upload
    const requestHeaders = { ...this.defaultHeaders, ...uploadConfig.headers };
    delete requestHeaders['Content-Type'];

    const init: RequestInit = {
      method: 'POST',
      headers: requestHeaders,
      body: formData
    };

    return this._makeRequest<T>('POST', path, { ...uploadConfig, _rawInit: init });
  }

  /**
   * Get rate limit information
   */
  getRateLimitInfo(): RateLimitInfo {
    return this.rateLimiter.getRateLimitInfo();
  }

  /**
   * Abort all pending requests
   */
  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = new AbortController();
    }
  }

  private async _makeRequest<T = unknown>(
    method: HTTPMethod,
    path: string,
    config: RequestConfig & { _rawInit?: RequestInit } = {}
  ): Promise<APIResponse<T>> {
    // Wait for rate limit availability
    await this.rateLimiter.waitForAvailability();
    
    const url = this.buildUrl(path);
    const startTime = Date.now();
    
    // Prepare request init
    let init: RequestInit;
    
    if (config._rawInit) {
      // Use raw init for special cases like file uploads
      init = config._rawInit;
    } else {
      init = await this.prepareRequestInit(method, config);
    }

    // Apply request interceptors
    let interceptedData = { url, init };
    for (const interceptor of this.requestInterceptors) {
      interceptedData = await interceptor(interceptedData.url, interceptedData.init);
    }

    // Set up timeout and abort signal
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    
    // Combine abort signals
    if (this.abortController?.signal.aborted) {
      controller.abort();
    }
    
    init.signal = controller.signal;

    try {
      if (this.debug) {
        this.emit('debug', 'Making request', {
          method,
          url: interceptedData.url,
          headers: interceptedData.init.headers
        });
      }

      // Make the request
      let response = await fetch(interceptedData.url, interceptedData.init);
      
      // Clear timeout
      clearTimeout(timeoutId);
      
      // Record request for rate limiting
      this.rateLimiter.recordRequest();
      
      // Apply response interceptors
      for (const interceptor of this.responseInterceptors) {
        response = await interceptor(response);
      }
      
      // Update rate limiting from headers
      this.rateLimiter.updateRateLimit(response.headers);
      
      const duration = Date.now() - startTime;
      
      if (this.debug) {
        this.emit('debug', 'Response received', {
          status: response.status,
          duration,
          url: interceptedData.url
        });
      }

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = getRetryAfter(response.headers);
        const errorData = await this.parseErrorResponse(response);
        throw new RateLimitError(
          errorData.message || 'Rate limit exceeded',
          retryAfter,
          errorData
        );
      }

      // Handle other errors
      if (!response.ok) {
        const errorData = await this.parseErrorResponse(response);
        throw parseAPIError(errorData, response.status);
      }

      // Parse successful response
      const responseData = await this.parseSuccessResponse<T>(response);
      
      this.emit('response', {
        method,
        url: interceptedData.url,
        status: response.status,
        duration,
        data: responseData
      });

      return responseData;

    } catch (error) {
      clearTimeout(timeoutId);
      
      // Handle specific error types
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new TimeoutError('Request timeout');
      }
      
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new NetworkError('Network error', error);
      }
      
      if (error instanceof SchlepEngineError) {
        throw error;
      }
      
      throw new APIError(`Request failed: ${error}`, 0);
    }
  }

  private async prepareRequestInit(method: HTTPMethod, config: RequestConfig): RequestInit {
    const headers = { ...this.defaultHeaders, ...config.headers };
    
    const init: RequestInit = {
      method,
      headers
    };

    // Handle request body
    if (config.params && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      if (headers['Content-Type']?.includes('application/json')) {
        init.body = JSON.stringify(config.params);
      } else {
        // Form data
        const formData = new FormData();
        Object.entries(config.params).forEach(([key, value]) => {
          formData.append(key, String(value));
        });
        init.body = formData;
        delete headers['Content-Type']; // Let browser set it
      }
    }

    // Handle URL parameters for GET requests
    if (config.params && method === 'GET') {
      // URL params are handled in buildUrl
    }

    return init;
  }

  private buildUrl(path: string): string {
    if (path.startsWith('http')) {
      return path;
    }
    
    const fullPath = path.startsWith('/') ? path : `/${path}`;
    return `${this.baseUrl}${fullPath}`;
  }

  private async parseSuccessResponse<T>(response: Response): Promise<APIResponse<T>> {
    const contentType = response.headers.get('Content-Type') || '';
    
    if (contentType.includes('application/json')) {
      const data = await response.json() as APIResponse<T>;
      
      // Ensure proper response format
      if (typeof data === 'object' && data !== null) {
        return {
          success: true,
          timestamp: new Date().toISOString(),
          ...data
        };
      } else {
        return {
          success: true,
          data: data as T,
          timestamp: new Date().toISOString()
        };
      }
    } else {
      const text = await response.text();
      return {
        success: true,
        data: text as unknown as T,
        timestamp: new Date().toISOString()
      };
    }
  }

  private async parseErrorResponse(response: Response): Promise<any> {
    const contentType = response.headers.get('Content-Type') || '';
    
    try {
      if (contentType.includes('application/json')) {
        return await response.json();
      } else {
        const text = await response.text();
        return { message: text, error: 'api_error' };
      }
    } catch {
      return { 
        message: `HTTP ${response.status}: ${response.statusText}`,
        error: 'parse_error'
      };
    }
  }

  private getDefaultUserAgent(): string {
    const isBrowser = typeof window !== 'undefined';
    const version = '1.0.0'; // Will be replaced by build process
    
    if (isBrowser) {
      return `Schlep-engine-JS-SDK/${version} (Browser)`;
    } else {
      return `Schlep-engine-JS-SDK/${version} (Node.js)`;
    }
  }

  /**
   * Close the client and cleanup resources
   */
  close(): void {
    this.abort();
    this.removeAllListeners();
  }
}

export default HTTPClient;