/**
 * WebSocket client for Schlep-engine JavaScript SDK
 * Provides real-time streaming capabilities for data processing, ML training, and system events
 */

import EventEmitter from 'eventemitter3';

import {
  WebSocketMessage,
  StreamEvent,
  StreamEventType
} from '../types/common';
import { SchlepEngineError, NetworkError } from '../utils/errors';

/**
 * WebSocket connection states
 */
export enum WebSocketState {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTING = 'disconnecting',
  DISCONNECTED = 'disconnected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error'
}

/**
 * WebSocket client configuration
 */
export interface WebSocketConfig {
  baseUrl: string;
  apiKey?: string;
  accessToken?: string;
  protocols?: string[];
  reconnect?: boolean;
  reconnectInterval?: number;
  reconnectMaxAttempts?: number;
  heartbeatInterval?: number;
  messageTimeout?: number;
  debug?: boolean;
}

/**
 * Subscription configuration
 */
export interface SubscriptionConfig {
  channel: string;
  events?: StreamEventType[];
  filters?: Record<string, unknown>;
  onEvent?: (event: StreamEvent) => void;
  onError?: (error: Error) => void;
}

/**
 * Active subscription
 */
interface ActiveSubscription {
  id: string;
  config: SubscriptionConfig;
  lastActivity: number;
}

/**
 * WebSocket client for real-time communication with Schlep-engine
 */
export class WebSocketClient extends EventEmitter {
  private config: Required<WebSocketConfig>;
  private ws?: WebSocket;
  private state: WebSocketState = WebSocketState.DISCONNECTED;
  private subscriptions: Map<string, ActiveSubscription> = new Map();
  private messageHandlers: Map<string, (data: unknown) => void> = new Map();
  
  // Reconnection state
  private reconnectAttempts = 0;
  private reconnectTimer?: NodeJS.Timeout;
  
  // Heartbeat state
  private heartbeatTimer?: NodeJS.Timeout;
  private lastPongTime = 0;
  
  // Message tracking
  private messageId = 0;
  private pendingMessages: Map<string, {
    resolve: (data: unknown) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();

  constructor(config: WebSocketConfig) {
    super();
    
    this.config = {
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      accessToken: config.accessToken,
      protocols: config.protocols || [],
      reconnect: config.reconnect ?? true,
      reconnectInterval: config.reconnectInterval || 5000,
      reconnectMaxAttempts: config.reconnectMaxAttempts || 10,
      heartbeatInterval: config.heartbeatInterval || 30000,
      messageTimeout: config.messageTimeout || 10000,
      debug: config.debug || false
    };
  }

  /**
   * Connect to WebSocket server
   */
  async connect(): Promise<void> {
    if (this.state === WebSocketState.CONNECTED || this.state === WebSocketState.CONNECTING) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.setState(WebSocketState.CONNECTING);
      
      const wsUrl = this.buildWebSocketUrl();
      
      if (this.config.debug) {
        console.log('Connecting to WebSocket:', wsUrl);
      }

      try {
        this.ws = new WebSocket(wsUrl, this.config.protocols);
        
        // Set up event handlers
        this.ws.onopen = () => {
          this.setState(WebSocketState.CONNECTED);
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          this.emit('connected');
          
          if (this.config.debug) {
            console.log('WebSocket connected');
          }
          
          resolve();
        };

        this.ws.onclose = (event) => {
          this.handleClose(event);
        };

        this.ws.onerror = (error) => {
          this.handleError(error);
          if (this.state === WebSocketState.CONNECTING) {
            reject(new NetworkError('WebSocket connection failed'));
          }
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event);
        };

        // Connection timeout
        setTimeout(() => {
          if (this.state === WebSocketState.CONNECTING) {
            this.ws?.close();
            reject(new NetworkError('WebSocket connection timeout'));
          }
        }, 10000);

      } catch (error) {
        this.setState(WebSocketState.ERROR);
        reject(new NetworkError('WebSocket creation failed', error as Error));
      }
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.state === WebSocketState.DISCONNECTED) {
      return;
    }

    this.setState(WebSocketState.DISCONNECTING);
    this.clearReconnectTimer();
    this.stopHeartbeat();
    
    // Clear all subscriptions
    this.subscriptions.clear();
    
