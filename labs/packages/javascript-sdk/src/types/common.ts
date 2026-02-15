/**
 * Common types and interfaces for Igris-engine JavaScript SDK
 */

/**
 * Generic API response wrapper
 */
export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error_code?: string;
  request_id?: string;
  timestamp?: string;
  pagination?: PaginationInfo;
}

/**
 * Pagination information for paginated responses
 */
export interface PaginationInfo {
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

/**
 * Job status enumeration
 */
export enum JobStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  PAUSED = 'paused'
}

/**
 * Supported file types
 */
export enum FileType {
  CSV = 'csv',
  JSON = 'json',
  XLSX = 'xlsx',
  PARQUET = 'parquet',
  TXT = 'txt',
  PDF = 'pdf',
  IMAGE = 'image',
  UNKNOWN = 'unknown'
}

/**
 * File upload information
 */
export interface FileUpload {
  filename: string;
  file_type: FileType;
  size_bytes: number;
  content_type?: string;
  upload_id?: string;
  url?: string;
  metadata?: Record<string, unknown>;
  created_at?: string;
}

/**
 * General job information
 */
export interface JobInfo {
  job_id: string;
  status: JobStatus;
  job_type: string;
  created_at: string;
  updated_at?: string;
  completed_at?: string;
  progress_percentage: number;
  message?: string;
  error_message?: string;
  metadata?: Record<string, unknown>;
}

/**
 * HTTP method types
 */
export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Request configuration
 */
export interface RequestConfig {
  headers?: Record<string, string>;
  params?: Record<string, any>;
  timeout?: number;
  signal?: AbortSignal;
  onUploadProgress?: ProgressCallback;
}

/**
 * Environment configuration
 */
export type Environment = 'development' | 'staging' | 'production';

/**
 * Authentication method types
 */
export type AuthMethod = 'api_key' | 'jwt' | 'none';

/**
 * SDK configuration options
 */
export interface SDKConfig {
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
  environment?: Environment;
  retries?: number;
  retryDelay?: number;
  userAgent?: string;
  debug?: boolean;
  headers?: Record<string, string>;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  retries: number;
  retryDelay: number;
  retryCondition?: (error: Error) => boolean;
  exponentialBackoff?: boolean;
  maxDelay?: number;
}

/**
 * Rate limiting information
 */
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
  resetTime: Date;
}

/**
 * Error response structure
 */
export interface ErrorResponse {
  error: string;
  message: string;
  code?: string;
  details?: unknown;
  timestamp?: string;
  request_id?: string;
}

/**
 * Health check response
 */
export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  version: string;
  uptime: number;
  timestamp: string;
  services?: Record<string, 'up' | 'down'>;
  environment?: string;
}

/**
 * Progress callback function type
 */
export type ProgressCallback = (progress: {
  loaded: number;
  total?: number;
  percentage: number;
}) => void;

/**
 * Utility type for making all properties optional
 */
export type PartialDeep<T> = {
  [P in keyof T]?: T[P] extends object ? PartialDeep<T[P]> : T[P];
};

/**
 * Utility type for making specific properties required
 */
export type RequireFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Helper type for API endpoints
 */
export type APIEndpoint = string;

/**
 * Base configuration for all API classes
 */
export interface BaseAPIConfig {
  client: {
    request: <T = unknown>(
      method: HTTPMethod,
      path: string,
      config?: RequestConfig
    ) => Promise<APIResponse<T>>;
    get: <T = unknown>(path: string, config?: RequestConfig) => Promise<APIResponse<T>>;
    post: <T = unknown>(path: string, config?: RequestConfig) => Promise<APIResponse<T>>;
    put: <T = unknown>(path: string, config?: RequestConfig) => Promise<APIResponse<T>>;
    patch: <T = unknown>(path: string, config?: RequestConfig) => Promise<APIResponse<T>>;
    delete: <T = unknown>(path: string, config?: RequestConfig) => Promise<APIResponse<T>>;
  };
}

/**
 * File upload options
 */
export interface UploadOptions {
  onProgress?: ProgressCallback;
  transformations?: string[];
  outputFormat?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

/**
 * WebSocket message types
 */
export interface WebSocketMessage {
  type: string;
  data: unknown;
  id?: string;
  timestamp?: string;
}

/**
 * Event types for real-time streaming
 */
export enum StreamEventType {
  DATA_PROCESSED = 'data-processed',
  JOB_UPDATED = 'job-updated',
  ERROR = 'error',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  RECONNECTING = 'reconnecting'
}

/**
 * Stream event data structure
 */
export interface StreamEvent<T = unknown> {
  type: StreamEventType;
  data: T;
  timestamp: string;
  id?: string;
}

/**
 * Browser-specific file upload interface
 */
export interface BrowserFile {
  file: File;
  preview?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Node.js-specific file upload interface
 */
export interface NodeFile {
  path: string;
  buffer?: Buffer;
  stream?: NodeJS.ReadableStream;
  metadata?: Record<string, unknown>;
}

/**
 * Generic error class interface
 */
export interface SDKError extends Error {
  code?: string;
  statusCode?: number;
  response?: ErrorResponse;
  isRetryable?: boolean;
}

/**
 * Token storage interface
 */
export interface TokenStorage {
  getToken(): Promise<string | null>;
  setToken(token: string): Promise<void>;
  removeToken(): Promise<void>;
  isTokenValid(token: string): boolean;
}

export default {};