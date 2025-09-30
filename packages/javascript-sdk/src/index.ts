/**
 * Schlep-engine JavaScript SDK
 * Official TypeScript/JavaScript SDK for Schlep-engine API
 * 
 * @example
 * ```typescript
 * import { SchlepEngineClient } from '@schlep-engine/javascript-sdk';
 * 
 * // Initialize with API key
 * const client = new SchlepEngineClient({
 *   apiKey: 'your-api-key',
 *   baseUrl: 'https://api.schlep-engine.com'
 * });
 * 
 * // Process data
 * const result = await client.data.processFile(file, {
 *   outputFormat: DataFormat.JSON,
 *   onProgress: (progress) => console.log(`${progress}% complete`)
 * });
 * 
 * // Train ML model
 * const trainingJob = await client.ml.trainModel(pipelineId, trainingFile);
 * await client.ml.waitForTraining(trainingJob.data.job_id);
 * 
 * // Real-time streaming
 * const streaming = new StreamingManager({ baseUrl: client.baseUrl });
 * await streaming.initialize();
 * streaming.subscribeToJob(jobId, {
 *   onEvent: (event) => console.log('Job update:', event)
 * });
 * ```
 * 
 * @packageDocumentation
 */

// Main client
export { SchlepEngineClient, SDK_INFO } from './client/schlep-engine';

// API classes
export {
  AuthAPI,
  DataProcessingAPI,
  MLPipelineAPI,
  StorageAPI,
  MonitoringAPI,
  AnalyticsAPI,
  DocumentExtractionAPI,
  DataQualityAPI,
  UsersAPI,
  AdminAPI
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
  FileTokenStorage,
  BrowserTokenStorage,
  MemoryTokenStorage,
  createTokenStorage
} from './auth';

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