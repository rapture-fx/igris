/**
 * Main Schlep-engine JavaScript SDK Client
 * Official TypeScript/JavaScript client for the Schlep-engine API platform
 */

import EventEmitter from 'eventemitter3';

import { SDKConfig, APIResponse, HTTPMethod, RequestConfig } from '../types/common';
import { AuthState } from '../types/auth';
import { HTTPClient, HTTPClientConfig } from '../utils/http-client';
import { AuthManager, AuthManagerConfig } from '../auth/auth-manager';
import { createTokenStorage } from '../auth/token-storage';
import { SchlepEngineError, ConfigurationError } from '../utils/errors';

// Import API classes
import { AuthAPI } from '../api/auth';
import { DataProcessingAPI } from '../api/data-processing';
import { MLPipelineAPI } from '../api/ml-pipeline';
import { StorageAPI } from '../api/storage';
import { MonitoringAPI } from '../api/monitoring';
import { AnalyticsAPI } from '../api/analytics';
import { DocumentExtractionAPI } from '../api/document';
import { DataQualityAPI } from '../api/quality';
import { UsersAPI } from '../api/users';
import { AdminAPI } from '../api/admin';

/**
 * SDK version info
 */
export const SDK_INFO = {
  name: 'Schlep-engine JavaScript SDK',
  version: '1.0.0',
  company: 'Schlep-engine',
  description: 'Official JavaScript/TypeScript SDK for Schlep-engine API',
  documentation: 'https://docs.schlep-engine.com/sdk/javascript',
  support: 'https://support.schlep-engine.com',
  github: 'https://github.com/schlep-engine/javascript-sdk'
} as const;

/**
 * Main Schlep-engine SDK client class
 * Provides access to all Schlep-engine API endpoints with built-in authentication,
 * retry logic, and error handling
 */
export class SchlepEngineClient extends EventEmitter {
  // Core components
  private httpClient: HTTPClient;
  public readonly authManager: AuthManager;
  public readonly baseUrl: string;
  
  // API endpoints
  public readonly auth: AuthAPI;
  public readonly data: DataProcessingAPI;
  public readonly ml: MLPipelineAPI;
  public readonly storage: StorageAPI;
  public readonly monitoring: MonitoringAPI;
  public readonly analytics: AnalyticsAPI;
  public readonly document: DocumentExtractionAPI;
  public readonly quality: DataQualityAPI;
  public readonly users: UsersAPI;
  public readonly admin: AdminAPI;

  // Configuration
  private readonly config: Required<SDKConfig>;
  private isInitialized = false;

  /**
   * Initialize Schlep-engine client
   * 
   * @example
   * ```typescript
   * // With API key
   * const client = new SchlepEngineClient({
   *   apiKey: 'your-api-key',
   *   baseUrl: 'https://api.schlep-engine.com'
   * });
   * 
   * // With user authentication
   * const client = new SchlepEngineClient();
   * await client.auth.login('user@example.com', 'password');
   * 
   * // Process data
   * const result = await client.data.processFile(file);
   * 
   * // Train ML model
   * const model = await client.ml.trainModel(pipelineId, trainingData);
   * ```
   */
  constructor(config: SDKConfig = {}) {
    super();

    // Set default configuration
    this.config = {
      baseUrl: config.baseUrl || 'https://api.schlep-engine.com',
      apiKey: config.apiKey,
      timeout: config.timeout || 30000,
      environment: config.environment || 'production',
      retries: config.retries || 3,
      retryDelay: config.retryDelay || 1000,
      userAgent: config.userAgent || this.getDefaultUserAgent(),
      debug: config.debug || false,
      headers: config.headers || {}
    };

    this.baseUrl = this.config.baseUrl;

    // Initialize HTTP client
    const httpConfig: HTTPClientConfig = {
      baseUrl: this.config.baseUrl,
      timeout: this.config.timeout,
      userAgent: this.config.userAgent,
      debug: this.config.debug,
      headers: {
        ...this.config.headers,
        'X-SDK-Version': SDK_INFO.version,
        'X-SDK-Platform': this.getPlatformInfo()
      },
      retryConfig: {
        retries: this.config.retries,
        retryDelay: this.config.retryDelay,
        exponentialBackoff: true,
        maxDelay: 30000
      }
    };

    this.httpClient = new HTTPClient(httpConfig);

    // Initialize authentication manager
    const authConfig: AuthManagerConfig = {
      apiKey: this.config.apiKey,
      baseUrl: this.config.baseUrl,
      tokenStorage: createTokenStorage(),
      autoRefresh: true,
      refreshBuffer: 5 // 5 minutes before expiry
    };

    this.authManager = new AuthManager(authConfig);
    this.authManager.setHttpClient(this.httpClient);

    // Initialize API endpoints
    this.auth = new AuthAPI(this);
    this.data = new DataProcessingAPI(this);
    this.ml = new MLPipelineAPI(this);
    this.storage = new StorageAPI(this);
    this.monitoring = new MonitoringAPI(this);
    this.analytics = new AnalyticsAPI(this);
    this.document = new DocumentExtractionAPI(this);
    this.quality = new DataQualityAPI(this);
    this.users = new UsersAPI(this);
    this.admin = new AdminAPI(this);

    // Set up HTTP client interceptors
    this.setupInterceptors();

    // Set up auth event handlers
    this.setupAuthEventHandlers();

    this.isInitialized = true;

    if (this.config.debug) {
      console.log('Schlep-engine client initialized:', {
        baseUrl: this.config.baseUrl,
        environment: this.config.environment,
        version: SDK_INFO.version
      });
    }
  }

