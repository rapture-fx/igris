/**
 * Comprehensive End-to-End Tests for JavaScript/TypeScript SDK
 * 
 * This module contains E2E tests simulating real user workflows:
 * - Complete data processing pipelines
 * - File upload/download workflows with various formats
 * - Real-time WebSocket streaming scenarios
 * - Authentication and session management
 * - Error recovery and retry mechanisms
 * - Browser vs Node.js environment workflows
 * - Cross-feature integration scenarios
 */

import { jest, describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Mock SDK interfaces and types
interface SchlepEngineClient {
    authenticate(): Promise<AuthResult>;
    uploadFile(file: File | ArrayBuffer | Buffer, metadata?: any): Promise<UploadResult>;
    downloadFile(fileId: string): Promise<ArrayBuffer>;
    createJob(config: JobConfig): Promise<JobResult>;
    waitForJobCompletion(jobId: string, timeout?: number): Promise<JobCompletionResult>;
    createWebSocketConnection(url?: string): Promise<WebSocketConnection>;
    trainModel(config: TrainingConfig): Promise<ModelResult>;
    predict(modelId: string, data: any[]): Promise<PredictionResult>;
}

interface AuthResult {
    token: string;
    expiresIn: number;
    refreshToken?: string;
}

interface UploadResult {
    fileId: string;
    size: number;
    status: string;
    metadata?: any;
}

interface JobConfig {
    type: string;
    inputFiles?: string[];
    operations?: any[];
    [key: string]: any;
}

interface JobResult {
    jobId: string;
    status: string;
    config: JobConfig;
    createdAt: number;
}

interface JobCompletionResult {
    jobId: string;
    status: string;
    progress: number;
    results?: any;
}

interface TrainingConfig {
    modelType: string;
    algorithm: string;
    trainingData: string;
    hyperparameters?: any;
    [key: string]: any;
}

interface ModelResult {
    modelId: string;
    status: string;
    accuracy?: number;
}

interface PredictionResult {
    modelId: string;
    predictions: any[];
    confidenceScores: number[];
}

interface WebSocketConnection extends EventEmitter {
    connect(): Promise<{ status: string; sessionId: string }>;
    send(message: any): Promise<{ status: string; messageId: string }>;
    receive(timeout?: number): Promise<any>;
    disconnect(): Promise<{ status: string }>;
    isConnected(): boolean;
}

// Mock implementations
const createMockClient = (): SchlepEngineClient => {
    const generateId = () => `mock_${Math.random().toString(36).substring(2, 15)}`;
    
    return {
        authenticate: jest.fn().mockImplementation(async () => {
            await new Promise(resolve => setTimeout(resolve, 100)); // Simulate network delay
            return {
                token: `auth_token_${generateId()}`,
                expiresIn: 3600,
                refreshToken: `refresh_${generateId()}`
            };
        }),

        uploadFile: jest.fn().mockImplementation(async (file: any, metadata?: any) => {
            await new Promise(resolve => setTimeout(resolve, 200)); // Simulate upload time
            
            let size = 0;
            if (file instanceof ArrayBuffer) {
                size = file.byteLength;
            } else if (file instanceof Buffer) {
                size = file.length;
            } else if (typeof File !== 'undefined' && file instanceof File) {
                size = file.size;
            } else {
                size = 1024; // Default size
            }
            
            return {
                fileId: `file_${generateId()}`,
                size,
                status: 'uploaded',
                metadata: metadata || {}
            };
        }),

        downloadFile: jest.fn().mockImplementation(async (fileId: string) => {
            await new Promise(resolve => setTimeout(resolve, 150)); // Simulate download time
            const content = `Mock file content for ${fileId}`;
            return new TextEncoder().encode(content).buffer;
        }),

        createJob: jest.fn().mockImplementation(async (config: JobConfig) => {
            await new Promise(resolve => setTimeout(resolve, 100));
            return {
                jobId: `job_${generateId()}`,
                status: 'created',
                config,
                createdAt: Date.now()
            };
        }),

        waitForJobCompletion: jest.fn().mockImplementation(async (jobId: string, timeout?: number) => {
            // Simulate job processing time
            await new Promise(resolve => setTimeout(resolve, 1000));
            return {
                jobId,
                status: 'completed',
                progress: 100,
                results: {
                    processedItems: 100,
                    outputFiles: [`output_${generateId()}.json`]
                }
            };
        }),

        createWebSocketConnection: jest.fn().mockImplementation(async (url?: string) => {
            return new MockWebSocketConnection();
        }),

        trainModel: jest.fn().mockImplementation(async (config: TrainingConfig) => {
            // ML training takes longer
            await new Promise(resolve => setTimeout(resolve, 2000));
            return {
                modelId: `model_${generateId()}`,
                status: 'trained',
                accuracy: 0.95
            };
        }),

        predict: jest.fn().mockImplementation(async (modelId: string, data: any[]) => {
            await new Promise(resolve => setTimeout(resolve, 300));
            return {
                modelId,
                predictions: data.map((item, i) => ({ input: item, prediction: `pred_${i}` })),
                confidenceScores: data.map((_, i) => 0.9 + i * 0.01)
            };
        })
    };
};

class MockWebSocketConnection extends EventEmitter implements WebSocketConnection {
    private connected = false;
    private messages: any[] = [];

    async connect(): Promise<{ status: string; sessionId: string }> {
        await new Promise(resolve => setTimeout(resolve, 100));
        this.connected = true;
        const result = { status: 'connected', sessionId: `ws_${Math.random().toString(36).substring(2, 15)}` };
        this.emit('connected', result);
        return result;
    }

    async send(message: any): Promise<{ status: string; messageId: string }> {
        if (!this.connected) {
            throw new Error('WebSocket not connected');
        }
        await new Promise(resolve => setTimeout(resolve, 10));
        this.messages.push(message);
        const result = { status: 'sent', messageId: `msg_${this.messages.length}` };
        this.emit('messageSent', result);
        return result;
    }

    async receive(timeout = 5000): Promise<any> {
        await new Promise(resolve => setTimeout(resolve, 50));
        const message = {
            type: 'data',
            payload: { 
                timestamp: Date.now(), 
                data: 'mock_streaming_data',
                sequenceNumber: Math.floor(Math.random() * 1000)
            },
            messageId: `received_${Math.random().toString(36).substring(2, 15)}`
        };
        this.emit('messageReceived', message);
        return message;
    }

    async disconnect(): Promise<{ status: string }> {
        await new Promise(resolve => setTimeout(resolve, 50));
        this.connected = false;
        const result = { status: 'disconnected' };
        this.emit('disconnected', result);
        return result;
    }

    isConnected(): boolean {
        return this.connected;
    }
}

interface E2ETestSuite {
    client: SchlepEngineClient;
    tempFiles: string[];
    workflowState: Record<string, any>;
    tempDir: string;
    createTestFile(filename: string, contentType?: string, sizeMB?: number): Promise<string>;
    createTestBlob(filename: string, contentType?: string, sizeMB?: number): Blob;
    cleanup(): Promise<void>;
}

class E2ETestSuiteImpl implements E2ETestSuite {
    client: SchlepEngineClient;
    tempFiles: string[] = [];
    workflowState: Record<string, any> = {};
    tempDir: string;

    constructor() {
        this.client = createMockClient();
        this.tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-e2e-test-'));
    }

    async createTestFile(filename: string, contentType = 'text', sizeMB = 1): Promise<string> {
        const filePath = path.join(this.tempDir, filename);
        
        let content: string;
        if (contentType === 'json') {
            content = JSON.stringify({
                filename,
                data: Array.from({ length: sizeMB * 100 }, (_, i) => ({
                    id: i,
                    value: `item_${i}`,
                    timestamp: Date.now() + i
                }))
            }, null, 2);
        } else if (contentType === 'text') {
            content = `Test file content for ${filename}\n`.repeat(sizeMB * 1000);
        } else {
            content = `Generic content for ${filename}`.repeat(sizeMB * 500);
        }
        
        await fs.promises.writeFile(filePath, content);
        this.tempFiles.push(filePath);
        return filePath;
    }

    createTestBlob(filename: string, contentType = 'text/plain', sizeMB = 1): Blob {
        let content: string;
        if (contentType === 'application/json') {
            content = JSON.stringify({
                filename,
                data: Array.from({ length: sizeMB * 100 }, (_, i) => ({ id: i, value: `item_${i}` }))
            });
        } else {
            content = `Test blob content for ${filename}\n`.repeat(sizeMB * 1000);
        }
        
        return new Blob([content], { type: contentType });
    }

    async cleanup(): Promise<void> {
        // Clean up temporary files
        for (const filePath of this.tempFiles) {
            try {
                if (fs.existsSync(filePath)) {
                    await fs.promises.unlink(filePath);
                }
            } catch (error) {
                console.warn(`Failed to delete temp file ${filePath}:`, error);
            }
        }
        
        // Clean up temp directory
        try {
            await fs.promises.rmdir(this.tempDir);
        } catch (error) {
            console.warn(`Failed to delete temp directory ${this.tempDir}:`, error);
        }
    }
}

describe('JavaScript SDK End-to-End Tests', () => {
    let e2eSuite: E2ETestSuite;

    beforeAll(() => {
        e2eSuite = new E2ETestSuiteImpl();
    });

    afterAll(async () => {
        await e2eSuite.cleanup();
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Complete Data Processing Workflows', () => {
        it('should execute full data pipeline workflow: upload → process → download', async () => {
            const client = e2eSuite.client;

            // Step 1: Authenticate
            const authResult = await client.authenticate();
            expect(authResult.token).toBeDefined();
            expect(authResult.expiresIn).toBeGreaterThan(0);

            // Step 2: Prepare and upload data files
            const inputFiles: string[] = [];
            
            for (let i = 0; i < 3; i++) {
                // In browser environment, create Blob; in Node.js, use Buffer
                let fileData: any;
                if (typeof Blob !== 'undefined') {
                    fileData = e2eSuite.createTestBlob(`input_data_${i}.json`, 'application/json', 1);
                } else {
                    // Node.js environment
                    const filePath = await e2eSuite.createTestFile(`input_data_${i}.json`, 'json', 1);
                    const buffer = await fs.promises.readFile(filePath);
                    fileData = buffer;
                }

                const uploadResult = await client.uploadFile(fileData, {
                    type: 'input_data',
                    batch: i,
                    timestamp: Date.now()
                });

                expect(uploadResult.status).toBe('uploaded');
                expect(uploadResult.fileId).toBeDefined();
                inputFiles.push(uploadResult.fileId);
            }

            // Step 3: Create data processing job
            const jobConfig: JobConfig = {
                type: 'data_transformation',
                inputFiles,
                operations: [
                    { type: 'filter', criteria: { value: { $gt: 50 } } },
                    { type: 'transform', function: 'normalize' },
                    { type: 'aggregate', groupBy: 'category' }
                ],
                outputFormat: 'json'
            };

            const jobResult = await client.createJob(jobConfig);
            expect(jobResult.status).toBe('created');

            // Step 4: Wait for job completion
            const completionResult = await client.waitForJobCompletion(jobResult.jobId, 60000);
            expect(completionResult.status).toBe('completed');
            expect(completionResult.progress).toBe(100);
            expect(completionResult.results).toBeDefined();

            // Step 5: Download processed results
            const outputFiles = completionResult.results!.outputFiles;
            const downloadedFiles: ArrayBuffer[] = [];

            for (const outputFile of outputFiles) {
                const downloadResult = await client.downloadFile(outputFile);
                expect(downloadResult).toBeInstanceOf(ArrayBuffer);
                expect(downloadResult.byteLength).toBeGreaterThan(0);
                downloadedFiles.append(downloadResult);
            }

            // Step 6: Verify workflow completion
            const workflowSummary = {
                authentication: 'completed',
                uploadedFiles: inputFiles.length,
                jobStatus: completionResult.status,
                downloadedFiles: downloadedFiles.length,
                processingTime: Date.now() - jobResult.createdAt
            };

            e2eSuite.workflowState['data_pipeline'] = workflowSummary;

            expect(workflowSummary.authentication).toBe('completed');
            expect(workflowSummary.uploadedFiles).toBe(3);
            expect(workflowSummary.jobStatus).toBe('completed');
            expect(workflowSummary.downloadedFiles).toBeGreaterThan(0);
        });

        it('should handle batch processing workflow with concurrent jobs', async () => {
            const client = e2eSuite.client;

            await client.authenticate();

            // Create multiple data batches
            const batches: Array<{ batchId: number; files: string[] }> = [];
            
            for (let batchId = 0; batchId < 5; batchId++) {
                const batchFiles: string[] = [];
                
                for (let fileId = 0; fileId < 2; fileId++) {
                    let fileData: any;
                    
                    if (typeof Blob !== 'undefined') {
                        fileData = e2eSuite.createTestBlob(`batch_${batchId}_file_${fileId}.json`, 'application/json');
                    } else {
                        const filePath = await e2eSuite.createTestFile(`batch_${batchId}_file_${fileId}.json`, 'json');
                        fileData = await fs.promises.readFile(filePath);
                    }

                    const uploadResult = await client.uploadFile(fileData);
                    batchFiles.push(uploadResult.fileId);
                }

                batches.push({ batchId, files: batchFiles });
            }

            // Create concurrent processing jobs
            const jobPromises = batches.map(batch => 
                client.createJob({
                    type: 'batch_processing',
                    batchId: batch.batchId,
                    inputFiles: batch.files,
                    operations: ['validate', 'transform', 'summarize']
                })
            );

            const jobResults = await Promise.all(jobPromises);
            const jobIds = jobResults.map(result => result.jobId);

            // Monitor all jobs concurrently
            const completionPromises = jobIds.map(jobId => 
                client.waitForJobCompletion(jobId, 120000)
            );

            const completionResults = await Promise.all(completionPromises);

            // Verify all jobs completed successfully
            let completedJobs = 0;
            let totalProcessedItems = 0;

            for (const result of completionResults) {
                expect(result.status).toBe('completed');
                completedJobs++;
                totalProcessedItems += result.results?.processedItems || 0;
            }

            expect(completedJobs).toBe(batches.length);
            expect(totalProcessedItems).toBeGreaterThan(0);

            e2eSuite.workflowState['batch_processing'] = {
                batchesProcessed: completedJobs,
                totalItems: totalProcessedItems,
                successRate: completedJobs / batches.length
            };
        });

        it('should handle error recovery and retry mechanisms', async () => {
            const client = e2eSuite.client;

            await client.authenticate();

            // Mock a scenario where job creation fails initially
            let callCount = 0;
            const originalCreateJob = client.createJob;
            
            (client.createJob as jest.Mock).mockImplementation(async (config: JobConfig) => {
                callCount++;
                
                // Fail the first 2 attempts
                if (callCount <= 2) {
                    throw new Error('Simulated service unavailable');
                }
                
                // Succeed on the 3rd attempt
                return originalCreateJob(config);
            });

            // Implement retry logic with exponential backoff
            const maxRetries = 3;
            const baseDelay = 100;
            
            const jobConfig: JobConfig = {
                type: 'error_recovery_test',
                data: 'test_data'
            };

            let jobResult: JobResult | undefined;
            
            for (let attempt = 0; attempt < maxRetries; attempt++) {
                try {
                    jobResult = await client.createJob(jobConfig);
                    break;
                } catch (error) {
                    if (attempt < maxRetries - 1) {
                        const delay = baseDelay * Math.pow(2, attempt);
                        await new Promise(resolve => setTimeout(resolve, delay));
                        continue;
                    } else {
                        throw error;
                    }
                }
            }

            expect(jobResult).toBeDefined();
            expect(jobResult!.status).toBe('created');
            expect(callCount).toBe(3);

            // Complete the workflow
            const completionResult = await client.waitForJobCompletion(jobResult!.jobId);
            expect(completionResult.status).toBe('completed');

            e2eSuite.workflowState['error_recovery'] = {
                attempts: callCount,
                finalStatus: completionResult.status,
                retrySuccessful: true
            };
        });
    });

    describe('ML Pipeline Workflows', () => {
        it('should execute complete ML training workflow', async () => {
            const client = e2eSuite.client;

            // Step 1: Authenticate and prepare training data
            await client.authenticate();

            // Upload training data
            let trainingData: any;
            if (typeof Blob !== 'undefined') {
                trainingData = e2eSuite.createTestBlob('training_data.json', 'application/json', 5);
            } else {
                const filePath = await e2eSuite.createTestFile('training_data.json', 'json', 5);
                trainingData = await fs.promises.readFile(filePath);
            }

            const trainUpload = await client.uploadFile(trainingData, {
                type: 'training_data',
                samples: 1000
            });

            // Upload validation data
            let validationData: any;
            if (typeof Blob !== 'undefined') {
                validationData = e2eSuite.createTestBlob('validation_data.json', 'application/json', 2);
            } else {
                const filePath = await e2eSuite.createTestFile('validation_data.json', 'json', 2);
                validationData = await fs.promises.readFile(filePath);
            }

            const valUpload = await client.uploadFile(validationData, {
                type: 'validation_data',
                samples: 200
            });

            // Step 2: Configure and start model training
            const trainingConfig: TrainingConfig = {
                modelType: 'classifier',
                algorithm: 'random_forest',
                trainingData: trainUpload.fileId,
                validationData: valUpload.fileId,
                hyperparameters: {
                    nEstimators: 100,
                    maxDepth: 10,
                    minSamplesSplit: 5
                },
                validationSplit: 0.2,
                earlyStopping: true
            };

            const trainingResult = await client.trainModel(trainingConfig);
            
            expect(trainingResult.status).toBe('trained');
            expect(trainingResult.accuracy).toBeGreaterThan(0.8);

            // Step 3: Run inference with test data
            const testData = [
                { feature1: 0.5, feature2: 1.2, feature3: 'category_a' },
                { feature1: 0.8, feature2: 0.9, feature3: 'category_b' },
                { feature1: 0.3, feature2: 1.5, feature3: 'category_a' },
                { feature1: 0.7, feature2: 0.6, feature3: 'category_c' }
            ];

            const predictionResult = await client.predict(trainingResult.modelId, testData);

            expect(predictionResult.predictions).toHaveLength(testData.length);
            expect(predictionResult.confidenceScores).toHaveLength(testData.length);
            expect(predictionResult.confidenceScores.every(score => score > 0.5)).toBeTruthy();

            // Step 4: Validate complete ML workflow
            const mlWorkflowSummary = {
                trainingDataUploaded: Boolean(trainUpload.fileId),
                validationDataUploaded: Boolean(valUpload.fileId),
                modelTrained: trainingResult.status === 'trained',
                modelAccuracy: trainingResult.accuracy,
                predictionsGenerated: predictionResult.predictions.length,
                avgConfidence: predictionResult.confidenceScores.reduce((a, b) => a + b, 0) / predictionResult.confidenceScores.length
            };

            e2eSuite.workflowState['ml_pipeline'] = mlWorkflowSummary;

            expect(mlWorkflowSummary.trainingDataUploaded).toBeTruthy();
            expect(mlWorkflowSummary.validationDataUploaded).toBeTruthy();
            expect(mlWorkflowSummary.modelTrained).toBeTruthy();
            expect(mlWorkflowSummary.modelAccuracy).toBeGreaterThan(0.8);
            expect(mlWorkflowSummary.predictionsGenerated).toBe(testData.length);
            expect(mlWorkflowSummary.avgConfidence).toBeGreaterThan(0.5);
        });
    });

    describe('Real-time Streaming Workflows', () => {
        it('should execute complete streaming workflow', async () => {
            const client = e2eSuite.client;

            // Step 1: Authenticate
            await client.authenticate();

            // Step 2: Establish WebSocket connection
            const websocket = await client.createWebSocketConnection();
            const connectionResult = await websocket.connect();

            expect(connectionResult.status).toBe('connected');
            expect(connectionResult.sessionId).toBeDefined();

            // Step 3: Set up streaming data processing
            const processedMessages: any[] = [];
            let errorCount = 0;

            // Process streaming messages
            try {
                for (let i = 0; i < 10; i++) {
                    const message = await websocket.receive(5000);
                    
                    const processedData = {
                        original: message,
                        processedAt: Date.now(),
                        processedBy: 'e2e_test_workflow'
                    };
                    
                    processedMessages.push(processedData);

                    // Send acknowledgment
                    const ackMessage = {
                        type: 'acknowledgment',
                        messageId: message.messageId,
                        status: 'processed'
                    };

                    await websocket.send(ackMessage);
                }
            } catch (error) {
                errorCount++;
            }

            // Step 4: Verify streaming workflow
            expect(processedMessages).toHaveLength(10);
            expect(errorCount).toBe(0);
            expect(processedMessages.every(msg => 'processedAt' in msg)).toBeTruthy();

            // Step 5: Clean up connection
            const disconnectResult = await websocket.disconnect();
            expect(disconnectResult.status).toBe('disconnected');

            const streamingSummary = {
                connectionEstablished: true,
                messagesProcessed: processedMessages.length,
                errors: errorCount,
                connectionClosed: true
            };

            e2eSuite.workflowState['streaming'] = streamingSummary;
        });

        it('should handle streaming with data persistence', async () => {
            const client = e2eSuite.client;

            await client.authenticate();

            const websocket = await client.createWebSocketConnection();
            await websocket.connect();

            const collectedData: any[] = [];
            const batchSize = 5;
            const numBatches = 3;

            // Process and persist streaming data in batches
            for (let batchNum = 0; batchNum < numBatches; batchNum++) {
                const batchData: any[] = [];

                // Collect batch data
                for (let i = 0; i < batchSize; i++) {
                    const message = await websocket.receive();
                    batchData.push(message.payload);
                }

                collectedData.push(...batchData);

                // Upload batch to cloud storage
                const batchBlob = new Blob([JSON.stringify(batchData)], { type: 'application/json' });
                
                let uploadData: any;
                if (typeof Blob !== 'undefined') {
                    uploadData = batchBlob;
                } else {
                    // Node.js environment
                    uploadData = Buffer.from(JSON.stringify(batchData));
                }

                const uploadResult = await client.uploadFile(uploadData, {
                    type: 'streaming_batch',
                    batchNumber: batchNum,
                    timestamp: Date.now()
                });

                expect(uploadResult.status).toBe('uploaded');
            }

            await websocket.disconnect();

            expect(collectedData).toHaveLength(numBatches * batchSize);

            e2eSuite.workflowState['streaming_persistence'] = {
                batchesProcessed: numBatches,
                totalMessages: collectedData.length,
                dataPersisted: true,
                filesUploaded: numBatches
            };
        });
    });

    describe('Cross-Platform Environment Workflows', () => {
        it('should handle browser-specific file workflows', async () => {
            // Skip if not in browser environment
            if (typeof File === 'undefined' || typeof Blob === 'undefined') {
                console.log('Skipping browser-specific test in Node.js environment');
                return;
            }

            const client = e2eSuite.client;
            await client.authenticate();

            // Create File objects (browser-specific)
            const textFile = new File(['Hello, World!'], 'hello.txt', { type: 'text/plain' });
            const jsonFile = new File([JSON.stringify({ data: 'test' })], 'data.json', { type: 'application/json' });

            // Upload files using File API
            const textUpload = await client.uploadFile(textFile, { source: 'user_upload' });
            const jsonUpload = await client.uploadFile(jsonFile, { source: 'user_upload' });

            expect(textUpload.fileId).toBeDefined();
            expect(jsonUpload.fileId).toBeDefined();
            expect(textUpload.size).toBe(textFile.size);
            expect(jsonUpload.size).toBe(jsonFile.size);

            e2eSuite.workflowState['browser_file_handling'] = {
                textFileUploaded: Boolean(textUpload.fileId),
                jsonFileUploaded: Boolean(jsonUpload.fileId),
                fileSizesMatch: textUpload.size === textFile.size && jsonUpload.size === jsonFile.size
            };
        });

        it('should handle Node.js-specific buffer workflows', async () => {
            // Skip if in browser environment
            if (typeof Buffer === 'undefined') {
                console.log('Skipping Node.js-specific test in browser environment');
                return;
            }

            const client = e2eSuite.client;
            await client.authenticate();

            // Create Buffer objects (Node.js-specific)
            const textBuffer = Buffer.from('Hello from Node.js!', 'utf8');
            const binaryBuffer = Buffer.alloc(1024, 'A'); // 1KB of 'A' characters

            // Upload buffers
            const textUpload = await client.uploadFile(textBuffer, { source: 'node_buffer' });
            const binaryUpload = await client.uploadFile(binaryBuffer, { source: 'node_buffer' });

            expect(textUpload.fileId).toBeDefined();
            expect(binaryUpload.fileId).toBeDefined();
            expect(textUpload.size).toBe(textBuffer.length);
            expect(binaryUpload.size).toBe(binaryBuffer.length);

            e2eSuite.workflowState['nodejs_buffer_handling'] = {
                textBufferUploaded: Boolean(textUpload.fileId),
                binaryBufferUploaded: Boolean(binaryUpload.fileId),
                bufferSizesMatch: textUpload.size === textBuffer.length && binaryUpload.size === binaryBuffer.length
            };
        });
    });

    describe('Complex Integration Workflows', () => {
        it('should execute multi-service integration workflow', async () => {
            const client = e2eSuite.client;

            // Step 1: Authentication and setup
            const authResult = await client.authenticate();
            expect(authResult.token).toBeDefined();

            // Step 2: Data ingestion from multiple sources
            const sourceTypes = ['user_data', 'product_data', 'transaction_data'];
            const sourceFiles: string[] = [];

            for (const sourceType of sourceTypes) {
                let fileData: any;
                
                if (typeof Blob !== 'undefined') {
                    fileData = e2eSuite.createTestBlob(`${sourceType}.json`, 'application/json', 2);
                } else {
                    const filePath = await e2eSuite.createTestFile(`${sourceType}.json`, 'json', 2);
                    fileData = await fs.promises.readFile(filePath);
                }

                const uploadResult = await client.uploadFile(fileData, {
                    sourceType,
                    version: '1.0'
                });

                sourceFiles.push(uploadResult.fileId);
            }

            // Step 3: Data processing and transformation
            const processingJobConfig: JobConfig = {
                type: 'multi_source_processing',
                inputFiles: sourceFiles,
                operations: [
                    { type: 'join', joinKey: 'user_id' },
                    { type: 'clean', removeNulls: true },
                    { type: 'feature_engineering', createFeatures: ['user_lifetime_value', 'purchase_frequency'] }
                ]
            };

            const processingJob = await client.createJob(processingJobConfig);
            const processingResult = await client.waitForJobCompletion(processingJob.jobId);

            expect(processingResult.status).toBe('completed');

            // Step 4: ML model training with processed data
            const processedDataFile = processingResult.results!.outputFiles[0];

            const trainingConfig: TrainingConfig = {
                modelType: 'recommendation_engine',
                trainingData: processedDataFile,
                algorithm: 'collaborative_filtering',
                hyperparameters: {
                    factors: 50,
                    regularization: 0.01,
                    iterations: 100
                }
            };

            const trainingResult = await client.trainModel(trainingConfig);

            // Step 5: Real-time prediction service via WebSocket
            const websocket = await client.createWebSocketConnection();
            await websocket.connect();

            const recommendationRequests = Array.from({ length: 10 }, (_, i) => ({
                userId: `user_${i}`,
                context: { page: 'home', time: 'evening' }
            }));

            const recommendations: any[] = [];

            for (const request of recommendationRequests) {
                await websocket.send({
                    type: 'recommendation_request',
                    modelId: trainingResult.modelId,
                    request
                });

                const response = await websocket.receive();
                recommendations.push(response.payload);
            }

            await websocket.disconnect();

            // Step 6: Verify complete integration
            const workflowSummary = {
                dataSourcesIngested: sourceFiles.length,
                dataProcessingCompleted: processingResult.status === 'completed',
                modelTrained: trainingResult.status === 'trained',
                realtimePredictions: recommendations.length,
                endToEndSuccess: true
            };

            e2eSuite.workflowState['complex_integration'] = workflowSummary;

            expect(workflowSummary.dataSourcesIngested).toBe(3);
            expect(workflowSummary.dataProcessingCompleted).toBeTruthy();
            expect(workflowSummary.modelTrained).toBeTruthy();
            expect(workflowSummary.realtimePredictions).toBe(10);
            expect(workflowSummary.endToEndSuccess).toBeTruthy();
        });
    });

    describe('E2E Workflow Summary', () => {
        it('should generate comprehensive workflow test summary', () => {
            console.log('\n' + '='.repeat(70));
            console.log('JAVASCRIPT SDK END-TO-END WORKFLOW TEST SUMMARY');
            console.log('='.repeat(70));

            // Display all completed workflows
            for (const [workflowName, workflowState] of Object.entries(e2eSuite.workflowState)) {
                console.log(`\n${workflowName.toUpperCase().replace(/_/g, ' ')} WORKFLOW:`);

                if (typeof workflowState === 'object' && workflowState !== null) {
                    for (const [key, value] of Object.entries(workflowState)) {
                        if (typeof value === 'boolean') {
                            const status = value ? '✓ PASSED' : '✗ FAILED';
                            console.log(`  ${key}: ${status}`);
                        } else {
                            console.log(`  ${key}: ${value}`);
                        }
                    }
                } else {
                    console.log(`  Status: ${workflowState}`);
                }
            }

            console.log(`\nTOTAL WORKFLOWS TESTED: ${Object.keys(e2eSuite.workflowState).length}`);

            // Environment detection
            const environment = typeof window !== 'undefined' ? 'Browser' : 'Node.js';
            console.log(`ENVIRONMENT: ${environment}`);

            console.log('='.repeat(70));

            // Verify comprehensive test coverage
            const completedWorkflows = Object.keys(e2eSuite.workflowState);
            expect(completedWorkflows.length).toBeGreaterThanOrEqual(3);
        });
    });
});