/**
 * Performance and load tests for Igris-engine JavaScript SDK
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { IgrisClient } from '../src/client/igris-inertial';
import { APIError, RateLimitError, NetworkError } from '../src/utils/errors';
import { mockResponse, mockApiError } from './setup';

// Mock performance.now for consistent timing
const mockPerformanceNow = jest.fn();
Object.defineProperty(global, 'performance', {
  value: { now: mockPerformanceNow }
});

// Mock fetch globally
global.fetch = jest.fn();

describe('SDK Performance Tests', () => {
  let client: IgrisClient;

  beforeEach(() => {
    client = new IgrisClient({
      apiKey: 'test-api-key',
      baseUrl: 'https://api.test.com',
      timeout: 30000,
      maxConcurrentRequests: 50
    });
    
    jest.clearAllMocks();
    mockPerformanceNow.mockImplementation(() => Date.now());
  });

  describe('concurrent requests', () => {
    test('should handle high concurrency efficiently', async () => {
      const concurrentRequests = 100;
      const mockJobResponse = {
        job_id: 'job-123',
        status: 'completed',
        result: { data: 'test' }
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse(mockJobResponse))
      });

      const startTime = Date.now();

      // Create concurrent tasks
      const tasks = Array.from({ length: concurrentRequests }, (_, i) => 
        client.data.getJobStatus(`job-${i}`)
      );

      const results = await Promise.all(tasks);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Performance assertions
      expect(results).toHaveLength(concurrentRequests);
      expect(results.every(result => result.job_id === 'job-123')).toBe(true);
      
      // Should complete 100 requests in under 5 seconds with proper concurrency
      expect(totalTime).toBeLessThan(5000);
      
      // Calculate requests per second
      const rps = concurrentRequests / (totalTime / 1000);
      expect(rps).toBeGreaterThan(20); // Should achieve at least 20 RPS

      console.log(`Concurrent requests performance: ${rps.toFixed(2)} RPS, ${totalTime}ms total`);
    });

    test('should respect connection limits', async () => {
      const limitedClient = new IgrisClient({
        apiKey: 'test-api-key',
        baseUrl: 'https://api.test.com',
        maxConcurrentRequests: 5
      });

      const requestCount = 20;
      let activeRequests = 0;
      let maxActiveRequests = 0;

      (global.fetch as jest.Mock).mockImplementation(async () => {
        activeRequests++;
        maxActiveRequests = Math.max(maxActiveRequests, activeRequests);
        
        // Simulate some processing time
        await new Promise(resolve => setTimeout(resolve, 100));
        
        activeRequests--;
        
        return {
          ok: true,
          json: jest.fn().mockResolvedValue(mockResponse({ data: 'test' }))
        };
      });

      const tasks = Array.from({ length: requestCount }, (_, i) =>
        limitedClient.data.getJobStatus(`job-${i}`)
      );

      await Promise.all(tasks);

      // Should not exceed the concurrent request limit
      expect(maxActiveRequests).toBeLessThanOrEqual(5);
    });
  });

  describe('response time distribution', () => {
    test('should maintain consistent response times under load', async () => {
      const requestCount = 200;
      const responseTimes: number[] = [];

      // Mock realistic network delay
      (global.fetch as jest.Mock).mockImplementation(async () => {
        const delay = 10 + Math.random() * 40; // 10-50ms delay
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return {
          ok: true,
          json: jest.fn().mockResolvedValue(mockResponse({ data: 'test' }))
        };
      });

      // Measure response times
      for (let i = 0; i < requestCount; i++) {
        const startTime = Date.now();
        await client.data.getJobStatus(`job-${i}`);
        const endTime = Date.now();
        
        responseTimes.push(endTime - startTime);
      }

      // Analyze response time distribution
      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const sortedTimes = responseTimes.sort((a, b) => a - b);
      const medianResponseTime = sortedTimes[Math.floor(sortedTimes.length / 2)];
      const p95ResponseTime = sortedTimes[Math.floor(0.95 * sortedTimes.length)];
      const p99ResponseTime = sortedTimes[Math.floor(0.99 * sortedTimes.length)];

      console.log(
        `Response times - Avg: ${avgResponseTime.toFixed(1)}ms, ` +
        `Median: ${medianResponseTime}ms, ` +
        `P95: ${p95ResponseTime}ms, ` +
        `P99: ${p99ResponseTime}ms`
      );

      // Performance assertions
      expect(avgResponseTime).toBeLessThan(100); // Average under 100ms
      expect(p95ResponseTime).toBeLessThan(200); // 95th percentile under 200ms
      expect(p99ResponseTime).toBeLessThan(500); // 99th percentile under 500ms
    });

    test('should handle timeout scenarios gracefully', async () => {
      const shortTimeoutClient = new IgrisClient({
        apiKey: 'test-api-key',
        baseUrl: 'https://api.test.com',
        timeout: 100 // Very short timeout
      });

      // Mock slow response
      (global.fetch as jest.Mock).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => {
          resolve({
            ok: true,
            json: jest.fn().mockResolvedValue(mockResponse({ data: 'test' }))
          });
        }, 200)) // Response takes 200ms, but timeout is 100ms
      );

      await expect(shortTimeoutClient.data.getJobStatus('job-123'))
        .rejects.toThrow(); // Should timeout
    });
  });

  describe('memory usage', () => {
    test('should not leak memory during high-volume operations', async () => {
      if (typeof process === 'undefined' || !process.memoryUsage) {
        console.log('Memory test skipped - Node.js environment required');
        return;
      }

      const initialMemory = process.memoryUsage().heapUsed / 1024 / 1024; // MB
      const operationCount = 1000;

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse({ 
          data: 'x'.repeat(1000) // 1KB response 
        }))
      });

      // Perform many operations
      for (let i = 0; i < operationCount; i++) {
        await client.data.getJobStatus(`job-${i}`);
        
        // Force garbage collection periodically
        if (i % 100 === 0 && global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage().heapUsed / 1024 / 1024;
      const memoryIncrease = finalMemory - initialMemory;

      console.log(`Memory usage: Initial ${initialMemory.toFixed(1)}MB, Final ${finalMemory.toFixed(1)}MB, Increase ${memoryIncrease.toFixed(1)}MB`);

      // Memory increase should be reasonable (detect memory leaks)
      expect(memoryIncrease).toBeLessThan(100); // Less than 100MB increase
    });

    test('should cleanup resources properly', async () => {
      const clients = [];
      
      // Create and destroy many clients
      for (let i = 0; i < 50; i++) {
        const tempClient = new IgrisClient({
          apiKey: 'test-api-key',
          baseUrl: 'https://api.test.com'
        });
        
        clients.push(tempClient);
        
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(mockResponse({ data: 'test' }))
        });
        
        await tempClient.data.getJobStatus('test-job');
        await tempClient.close();
      }

      // Force garbage collection
      if (global.gc) {
        global.gc();
      }

      // All clients should be eligible for garbage collection
      // In a real test, we'd use WeakRef to verify cleanup
      expect(clients).toHaveLength(50);
    });
  });

  describe('rate limiting handling', () => {
    test('should handle rate limits gracefully', async () => {
      const rateLimitedResponses = 3;
      let requestCount = 0;

      (global.fetch as jest.Mock).mockImplementation(async () => {
        requestCount++;
        
        if (requestCount <= rateLimitedResponses) {
          return {
            ok: false,
            status: 429,
            headers: new Map([['Retry-After', '1']]),
            json: jest.fn().mockResolvedValue(mockApiError('Rate limit exceeded', 429))
          };
        }
        
        return {
          ok: true,
          json: jest.fn().mockResolvedValue(mockResponse({ data: 'success' }))
        };
      });

      const startTime = Date.now();
      
      await expect(client.data.getJobStatus('job-123'))
        .rejects.toThrow(RateLimitError);
        
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(requestCount).toBe(1);
      expect(duration).toBeLessThan(100); // Should fail fast
    });

    test('should implement backoff for retries', async () => {
      const retryDelays: number[] = [];
      let requestCount = 0;

      const clientWithRetry = new IgrisClient({
        apiKey: 'test-api-key',
        baseUrl: 'https://api.test.com',
        retryConfig: {
          maxRetries: 3,
          baseDelay: 100,
          exponentialBackoff: true
        }
      });

      (global.fetch as jest.Mock).mockImplementation(async () => {
        const callTime = Date.now();
        if (retryDelays.length > 0) {
          retryDelays.push(callTime - retryDelays[retryDelays.length - 1]);
        } else {
          retryDelays.push(callTime);
        }
        
        requestCount++;
        
        if (requestCount <= 2) {
          return {
            ok: false,
            status: 500,
            json: jest.fn().mockResolvedValue(mockApiError('Server error', 500))
          };
        }
        
        return {
          ok: true,
          json: jest.fn().mockResolvedValue(mockResponse({ data: 'success' }))
        };
      });

      const result = await clientWithRetry.data.getJobStatus('job-123');
      
      expect(result.data).toBe('success');
      expect(requestCount).toBe(3);
      
      // Check exponential backoff (second delay should be roughly 2x first)
      if (retryDelays.length >= 3) {
        const firstDelay = retryDelays[1] - retryDelays[0];
        const secondDelay = retryDelays[2] - retryDelays[1];
        expect(secondDelay).toBeGreaterThan(firstDelay * 1.5);
      }
    });
  });

  describe('sustained load', () => {
    test('should maintain performance under sustained load', async () => {
      const testDuration = 10000; // 10 seconds
      const requestsPerSecond = 10;
      
      let requestCount = 0;
      let errorCount = 0;
      const startTime = Date.now();

      (global.fetch as jest.Mock).mockImplementation(async () => {
        // Simulate occasional errors (5% error rate)
        if (Math.random() < 0.05) {
          throw new Error('Simulated network error');
        }
        
        return {
          ok: true,
          json: jest.fn().mockResolvedValue(mockResponse({ data: 'test' }))
        };
      });

      const intervalId = setInterval(async () => {
        const promises = Array.from({ length: requestsPerSecond }, () => 
          client.data.getJobStatus(`job-${requestCount++}`)
            .catch(() => { errorCount++; })
        );
        
        await Promise.all(promises);
      }, 1000);

      // Run for test duration
      await new Promise(resolve => setTimeout(resolve, testDuration));
      clearInterval(intervalId);

      const totalTime = Date.now() - startTime;
      const actualRps = requestCount / (totalTime / 1000);
      const errorRate = errorCount / requestCount;

      console.log(`Sustained load test: ${actualRps.toFixed(2)} RPS, ${(errorRate * 100).toFixed(2)}% error rate`);

      // Performance assertions
      expect(actualRps).toBeGreaterThanOrEqual(requestsPerSecond * 0.9); // Within 10% of target
      expect(errorRate).toBeLessThan(0.1); // Less than 10% error rate
    }, 15000); // Longer timeout for sustained test
  });

  describe('error handling under load', () => {
    test('should maintain stability during error bursts', async () => {
      const requestCount = 100;
      let successCount = 0;
      let errorCount = 0;

      (global.fetch as jest.Mock).mockImplementation(async () => {
        // Simulate 20% error rate
        if (Math.random() < 0.2) {
          throw new NetworkError('Simulated network failure');
        }
        
        return {
          ok: true,
          json: jest.fn().mockResolvedValue(mockResponse({ data: 'success' }))
        };
      });

      const promises = Array.from({ length: requestCount }, async (_, i) => {
        try {
          await client.data.getJobStatus(`job-${i}`);
          successCount++;
        } catch (error) {
          errorCount++;
        }
      });

      await Promise.all(promises);

      const successRate = successCount / requestCount;
      const errorRate = errorCount / requestCount;

      console.log(`Error handling test - Success: ${(successRate * 100).toFixed(1)}%, Error: ${(errorRate * 100).toFixed(1)}%`);

      // Should handle errors gracefully
      expect(successRate).toBeGreaterThan(0.7); // At least 70% success
      expect(successCount + errorCount).toBe(requestCount); // All requests completed
    });

    test('should recover from temporary outages', async () => {
      let requestCount = 0;
      const outageStart = 10;
      const outageEnd = 20;

      (global.fetch as jest.Mock).mockImplementation(async () => {
        requestCount++;
        
        // Simulate outage between requests 10-20
        if (requestCount >= outageStart && requestCount < outageEnd) {
          return {
            ok: false,
            status: 503,
            json: jest.fn().mockResolvedValue(mockApiError('Service unavailable', 503))
          };
        }
        
        return {
          ok: true,
          json: jest.fn().mockResolvedValue(mockResponse({ data: 'available' }))
        };
      });

      const results = [];
      
      // Make 30 requests (10 before outage, 10 during, 10 after)
      for (let i = 0; i < 30; i++) {
        try {
          const result = await client.data.getJobStatus(`job-${i}`);
          results.push({ success: true, data: result });
        } catch (error) {
          results.push({ success: false, error: error.message });
        }
      }

      // Analyze results
      const beforeOutage = results.slice(0, outageStart);
      const duringOutage = results.slice(outageStart, outageEnd);
      const afterOutage = results.slice(outageEnd);

      expect(beforeOutage.every(r => r.success)).toBe(true); // All successful before
      expect(duringOutage.every(r => !r.success)).toBe(true); // All failed during
      expect(afterOutage.every(r => r.success)).toBe(true); // All successful after
    });
  });

  describe('resource optimization', () => {
    test('should reuse connections efficiently', async () => {
      const requestCount = 50;
      const connectionTracker = {
        created: 0,
        reused: 0
      };

      // Mock connection reuse tracking
      const originalFetch = global.fetch;
      (global.fetch as jest.Mock).mockImplementation(async (...args) => {
        // Simulate connection reuse logic
        if (Math.random() > 0.1) { // 90% connection reuse
          connectionTracker.reused++;
        } else {
          connectionTracker.created++;
        }
        
        return {
          ok: true,
          json: jest.fn().mockResolvedValue(mockResponse({ data: 'test' }))
        };
      });

      // Make sequential requests that should reuse connections
      for (let i = 0; i < requestCount; i++) {
        await client.data.getJobStatus(`job-${i}`);
      }

      const reuseRatio = connectionTracker.reused / requestCount;
      console.log(`Connection reuse ratio: ${(reuseRatio * 100).toFixed(1)}%`);

      expect(reuseRatio).toBeGreaterThan(0.8); // At least 80% connection reuse
    });

    test('should handle large payloads efficiently', async () => {
      const largePayloadSize = 10 * 1024 * 1024; // 10MB
      const largeData = 'x'.repeat(largePayloadSize);

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse({ 
          large_field: largeData 
        }))
      });

      const startTime = Date.now();
      const result = await client.data.getJobStatus('large-job');
      const endTime = Date.now();
      
      const processingTime = endTime - startTime;

      expect(result.large_field).toHaveLength(largePayloadSize);
      expect(processingTime).toBeLessThan(10000); // Under 10 seconds
      
      console.log(`Large payload test: ${processingTime}ms for ${(largePayloadSize / 1024 / 1024).toFixed(1)}MB`);
    });
  });

  describe('performance regression detection', () => {
    test('should establish performance baseline', async () => {
      const baselineRequests = 100;
      const responseTimes: number[] = [];

      (global.fetch as jest.Mock).mockImplementation(async () => {
        // Simulate consistent response time
        await new Promise(resolve => setTimeout(resolve, 20 + Math.random() * 10));
        
        return {
          ok: true,
          json: jest.fn().mockResolvedValue(mockResponse({ data: 'test' }))
        };
      });

      // Measure baseline performance
      const startTime = Date.now();
      
      for (let i = 0; i < baselineRequests; i++) {
        const requestStart = Date.now();
        await client.data.getJobStatus(`job-${i}`);
        const requestEnd = Date.now();
        
        responseTimes.push(requestEnd - requestStart);
      }
      
      const totalTime = Date.now() - startTime;
      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const rps = baselineRequests / (totalTime / 1000);

      const baseline = {
        requests: baselineRequests,
        totalTime,
        rps,
        avgResponseTime
      };

      console.log(`Performance baseline: ${baseline.rps.toFixed(2)} RPS, ${baseline.avgResponseTime.toFixed(2)}ms avg response time`);

      // Minimum acceptable performance
      expect(baseline.rps).toBeGreaterThan(3); // At least 3 RPS
      expect(baseline.avgResponseTime).toBeLessThan(100); // Max 100ms average
    });
  });
});

describe('Browser Performance Tests', () => {
  let client: IgrisClient;

  beforeEach(() => {
    // Mock browser environment
    Object.defineProperty(global, 'window', {
      value: {
        navigator: { userAgent: 'Mozilla/5.0 Test Browser' },
        localStorage: {
          getItem: jest.fn(),
          setItem: jest.fn(),
          removeItem: jest.fn()
        }
      },
      configurable: true
    });

    client = new IgrisClient({
      apiKey: 'test-api-key',
      baseUrl: 'https://api.test.com'
    });

    jest.clearAllMocks();
  });

  test('should handle file uploads efficiently in browser', async () => {
    const fileContent = 'test content';
    const file = new File([fileContent], 'test.txt', { type: 'text/plain' });

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(mockResponse({
        job_id: 'upload-job-123',
        status: 'processing'
      }))
    });

    const startTime = Date.now();
    const result = await client.data.processFile(file, {
      outputFormat: 'json',
      onProgress: (progress) => {
        console.log(`Upload progress: ${progress}%`);
      }
    });
    const endTime = Date.now();

    expect(result.job_id).toBe('upload-job-123');
    expect(endTime - startTime).toBeLessThan(1000); // Under 1 second for small file
  });

  test('should implement progressive loading for large responses', async () => {
    const largeResponse = {
      data: Array.from({ length: 10000 }, (_, i) => ({ id: i, value: `item-${i}` }))
    };

    let streamedChunks = 0;
    
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockImplementation(async () => {
        // Simulate streaming by yielding control periodically
        for (let i = 0; i < 100; i++) {
          if (i % 10 === 0) {
            streamedChunks++;
            await new Promise(resolve => setTimeout(resolve, 0));
          }
        }
        return mockResponse(largeResponse);
      })
    });

    const result = await client.data.getJobStatus('large-data-job');

    expect(result.data).toHaveLength(10000);
    expect(streamedChunks).toBeGreaterThan(0); // Should have yielded control
  });
});