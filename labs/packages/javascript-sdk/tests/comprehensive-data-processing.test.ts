/**
 * Comprehensive data processing tests for Igris-engine JavaScript SDK
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { IgrisClient } from '../src/client/igris-inertial';
import { DataProcessingAPI } from '../src/api/data-processing';
import { APIError, ValidationError, TimeoutError } from '../src/utils/errors';
import { 
  ProcessingJob, 
  DataSource, 
  ProcessingConfig, 
  DataFormat,
  ValidationResult,
  QualityMetrics 
} from '../src/types/data';
import { mockResponse, mockApiError, createMockFile } from './setup';

// Mock fetch globally
global.fetch = jest.fn();

describe('DataProcessingAPI', () => {
  let client: IgrisClient;
  let dataAPI: DataProcessingAPI;

  beforeEach(() => {
    client = new IgrisClient({
      apiKey: 'test-api-key',
      baseUrl: 'https://api.test.com'
    });
    dataAPI = client.data;
    jest.clearAllMocks();
  });

  const mockProcessingJob: ProcessingJob = {
    job_id: 'job-123',
    status: 'running',
    progress: { current: 50, total: 100 },
    created_at: '2024-01-01T12:00:00Z',
    estimated_completion: '2024-01-01T12:30:00Z',
    config: {
      output_format: DataFormat.JSON,
      batch_size: 1000,
      parallel_processing: true,
      quality_checks: true
    }
  };

  describe('file processing', () => {
    test('should process file successfully', async () => {
      const file = createMockFile('test.csv', 'id,name,value\n1,Alice,100\n2,Bob,200');

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse(mockProcessingJob))
      });

      const result = await dataAPI.processFile(file, {
        outputFormat: DataFormat.JSON,
        batchSize: 1000
      });

      expect(result.job_id).toBe('job-123');
      expect(result.status).toBe('running');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/data/process'),
        expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData)
        })
      );
    });

    test('should handle file processing with progress callback', async () => {
      const file = createMockFile('test.csv', 'id,name,value\n1,Alice,100');
      const progressUpdates: number[] = [];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse(mockProcessingJob))
      });

      const result = await dataAPI.processFile(file, {
        outputFormat: DataFormat.JSON,
        onProgress: (progress) => {
          progressUpdates.push(progress);
        }
      });

      expect(result.job_id).toBe('job-123');
      // Progress callback should be registered for later use
      expect(dataAPI.hasProgressCallback(result.job_id)).toBe(true);
    });

    test('should handle invalid file format', async () => {
      const invalidFile = createMockFile('test.exe', 'binary content', 'application/octet-stream');

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: jest.fn().mockResolvedValueOnce(mockApiError('Unsupported file format', 400))
      });

      await expect(dataAPI.processFile(invalidFile, {
        outputFormat: DataFormat.JSON
      })).rejects.toThrow(APIError);
    });

    test('should handle large file upload with chunking', async () => {
      const largeContent = 'a'.repeat(100 * 1024 * 1024 + 1); // > 100MB
      const largeFile = createMockFile('large.csv', largeContent);

      // Mock chunked upload response
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockResponse({ upload_id: 'upload-123' }))
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockResponse(mockProcessingJob))
        });

      const result = await dataAPI.processFile(largeFile, {
        outputFormat: DataFormat.JSON
      });

      expect(result.job_id).toBe('job-123');
      expect(global.fetch).toHaveBeenCalledTimes(2); // Upload + process
    });

    test('should validate file before processing', async () => {
      const file = createMockFile('test.csv', 'id,name\n1,Alice\n2,Bob');

      const validationResult: ValidationResult = {
        is_valid: true,
        errors: [],
        warnings: ['Column "age" is missing'],
        suggestions: ['Consider adding age column for better analysis']
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse({
          validation: validationResult,
          source: {
            source_id: 'source-123',
            name: 'test.csv',
            format: DataFormat.CSV,
            size_bytes: file.size,
            row_count: 2,
            column_count: 2
          }
        }))
      });

      const result = await dataAPI.validateFile(file);

      expect(result.validation.is_valid).toBe(true);
      expect(result.validation.warnings).toHaveLength(1);
      expect(result.source.name).toBe('test.csv');
    });
  });

  describe('job management', () => {
    test('should get job status', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse(mockProcessingJob))
      });

      const result = await dataAPI.getJobStatus('job-123');

      expect(result.job_id).toBe('job-123');
      expect(result.status).toBe('running');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.test.com/api/v1/data/jobs/job-123',
        expect.any(Object)
      );
    });

    test('should handle job not found', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: jest.fn().mockResolvedValueOnce(mockApiError('Job not found', 404))
      });

      await expect(dataAPI.getJobStatus('nonexistent-job')).rejects.toThrow(APIError);
    });

    test('should wait for job completion', async () => {
      const jobStates = [
        { ...mockProcessingJob, progress: { current: 25, total: 100 } },
        { ...mockProcessingJob, progress: { current: 75, total: 100 } },
        { 
          ...mockProcessingJob, 
          status: 'completed' as const,
          progress: { current: 100, total: 100 },
          result: {
            output_url: 'https://storage.com/result.json',
            quality_metrics: {
              completeness: 0.95,
              accuracy: 0.98,
              consistency: 0.92
            } as QualityMetrics
          }
        }
      ];

      let callCount = 0;
      (global.fetch as jest.Mock).mockImplementation(() => {
        const response = jobStates[Math.min(callCount, jobStates.length - 1)];
        callCount++;
        return Promise.resolve({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockResponse(response))
        });
      });

      const result = await dataAPI.waitForCompletion('job-123', {
        timeout: 10000,
        pollInterval: 100
      });

      expect(result.status).toBe('completed');
      expect(result.result).toBeDefined();
      expect(callCount).toBeGreaterThanOrEqual(3);
    });

    test('should timeout waiting for completion', async () => {
      const runningJob = { ...mockProcessingJob, status: 'running' as const };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse(runningJob))
      });

      await expect(dataAPI.waitForCompletion('job-123', {
        timeout: 200,
        pollInterval: 50
      })).rejects.toThrow(TimeoutError);
    });

    test('should cancel job', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse({ message: 'Job cancelled' }))
      });

      const result = await dataAPI.cancelJob('job-123');

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.test.com/api/v1/data/jobs/job-123/cancel',
        expect.objectContaining({ method: 'POST' })
      );
    });

    test('should list jobs with pagination', async () => {
      const jobsResponse = {
        jobs: [mockProcessingJob],
        pagination: {
          page: 1,
          per_page: 10,
          total: 1,
          pages: 1
        }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse(jobsResponse))
      });

      const result = await dataAPI.listJobs({
        page: 1,
        perPage: 10,
        status: 'running'
      });

      expect(result.jobs).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('page=1&per_page=10&status=running'),
        expect.any(Object)
      );
    });
  });

  describe('batch processing', () => {
    test('should process multiple files in batch', async () => {
      const files = [
        createMockFile('file1.csv', 'id,name\n1,Alice'),
        createMockFile('file2.csv', 'id,name\n2,Bob'),
        createMockFile('file3.csv', 'id,name\n3,Charlie')
      ];

      const batchJob: ProcessingJob = {
        ...mockProcessingJob,
        job_id: 'batch-job-123',
        progress: { current: 0, total: 3 }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse(batchJob))
      });

      const result = await dataAPI.batchProcessFiles(files, {
        outputFormat: DataFormat.JSON,
        batchSize: 1000
      });

      expect(result.job_id).toBe('batch-job-123');
      expect(result.progress.total).toBe(3);
    });

    test('should handle partial batch failures', async () => {
      const files = [
        createMockFile('valid.csv', 'id,name\n1,Alice'),
        createMockFile('invalid.txt', 'not a csv file')
      ];

      const partialSuccessResponse = {
        successful_files: ['valid.csv'],
        failed_files: [{ file: 'invalid.txt', error: 'Unsupported format' }],
        batch_job_id: 'batch-job-456'
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse(partialSuccessResponse))
      });

      const result = await dataAPI.batchProcessFiles(files, {
        outputFormat: DataFormat.JSON
      });

      expect(result.successful_files).toHaveLength(1);
      expect(result.failed_files).toHaveLength(1);
    });
  });

  describe('data transformation', () => {
    test('should apply data transformations', async () => {
      const transformationConfig = {
        transformations: [
          { type: 'normalize', column: 'age' },
          { type: 'encode', column: 'category', method: 'one_hot' }
        ]
      };

      const transformedJob: ProcessingJob = {
        ...mockProcessingJob,
        job_id: 'transform-job-123'
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse(transformedJob))
      });

      const result = await dataAPI.applyTransformations('source-123', transformationConfig);

      expect(result.job_id).toBe('transform-job-123');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/data/transform'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            source_id: 'source-123',
            ...transformationConfig
          })
        })
      );
    });

    test('should get available transformation templates', async () => {
      const templates = [
        {
          id: 'clean-data',
          name: 'Data Cleaning',
          description: 'Basic data cleaning pipeline',
          transformations: [
            { type: 'remove_nulls' },
            { type: 'deduplicate' }
          ]
        }
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse({ templates }))
      });

      const result = await dataAPI.getTransformationTemplates();

      expect(result.templates).toHaveLength(1);
      expect(result.templates[0].name).toBe('Data Cleaning');
    });
  });

  describe('data quality analysis', () => {
    test('should analyze data quality', async () => {
      const qualityReport = {
        overall_score: 0.85,
        metrics: {
          completeness: 0.95,
          accuracy: 0.80,
          consistency: 0.90,
          validity: 0.75
        },
        issues: [
          { column: 'age', issue: 'missing_values', count: 15 },
          { column: 'email', issue: 'invalid_format', count: 3 }
        ],
        recommendations: [
          'Fill missing age values using median',
          'Validate and correct email formats'
        ]
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse(qualityReport))
      });

      const result = await dataAPI.analyzeDataQuality('source-123', {
        includeRecommendations: true,
        detailedAnalysis: true
      });

      expect(result.overall_score).toBe(0.85);
      expect(result.issues).toHaveLength(2);
      expect(result.recommendations).toHaveLength(2);
    });

    test('should generate data profiling report', async () => {
      const profilingReport = {
        row_count: 10000,
        column_count: 15,
        columns: [
          {
            name: 'age',
            type: 'numeric',
            stats: {
              min: 18,
              max: 65,
              mean: 35.5,
              median: 34,
              std_dev: 12.3,
              null_count: 25
            }
          },
          {
            name: 'category',
            type: 'categorical',
            stats: {
              unique_count: 5,
              most_frequent: 'A',
              frequency_distribution: { A: 4000, B: 3000, C: 2000, D: 800, E: 200 }
            }
          }
        ]
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse(profilingReport))
      });

      const result = await dataAPI.generateDataProfile('source-123');

      expect(result.row_count).toBe(10000);
      expect(result.columns).toHaveLength(2);
      expect(result.columns[0].stats.mean).toBe(35.5);
    });
  });

  describe('real-time processing', () => {
    test('should start real-time processing stream', async () => {
      const streamConfig = {
        input_source: 'kafka://topic',
        output_destination: 's3://bucket/stream-output',
        processing_rules: [
          { type: 'filter', condition: 'age > 18' },
          { type: 'transform', field: 'name', operation: 'uppercase' }
        ]
      };

      const streamJob = {
        stream_id: 'stream-123',
        status: 'running',
        processed_records: 1500,
        error_count: 2,
        throughput: 150.5 // records per second
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse(streamJob))
      });

      const result = await dataAPI.startRealTimeProcessing(streamConfig);

      expect(result.stream_id).toBe('stream-123');
      expect(result.status).toBe('running');
      expect(result.throughput).toBe(150.5);
    });

    test('should monitor real-time stream', async () => {
      const streamMetrics = {
        stream_id: 'stream-123',
        uptime_seconds: 3600,
        records_processed: 50000,
        records_per_second: 13.9,
        error_rate: 0.001,
        memory_usage_mb: 256,
        cpu_usage_percent: 45.2
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse(streamMetrics))
      });

      const result = await dataAPI.getStreamMetrics('stream-123');

      expect(result.records_processed).toBe(50000);
      expect(result.error_rate).toBe(0.001);
      expect(result.cpu_usage_percent).toBe(45.2);
    });
  });

  describe('error handling', () => {
    test('should handle network errors with retry', async () => {
      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockResponse(mockProcessingJob))
        });

      const result = await dataAPI.getJobStatus('job-123');

      expect(result.job_id).toBe('job-123');
      expect(global.fetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    test('should handle rate limiting', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Map([['Retry-After', '5']]),
        json: jest.fn().mockResolvedValueOnce(mockApiError('Rate limit exceeded', 429))
      });

      const file = createMockFile('test.csv', 'id,name\n1,Alice');

      await expect(dataAPI.processFile(file, {
        outputFormat: DataFormat.JSON
      })).rejects.toThrow('Rate limit exceeded');
    });

    test('should validate processing configuration', async () => {
      const file = createMockFile('test.csv', 'id,name\n1,Alice');

      const invalidConfig = {
        outputFormat: 'invalid-format' as DataFormat,
        batchSize: -1 // Invalid
      };

      await expect(dataAPI.processFile(file, invalidConfig)).rejects.toThrow(ValidationError);
    });

    test('should handle malformed API responses', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          success: true,
          // Missing 'data' field
        })
      });

      await expect(dataAPI.getJobStatus('job-123')).rejects.toThrow();
    });
  });

  describe('performance optimization', () => {
    test('should handle concurrent requests efficiently', async () => {
      const jobIds = Array.from({ length: 10 }, (_, i) => `job-${i}`);
      
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse(mockProcessingJob))
      });

      const startTime = Date.now();
      
      const promises = jobIds.map(id => dataAPI.getJobStatus(id));
      const results = await Promise.all(promises);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(results).toHaveLength(10);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    test('should implement request deduplication', async () => {
      const jobId = 'job-123';
      
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse(mockProcessingJob))
      });

      // Make multiple identical requests simultaneously
      const promises = Array(5).fill(null).map(() => dataAPI.getJobStatus(jobId));
      await Promise.all(promises);

      // Should only make one actual HTTP request due to deduplication
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    test('should implement response caching', async () => {
      const jobId = 'completed-job';
      const completedJob = { ...mockProcessingJob, status: 'completed' as const };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse(completedJob))
      });

      // First request
      await dataAPI.getJobStatus(jobId);
      
      // Second request (should use cache for completed jobs)
      await dataAPI.getJobStatus(jobId);

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });
});

describe('Data Processing Integration', () => {
  let client: IgrisClient;

  beforeEach(() => {
    client = new IgrisClient({
      apiKey: 'test-api-key',
      baseUrl: 'https://api.test.com'
    });
    jest.clearAllMocks();
  });

  test('should handle complete processing workflow', async () => {
    const file = createMockFile('workflow.csv', 'id,name,age\n1,Alice,25\n2,Bob,30');

    // Mock the complete workflow
    (global.fetch as jest.Mock)
      // File upload
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse({ 
          job_id: 'process-job-123',
          status: 'running'
        }))
      })
      // Status check 1 (running)
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse({
          job_id: 'process-job-123',
          status: 'running',
          progress: { current: 50, total: 100 }
        }))
      })
      // Status check 2 (completed)
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse({
          job_id: 'process-job-123',
          status: 'completed',
          progress: { current: 100, total: 100 },
          result: {
            output_url: 'https://storage.com/result.json',
            quality_metrics: {
              completeness: 0.95,
              accuracy: 0.98,
              consistency: 0.92
            }
          }
        }))
      })
      // Download result
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce([
          { id: 1, name: 'Alice', age: 25 },
          { id: 2, name: 'Bob', age: 30 }
        ])
      });

    // Process file
    const job = await client.data.processFile(file, {
      outputFormat: DataFormat.JSON,
      qualityChecks: true
    });

    // Wait for completion
    const completedJob = await client.data.waitForCompletion(job.job_id, {
      timeout: 5000,
      pollInterval: 100
    });

    // Download result
    const result = await client.data.downloadResult(completedJob.job_id);

    expect(completedJob.status).toBe('completed');
    expect(completedJob.result?.quality_metrics.completeness).toBe(0.95);
    expect(result).toHaveLength(2);
  });
});