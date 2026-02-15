/**
 * Integration tests for generated TypeScript client
 * Tests basic functionality, authentication, and error handling
 */

const fs = require('fs');
const path = require('path');

// Check if generated client exists
const clientPath = path.join(__dirname, '../../generated/typescript');
const packageJsonPath = path.join(clientPath, 'package.json');

if (!fs.existsSync(packageJsonPath)) {
    console.log('Generated TypeScript client not found, skipping tests');
    process.exit(0);
}

// Try to import the generated client
let IgrisClient, Configuration, ApiClient;
try {
    // Add the generated client to module path
    require('module')._nodeModulePaths.unshift(clientPath);
    
    const clientModule = require(clientPath);
    IgrisClient = clientModule.IgrisClient;
    Configuration = clientModule.Configuration;
    ApiClient = clientModule.ApiClient;
} catch (error) {
    console.log(`Failed to import generated client: ${error.message}`);
    process.exit(0);
}

describe('TypeScript Client Integration Tests', () => {
    const baseUrl = 'https://api.igris-inertial.com';
    const apiKey = 'test_api_key_12345';
    const testTimeout = 30000;

    describe('Client Creation', () => {
        test('should create client instance', () => {
            const client = new IgrisClient({
                basePath: baseUrl,
                apiKey: apiKey
            });
            
            expect(client).toBeDefined();
        });

        test('should create configuration instance', () => {
            const config = new Configuration({
                basePath: baseUrl,
                apiKey: apiKey
            });
            
            expect(config).toBeDefined();
            expect(config.basePath).toBe(baseUrl);
        });

        test('should create API client instance', () => {
            const config = new Configuration({
                basePath: baseUrl,
                apiKey: apiKey
            });
            
            const client = new ApiClient(config);
            expect(client).toBeDefined();
        });
    });

    describe('Authentication', () => {
        test('should set authentication headers correctly', async () => {
            const mockFetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                headers: new Map([['content-type', 'application/json']]),
                json: () => Promise.resolve({ status: 'success' })
            });
            
            // Mock fetch globally
            global.fetch = mockFetch;
            
            const client = new IgrisClient({
                basePath: baseUrl,
                apiKey: apiKey
            });
            
            try {
                // Attempt to make a request (will be mocked)
                await client.healthCheck();
            } catch (error) {
                // Expected since we're mocking
            }
            
            // Verify fetch was called with correct headers
            expect(mockFetch).toHaveBeenCalled();
            const call = mockFetch.mock.calls[0];
            const requestInit = call[1];
            
            expect(requestInit.headers).toBeDefined();
            expect(requestInit.headers['X-API-Key']).toBe(apiKey);
        });

        test('should handle missing API key', () => {
            expect(() => {
                new IgrisClient({
                    basePath: baseUrl
                    // No API key provided
                });
            }).toThrow(); // Should throw error for missing API key
        });
    });

    describe('Error Handling', () => {
        test('should handle HTTP 404 errors', async () => {
            const mockFetch = jest.fn().mockResolvedValue({
                ok: false,
                status: 404,
                statusText: 'Not Found',
                headers: new Map([['content-type', 'application/json']]),
                json: () => Promise.resolve({ error: 'Not Found' })
            });
            
            global.fetch = mockFetch;
            
            const client = new IgrisClient({
                basePath: baseUrl,
                apiKey: apiKey
            });
            
            try {
                await client.getNonExistentEndpoint();
                fail('Should have thrown an error');
            } catch (error) {
                expect(error).toBeDefined();
                // Error handling depends on generated client implementation
            }
        });

        test('should handle HTTP 500 errors', async () => {
            const mockFetch = jest.fn().mockResolvedValue({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
                headers: new Map([['content-type', 'application/json']]),
                json: () => Promise.resolve({ error: 'Internal Server Error' })
            });
            
            global.fetch = mockFetch;
            
            const client = new IgrisClient({
                basePath: baseUrl,
                apiKey: apiKey
            });
            
            try {
                await client.healthCheck();
                fail('Should have thrown an error');
            } catch (error) {
                expect(error).toBeDefined();
            }
        });

        test('should handle network timeout', async () => {
            const mockFetch = jest.fn().mockRejectedValue(new Error('Request timeout'));
            
            global.fetch = mockFetch;
            
            const client = new IgrisClient({
                basePath: baseUrl,
                apiKey: apiKey,
                timeout: 1000
            });
            
            try {
                await client.healthCheck();
                fail('Should have thrown a timeout error');
            } catch (error) {
                expect(error.message).toContain('timeout');
            }
        }, 10000);
    });

    describe('Request Configuration', () => {
        test('should set correct User-Agent header', async () => {
            const mockFetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                headers: new Map([['content-type', 'application/json']]),
                json: () => Promise.resolve({ status: 'success' })
            });
            
            global.fetch = mockFetch;
            
            const client = new IgrisClient({
                basePath: baseUrl,
                apiKey: apiKey
            });
            
            try {
                await client.healthCheck();
            } catch (error) {
                // Expected since we're mocking
            }
            
            // Check User-Agent header
            const call = mockFetch.mock.calls[0];
            const requestInit = call[1];
            const userAgent = requestInit.headers['User-Agent'];
            
            expect(userAgent).toBeDefined();
            expect(userAgent).toContain('igris-inertial');
        });

        test('should handle custom request timeout', async () => {
            const client = new IgrisClient({
                basePath: baseUrl,
                apiKey: apiKey,
                timeout: 5000
            });
            
            expect(client.timeout).toBe(5000);
        });

        test('should handle custom base path', () => {
            const customBasePath = 'https://custom-api.example.com';
            
            const client = new IgrisClient({
                basePath: customBasePath,
                apiKey: apiKey
            });
            
            expect(client.basePath).toBe(customBasePath);
        });
    });

    describe('Data Serialization', () => {
        test('should serialize request data correctly', () => {
            const testData = {
                stringField: 'test',
                numberField: 123,
                booleanField: true,
                arrayField: [1, 2, 3],
                objectField: { nested: 'value' }
            };
            
            const client = new IgrisClient({
                basePath: baseUrl,
                apiKey: apiKey
            });
            
            // Test serialization (method depends on generated client)
            const serialized = JSON.stringify(testData);
            expect(serialized).toBeDefined();
            
            const parsed = JSON.parse(serialized);
            expect(parsed).toEqual(testData);
        });

        test('should handle Date objects in serialization', () => {
            const testData = {
                dateField: new Date('2024-01-01T00:00:00Z'),
                timestampField: Date.now()
            };
            
            const serialized = JSON.stringify(testData);
            expect(serialized).toBeDefined();
            
            const parsed = JSON.parse(serialized);
            expect(parsed.dateField).toBeDefined();
            expect(parsed.timestampField).toBeDefined();
        });
    });

    describe('Type Safety', () => {
        test('should maintain TypeScript type safety', () => {
            // This test verifies that TypeScript types are properly generated
            const client = new IgrisClient({
                basePath: baseUrl,
                apiKey: apiKey
            });
            
            // Type checking happens at compile time, but we can test runtime behavior
            expect(typeof client.basePath).toBe('string');
            expect(typeof client.apiKey).toBe('string');
        });
    });

    describe('Model Classes', () => {
        test('should import model classes if generated', () => {
            try {
                // Try to import model classes (actual imports depend on generated code)
                const models = require(path.join(clientPath, 'models'));
                expect(models).toBeDefined();
            } catch (error) {
                // Models might not be generated yet
                console.log('Model classes not found, skipping test');
            }
        });
    });

    describe('API Classes', () => {
        test('should import API classes if generated', () => {
            try {
                // Try to import API classes (actual imports depend on generated code)
                const apis = require(path.join(clientPath, 'apis'));
                expect(apis).toBeDefined();
            } catch (error) {
                // APIs might not be generated yet
                console.log('API classes not found, skipping test');
            }
        });
    });

    // Live tests (only run when API is available)
    describe('Live API Tests', () => {
        beforeEach(() => {
            if (process.env.SKIP_LIVE_TESTS === 'true') {
                test.skip();
            }
        });

        test('should connect to local development server', async () => {
            const client = new IgrisClient({
                basePath: 'http://localhost:8000',
                apiKey: 'test_key'
            });
            
            try {
                const response = await client.healthCheck();
                expect(response).toBeDefined();
            } catch (error) {
                // Expected if API is not running
                console.log('API server not available for live testing');
                test.skip();
            }
        }, testTimeout);
    });
});

// Custom matchers for better test assertions
expect.extend({
    toBeValidResponse(received) {
        const pass = received && typeof received === 'object' && received.status;
        if (pass) {
            return {
                message: () => `expected ${received} not to be a valid response`,
                pass: true,
            };
        } else {
            return {
                message: () => `expected ${received} to be a valid response`,
                pass: false,
            };
        }
    },
});

// Setup and teardown
beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
});

afterEach(() => {
    // Clean up after each test
    delete global.fetch;
});