  /**
   * Make authenticated API request
   */
  async request<T = unknown>(
    method: HTTPMethod,
    path: string,
    config?: RequestConfig
  ): Promise<APIResponse<T>> {
    this.ensureInitialized();

    // Add authentication headers
    const authHeaders = this.authManager.getAuthHeaders();
    const requestConfig: RequestConfig = {
      ...config,
      headers: {
        ...authHeaders,
        ...config?.headers
      }
    };

    return this.httpClient.request<T>(method, path, requestConfig);
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
    config?: RequestConfig
  ): Promise<APIResponse<T>> {
    this.ensureInitialized();

    // Add authentication headers
    const authHeaders = this.authManager.getAuthHeaders();
    const requestConfig: RequestConfig = {
      ...config,
      headers: {
        ...authHeaders,
        ...config?.headers
      }
    };

    return this.httpClient.uploadFile<T>(path, file, requestConfig);
  }

  /**
   * Test connection to the API
   */
  async testConnection(): Promise<APIResponse<any>> {
    try {
      const response = await this.get('/health');
      
      if (this.config.debug) {
        console.log('Connection test successful:', response);
      }
      
      this.emit('connection:success', response);
      return response;
    } catch (error) {
      if (this.config.debug) {
        console.error('Connection test failed:', error);
      }
      
      this.emit('connection:error', error);
      throw error;
    }
  }

  /**
   * Get current authentication state
   */
  get authState(): AuthState {
    return this.authManager.authState;
  }

  /**
   * Check if client is authenticated
   */
  get isAuthenticated(): boolean {
    return this.authManager.isAuthenticated;
  }

  /**
   * Set API key for authentication
   */
  setApiKey(apiKey: string): void {
    this.authManager.setApiKey(apiKey);
    this.emit('auth:api-key-set', { apiKey: apiKey.substring(0, 8) + '...' });
  }

  /**
   * Get SDK configuration and status information
   */
  getSdkInfo(): Record<string, unknown> {
    return {
      ...SDK_INFO,
      config: {
        baseUrl: this.config.baseUrl,
        environment: this.config.environment,
        timeout: this.config.timeout,
        retries: this.config.retries,
        debug: this.config.debug
      },
      auth: {
        method: this.authManager.authMethod,
        isAuthenticated: this.authManager.isAuthenticated
      },
      platform: this.getPlatformInfo(),
      userAgent: this.config.userAgent,
      rateLimits: this.httpClient.getRateLimitInfo()
    };
  }

  /**
   * Close the client and cleanup resources
   */
  async close(): Promise<void> {
    try {
      // Close HTTP client
      this.httpClient.close();
      
      // Cleanup auth manager
      this.authManager.destroy();
      
      // Remove all event listeners
      this.removeAllListeners();
      
      this.isInitialized = false;
      
      if (this.config.debug) {
        console.log('Schlep-engine client closed');
      }
    } catch (error) {
      if (this.config.debug) {
        console.error('Error closing client:', error);
      }
    }
  }

  /**
   * Setup HTTP client request/response interceptors
   */
  private setupInterceptors(): void {
    // Request interceptor for logging
    if (this.config.debug) {
      this.httpClient.addRequestInterceptor((url, init) => {
        console.log('Making request:', {
          url,
          method: init.method,
          headers: init.headers
        });
        return { url, init };
      });
    }

    // Response interceptor for events
    this.httpClient.on('response', (data) => {
      this.emit('api:response', data);
      
      if (this.config.debug) {
        console.log('API response:', {
          method: data.method,
          url: data.url,
          status: data.status,
          duration: data.duration
        });
      }
    });

    // Error interceptor
    this.httpClient.on('error', (error) => {
      this.emit('api:error', error);
      
      if (this.config.debug) {
        console.error('API error:', error);
      }
    });
  }

  /**
   * Setup authentication event handlers
   */
  private setupAuthEventHandlers(): void {
    // Forward auth events
    this.authManager.on('auth', (event) => {
      this.emit('auth', event);
    });

    this.authManager.on('login', (event) => {
      this.emit('auth:login', event);
    });

    this.authManager.on('logout', (event) => {
      this.emit('auth:logout', event);
    });

    this.authManager.on('token_refresh', (event) => {
      this.emit('auth:token-refresh', event);
    });

    this.authManager.on('token_expired', (event) => {
      this.emit('auth:token-expired', event);
    });
  }

  /**
   * Get default user agent
   */
  private getDefaultUserAgent(): string {
    const platform = this.getPlatformInfo();
    return `${SDK_INFO.name}/${SDK_INFO.version} (${platform})`;
  }

  /**
   * Get platform information
   */
  private getPlatformInfo(): string {
    const isBrowser = typeof window !== 'undefined';
    const isNode = typeof process !== 'undefined' && process.versions?.node;
    
    if (isBrowser) {
      return `Browser/${navigator.userAgent}`;
    } else if (isNode) {
      return `Node.js/${process.versions.node}`;
    } else {
      return 'JavaScript/Unknown';
    }
  }

  /**
   * Ensure client is initialized
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new ConfigurationError('Client not initialized');
    }
  }
}

export default SchlepEngineClient;