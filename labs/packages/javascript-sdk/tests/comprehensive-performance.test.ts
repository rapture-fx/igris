/**
 * Comprehensive Performance and Load Tests for JavaScript/TypeScript SDK
 * 
 * This module contains performance tests covering:
 * - Response time measurements
 * - Throughput testing
 * - Concurrent request handling
 * - Memory usage profiling
 * - Connection pooling efficiency
 * - Rate limiting behavior
 * - Resource cleanup verification
 * - Browser vs Node.js environment performance
 */

import { jest, describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import { performance, PerformanceObserver } from 'perf_hooks';
import { EventEmitter } from 'events';

// Mock SDK imports
interface SchlepEngineClient {
    authenticate(): Promise<any>;
    createJob(data: any): Promise<any>;
    getJobStatus(jobId: string): Promise<any>;
    uploadFile(data: ArrayBuffer | File, filename?: string): Promise<any>;
    downloadFile(fileId: string): Promise<ArrayBuffer>;
    createWebSocketConnection(url?: string): Promise<any>;
}

interface AuthManager {
    getCachedToken(): string | null;
    refreshToken(): Promise<any>;
}

interface DataProcessor {
    processData(data: any): Promise<any>;
}

interface WebSocketManager extends EventEmitter {
    connect(): Promise<void>;
    send(data: any): Promise<void>;
    disconnect(): Promise<void>;
}

// Mock implementations
const createMockClient = (): SchlepEngineClient => ({
    authenticate: jest.fn().mockResolvedValue({ token: 'test-token', expiresIn: 3600 }),
    createJob: jest.fn().mockResolvedValue({ jobId: 'test-job-123', status: 'created' }),
    getJobStatus: jest.fn().mockResolvedValue({ jobId: 'test-job-123', status: 'completed' }),
    uploadFile: jest.fn().mockResolvedValue({ fileId: 'test-file-123', size: 1024 }),
    downloadFile: jest.fn().mockResolvedValue(new ArrayBuffer(1024)),
    createWebSocketConnection: jest.fn().mockResolvedValue({}),
});

const createMockAuthManager = (): AuthManager => ({
    getCachedToken: jest.fn().mockReturnValue('cached-token'),
    refreshToken: jest.fn().mockResolvedValue({ token: 'refreshed-token' }),
});

const createMockDataProcessor = (): DataProcessor => ({
    processData: jest.fn().mockResolvedValue({ processed: true }),
});

class MockWebSocketManager extends EventEmitter implements WebSocketManager {
    connect = jest.fn().mockResolvedValue(undefined);
    send = jest.fn().mockResolvedValue(undefined);
    disconnect = jest.fn().mockResolvedValue(undefined);
}

interface PerformanceResult {
    [key: string]: any;
}

class PerformanceTestSuite {
    private testResults: Record<string, PerformanceResult> = {};
    private memoryUsage: number[] = [];
    private performanceObserver?: PerformanceObserver;

    constructor() {
        this.setupPerformanceObserver();
    }

    private setupPerformanceObserver(): void {
        if (typeof PerformanceObserver !== 'undefined') {
            this.performanceObserver = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                // Store performance entries for analysis
            });
            this.performanceObserver.observe({ entryTypes: ['measure'] });
        }
    }

    measureExecutionTime<T>(name: string, fn: () => T): T {
        const start = performance.now();
        const result = fn();
        const end = performance.now();
        const duration = end - start;
        
        performance.mark(`${name}-start`);
        performance.mark(`${name}-end`);
        performance.measure(name, `${name}-start`, `${name}-end`);
        
        return result;
    }

    async measureAsyncExecutionTime<T>(name: string, fn: () => Promise<T>): Promise<[T, number]> {
        const start = performance.now();
        const result = await fn();
        const end = performance.now();
        const duration = end - start;
        
        performance.mark(`${name}-start`);
        performance.mark(`${name}-end`);
        performance.measure(name, `${name}-start`, `${name}-end`);
        
        return [result, duration];
    }

    getMemoryUsage(): number {
        if (typeof process !== 'undefined' && process.memoryUsage) {
            return process.memoryUsage().heapUsed;
        } else if (typeof performance !== 'undefined' && (performance as any).memory) {
            return (performance as any).memory.usedJSHeapSize;
        }
        return 0;
    }

    recordMemoryUsage(): void {
        this.memoryUsage.push(this.getMemoryUsage());
    }

    getMemoryStats(): { min: number; max: number; avg: number; growth: number } {
        if (this.memoryUsage.length === 0) return { min: 0, max: 0, avg: 0, growth: 0 };
        
        const min = Math.min(...this.memoryUsage);
        const max = Math.max(...this.memoryUsage);
        const avg = this.memoryUsage.reduce((a, b) => a + b, 0) / this.memoryUsage.length;
        const growth = this.memoryUsage[this.memoryUsage.length - 1] - this.memoryUsage[0];
        
        return { min, max, avg, growth };
    }

    addResult(testName: string, result: PerformanceResult): void {
        this.testResults[testName] = result;
    }

    getResults(): Record<string, PerformanceResult> {
        return this.testResults;
    }

    cleanup(): void {
        if (this.performanceObserver) {
            this.performanceObserver.disconnect();
        }
        performance.clearMarks();
        performance.clearMeasures();
    }
}

