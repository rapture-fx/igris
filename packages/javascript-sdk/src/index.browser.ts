/**
 * Schlep-engine JavaScript SDK for Browser
 */

// Main client
export { SchlepEngineClient, SDK_INFO } from './client/schlep-engine';

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
import { AuthManager } from './auth/auth-manager';
import { BrowserTokenStorage, MemoryTokenStorage } from './auth/token-storage.browser';

// Factory function for browser-compatible token storage
export function createTokenStorage(): BrowserTokenStorage | MemoryTokenStorage {
  if (typeof localStorage !== 'undefined') {
    return new BrowserTokenStorage();
  }
  return new MemoryTokenStorage();
}

export {
  AuthManager,
  BrowserTokenStorage,
  MemoryTokenStorage
};

// Utilities
export {
  HTTPClient,
  RetryHandler,
  SchlepEngineError,
  APIError,
  AuthenticationError,
  NetworkError,
  RateLimitError,
  TimeoutError
} from './utils';

// All types
export * from './types';

// Default export
export { SchlepEngineClient as default } from './client/schlep-engine';