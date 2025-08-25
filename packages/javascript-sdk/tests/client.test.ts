/**
 * Tests for SchlepEngineClient
 */

import { SchlepEngineClient } from '../src/client/schlep-engine';
import { AuthenticationError, ConfigurationError } from '../src/utils/errors';
import { mockResponse, mockApiError } from './setup';

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('SchlepEngineClient', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      const client = new SchlepEngineClient();
      
      expect(client.baseUrl).toBe('https://api.schlep-engine.com');
      expect(client.isAuthenticated).toBe(false);
    });

    it('should initialize with API key', () => {
      const client = new SchlepEngineClient({
        apiKey: 'test-api-key',
        baseUrl: 'https://test.api.com'
      });

      expect(client.baseUrl).toBe('https://test.api.com');
      expect(client.isAuthenticated).toBe(true);
    });

    it('should initialize with custom configuration', () => {
      const client = new SchlepEngineClient({
        baseUrl: 'https://custom.api.com',
        timeout: 60000,
        debug: true,
        environment: 'development'
      });

      const sdkInfo = client.getSdkInfo();
      expect(sdkInfo.config.baseUrl).toBe('https://custom.api.com');
      expect(sdkInfo.config.timeout).toBe(60000);
      expect(sdkInfo.config.debug).toBe(true);
      expect(sdkInfo.config.environment).toBe('development');
    });
  });

  describe('Authentication', () => {
    it('should set API key', () => {
      const client = new SchlepEngineClient();
      expect(client.isAuthenticated).toBe(false);

      client.setApiKey('test-api-key');
      expect(client.isAuthenticated).toBe(true);
    });

    it('should get auth state', () => {
      const client = new SchlepEngineClient({ apiKey: 'test-key' });
      const authState = client.authState;

      expect(authState.isAuthenticated).toBe(true);
      expect(authState.authMethod).toBe('api_key');
    });
  });

  describe('HTTP Requests', () => {
    it('should make GET request', async () => {
      const client = new SchlepEngineClient({ apiKey: 'test-key' });
      const responseData = mockResponse({ test: 'data' });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map(),
        json: async () => responseData
      });

      const response = await client.get('/test');
      
      expect(response.success).toBe(true);
      expect(response.data).toEqual({ test: 'data' });
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.schlep-engine.com/test',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-key'
          })
        })
      );
    });

    it('should make POST request', async () => {
      const client = new SchlepEngineClient({ apiKey: 'test-key' });
      const responseData = mockResponse({ created: 'success' });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        headers: new Map(),
        json: async () => responseData
      });

      const response = await client.post('/test', {
        params: { name: 'test' }
      });
      
      expect(response.success).toBe(true);
      expect(response.data).toEqual({ created: 'success' });
    });

    it('should handle API errors', async () => {
      const client = new SchlepEngineClient({ apiKey: 'test-key' });
      const errorData = mockApiError('Test error', 400);

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        headers: new Map(),
        json: async () => errorData
      });

      await expect(client.get('/test')).rejects.toThrow();
    });

    it('should handle authentication errors', async () => {
      const client = new SchlepEngineClient({ apiKey: 'invalid-key' });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: new Map(),
        json: async () => mockApiError('Unauthorized', 401)
      });

      await expect(client.get('/test')).rejects.toThrow(AuthenticationError);
    });

    it('should handle network errors', async () => {
      const client = new SchlepEngineClient({ apiKey: 'test-key' });

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(client.get('/test')).rejects.toThrow();
    });
  });

  describe('Connection Testing', () => {
    it('should test connection successfully', async () => {
      const client = new SchlepEngineClient({ apiKey: 'test-key' });
      const healthData = mockResponse({
        status: 'healthy',
        version: '1.0.0',
        uptime: 3600
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map(),
        json: async () => healthData
      });

      const response = await client.testConnection();
      
      expect(response.success).toBe(true);
      expect(response.data.status).toBe('healthy');
    });

    it('should handle connection test failure', async () => {
      const client = new SchlepEngineClient({ apiKey: 'test-key' });

      mockFetch.mockRejectedValueOnce(new Error('Connection failed'));

      await expect(client.testConnection()).rejects.toThrow('Connection failed');
    });
  });

  describe('SDK Info', () => {
    it('should return SDK information', () => {
      const client = new SchlepEngineClient({
        apiKey: 'test-key',
        baseUrl: 'https://test.api.com',
        debug: true
      });

      const info = client.getSdkInfo();

      expect(info.name).toBe('Schlep-engine JavaScript SDK');
      expect(info.version).toBe('1.0.0');
      expect(info.config.baseUrl).toBe('https://test.api.com');
      expect(info.config.debug).toBe(true);
      expect(info.auth.isAuthenticated).toBe(true);
      expect(info.auth.method).toBe('api_key');
    });
  });

  describe('Event Handling', () => {
    it('should emit connection events', async () => {
      const client = new SchlepEngineClient({ apiKey: 'test-key' });
      
      let connectionSuccessEmitted = false;
      client.on('connection:success', () => {
        connectionSuccessEmitted = true;
      });

      const healthData = mockResponse({ status: 'healthy' });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map(),
        json: async () => healthData
      });

      await client.testConnection();
      
      expect(connectionSuccessEmitted).toBe(true);
    });

    it('should emit API response events', async () => {
      const client = new SchlepEngineClient({ apiKey: 'test-key', debug: true });
      
      let apiResponseEmitted = false;
      client.on('api:response', () => {
        apiResponseEmitted = true;
      });

      const responseData = mockResponse({ test: 'data' });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map(),
        json: async () => responseData
      });

      await client.get('/test');
      
      expect(apiResponseEmitted).toBe(true);
    });
  });

  describe('Cleanup', () => {
    it('should close client properly', async () => {
      const client = new SchlepEngineClient({ apiKey: 'test-key' });
      
      await client.close();
      
      // Client should be closed without errors
      expect(true).toBe(true);
    });

    it('should remove event listeners on close', async () => {
      const client = new SchlepEngineClient({ apiKey: 'test-key' });
      
      const eventHandler = jest.fn();
      client.on('test', eventHandler);
      
      await client.close();
      client.emit('test');
      
      expect(eventHandler).not.toHaveBeenCalled();
    });
  });

  describe('File Upload', () => {
    it('should upload file successfully', async () => {
      const client = new SchlepEngineClient({ apiKey: 'test-key' });
      const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
      const uploadResponse = mockResponse({
        file_id: 'file_123',
        filename: 'test.txt',
        size: 12
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map(),
        json: async () => uploadResponse
      });

      const response = await client.uploadFile('/upload', file);
      
      expect(response.success).toBe(true);
      expect(response.data.file_id).toBe('file_123');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.schlep-engine.com/upload',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData)
        })
      );
    });
  });
});