describe('JavaScript SDK Performance Tests', () => {
    let performanceSuite: PerformanceTestSuite;
    let mockClient: SchlepEngineClient;
    let mockAuthManager: AuthManager;
    let mockDataProcessor: DataProcessor;

    beforeAll(() => {
        performanceSuite = new PerformanceTestSuite();
    });

    beforeEach(() => {
        mockClient = createMockClient();
        mockAuthManager = createMockAuthManager();
        mockDataProcessor = createMockDataProcessor();
        performanceSuite.recordMemoryUsage();
    });

    afterEach(() => {
        performanceSuite.recordMemoryUsage();
        jest.clearAllMocks();
    });

    afterAll(() => {
        performanceSuite.cleanup();
    });

    describe('Authentication Performance', () => {
        it('should authenticate within acceptable time limits', async () => {
            const [result, duration] = await performanceSuite.measureAsyncExecutionTime(
                'auth-single',
                () => mockClient.authenticate()
            );

            expect(duration).toBeLessThan(500); // 500ms
            expect(result).toHaveProperty('token');

            performanceSuite.addResult('auth_response_time', {
                duration,
                acceptable: duration < 500
            });
        });

        it('should handle concurrent authentication requests efficiently', async () => {
            const concurrentRequests = 50;
            const startTime = performance.now();

            const promises = Array.from({ length: concurrentRequests }, () =>
                mockClient.authenticate()
            );

            const results = await Promise.all(promises);
            const endTime = performance.now();
            const totalTime = endTime - startTime;
            const avgTimePerRequest = totalTime / concurrentRequests;

            expect(results).toHaveLength(concurrentRequests);
            expect(avgTimePerRequest).toBeLessThan(100); // 100ms per request on average
            expect(totalTime).toBeLessThan(5000); // Total time under 5 seconds

            performanceSuite.addResult('concurrent_auth', {
                totalTime,
                avgTimePerRequest,
                requests: concurrentRequests,
                requestsPerSecond: (concurrentRequests / totalTime) * 1000
            });
        });

        it('should demonstrate token caching efficiency', async () => {
            // First call - should fetch token
            const [, firstCallTime] = await performanceSuite.measureAsyncExecutionTime(
                'token-first-call',
                () => Promise.resolve(mockAuthManager.getCachedToken())
            );

            // Second call - should use cache
            const [, cachedCallTime] = await performanceSuite.measureAsyncExecutionTime(
                'token-cached-call',
                () => Promise.resolve(mockAuthManager.getCachedToken())
            );

            // Cache should be significantly faster
            const efficiencyRatio = firstCallTime / (cachedCallTime || 0.001);
            expect(efficiencyRatio).toBeGreaterThan(2); // At least 2x faster

            performanceSuite.addResult('token_cache_efficiency', {
                firstCallTime,
                cachedCallTime,
                efficiencyRatio
            });
        });
    });

    describe('Data Processing Performance', () => {
        it('should handle file upload with good throughput', async () => {
            const fileSizes = [1024, 10240, 102400, 1024000]; // 1KB, 10KB, 100KB, 1MB

            for (const size of fileSizes) {
                const testData = new ArrayBuffer(size);
                
                const [result, uploadTime] = await performanceSuite.measureAsyncExecutionTime(
                    `upload-${size}`,
                    () => mockClient.uploadFile(testData, `test-${size}.bin`)
                );

                const throughputMbps = (size / (uploadTime / 1000)) / (1024 * 1024); // MB/s
                
                // Expect at least 1 MB/s throughput
                expect(throughputMbps).toBeGreaterThan(1);

                performanceSuite.addResult(`upload_performance_${size}`, {
                    size,
                    uploadTime,
                    throughputMbps
                });
            }
        });

        it('should process multiple jobs concurrently', async () => {
            const numJobs = 20;
            
            const processJob = async (jobId: number) => {
                const job = await mockClient.createJob({ type: 'test', data: `job-${jobId}` });
                
                // Simulate polling for completion
                let attempts = 0;
                while (attempts < 10) {
                    const status = await mockClient.getJobStatus(job.jobId);
                    if (status.status === 'completed') {
                        return status;
                    }
                    await new Promise(resolve => setTimeout(resolve, 100));
                    attempts++;
                }
                return { status: 'timeout' };
            };

            const startTime = performance.now();
            const jobPromises = Array.from({ length: numJobs }, (_, i) => processJob(i));
            const results = await Promise.all(jobPromises);
            const endTime = performance.now();

            const totalTime = endTime - startTime;
            const jobsPerSecond = (numJobs / totalTime) * 1000;

            expect(results).toHaveLength(numJobs);
            expect(jobsPerSecond).toBeGreaterThan(2); // At least 2 jobs per second

            performanceSuite.addResult('concurrent_job_processing', {
                numJobs,
                totalTime,
                jobsPerSecond,
                completedJobs: results.filter(r => r.status === 'completed').length
            });
        });

        it('should manage memory efficiently during large data processing', async () => {
            const initialMemory = performanceSuite.getMemoryUsage();
            
            // Process multiple large data chunks
            const chunkSize = 1024 * 1024; // 1MB chunks
            const numChunks = 10;
            
            for (let i = 0; i < numChunks; i++) {
                const chunk = new ArrayBuffer(chunkSize);
                await mockDataProcessor.processData(chunk);
                
                // Force garbage collection if available
                if (global.gc) {
                    global.gc();
                }
                
                performanceSuite.recordMemoryUsage();
            }

            const memoryStats = performanceSuite.getMemoryStats();
            const memoryGrowthMB = memoryStats.growth / (1024 * 1024);

            // Memory growth should be reasonable (less than 50MB)
            expect(memoryGrowthMB).toBeLessThan(50);

            performanceSuite.addResult('memory_management', {
                initialMemoryMB: initialMemory / (1024 * 1024),
                finalMemoryMB: memoryStats.max / (1024 * 1024),
                memoryGrowthMB,
                chunksProcessed: numChunks
            });
        });
    });

    describe('WebSocket Performance', () => {
        it('should establish WebSocket connections quickly', async () => {
            const wsManager = new MockWebSocketManager();
            
            const [, connectionTime] = await performanceSuite.measureAsyncExecutionTime(
                'websocket-connection',
                () => wsManager.connect()
            );

            expect(connectionTime).toBeLessThan(2000); // 2 seconds

            performanceSuite.addResult('websocket_connection_time', {
                connectionTime,
                acceptable: connectionTime < 2000
            });
        });

        it('should handle high message throughput', async () => {
            const wsManager = new MockWebSocketManager();
            const numMessages = 1000;
            const messageSize = 1024; // 1KB messages
            
            await wsManager.connect();
            
            const testMessage = new ArrayBuffer(messageSize);
            const startTime = performance.now();
            
            const sendPromises = Array.from({ length: numMessages }, () =>
                wsManager.send(testMessage)
            );
            
            await Promise.all(sendPromises);
            const endTime = performance.now();
            
            const totalTime = endTime - startTime;
            const messagesPerSecond = (numMessages / totalTime) * 1000;
            const throughputMbps = (numMessages * messageSize / (totalTime / 1000)) / (1024 * 1024);

            expect(messagesPerSecond).toBeGreaterThan(100); // At least 100 messages/second

            performanceSuite.addResult('websocket_throughput', {
                messagesPerSecond,
                throughputMbps,
                totalMessages: numMessages,
                totalTime
            });
        });

        it('should handle multiple concurrent WebSocket connections', async () => {
            const numConnections = 10;
            
            const createConnection = async (id: number) => {
                const ws = new MockWebSocketManager();
                await ws.connect();
                return ws;
            };

            const startTime = performance.now();
            const connectionPromises = Array.from({ length: numConnections }, (_, i) =>
                createConnection(i)
            );
            
            const connections = await Promise.all(connectionPromises);
            const endTime = performance.now();
            const totalTime = endTime - startTime;

            expect(connections).toHaveLength(numConnections);
            expect(totalTime).toBeLessThan(10000); // 10 seconds

            performanceSuite.addResult('concurrent_websocket_connections', {
                numConnections,
                totalTime,
                avgTimePerConnection: totalTime / numConnections
            });

            // Clean up connections
            await Promise.all(connections.map(ws => ws.disconnect()));
        });
    });

    describe('Rate Limiting and Load Testing', () => {
        it('should respect rate limits', async () => {
            const requestsPerSecond = 10;
            const testDuration = 5000; // 5 seconds
            
            const requests: number[] = [];
            const startTime = performance.now();
            
            while (performance.now() - startTime < testDuration) {
                const requestStart = performance.now();
                await mockClient.authenticate();
                requests.push(requestStart);
                
                // Simple rate limiting simulation
                await new Promise(resolve => setTimeout(resolve, 10));
            }
            
            const actualRps = (requests.length / testDuration) * 1000;
            
            // Should not significantly exceed rate limit
            expect(actualRps).toBeLessThanOrEqual(requestsPerSecond * 1.1);

            performanceSuite.addResult('rate_limit_compliance', {
                targetRps: requestsPerSecond,
                actualRps,
                totalRequests: requests.length,
                testDuration
            });
        });

        it('should handle sustained load', async () => {
            const duration = 10000; // 10 seconds
            const targetRps = 5;
            
            let completedRequests = 0;
            let errors = 0;
            
            const startTime = performance.now();
            
            const makeRequests = async () => {
                while (performance.now() - startTime < duration) {
                    try {
                        await mockClient.authenticate();
                        completedRequests++;
                    } catch (error) {
                        errors++;
                    }
                    await new Promise(resolve => setTimeout(resolve, 1000 / targetRps));
                }
            };

            await makeRequests();
            const actualDuration = performance.now() - startTime;
            const actualRps = (completedRequests / actualDuration) * 1000;
            const errorRate = errors / (completedRequests + errors);

            expect(actualRps).toBeGreaterThanOrEqual(targetRps * 0.9);
            expect(errorRate).toBeLessThan(0.05); // Less than 5% error rate

            performanceSuite.addResult('sustained_load', {
                targetRps,
                actualRps,
                duration: actualDuration,
                completedRequests,
                errors,
                errorRate
            });
        });

        it('should handle load spikes gracefully', async () => {
            const normalRps = 2;
            const spikeRps = 20;
            const spikeDuration = 2000; // 2 seconds
            
            const results = { normal: 0, spike: 0, errors: 0 };
            
            // Normal load function
            const normalLoad = async () => {
                for (let i = 0; i < normalRps * 5; i++) { // 5 seconds of normal load
                    try {
                        await mockClient.authenticate();
                        results.normal++;
                    } catch {
                        results.errors++;
                    }
                    await new Promise(resolve => setTimeout(resolve, 1000 / normalRps));
                }
            };
            
            // Spike load function
            const spikeLoad = async () => {
                await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
                const spikeStart = performance.now();
                while (performance.now() - spikeStart < spikeDuration) {
                    try {
                        await mockClient.authenticate();
                        results.spike++;
                    } catch {
                        results.errors++;
                    }
                    await new Promise(resolve => setTimeout(resolve, 1000 / spikeRps));
                }
            };

            const startTime = performance.now();
            await Promise.all([normalLoad(), spikeLoad()]);
            const totalTime = performance.now() - startTime;
            
            const totalRequests = results.normal + results.spike;
            const errorRate = results.errors / (totalRequests + results.errors);

            expect(errorRate).toBeLessThan(0.1); // Less than 10% error rate
            expect(results.spike).toBeGreaterThan(spikeRps * (spikeDuration / 1000) * 0.8);

            performanceSuite.addResult('spike_load_handling', {
                normalRequests: results.normal,
                spikeRequests: results.spike,
                totalErrors: results.errors,
                errorRate,
                totalTime
            });
        });
    });

    describe('Connection Pooling Performance', () => {
        it('should demonstrate connection pooling efficiency', async () => {
            const numRequests = 50;
            
            // Simulate pooled connections (reused)
            const pooledStartTime = performance.now();
            const pooledPromises = Array.from({ length: numRequests }, () =>
                mockClient.authenticate()
            );
            await Promise.all(pooledPromises);
            const pooledTime = performance.now() - pooledStartTime;
            
            // Simulate non-pooled connections (new connection each time)
            const nonPooledStartTime = performance.now();
            for (let i = 0; i < numRequests; i++) {
                await mockClient.authenticate();
            }
            const nonPooledTime = performance.now() - nonPooledStartTime;
            
            const efficiencyGain = nonPooledTime / pooledTime;
            expect(efficiencyGain).toBeGreaterThan(1.2); // At least 20% improvement

            performanceSuite.addResult('connection_pooling_efficiency', {
                pooledTime,
                nonPooledTime,
                efficiencyGain,
                numRequests
            });
        });
    });

    describe('Environment-Specific Performance', () => {
        it('should measure Node.js vs Browser performance characteristics', async () => {
            const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;
            
            // File handling performance (Node.js specific)
            if (isNode) {
                const buffer = Buffer.alloc(1024 * 1024); // 1MB buffer
                const [, bufferTime] = await performanceSuite.measureAsyncExecutionTime(
                    'node-buffer-processing',
                    () => mockClient.uploadFile(buffer.buffer)
                );
                
                performanceSuite.addResult('nodejs_buffer_performance', {
                    bufferSize: buffer.length,
                    processingTime: bufferTime
                });
            } else {
                // Browser-specific performance
                const blob = new Blob(['x'.repeat(1024 * 1024)], { type: 'application/octet-stream' });
                const [, blobTime] = await performanceSuite.measureAsyncExecutionTime(
                    'browser-blob-processing',
                    () => mockClient.uploadFile(blob as any)
                );
                
                performanceSuite.addResult('browser_blob_performance', {
                    blobSize: blob.size,
                    processingTime: blobTime
                });
            }

            performanceSuite.addResult('environment_detection', {
                environment: isNode ? 'Node.js' : 'Browser',
                hasProcess: typeof process !== 'undefined',
                hasWindow: typeof window !== 'undefined',
                hasBlob: typeof Blob !== 'undefined'
            });
        });
    });

    describe('Performance Summary', () => {
        it('should generate comprehensive performance report', () => {
            const results = performanceSuite.getResults();
            const memoryStats = performanceSuite.getMemoryStats();
            
            console.log('\n' + '='.repeat(60));
            console.log('JAVASCRIPT SDK PERFORMANCE TEST SUMMARY');
            console.log('='.repeat(60));
            
            Object.entries(results).forEach(([testName, result]) => {
                console.log(`\n${testName.toUpperCase()}:`);
                Object.entries(result).forEach(([key, value]) => {
                    if (typeof value === 'number') {
                        console.log(`  ${key}: ${value.toFixed(3)}`);
                    } else {
                        console.log(`  ${key}: ${value}`);
                    }
                });
            });
            
            console.log('\nMEMORY STATISTICS:');
            console.log(`  Min Usage: ${(memoryStats.min / 1024 / 1024).toFixed(2)} MB`);
            console.log(`  Max Usage: ${(memoryStats.max / 1024 / 1024).toFixed(2)} MB`);
            console.log(`  Avg Usage: ${(memoryStats.avg / 1024 / 1024).toFixed(2)} MB`);
            console.log(`  Growth: ${(memoryStats.growth / 1024 / 1024).toFixed(2)} MB`);
            
            console.log('\n' + '='.repeat(60));
            
            // Verify that we have collected performance data
            expect(Object.keys(results).length).toBeGreaterThan(0);
        });
    });
});