    // Reject pending messages
    this.pendingMessages.forEach(({ reject, timeout }) => {
      clearTimeout(timeout);
      reject(new Error('WebSocket disconnected'));
    });
    this.pendingMessages.clear();

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = undefined;
    }

    this.setState(WebSocketState.DISCONNECTED);
    this.emit('disconnected');
  }

  /**
   * Subscribe to events on a channel
   */
  subscribe(config: SubscriptionConfig): string {
    const subscriptionId = this.generateId();
    
    const subscription: ActiveSubscription = {
      id: subscriptionId,
      config,
      lastActivity: Date.now()
    };

    this.subscriptions.set(subscriptionId, subscription);

    // Send subscription message if connected
    if (this.state === WebSocketState.CONNECTED) {
      this.sendSubscribeMessage(subscription);
    }

    if (this.config.debug) {
      console.log('Created subscription:', subscriptionId, config.channel);
    }

    return subscriptionId;
  }

  /**
   * Unsubscribe from a channel
   */
  unsubscribe(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      return;
    }

    // Send unsubscribe message if connected
    if (this.state === WebSocketState.CONNECTED) {
      this.sendUnsubscribeMessage(subscription);
    }

    this.subscriptions.delete(subscriptionId);

    if (this.config.debug) {
      console.log('Removed subscription:', subscriptionId);
    }
  }

  /**
   * Send message and wait for response
   */
  async sendMessage(type: string, data: unknown): Promise<unknown> {
    if (this.state !== WebSocketState.CONNECTED) {
      throw new Error('WebSocket not connected');
    }

    return new Promise((resolve, reject) => {
      const messageId = this.generateId();
      
      const message: WebSocketMessage = {
        id: messageId,
        type,
        data,
        timestamp: new Date().toISOString()
      };

      // Set up response handler
      const timeout = setTimeout(() => {
        this.pendingMessages.delete(messageId);
        reject(new Error('Message timeout'));
      }, this.config.messageTimeout);

      this.pendingMessages.set(messageId, {
        resolve,
        reject,
        timeout
      });

      // Send message
      this.ws!.send(JSON.stringify(message));
      
      if (this.config.debug) {
        console.log('Sent message:', messageId, type);
      }
    });
  }

  /**
   * Send fire-and-forget message
   */
  send(type: string, data: unknown): void {
    if (this.state !== WebSocketState.CONNECTED) {
      throw new Error('WebSocket not connected');
    }

    const message: WebSocketMessage = {
      type,
      data,
      timestamp: new Date().toISOString()
    };

    this.ws!.send(JSON.stringify(message));

    if (this.config.debug) {
      console.log('Sent fire-and-forget message:', type);
    }
  }

  /**
   * Get current connection state
   */
  getState(): WebSocketState {
    return this.state;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.state === WebSocketState.CONNECTED;
  }

  /**
   * Get active subscriptions
   */
  getSubscriptions(): Array<{ id: string; channel: string; events?: StreamEventType[] }> {
    return Array.from(this.subscriptions.values()).map(sub => ({
      id: sub.id,
      channel: sub.config.channel,
      events: sub.config.events
    }));
  }

  /**
   * Update authentication token
   */
  updateAuth(apiKey?: string, accessToken?: string): void {
    this.config.apiKey = apiKey;
    this.config.accessToken = accessToken;

    // Reconnect if currently connected
    if (this.state === WebSocketState.CONNECTED) {
      this.reconnect();
    }
  }

  /**
   * Force reconnection
   */
  reconnect(): void {
    if (this.state === WebSocketState.CONNECTED) {
      this.disconnect();
    }
    this.connect().catch(error => {
      this.emit('error', error);
    });
  }

  /**
   * Build WebSocket URL with authentication
   */
  private buildWebSocketUrl(): string {
    const wsProtocol = this.config.baseUrl.startsWith('https:') ? 'wss:' : 'ws:';
    const baseUrl = this.config.baseUrl.replace(/^https?:/, '');
    let url = `${wsProtocol}${baseUrl}/ws`;

    // Add authentication parameters
    const params = new URLSearchParams();
    
    if (this.config.apiKey) {
      params.append('api_key', this.config.apiKey);
    } else if (this.config.accessToken) {
      params.append('access_token', this.config.accessToken);
    }

    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    return url;
  }

  /**
   * Handle WebSocket close event
   */
  private handleClose(event: CloseEvent): void {
    this.stopHeartbeat();
    
    if (this.config.debug) {
      console.log('WebSocket closed:', event.code, event.reason);
    }

    if (this.state === WebSocketState.DISCONNECTING) {
      this.setState(WebSocketState.DISCONNECTED);
      return;
    }

    // Attempt reconnection if enabled
    if (this.config.reconnect && this.reconnectAttempts < this.config.reconnectMaxAttempts) {
      this.scheduleReconnect();
    } else {
      this.setState(WebSocketState.DISCONNECTED);
      this.emit('disconnected', event);
    }
  }

  /**
   * Handle WebSocket error
   */
  private handleError(error: Event): void {
    if (this.config.debug) {
      console.error('WebSocket error:', error);
    }

    this.setState(WebSocketState.ERROR);
    this.emit('error', new NetworkError('WebSocket error'));
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);
      
      if (this.config.debug) {
        console.log('Received message:', message.type, message.id);
      }

      // Handle pong response
      if (message.type === 'pong') {
        this.lastPongTime = Date.now();
        return;
      }

      // Handle message responses
      if (message.id && this.pendingMessages.has(message.id)) {
        const handler = this.pendingMessages.get(message.id)!;
        clearTimeout(handler.timeout);
        this.pendingMessages.delete(message.id);
        
        if (message.type === 'error') {
          handler.reject(new Error(message.data as string));
        } else {
          handler.resolve(message.data);
        }
        return;
      }

      // Handle stream events
      if (message.type === 'stream_event') {
        this.handleStreamEvent(message.data as StreamEvent);
        return;
      }

      // Handle custom message types
      this.emit('message', message);
      this.emit(`message:${message.type}`, message.data);

    } catch (error) {
      if (this.config.debug) {
        console.error('Failed to parse WebSocket message:', error);
      }
      this.emit('error', new Error('Invalid message format'));
    }
  }

  /**
   * Handle stream events
   */
  private handleStreamEvent(event: StreamEvent): void {
    // Update subscription activity
    this.subscriptions.forEach(subscription => {
      subscription.lastActivity = Date.now();
      
      // Check if event matches subscription
      const config = subscription.config;
      if (config.events && !config.events.includes(event.type)) {
        return;
      }

      // Apply filters if any
      if (config.filters && !this.matchesFilters(event.data, config.filters)) {
        return;
      }

      // Call subscription handler
      try {
        config.onEvent?.(event);
      } catch (error) {
        config.onError?.(error as Error);
      }
    });

    // Emit generic event
    this.emit('stream_event', event);
    this.emit(`stream_event:${event.type}`, event);
  }

  /**
   * Check if event data matches filters
   */
  private matchesFilters(data: unknown, filters: Record<string, unknown>): boolean {
    if (!data || typeof data !== 'object') {
      return false;
    }

    const eventData = data as Record<string, unknown>;
    
    return Object.entries(filters).every(([key, value]) => {
      return eventData[key] === value;
    });
  }

  /**
   * Send subscription message
   */
  private sendSubscribeMessage(subscription: ActiveSubscription): void {
    this.send('subscribe', {
      channel: subscription.config.channel,
      events: subscription.config.events,
      filters: subscription.config.filters
    });
  }

  /**
   * Send unsubscribe message
   */
  private sendUnsubscribeMessage(subscription: ActiveSubscription): void {
    this.send('unsubscribe', {
      channel: subscription.config.channel
    });
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    this.setState(WebSocketState.RECONNECTING);
    this.reconnectAttempts++;
    
    const delay = Math.min(
      this.config.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1),
      30000
    );

    if (this.config.debug) {
      console.log(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
    }

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(error => {
        if (this.config.debug) {
          console.error('Reconnection failed:', error);
        }
        this.handleClose(new CloseEvent('close'));
      });
    }, delay);

    this.emit('reconnecting', this.reconnectAttempts);
  }

  /**
   * Clear reconnection timer
   */
  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    this.heartbeatTimer = setInterval(() => {
      if (this.state === WebSocketState.CONNECTED) {
        this.send('ping', { timestamp: Date.now() });
        
        // Check if we received pong within reasonable time
        setTimeout(() => {
          const timeSincePong = Date.now() - this.lastPongTime;
          if (timeSincePong > this.config.heartbeatInterval * 2) {
            if (this.config.debug) {
              console.log('Heartbeat timeout, reconnecting');
            }
            this.reconnect();
          }
        }, 5000);
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  /**
   * Set connection state and emit event
   */
  private setState(state: WebSocketState): void {
    if (this.state !== state) {
      const previousState = this.state;
      this.state = state;
      this.emit('state_change', { from: previousState, to: state });
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${++this.messageId}`;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.disconnect();
    this.removeAllListeners();
  }
}

export default WebSocketClient;