/**
 * Igris-engine JavaScript SDK for Browser
 */

// Main client
export { IgrisClient, SDK_INFO } from './client/igris-inertial';

// API classes
export {
  AuthAPI,
  DataProcessingAPI,
  MLPipelineAPI,
  StorageAPI,
  MonitoringAPI
} from './api';

// WebSocket and streaming
export {
  WebSocketClient,
  StreamingManager,
  WebSocketState
} from './websocket';

// Authentication
export {
  AuthManager,
  createTokenStorage,
  BrowserTokenStorage,
  MemoryTokenStorage
} from './auth';

// Utilities
export {
  HTTPClient,
  RetryHandler,
  IgrisError,
  APIError,
  AuthenticationError,
  NetworkError,
  RateLimitError,
  TimeoutError
} from './utils';

// All types
export * from './types';

// Default export
export { IgrisClient as default } from './client/igris-inertial';