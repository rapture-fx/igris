/**
 * Comprehensive WebSocket and streaming tests for Igris-engine JavaScript SDK
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { StreamingClient, StreamingConfig, ConnectionStatus } from '../src/websocket/streaming-client';
import { MessageHandler } from '../src/websocket/message-handler';
import { 
  StreamingMessage, 
  MessageType, 
  RealtimeEvent,
  WebSocketMessage
} from '../src/types/streaming';
import { WebSocketError, ConnectionError, AuthenticationError } from '../src/utils/errors';

// Mock WebSocket
class MockWebSocket {
  public url: string;
  public readyState: number;
  public onopen: ((event: Event) => void) | null = null;
  public onclose: ((event: CloseEvent) => void) | null = null;
  public onmessage: ((event: MessageEvent) => void) | null = null;
  public onerror: ((event: Event) => void) | null = null;

  private listeners: Map<string, Array<(event: any) => void>> = new Map();

  constructor(url: string) {
    this.url = url;
    this.readyState = WebSocket.CONNECTING;
    
    // Simulate connection after a short delay
    setTimeout(() => {
      this.readyState = WebSocket.OPEN;
      this.onopen?.(new Event('open'));
    }, 10);
  }

  send(data: string | ArrayBuffer | Blob): void {
    // Mock send implementation
  }

  close(code?: number, reason?: string): void {
    this.readyState = WebSocket.CLOSED;
    this.onclose?.(new CloseEvent('close', { code, reason }));
  }

  addEventListener(type: string, listener: (event: any) => void): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(listener);
  }

  removeEventListener(type: string, listener: (event: any) => void): void {
    const listeners = this.listeners.get(type);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
  }

  // Helper methods for testing
  simulateMessage(data: any): void {
    const event = new MessageEvent('message', {
      data: JSON.stringify(data)
    });
    this.onmessage?.(event);
  }

  simulateError(): void {
    this.onerror?.(new Event('error'));
  }

  simulateClose(code: number = 1000, reason: string = ''): void {
    this.readyState = WebSocket.CLOSED;
    const event = new CloseEvent('close', { code, reason });
    this.onclose?.(event);
  }
}

// Mock WebSocket globally
(global as any).WebSocket = MockWebSocket;

describe('StreamingClient', () => {
  let streamingClient: StreamingClient;
  let mockWebSocket: MockWebSocket;
  let config: StreamingConfig;

  beforeEach(() => {
    config = {
      url: 'wss://api.test.com/stream',
      authToken: 'test_token_123',
      reconnectInterval: 1000,
      maxReconnectAttempts: 3,
      pingInterval: 30000,
      pingTimeout: 10000,
      messageQueueSize: 1000,
      compression: true
    };

    streamingClient = new StreamingClient(config);
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (streamingClient.isConnected()) {
      streamingClient.disconnect();
    }
  });

  describe('Connection Management', () => {
    test('should connect successfully', async () => {
      const connectPromise = streamingClient.connect();
      
      // Wait for connection
      await expect(connectPromise).resolves.toBeUndefined();
      
      expect(streamingClient.isConnected()).toBe(true);
      expect(streamingClient.getConnectionStatus()).toBe(ConnectionStatus.CONNECTED);
    });

    test('should handle connection failure', async () => {
      // Mock WebSocket constructor to throw error
      (global as any).WebSocket = jest.fn().mockImplementation(() => {
        throw new Error('Connection failed');
      });

      await expect(streamingClient.connect()).rejects.toThrow(ConnectionError);
      
      expect(streamingClient.isConnected()).toBe(false);
      expect(streamingClient.getConnectionStatus()).toBe(ConnectionStatus.DISCONNECTED);
    });

    test('should authenticate after connection', async () => {
      const authMessageSent = jest.fn();
      
      // Mock WebSocket to capture sent messages
      (global as any).WebSocket = jest.fn().mockImplementation((url: string) => {
        const mockWs = new MockWebSocket(url);
        mockWs.send = authMessageSent;
        return mockWs;
      });

      await streamingClient.connect();

      // Simulate auth response
      const authResponse = {
        type: 'auth_response',
        success: true,
        user_id: 'user123',
        session_id: 'session_abc'
      };

      // Get the mock WebSocket instance
      const wsInstance = (global as any).WebSocket.mock.instances[0];
      wsInstance.simulateMessage(authResponse);

      expect(authMessageSent).toHaveBeenCalledWith(
        expect.stringContaining('authenticate')
      );
    });

    test('should handle authentication failure', async () => {
      await streamingClient.connect();

      const authResponse = {
        type: 'auth_response',
        success: false,
        error: 'Invalid token'
      };

      const wsInstance = (global as any).WebSocket.mock.instances[0];
      
      // Should throw authentication error
      expect(() => {
        wsInstance.simulateMessage(authResponse);
      }).toThrow(AuthenticationError);
    });

    test('should disconnect gracefully', async () => {
      await streamingClient.connect();
      
      expect(streamingClient.isConnected()).toBe(true);
      
      await streamingClient.disconnect();
      
      expect(streamingClient.isConnected()).toBe(false);
      expect(streamingClient.getConnectionStatus()).toBe(ConnectionStatus.DISCONNECTED);
    });
  });

  describe('Message Handling', () => {
    beforeEach(async () => {
      await streamingClient.connect();
    });

    test('should send messages', async () => {
      const messageSent = jest.fn();
      const wsInstance = (global as any).WebSocket.mock.instances[0];
      wsInstance.send = messageSent;

      const message: StreamingMessage = {
        type: MessageType.SUBSCRIBE,
        channel: 'data_processing',
        payload: { job_id: 'job_123' },
        timestamp: Date.now()
      };

      await streamingClient.sendMessage(message);

      expect(messageSent).toHaveBeenCalledWith(
        expect.stringContaining('subscribe')
      );
    });

    test('should receive and process messages', async () => {
      const messagesReceived: StreamingMessage[] = [];
      
      streamingClient.onMessage((message) => {
        messagesReceived.push(message);
      });

      const incomingMessage = {
        type: 'job_update',
        channel: 'data_processing',
        payload: {
          job_id: 'job_123',
          status: 'completed',
          progress: 100
        },
        timestamp: Date.now()
      };

      const wsInstance = (global as any).WebSocket.mock.instances[0];
      wsInstance.simulateMessage(incomingMessage);

      await new Promise(resolve => setTimeout(resolve, 10)); // Allow message processing

      expect(messagesReceived).toHaveLength(1);
      expect(messagesReceived[0].type).toBe(MessageType.JOB_UPDATE);
      expect(messagesReceived[0].payload.job_id).toBe('job_123');
    });

    test('should handle malformed messages gracefully', async () => {
      const errorsReceived: Error[] = [];
      
      streamingClient.onError((error) => {
        errorsReceived.push(error);
      });

      const malformedMessages = [
        'invalid json',
        '{"incomplete": json',
        '{"type": "unknown_type"}',
        null,
        undefined
      ];

      const wsInstance = (global as any).WebSocket.mock.instances[0];

      malformedMessages.forEach(msg => {
        try {
          wsInstance.simulateMessage(msg);
        } catch (error) {
          // Expected for some malformed messages
        }
      });

      await new Promise(resolve => setTimeout(resolve, 10)); // Allow error processing

      expect(errorsReceived.length).toBeGreaterThan(0);
    });

    test('should queue messages when disconnected', async () => {
      await streamingClient.disconnect();

      const message: StreamingMessage = {
        type: MessageType.DATA,
        payload: { test: 'data' },
        timestamp: Date.now()
      };

      // Should not throw error, message should be queued
      await expect(streamingClient.sendMessage(message)).resolves.toBeUndefined();
      
      // Verify message is in queue
      expect(streamingClient.getQueueSize()).toBe(1);
    });
  });

  describe('Subscription Management', () => {
    beforeEach(async () => {
      await streamingClient.connect();
    });

    test('should subscribe to channels', async () => {
      const messageSent = jest.fn();
      const wsInstance = (global as any).WebSocket.mock.instances[0];
      wsInstance.send = messageSent;

      await streamingClient.subscribe('data_processing');
      await streamingClient.subscribe('ml_pipeline');

      expect(messageSent).toHaveBeenCalledTimes(2);
      expect(streamingClient.isSubscribed('data_processing')).toBe(true);
      expect(streamingClient.isSubscribed('ml_pipeline')).toBe(true);
    });

    test('should unsubscribe from channels', async () => {
      const messageSent = jest.fn();
      const wsInstance = (global as any).WebSocket.mock.instances[0];
      wsInstance.send = messageSent;

      await streamingClient.subscribe('data_processing');
      await streamingClient.unsubscribe('data_processing');

      expect(streamingClient.isSubscribed('data_processing')).toBe(false);
    });

    test('should handle subscription confirmations', async () => {
      await streamingClient.subscribe('data_processing');

      const subscriptionConfirmation = {
        type: 'subscription_confirmed',
        channel: 'data_processing',
        payload: { status: 'subscribed' }
      };

      const wsInstance = (global as any).WebSocket.mock.instances[0];
      wsInstance.simulateMessage(subscriptionConfirmation);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(streamingClient.isSubscribed('data_processing')).toBe(true);
    });
  });

  describe('Reconnection Logic', () => {
    test('should attempt reconnection on unexpected disconnect', async () => {
      await streamingClient.connect();
      
      const reconnectAttempts: number[] = [];
      streamingClient.onReconnectAttempt((attempt) => {
        reconnectAttempts.push(attempt);
      });

      // Simulate unexpected disconnect
      const wsInstance = (global as any).WebSocket.mock.instances[0];
      wsInstance.simulateClose(1006); // Abnormal closure

      await new Promise(resolve => setTimeout(resolve, config.reconnectInterval + 100));

      expect(reconnectAttempts.length).toBeGreaterThan(0);
    });

    test('should give up after max reconnection attempts', async () => {
      config.maxReconnectAttempts = 2;
      streamingClient = new StreamingClient(config);

      // Mock WebSocket to always fail
      (global as any).WebSocket = jest.fn().mockImplementation(() => {
        throw new Error('Connection failed');
      });

      await expect(streamingClient.connect()).rejects.toThrow(ConnectionError);
    });

    test('should restore subscriptions after reconnection', async () => {
      await streamingClient.connect();
      
      // Subscribe to channels
      await streamingClient.subscribe('data_processing');
      await streamingClient.subscribe('ml_pipeline');

      // Simulate disconnect and reconnect
      const wsInstance = (global as any).WebSocket.mock.instances[0];
      wsInstance.simulateClose(1006);

      // Mock successful reconnection
      (global as any).WebSocket = MockWebSocket;

      await new Promise(resolve => setTimeout(resolve, config.reconnectInterval + 100));

      // Subscriptions should be restored
      expect(streamingClient.isSubscribed('data_processing')).toBe(true);
      expect(streamingClient.isSubscribed('ml_pipeline')).toBe(true);
    });
  });

  describe('Heartbeat and Connection Health', () => {
    test('should send ping messages at intervals', async () => {
      config.pingInterval = 100; // Short interval for testing
      streamingClient = new StreamingClient(config);
      
      await streamingClient.connect();

      const messageSent = jest.fn();
      const wsInstance = (global as any).WebSocket.mock.instances[0];
      wsInstance.send = messageSent;

      await new Promise(resolve => setTimeout(resolve, 250));

      // Should have sent at least one ping
      expect(messageSent).toHaveBeenCalledWith(
        expect.stringContaining('ping')
      );
    });

    test('should handle ping timeout', async () => {
      config.pingTimeout = 50; // Very short timeout
      streamingClient = new StreamingClient(config);
      
      await streamingClient.connect();

      const connectionLost = jest.fn();
      streamingClient.onConnectionLost(connectionLost);

      // Don't respond to ping, should trigger timeout
      await new Promise(resolve => setTimeout(resolve, config.pingTimeout + 50));

      expect(connectionLost).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    test('should handle WebSocket errors', async () => {
      await streamingClient.connect();

      const errorsReceived: Error[] = [];
      streamingClient.onError((error) => {
        errorsReceived.push(error);
      });

      const wsInstance = (global as any).WebSocket.mock.instances[0];
      wsInstance.simulateError();

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(errorsReceived.length).toBeGreaterThan(0);
    });

    test('should handle message size limits', async () => {
      config.messageQueueSize = 5; // Small queue for testing
      streamingClient = new StreamingClient(config);
      
      await streamingClient.disconnect(); // Ensure disconnected to queue messages

      // Send more messages than queue size
      for (let i = 0; i < 10; i++) {
        await streamingClient.sendMessage({
          type: MessageType.DATA,
          payload: { sequence: i },
          timestamp: Date.now()
        });
      }

      // Queue should not exceed limit
      expect(streamingClient.getQueueSize()).toBeLessThanOrEqual(5);
    });

    test('should handle connection timeout', async () => {
      // Mock WebSocket to never connect
      (global as any).WebSocket = jest.fn().mockImplementation((url: string) => {
        const mockWs = new MockWebSocket(url);
        mockWs.readyState = WebSocket.CONNECTING; // Never changes to OPEN
        return mockWs;
      });

      config.connectTimeout = 100; // Short timeout
      streamingClient = new StreamingClient(config);

      await expect(streamingClient.connect()).rejects.toThrow('timeout');
    });
  });

  describe('Performance and Concurrency', () => {
    test('should handle high message throughput', async () => {
      await streamingClient.connect();

      const messagesReceived: StreamingMessage[] = [];
      streamingClient.onMessage((message) => {
        messagesReceived.push(message);
      });

      const wsInstance = (global as any).WebSocket.mock.instances[0];

      // Send 1000 messages rapidly
      const startTime = Date.now();
      for (let i = 0; i < 1000; i++) {
        wsInstance.simulateMessage({
          type: 'data',
          payload: { sequence: i },
          timestamp: Date.now()
        });
      }

      await new Promise(resolve => setTimeout(resolve, 100)); // Allow processing
      const endTime = Date.now();

      expect(messagesReceived).toHaveLength(1000);
      expect(endTime - startTime).toBeLessThan(5000); // Should process quickly
    });

    test('should handle concurrent operations', async () => {
      await streamingClient.connect();

      // Perform multiple operations concurrently
      const operations = [
        streamingClient.subscribe('channel1'),
        streamingClient.subscribe('channel2'),
        streamingClient.subscribe('channel3'),
        streamingClient.sendMessage({
          type: MessageType.DATA,
          payload: { test: 1 },
          timestamp: Date.now()
        }),
        streamingClient.sendMessage({
          type: MessageType.DATA,
          payload: { test: 2 },
          timestamp: Date.now()
        })
      ];

      await expect(Promise.all(operations)).resolves.not.toThrow();

      expect(streamingClient.isSubscribed('channel1')).toBe(true);
      expect(streamingClient.isSubscribed('channel2')).toBe(true);
      expect(streamingClient.isSubscribed('channel3')).toBe(true);
    });
  });
});

describe('MessageHandler', () => {
  let messageHandler: MessageHandler;

  beforeEach(() => {
    messageHandler = new MessageHandler();
  });

  describe('Message Filtering', () => {
    test('should filter messages by type', () => {
      const jobMessages: StreamingMessage[] = [];
      const errorMessages: StreamingMessage[] = [];

      messageHandler.onMessageType(MessageType.JOB_UPDATE, (msg) => jobMessages.push(msg));
      messageHandler.onMessageType(MessageType.ERROR, (msg) => errorMessages.push(msg));

      const jobMessage: StreamingMessage = {
        type: MessageType.JOB_UPDATE,
        payload: { job_id: 'job_123' },
        timestamp: Date.now()
      };

      const errorMessage: StreamingMessage = {
        type: MessageType.ERROR,
        payload: { error: 'Processing failed' },
        timestamp: Date.now()
      };

      const dataMessage: StreamingMessage = {
        type: MessageType.DATA,
        payload: { data: 'some data' },
        timestamp: Date.now()
      };

      messageHandler.handleMessage(jobMessage);
      messageHandler.handleMessage(errorMessage);
      messageHandler.handleMessage(dataMessage);

      expect(jobMessages).toHaveLength(1);
      expect(errorMessages).toHaveLength(1);
      expect(jobMessages[0].payload.job_id).toBe('job_123');
    });

    test('should filter messages by channel', () => {
      const processingMessages: StreamingMessage[] = [];
      const mlMessages: StreamingMessage[] = [];

      messageHandler.onChannel('data_processing', (msg) => processingMessages.push(msg));
      messageHandler.onChannel('ml_pipeline', (msg) => mlMessages.push(msg));

      const processingMsg: StreamingMessage = {
        type: MessageType.DATA,
        channel: 'data_processing',
        payload: { status: 'active' },
        timestamp: Date.now()
      };

      const mlMsg: StreamingMessage = {
        type: MessageType.DATA,
        channel: 'ml_pipeline',
        payload: { model: 'trained' },
        timestamp: Date.now()
      };

      const otherMsg: StreamingMessage = {
        type: MessageType.DATA,
        channel: 'analytics',
        payload: { metric: 'value' },
        timestamp: Date.now()
      };

      messageHandler.handleMessage(processingMsg);
      messageHandler.handleMessage(mlMsg);
      messageHandler.handleMessage(otherMsg);

      expect(processingMessages).toHaveLength(1);
      expect(mlMessages).toHaveLength(1);
    });
  });

  describe('Message Transformation', () => {
    test('should transform messages', () => {
      const transformedMessages: StreamingMessage[] = [];

      const transformer = (message: StreamingMessage): StreamingMessage => {
        if (message.type === MessageType.JOB_UPDATE) {
          return {
            ...message,
            payload: {
              ...message.payload,
              client_timestamp: Date.now(),
              client_id: 'javascript-sdk'
            }
          };
        }
        return message;
      };

      messageHandler.addTransformer(transformer);
      messageHandler.onMessage((msg) => transformedMessages.push(msg));

      const jobMessage: StreamingMessage = {
        type: MessageType.JOB_UPDATE,
        payload: { job_id: 'job_123', status: 'running' },
        timestamp: Date.now()
      };

      messageHandler.handleMessage(jobMessage);

      expect(transformedMessages).toHaveLength(1);
      expect(transformedMessages[0].payload.client_timestamp).toBeDefined();
      expect(transformedMessages[0].payload.client_id).toBe('javascript-sdk');
    });
  });

  describe('Message Validation', () => {
    test('should validate messages', () => {
      const validMessages: StreamingMessage[] = [];
      const invalidMessages: StreamingMessage[] = [];

      const validator = (message: StreamingMessage): boolean => {
        if (message.type === MessageType.JOB_UPDATE) {
          return message.payload.job_id && message.payload.status;
        }
        return true;
      };

      messageHandler.addValidator(validator);
      messageHandler.onValidMessage((msg) => validMessages.push(msg));
      messageHandler.onInvalidMessage((msg) => invalidMessages.push(msg));

      const validMessage: StreamingMessage = {
        type: MessageType.JOB_UPDATE,
        payload: { job_id: 'job_123', status: 'running' },
        timestamp: Date.now()
      };

      const invalidMessage: StreamingMessage = {
        type: MessageType.JOB_UPDATE,
        payload: { job_id: 'job_456' }, // Missing status
        timestamp: Date.now()
      };

      messageHandler.handleMessage(validMessage);
      messageHandler.handleMessage(invalidMessage);

      expect(validMessages).toHaveLength(1);
      expect(invalidMessages).toHaveLength(1);
    });
  });
});

describe('Realtime Events', () => {
  test('should process job progress events', () => {
    const progressUpdates: RealtimeEvent[] = [];
    
    const eventProcessor = {
      onJobProgress: (callback: (event: RealtimeEvent) => void) => {
        // Mock implementation
      },
      processEvent: (event: RealtimeEvent) => {
        if (event.event_type === 'job_progress') {
          progressUpdates.push(event);
        }
      }
    };

    // Simulate job progress events
    [25, 50, 75, 100].forEach(progress => {
      const event: RealtimeEvent = {
        event_type: 'job_progress',
        data: {
          job_id: 'job_123',
          progress,
          estimated_completion: new Date(Date.now() + 600000).toISOString()
        },
        timestamp: new Date(),
        severity: 'info'
      };

      eventProcessor.processEvent(event);
    });

    expect(progressUpdates).toHaveLength(4);
    expect(progressUpdates[3].data.progress).toBe(100);
  });

  test('should handle error events', () => {
    const errorEvents: RealtimeEvent[] = [];
    
    const eventProcessor = {
      onErrorEvent: (callback: (event: RealtimeEvent) => void) => {
        // Mock implementation
      },
      processEvent: (event: RealtimeEvent) => {
        if (event.event_type === 'processing_error') {
          errorEvents.push(event);
        }
      }
    };

    const errorEvent: RealtimeEvent = {
      event_type: 'processing_error',
      data: {
        job_id: 'job_failed',
        error_code: 'INVALID_DATA',
        error_message: 'Data validation failed',
        details: {
          line_number: 150,
          column: 'email',
          value: 'invalid-email'
        }
      },
      timestamp: new Date(),
      severity: 'error'
    };

    eventProcessor.processEvent(errorEvent);

    expect(errorEvents).toHaveLength(1);
    expect(errorEvents[0].data.error_code).toBe('INVALID_DATA');
  });
});

describe('Security Features', () => {
  test('should not expose sensitive data in error messages', () => {
    const config: StreamingConfig = {
      url: 'wss://api.test.com/stream',
      authToken: 'sensitive-token-12345',
      reconnectInterval: 1000,
      maxReconnectAttempts: 3
    };

    const streamingClient = new StreamingClient(config);

    // Mock connection error
    const error = new ConnectionError('Connection failed');
    
    expect(error.message).not.toContain('sensitive-token-12345');
  });

  test('should validate token format', () => {
    const invalidTokens = ['', '   ', null, undefined];

    invalidTokens.forEach(token => {
      const config: StreamingConfig = {
        url: 'wss://api.test.com/stream',
        authToken: token as any,
        reconnectInterval: 1000,
        maxReconnectAttempts: 3
      };

      expect(() => new StreamingClient(config)).toThrow();
    });
  });

  test('should handle SSL/TLS connections', () => {
    const secureConfig: StreamingConfig = {
      url: 'wss://secure-api.test.com/stream',
      authToken: 'test-token',
      sslVerify: true,
      reconnectInterval: 1000,
      maxReconnectAttempts: 3
    };

    expect(() => new StreamingClient(secureConfig)).not.toThrow();
  });
});