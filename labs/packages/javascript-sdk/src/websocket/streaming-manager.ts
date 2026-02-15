/**
 * Streaming manager for Igris-engine JavaScript SDK
 * Provides high-level interface for real-time data streaming and events
 */

import EventEmitter from 'eventemitter3';

import { StreamEvent, StreamEventType } from '../types/common';
import { WebSocketClient, WebSocketConfig, WebSocketState } from './websocket-client';

/**
 * Stream subscription options
 */
export interface StreamSubscriptionOptions {
  onEvent?: (event: StreamEvent) => void;
  onError?: (error: Error) => void;
  filters?: Record<string, unknown>;
}

/**
 * Data processing stream events
 */
export interface DataProcessingStreamEvents {
  'job-started': { job_id: string; job_type: string; created_at: string };
  'job-progress': { job_id: string; progress_percentage: number; message?: string };
  'job-completed': { job_id: string; status: string; results?: unknown };
  'job-failed': { job_id: string; error_message: string; error_details?: unknown };
  'data-validated': { job_id: string; validation_results: unknown };
  'data-transformed': { job_id: string; transformation_results: unknown };
}

/**
 * ML training stream events
 */
export interface MLTrainingStreamEvents {
  'training-started': { job_id: string; pipeline_id: string; config: unknown };
  'training-progress': { job_id: string; epoch: number; loss: number; metrics: unknown };
  'training-completed': { job_id: string; model_id: string; final_metrics: unknown };
  'training-failed': { job_id: string; error_message: string };
  'hyperparameter-update': { job_id: string; parameters: unknown };
  'validation-metrics': { job_id: string; metrics: unknown };
}

/**
 * System monitoring stream events
 */
export interface SystemMonitoringStreamEvents {
  'alert-triggered': { alert_id: string; metric: string; value: number; threshold: number };
  'alert-resolved': { alert_id: string; resolved_at: string };
  'system-metrics': { timestamp: string; metrics: Record<string, number> };
  'service-status-changed': { service: string; status: string; timestamp: string };
}

/**
 * All available stream events
 */
export type AllStreamEvents = DataProcessingStreamEvents & MLTrainingStreamEvents & SystemMonitoringStreamEvents;

/**
 * Streaming manager for handling real-time events
 */
export class StreamingManager extends EventEmitter {
  private wsClient: WebSocketClient;
  private isInitialized = false;
  private activeSubscriptions: Map<string, string> = new Map();

  constructor(config: WebSocketConfig) {
    super();
    
    this.wsClient = new WebSocketClient(config);
    
    // Forward WebSocket events
    this.setupWebSocketEventHandlers();
  }

  /**
   * Initialize the streaming connection
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    await this.wsClient.connect();
    this.isInitialized = true;
  }

  /**
   * Subscribe to data processing events
   */
  subscribeToDataProcessing(options: StreamSubscriptionOptions = {}): string {
    return this.subscribe('data-processing', StreamEventType.DATA_PROCESSED, {
      ...options,
      onEvent: (event) => {
        this.handleDataProcessingEvent(event);
        options.onEvent?.(event);
      }
    });
  }

  /**
   * Subscribe to ML training events
   */
  subscribeToMLTraining(options: StreamSubscriptionOptions = {}): string {
    return this.subscribe('ml-training', StreamEventType.JOB_UPDATED, {
      ...options,
      onEvent: (event) => {
        this.handleMLTrainingEvent(event);
        options.onEvent?.(event);
      }
    });
  }

  /**
   * Subscribe to system monitoring events
   */
  subscribeToSystemMonitoring(options: StreamSubscriptionOptions = {}): string {
    return this.subscribe('system-monitoring', StreamEventType.ERROR, {
      ...options,
      onEvent: (event) => {
        this.handleSystemMonitoringEvent(event);
        options.onEvent?.(event);
      }
    });
  }

  /**
   * Subscribe to specific job updates
   */
  subscribeToJob(jobId: string, options: StreamSubscriptionOptions = {}): string {
    return this.subscribe('jobs', StreamEventType.JOB_UPDATED, {
      ...options,
      filters: { job_id: jobId },
      onEvent: (event) => {
        this.emit('job:update', { jobId, event });
        this.emit(`job:update:${jobId}`, event);
        options.onEvent?.(event);
      }
    });
  }

  /**
   * Subscribe to model training progress
   */
  subscribeToModelTraining(modelId: string, options: StreamSubscriptionOptions = {}): string {
    return this.subscribe('model-training', StreamEventType.JOB_UPDATED, {
      ...options,
      filters: { model_id: modelId },
      onEvent: (event) => {
        this.emit('model:training', { modelId, event });
        this.emit(`model:training:${modelId}`, event);
        options.onEvent?.(event);
      }
    });
  }

  /**
   * Subscribe to system alerts
   */
  subscribeToAlerts(options: StreamSubscriptionOptions = {}): string {
    return this.subscribe('alerts', StreamEventType.ERROR, {
      ...options,
      onEvent: (event) => {
        this.emit('alert', event);
        options.onEvent?.(event);
      }
    });
  }

  /**
   * Subscribe to user-specific events
   */
  subscribeToUserEvents(userId: string, options: StreamSubscriptionOptions = {}): string {
    return this.subscribe('user-events', StreamEventType.JOB_UPDATED, {
      ...options,
      filters: { user_id: userId },
      onEvent: (event) => {
        this.emit('user:event', { userId, event });
        this.emit(`user:event:${userId}`, event);
        options.onEvent?.(event);
      }
    });
  }