describe('Error Scenarios', () => {
  it('should handle timeout errors', async () => {
    const client = new SchlepEngineClient({ 
      apiKey: 'test-key',
      timeout: 100 
    });

    // Mock a long delay
    mockFetch.mockImplementationOnce(() => 
      new Promise(resolve => setTimeout(resolve, 200))
    );

    await expect(client.get('/test')).rejects.toThrow();
  });

  it('should handle rate limit errors', async () => {
    const client = new SchlepEngineClient({ apiKey: 'test-key' });

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      headers: new Map([['retry-after', '60']]),
      json: async () => mockApiError('Rate limit exceeded', 429)
    });

    await expect(client.get('/test')).rejects.toThrow();
  });
});

describe('Authentication Integration', () => {
  it('should integrate with auth manager', () => {
    const client = new SchlepEngineClient();
    
    expect(client.authManager).toBeDefined();
    expect(client.isAuthenticated).toBe(false);
    
    client.setApiKey('test-key');
    expect(client.isAuthenticated).toBe(true);
  });

  it('should handle auth events', (done) => {
    const client = new SchlepEngineClient();
    
    client.on('auth:api-key-set', (event) => {
      expect(event.apiKey).toBe('test-key...');
      done();
    });
    
    client.setApiKey('test-key-12345');
  });
});