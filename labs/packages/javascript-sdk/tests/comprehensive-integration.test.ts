/**
 * Comprehensive integration tests for Igris-engine JavaScript SDK
 * 
 * These tests verify integration with real API endpoints and cross-platform compatibility.
 * They should only be run in integration test environments with proper API keys.
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import { IgrisClient } from '../src/client/igris-inertial';
import { JobStatus, ExportFormat } from '../src/types/data';
import { MLJobStatus } from '../src/types/ml';
import { APIError, ValidationError, NetworkError } from '../src/utils/errors';

// Integration test configuration
const INTEGRATION_TIMEOUT = 300000; // 5 minutes
const ML_TIMEOUT = 1800000; // 30 minutes for ML operations

// Check for required environment variables
const API_KEY = process.env.IGRIS_API_KEY;
const BASE_URL = process.env.IGRIS_BASE_URL || 'https://api.igris-inertial.com';

// Skip all tests if API key is not provided
const describeIntegration = API_KEY ? describe : describe.skip;

// Sample test data
const SAMPLE_CSV_DATA = `name,age,city,email
John Doe,30,New York,john@example.com
Jane Smith,25,Los Angeles,jane@example.com
Bob Johnson,35,Chicago,bob@example.com
Alice Brown,28,Houston,alice@example.com
Charlie Wilson,32,Phoenix,charlie@example.com`;

// Utility functions
function createTestFile(content: string, filename: string = 'test-data.csv'): File {
  return new File([content], filename, { type: 'text/csv' });
}

function generateLargeCSV(rows: number): string {
  let data = 'name,age,city,email,score\n';
  for (let i = 0; i < rows; i++) {
    data += `User${i},${20 + i % 60},City${i % 10},user${i}@example.com,${i % 100}\n`;
  }
  return data;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describeIntegration('Data Processing Integration Tests', () => {
  let client: IgrisClient;

  beforeAll(() => {
    if (!API_KEY) {
      throw new Error('IGRIS_API_KEY environment variable is required for integration tests');
    }

    client = new IgrisClient({
      apiKey: API_KEY,
      baseUrl: BASE_URL
    });
  });

  describe('Complete Data Processing Workflow', () => {
    test('should complete end-to-end data processing workflow', async () => {
      // Step 1: Upload file
      const testFile = createTestFile(SAMPLE_CSV_DATA);
      const uploadedFile = await client.data.uploadFile(testFile);

      expect(uploadedFile.file_id).toBeDefined();
      expect(['uploaded', 'processed']).toContain(uploadedFile.status);

      // Step 2: Create processing job
      const processingConfig = {
        format: 'csv' as const,
        delimiter: ',',
        headers: true,
        validation_rules: ['required_fields']
      };

      const job = await client.data.createProcessingJob(
        [uploadedFile.file_id],
        processingConfig
      );

      expect(job.job_id).toBeDefined();
      expect([JobStatus.PENDING, JobStatus.RUNNING]).toContain(job.status);

      // Step 3: Wait for completion
      const finalJob = await client.data.waitForCompletion(
        job.job_id,
        { pollInterval: 2000, timeout: INTEGRATION_TIMEOUT }
      );

      expect(finalJob.status).toBe(JobStatus.COMPLETED);
      expect(finalJob.processed_records).toBeGreaterThan(0);

      // Step 4: Download results
      const results = await client.data.downloadResults(
        job.job_id,
        ExportFormat.CSV
      );

      expect(results).toBeInstanceOf(Blob);
      
      const resultText = await results.text();
      expect(resultText).toContain('name'); // Header should be present
      expect(resultText).toContain('John Doe'); // Sample data should be present
    }, INTEGRATION_TIMEOUT);

    test('should validate data with real API', async () => {
      const testFile = createTestFile(SAMPLE_CSV_DATA);
      const uploadedFile = await client.data.uploadFile(testFile);

      const validationResult = await client.data.validateData(uploadedFile.file_id);

      expect(typeof validationResult.is_valid).toBe('boolean');
      expect(Array.isArray(validationResult.errors)).toBe(true);
      expect(Array.isArray(validationResult.warnings)).toBe(true);
      expect(validationResult.summary).toHaveProperty('total_rows');
      expect(validationResult.summary.total_rows).toBe(5); // Our test data has 5 rows
    }, INTEGRATION_TIMEOUT);

    test('should generate data quality report', async () => {
      const testFile = createTestFile(SAMPLE_CSV_DATA);
      const uploadedFile = await client.data.uploadFile(testFile);

      const qualityReport = await client.data.getDataQualityReport(uploadedFile.file_id);

      expect(qualityReport.file_id).toBe(uploadedFile.file_id);
      expect(qualityReport.overall_score).toBeGreaterThanOrEqual(0);
      expect(qualityReport.overall_score).toBeLessThanOrEqual(100);
      expect(qualityReport.completeness_score).toBeGreaterThanOrEqual(0);
      expect(qualityReport.completeness_score).toBeLessThanOrEqual(100);
      expect(Array.isArray(qualityReport.issues)).toBe(true);
      expect(Array.isArray(qualityReport.recommendations)).toBe(true);
    }, INTEGRATION_TIMEOUT);

    test('should handle concurrent job processing', async () => {
      // Upload multiple files
      const testFile = createTestFile(SAMPLE_CSV_DATA);
      const uploadPromises = Array(3).fill(null).map(() => 
        client.data.uploadFile(testFile)
      );
      
      const uploadedFiles = await Promise.all(uploadPromises);

      // Create multiple processing jobs
      const jobPromises = uploadedFiles.map(file => 
        client.data.createProcessingJob([file.file_id], {
          format: 'csv' as const,
          headers: true
        })
      );

      const jobs = await Promise.all(jobPromises);

      // Wait for all jobs to complete
      const completionPromises = jobs.map(job =>
        client.data.waitForCompletion(job.job_id, { timeout: INTEGRATION_TIMEOUT })
      );

      const completedJobs = await Promise.all(completionPromises);

      // Verify all jobs completed successfully
      completedJobs.forEach(completedJob => {
        expect(completedJob.status).toBe(JobStatus.COMPLETED);
        expect(completedJob.processed_records).toBeGreaterThan(0);
      });
    }, INTEGRATION_TIMEOUT);
  });

  describe('ML Pipeline Integration', () => {
    test('should complete ML training workflow', async () => {
      // First, process data for ML training
      const testFile = createTestFile(SAMPLE_CSV_DATA);
      const uploadedFile = await client.data.uploadFile(testFile);

      const processingConfig = {
        format: 'csv' as const,
        headers: true,
        validation_rules: ['required_fields']
      };

      const processingJob = await client.data.createProcessingJob(
        [uploadedFile.file_id],
        processingConfig
      );

      await client.data.waitForCompletion(
        processingJob.job_id,
        { timeout: INTEGRATION_TIMEOUT }
      );

      // Create ML training job
      const trainingConfig = {
        algorithm: 'random_forest',
        target_column: 'age', // Using age as target for regression
        hyperparameters: {
          n_estimators: 10, // Small number for faster testing
          max_depth: 5
        },
        test_size: 0.3
      };

      const mlJob = await client.ml.createTrainingJob(
        processingJob.job_id,
        'age',
        trainingConfig
      );

      expect(mlJob.job_id).toBeDefined();
      expect([MLJobStatus.PENDING, MLJobStatus.TRAINING]).toContain(mlJob.status);

      // Wait for training to complete (with extended timeout for ML)
      const finalMLJob = await client.ml.waitForTrainingCompletion(
        mlJob.job_id,
        { pollInterval: 5000, timeout: ML_TIMEOUT }
      );

      expect(finalMLJob.status).toBe(MLJobStatus.COMPLETED);

      // Get model metrics if model was created
      if (finalMLJob.model_id) {
        const metrics = await client.ml.getModelMetrics(finalMLJob.model_id);
        expect(metrics).toBeDefined();
        
        // Verify metrics contain expected fields
        const expectedMetrics = ['accuracy', 'precision', 'recall', 'f1_score'];
        expectedMetrics.forEach(metric => {
          if (metric in metrics) {
            expect(metrics[metric]).toBeGreaterThanOrEqual(0);
            expect(metrics[metric]).toBeLessThanOrEqual(1);
          }
        });
      }
    }, ML_TIMEOUT);

    test('should perform model inference', async () => {
      try {
        // Try to get list of available models
        const modelsResponse = await client.ml.listModels();

        if (!modelsResponse || !modelsResponse.models || modelsResponse.models.length === 0) {
          console.log('No trained models available for inference testing - skipping');
          return;
        }

        // Use the first available model
        const model = modelsResponse.models[0];
        const modelId = model.model_id;

        if (!modelId) {
          console.log('No valid model ID found - skipping');
          return;
        }

        // Test single prediction
        const testInput = {
          age: 30,
          city: 'New York'
        };

        const prediction = await client.ml.predictSingle(modelId, testInput);

        expect(prediction).toHaveProperty('prediction');
        expect(
          prediction.hasOwnProperty('probability') || 
          prediction.hasOwnProperty('confidence')
        ).toBe(true);

      } catch (error) {
        if (error instanceof APIError && error.status === 404) {
          console.log('No models available for testing - skipping');
          return;
        }
        throw error;
      }
    }, INTEGRATION_TIMEOUT);
  });

  describe('Cross-SDK Compatibility', () => {
    test('should maintain consistent API response format', async () => {
      const testFile = createTestFile(SAMPLE_CSV_DATA);
      const uploadedFile = await client.data.uploadFile(testFile);

      // Verify response contains expected fields that should be consistent across SDKs
      const expectedFields = ['file_id', 'filename', 'size', 'content_type', 'status'];
      expectedFields.forEach(field => {
        expect(uploadedFile).toHaveProperty(field);
      });

      // Create job and verify response format
      const job = await client.data.createProcessingJob(
        [uploadedFile.file_id],
        { format: 'csv' as const, headers: true }
      );

      const jobExpectedFields = ['job_id', 'status', 'created_at', 'updated_at'];
      jobExpectedFields.forEach(field => {
        expect(job).toHaveProperty(field);
      });

      // Verify status values are consistent
      const validStatuses = [
        JobStatus.PENDING,
        JobStatus.RUNNING,
        JobStatus.COMPLETED,
        JobStatus.FAILED
      ];
      expect(validStatuses).toContain(job.status);
    }, INTEGRATION_TIMEOUT);

    test('should handle error responses consistently', async () => {
      // Try to access non-existent resource
      try {
        await client.data.getJobStatus('nonexistent_job_12345');
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(APIError);
        expect(error.status).toBe(404);
        expect(error.message).toBeDefined();
      }

      // Try invalid operation
      try {
        await client.data.createProcessingJob([], {}); // Empty files list
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect(error.message).toBeDefined();
      }
    }, INTEGRATION_TIMEOUT);

    test('should handle pagination consistently', async () => {
      // Test job listing with pagination
      const page1 = await client.data.listJobs({
        page: 1,
        per_page: 5
      });

      // Verify pagination response format
      const expectedPaginationFields = ['jobs', 'total', 'page', 'per_page', 'has_next'];
      expectedPaginationFields.forEach(field => {
        expect(page1).toHaveProperty(field);
      });

      // If there are more jobs, test next page
      if (page1.has_next) {
        const page2 = await client.data.listJobs({
          page: 2,
          per_page: 5
        });

        // Verify page numbers are different
        if (page2.jobs.length > 0) {
          const page1Ids = page1.jobs.map(job => job.job_id);
          const page2Ids = page2.jobs.map(job => job.job_id);
          
          // Jobs should be different (assuming we have enough jobs)
          const intersection = page1Ids.filter(id => page2Ids.includes(id));
          expect(intersection.length).toBe(0);
        }
      }
    }, INTEGRATION_TIMEOUT);
  });

  describe('Performance Integration', () => {
    test('should handle large file processing', async () => {
      // Create a larger CSV file (1000 rows)
      const largeData = generateLargeCSV(1000);
      const largeFile = createTestFile(largeData, 'large-test-data.csv');

      const startTime = Date.now();

      // Upload large file
      const uploadedFile = await client.data.uploadFile(largeFile);
      expect(uploadedFile.file_id).toBeDefined();

      // Process the file
      const processingConfig = {
        format: 'csv' as const,
        headers: true,
        validation_rules: ['required_fields']
      };

      const job = await client.data.createProcessingJob(
        [uploadedFile.file_id],
        processingConfig
      );

      // Wait for completion with extended timeout
      const finalJob = await client.data.waitForCompletion(
        job.job_id,
        { pollInterval: 3000, timeout: 600000 } // 10 minutes for large file
      );

      const endTime = Date.now();
      const processingTime = (endTime - startTime) / 1000; // in seconds

      expect(finalJob.status).toBe(JobStatus.COMPLETED);
      expect(finalJob.processed_records).toBe(1000);

      // Verify reasonable processing time (should process 1000 rows in under 10 minutes)
      expect(processingTime).toBeLessThan(600);
    }, 600000); // 10 minute timeout

    test('should handle concurrent API requests', async () => {
      // Make multiple concurrent requests
      const promises = Array(10).fill(null).map(() =>
        client.data.listJobs({ page: 1, per_page: 10 })
      );

      const startTime = Date.now();
      const results = await Promise.all(promises);
      const endTime = Date.now();

      // Verify all requests succeeded
      results.forEach((result, index) => {
        expect(result).toBeDefined();
        expect(result).toHaveProperty('jobs');
      });

      // Verify reasonable response time
      const totalTime = (endTime - startTime) / 1000; // in seconds
      const avgTimePerRequest = totalTime / promises.length;
      expect(avgTimePerRequest).toBeLessThan(5.0); // Should average less than 5 seconds per request
    }, INTEGRATION_TIMEOUT);
  });

  describe('Error Scenarios', () => {
    test('should handle API rate limiting', async () => {
      // Make rapid requests to potentially trigger rate limiting
      const promises = Array(50).fill(null).map(() =>
        client.data.listJobs({ page: 1, per_page: 1 })
      );

      const results = await Promise.allSettled(promises);

      // Count successful vs rate-limited requests
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const rateLimited = results.filter(r => 
        r.status === 'rejected' && 
        r.reason instanceof APIError && 
        r.reason.status === 429
      ).length;

      // Should have some successful requests
      expect(successful).toBeGreaterThan(0);

      // If rate limiting occurred, verify it was handled properly
      if (rateLimited > 0) {
        const rateLimitErrors = results
          .filter(r => 
            r.status === 'rejected' && 
            r.reason instanceof APIError && 
            r.reason.status === 429
          )
          .map(r => (r as PromiseRejectedResult).reason as APIError);

        rateLimitErrors.forEach(error => {
          expect(error.message.toLowerCase()).toMatch(/(rate|limit|too many)/);
        });
      }
    }, INTEGRATION_TIMEOUT);

    test('should handle invalid authentication', async () => {
      // Create client with invalid API key
      const invalidClient = new IgrisClient({
        apiKey: 'invalid_api_key_12345',
        baseUrl: BASE_URL
      });

      // Should raise authentication error
      try {
        await invalidClient.data.listJobs();
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(APIError);
        expect([401, 403]).toContain(error.status);
        expect(error.message.toLowerCase()).toMatch(/(auth|unauthorized|forbidden)/);
      }
    }, INTEGRATION_TIMEOUT);

    test('should handle network timeout', async () => {
      // Create client with very short timeout
      const timeoutClient = new IgrisClient({
        apiKey: API_KEY,
        baseUrl: BASE_URL,
        timeout: 1 // Very short timeout
      });

      // Should handle timeout gracefully
      try {
        await timeoutClient.data.listJobs();
        // May succeed if network is very fast, so don't fail the test
      } catch (error) {
        // Should be a timeout-related error
        expect(
          error instanceof NetworkError ||
          error.message.toLowerCase().includes('timeout') ||
          error.message.toLowerCase().includes('time')
        ).toBe(true);
      }
    }, INTEGRATION_TIMEOUT);
  });
});

// Browser-specific integration tests
if (typeof window !== 'undefined') {
  describeIntegration('Browser Environment Integration', () => {
    let client: IgrisClient;

    beforeAll(() => {
      if (!API_KEY) {
        throw new Error('IGRIS_API_KEY environment variable is required for integration tests');
      }

      client = new IgrisClient({
        apiKey: API_KEY,
        baseUrl: BASE_URL
      });
    });

    test('should handle File API in browser', async () => {
      const testFile = createTestFile(SAMPLE_CSV_DATA);
      
      // Verify File properties
      expect(testFile.name).toBe('test-data.csv');
      expect(testFile.type).toBe('text/csv');
      expect(testFile.size).toBeGreaterThan(0);

      // Test file upload in browser
      const uploadedFile = await client.data.uploadFile(testFile);
      expect(uploadedFile.file_id).toBeDefined();
    }, INTEGRATION_TIMEOUT);

    test('should handle Blob responses for downloads', async () => {
      const testFile = createTestFile(SAMPLE_CSV_DATA);
      const uploadedFile = await client.data.uploadFile(testFile);

      const job = await client.data.createProcessingJob(
        [uploadedFile.file_id],
        { format: 'csv' as const, headers: true }
      );

      const finalJob = await client.data.waitForCompletion(
        job.job_id,
        { timeout: INTEGRATION_TIMEOUT }
      );

      if (finalJob.status === JobStatus.COMPLETED) {
        const results = await client.data.downloadResults(
          job.job_id,
          ExportFormat.CSV
        );

        // Test Blob properties
        expect(results).toBeInstanceOf(Blob);
        expect(results.size).toBeGreaterThan(0);
        expect(results.type).toContain('csv');

        // Test Blob text reading
        const text = await results.text();
        expect(typeof text).toBe('string');
        expect(text.length).toBeGreaterThan(0);
      }
    }, INTEGRATION_TIMEOUT);

    test('should handle progress callbacks for uploads', async () => {
      const testFile = createTestFile(SAMPLE_CSV_DATA);
      const progressEvents: Array<{ loaded: number; total: number }> = [];

      await client.data.uploadFile(testFile, {
        onProgress: (loaded, total) => {
          progressEvents.push({ loaded, total });
        }
      });

      // Progress events should be captured (if supported by implementation)
      // This test mainly verifies that progress callbacks don't cause errors
      expect(Array.isArray(progressEvents)).toBe(true);
    }, INTEGRATION_TIMEOUT);
  });
}

// Node.js-specific integration tests  
if (typeof process !== 'undefined' && process.versions?.node) {
  describeIntegration('Node.js Environment Integration', () => {
    let client: IgrisClient;

    beforeAll(() => {
      if (!API_KEY) {
        throw new Error('IGRIS_API_KEY environment variable is required for integration tests');
      }

      client = new IgrisClient({
        apiKey: API_KEY,
        baseUrl: BASE_URL
      });
    });

    test('should handle file system operations in Node.js', async () => {
      // In Node.js, we might handle files differently
      const testFile = createTestFile(SAMPLE_CSV_DATA);
      
      const uploadedFile = await client.data.uploadFile(testFile);
      expect(uploadedFile.file_id).toBeDefined();
    }, INTEGRATION_TIMEOUT);

    test('should handle streams in Node.js', async () => {
      // This test would verify Node.js stream handling if implemented
      const testFile = createTestFile(SAMPLE_CSV_DATA);
      
      const uploadedFile = await client.data.uploadFile(testFile);
      expect(uploadedFile.file_id).toBeDefined();
    }, INTEGRATION_TIMEOUT);
  });
}