  /**
   * Subscribe to organization events
   */
  subscribeToOrganizationEvents(orgId: string, options: StreamSubscriptionOptions = {}): string {
    return this.subscribe('organization-events', StreamEventType.JOB_UPDATED, {
      ...options,
      filters: { organization_id: orgId },
      onEvent: (event) => {
        this.emit('org:event', { orgId, event });
        this.emit(`org:event:${orgId}`, event);
        options.onEvent?.(event);
      }
    });
  }

  /**
   * Subscribe to custom channel
   */
  subscribeToChannel(
    channel: string,
    eventTypes?: StreamEventType[],
    options: StreamSubscriptionOptions = {}
  ): string {
    return this.subscribe(channel, eventTypes, options);
  }

  /**
   * Unsubscribe from a stream
   */
  unsubscribe(subscriptionId: string): void {
    this.wsClient.unsubscribe(subscriptionId);
    this.activeSubscriptions.delete(subscriptionId);
  }

  /**
   * Unsubscribe from all streams
   */
  unsubscribeAll(): void {
    this.activeSubscriptions.forEach((_, subscriptionId) => {
      this.wsClient.unsubscribe(subscriptionId);
    });
    this.activeSubscriptions.clear();
  }

  /**
   * Send custom message to server
   */
  async sendMessage(type: string, data: unknown): Promise<unknown> {
    return this.wsClient.sendMessage(type, data);
  }

  /**
   * Check connection status
   */
  isConnected(): boolean {
    return this.wsClient.isConnected();
  }

  /**
   * Get connection state
   */
  getConnectionState(): WebSocketState {
    return this.wsClient.getState();
  }

  /**
   * Force reconnection
   */
  reconnect(): void {
    this.wsClient.reconnect();
  }

  /**
   * Update authentication credentials
   */
  updateAuth(apiKey?: string, accessToken?: string): void {
    this.wsClient.updateAuth(apiKey, accessToken);
  }

  /**
   * Get active subscriptions info
   */
  getActiveSubscriptions(): Array<{ id: string; channel: string; events?: StreamEventType[] }> {
    return this.wsClient.getSubscriptions();
  }

  /**
   * Close streaming connection
   */
  close(): void {
    this.unsubscribeAll();
    this.wsClient.disconnect();
    this.wsClient.destroy();
    this.removeAllListeners();
    this.isInitialized = false;
  }

  /**
   * Generic subscription method
   */
  private subscribe(
    channel: string, 
    events?: StreamEventType | StreamEventType[],
    options: StreamSubscriptionOptions = {}
  ): string {
    const eventTypes = Array.isArray(events) ? events : events ? [events] : undefined;
    
    const subscriptionId = this.wsClient.subscribe({
      channel,
      events: eventTypes,
      filters: options.filters,
      onEvent: options.onEvent,
      onError: options.onError
    });

    this.activeSubscriptions.set(subscriptionId, channel);
    return subscriptionId;
  }

  /**
   * Handle data processing events
   */
  private handleDataProcessingEvent(event: StreamEvent): void {
    const eventData = event.data as any;
    
    switch (eventData.event_type) {
      case 'job_started':
        this.emit('data:job-started', eventData);
        break;
      case 'job_progress':
        this.emit('data:job-progress', eventData);
        break;
      case 'job_completed':
        this.emit('data:job-completed', eventData);
        break;
      case 'job_failed':
        this.emit('data:job-failed', eventData);
        break;
      case 'data_validated':
        this.emit('data:validated', eventData);
        break;
      case 'data_transformed':
        this.emit('data:transformed', eventData);
        break;
      default:
        this.emit('data:event', eventData);
    }
  }

  /**
   * Handle ML training events
   */
  private handleMLTrainingEvent(event: StreamEvent): void {
    const eventData = event.data as any;
    
    switch (eventData.event_type) {
      case 'training_started':
        this.emit('ml:training-started', eventData);
        break;
      case 'training_progress':
        this.emit('ml:training-progress', eventData);
        break;
      case 'training_completed':
        this.emit('ml:training-completed', eventData);
        break;
      case 'training_failed':
        this.emit('ml:training-failed', eventData);
        break;
      case 'hyperparameter_update':
        this.emit('ml:hyperparameter-update', eventData);
        break;
      case 'validation_metrics':
        this.emit('ml:validation-metrics', eventData);
        break;
      default:
        this.emit('ml:event', eventData);
    }
  }

  /**
   * Handle system monitoring events
   */
  private handleSystemMonitoringEvent(event: StreamEvent): void {
    const eventData = event.data as any;
    
    switch (eventData.event_type) {
      case 'alert_triggered':
        this.emit('system:alert-triggered', eventData);
        break;
      case 'alert_resolved':
        this.emit('system:alert-resolved', eventData);
        break;
      case 'system_metrics':
        this.emit('system:metrics', eventData);
        break;
      case 'service_status_changed':
        this.emit('system:service-status-changed', eventData);
        break;
      default:
        this.emit('system:event', eventData);
    }
  }

  /**
   * Set up WebSocket event handlers
   */
  private setupWebSocketEventHandlers(): void {
    this.wsClient.on('connected', () => {
      this.emit('connected');
    });

    this.wsClient.on('disconnected', () => {
      this.emit('disconnected');
    });

    this.wsClient.on('reconnecting', (attempt: number) => {
      this.emit('reconnecting', attempt);
    });

    this.wsClient.on('error', (error: Error) => {
      this.emit('error', error);
    });

    this.wsClient.on('state_change', (states: { from: WebSocketState; to: WebSocketState }) => {
      this.emit('connection-state-changed', states);
    });

    this.wsClient.on('stream_event', (event: StreamEvent) => {
      this.emit('stream-event', event);
    });
  }
}

export default StreamingManager;