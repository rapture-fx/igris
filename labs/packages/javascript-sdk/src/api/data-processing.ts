/**
 * Data Processing API for Igris-engine JavaScript SDK
 */

import { BaseAPI } from './base';
import {
  DataProcessingRequest,
  DataProcessingResult,
  DataQualityReport,
  TransformationRule,
  DataPipeline,
  DataFormat,
  ProcessingMode,
  DataProfile,
  ValidationResult,
  ExportConfig,
  SamplingConfig
} from '../types/data';
import { JobInfo, FileUpload, APIResponse } from '../types/common';
import { ProgressCallback } from '../types/common';

/**
 * Data Processing API client
 * Provides methods for processing, transforming, and managing data
 */
export class DataProcessingAPI extends BaseAPI {
  constructor(client: any) {
    super(client);
    this.basePath = '/data';
  }

  /**
   * Process a data file
   */
  async processFile(
    file: File | Blob,
    options: {
      dataFormat?: DataFormat;
      processingMode?: ProcessingMode;
      transformations?: TransformationRule[];
      outputFormat?: DataFormat;
      onProgress?: ProgressCallback;
      [key: string]: unknown;
    } = {}
  ): Promise<APIResponse<DataProcessingResult>> {
    // First upload the file
    const uploadResponse = await this.uploadFile(
      '/upload',
      file,
      {
        data_format: options.dataFormat,
        processing_mode: options.processingMode
      },
      options.onProgress
    );

    if (!this.isSuccess(uploadResponse)) {
      throw new Error(`File upload failed: ${this.getErrorMessage(uploadResponse)}`);
    }

    const fileUpload = uploadResponse.data as FileUpload;

    // Create processing request
    const request: DataProcessingRequest = {
      source_path: fileUpload.url,
      data_format: options.dataFormat || this.detectFormat(fileUpload.filename),
      processing_mode: options.processingMode || ProcessingMode.BATCH,
      transformations: options.transformations?.map(t => t as Record<string, unknown>) || [],
      output_format: options.outputFormat || DataFormat.JSON,
      options: this.buildQueryParams(options)
    };

    return this.post<DataProcessingResult>('/process', {
      params: request
    });
  }

  /**
   * Process data from a URL
   */
  async processUrl(
    url: string,
    dataFormat: DataFormat,
    options: {
      processingMode?: ProcessingMode;
      transformations?: TransformationRule[];
      outputFormat?: DataFormat;
      [key: string]: unknown;
    } = {}
  ): Promise<APIResponse<DataProcessingResult>> {
    this.validateRequired({ url, dataFormat }, ['url', 'dataFormat']);

    const request: DataProcessingRequest = {
      source_url: url,
      data_format: dataFormat,
      processing_mode: options.processingMode || ProcessingMode.BATCH,
      transformations: options.transformations?.map(t => t as Record<string, unknown>) || [],
      output_format: options.outputFormat || DataFormat.JSON,
      options: this.buildQueryParams(options)
    };

    return this.post<DataProcessingResult>('/process', {
      params: request
    });
  }

  /**
   * Upload a file for processing
   */
  async uploadFile(
    path: string,
    file: File | Blob,
    additionalParams?: Record<string, unknown>,
    onProgress?: ProgressCallback
  ): Promise<APIResponse<FileUpload>> {
    return super.uploadFile<FileUpload>(path, file, additionalParams, onProgress);
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<APIResponse<JobInfo>> {
    this.validateRequired({ jobId }, ['jobId']);
    return this.get<JobInfo>(`/jobs/${jobId}`);
  }

  /**
   * Wait for job completion
   */
  async waitForJob(
    jobId: string,
    pollInterval = 2000,
    maxWaitTime = 300000
  ): Promise<APIResponse<DataProcessingResult>> {
    return super.waitForJob<DataProcessingResult>(
      jobId,
      `/data/jobs/${jobId}`,
      pollInterval,
      maxWaitTime
    );
  }

  /**
   * Cancel a processing job
   */
  async cancelJob(jobId: string): Promise<APIResponse<{ message: string }>> {
    this.validateRequired({ jobId }, ['jobId']);
    return this.delete<{ message: string }>(`/jobs/${jobId}`);
  }

  /**
   * Get processing job results
   */
  async getJobResults(jobId: string): Promise<APIResponse<DataProcessingResult>> {
    this.validateRequired({ jobId }, ['jobId']);
    return this.get<DataProcessingResult>(`/jobs/${jobId}/results`);
  }

  /**
   * Download processed data
   */
  getDownloadUrl(jobId: string, format?: DataFormat): string {
    this.validateRequired({ jobId }, ['jobId']);
    
    const params: Record<string, string> = {};
    if (format) {
      params.format = format;
    }

    return this.buildDownloadUrl(`/jobs/${jobId}/download`, params);
  }

  /**
   * Profile data to understand its structure and quality
   */
  async profileData(
    file: File | Blob,
    options: {
      sampleSize?: number;
      onProgress?: ProgressCallback;
    } = {}
  ): Promise<APIResponse<DataProfile[]>> {
    const formData = new FormData();
    formData.append('file', file);
    
    if (options.sampleSize) {
      formData.append('sample_size', options.sampleSize.toString());
    }

    return this.post<DataProfile[]>('/profile', {
      params: formData
    });
  }

  /**
   * Generate data quality report
   */
  async getDataQuality(
    source: string | File,
    options: {
      validationRules?: Array<Record<string, unknown>>;
      onProgress?: ProgressCallback;
    } = {}
  ): Promise<APIResponse<DataQualityReport>> {
    let params: Record<string, unknown>;

    if (typeof source === 'string') {
      // URL source
      params = {
        source_url: source,
        validation_rules: options.validationRules
      };
    } else {
      // File source - upload first
      const uploadResponse = await this.uploadFile('/upload', source, {}, options.onProgress);
      if (!this.isSuccess(uploadResponse)) {
        throw new Error(`File upload failed: ${this.getErrorMessage(uploadResponse)}`);
      }

      params = {
        source_path: uploadResponse.data.url,
        validation_rules: options.validationRules
      };
    }

    return this.post<DataQualityReport>('/quality', { params });
  }

  /**
   * Create data processing pipeline
   */
  async createPipeline(pipeline: DataPipeline): Promise<APIResponse<DataPipeline & { id: string }>> {
    this.validateRequired(pipeline, ['name', 'transformations']);
    return this.post<DataPipeline & { id: string }>('/pipelines', {
      params: pipeline
    });
  }

  /**
   * Get data processing pipeline
   */
  async getPipeline(pipelineId: string): Promise<APIResponse<DataPipeline & { id: string }>> {
    this.validateRequired({ pipelineId }, ['pipelineId']);
    return this.get<DataPipeline & { id: string }>(`/pipelines/${pipelineId}`);
  }

  /**
   * Update data processing pipeline
   */
  async updatePipeline(
    pipelineId: string, 
    updates: Partial<DataPipeline>
  ): Promise<APIResponse<DataPipeline & { id: string }>> {
    this.validateRequired({ pipelineId }, ['pipelineId']);
    return this.patch<DataPipeline & { id: string }>(`/pipelines/${pipelineId}`, {
      params: updates
    });
  }

  /**
   * Delete data processing pipeline
   */
  async deletePipeline(pipelineId: string): Promise<APIResponse<{ message: string }>> {
    this.validateRequired({ pipelineId }, ['pipelineId']);
    return this.delete<{ message: string }>(`/pipelines/${pipelineId}`);
  }

  /**
   * List data processing pipelines
   */
  async listPipelines(params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    isActive?: boolean;
  }): Promise<APIResponse<DataPipeline[]>> {
    return this.paginatedRequest<DataPipeline>('/pipelines', params);
  }

  /**
   * Run data processing pipeline
   */
  async runPipeline(
    pipelineId: string,
    inputSource: string | File,
    options: {
      onProgress?: ProgressCallback;
    } = {}
  ): Promise<APIResponse<DataProcessingResult>> {
    this.validateRequired({ pipelineId }, ['pipelineId']);

    let params: Record<string, unknown>;

    if (typeof inputSource === 'string') {
      params = { source_url: inputSource };
    } else {
      // Upload file first
      const uploadResponse = await this.uploadFile('/upload', inputSource, {}, options.onProgress);
      if (!this.isSuccess(uploadResponse)) {
        throw new Error(`File upload failed: ${this.getErrorMessage(uploadResponse)}`);
      }
      params = { source_path: uploadResponse.data.url };
    }

    return this.post<DataProcessingResult>(`/pipelines/${pipelineId}/run`, { params });
  }

  /**
   * Validate data against schema or rules
   */
  async validateData(
    source: string | File,
    validationRules: Array<Record<string, unknown>>,
    options: {
      onProgress?: ProgressCallback;
    } = {}
  ): Promise<APIResponse<ValidationResult[]>> {
    let params: Record<string, unknown>;

    if (typeof source === 'string') {
      params = {
        source_url: source,
        validation_rules: validationRules
      };
    } else {
      const uploadResponse = await this.uploadFile('/upload', source, {}, options.onProgress);
      if (!this.isSuccess(uploadResponse)) {
        throw new Error(`File upload failed: ${this.getErrorMessage(uploadResponse)}`);
      }

      params = {
        source_path: uploadResponse.data.url,
        validation_rules: validationRules
      };
    }

    return this.post<ValidationResult[]>('/validate', { params });
  }

  /**
   * Sample data from source
   */
  async sampleData(
    source: string | File,
    config: SamplingConfig,
    options: {
      onProgress?: ProgressCallback;
    } = {}
  ): Promise<APIResponse<{ sample_data: unknown[]; metadata: Record<string, unknown> }>> {
    let params: Record<string, unknown>;

    if (typeof source === 'string') {
      params = {
        source_url: source,
        sampling_config: config
      };
    } else {
      const uploadResponse = await this.uploadFile('/upload', source, {}, options.onProgress);
      if (!this.isSuccess(uploadResponse)) {
        throw new Error(`File upload failed: ${this.getErrorMessage(uploadResponse)}`);
      }

      params = {
        source_path: uploadResponse.data.url,
        sampling_config: config
      };
    }

    return this.post<{ sample_data: unknown[]; metadata: Record<string, unknown> }>('/sample', { params });
  }

  /**
   * Export processed data
   */
  async exportData(
    jobId: string,
    exportConfig: ExportConfig
  ): Promise<APIResponse<{ export_id: string; download_url?: string }>> {
    this.validateRequired({ jobId }, ['jobId']);

    return this.post<{ export_id: string; download_url?: string }>(`/jobs/${jobId}/export`, {
      params: exportConfig
    });
  }

  /**
   * Get export status
   */
  async getExportStatus(exportId: string): Promise<APIResponse<{
    export_id: string;
    status: string;
    progress_percentage: number;
    download_url?: string;
    error_message?: string;
  }>> {
    this.validateRequired({ exportId }, ['exportId']);
    return this.get(`/exports/${exportId}`);
  }

  /**
   * List processing jobs
   */
  async listJobs(params?: {
    page?: number;
    pageSize?: number;
    status?: string;
    jobType?: string;
  }): Promise<APIResponse<JobInfo[]>> {
    return this.paginatedRequest<JobInfo>('/jobs', params);
  }

  /**
   * Get processing statistics
   */
  async getProcessingStats(params?: {
    period?: 'day' | 'week' | 'month';
    startDate?: string;
    endDate?: string;
  }): Promise<APIResponse<{
    total_jobs: number;
    successful_jobs: number;
    failed_jobs: number;
    total_records_processed: number;
    average_processing_time: number;
    data_formats_breakdown: Record<string, number>;
  }>> {
    return this.get('/stats', { params });
  }

  /**
   * Detect data format from filename
   */
  private detectFormat(filename: string): DataFormat {
    const extension = filename.toLowerCase().split('.').pop();
    
    const formatMap: Record<string, DataFormat> = {
      'csv': DataFormat.CSV,
      'json': DataFormat.JSON,
      'xlsx': DataFormat.XLSX,
      'xls': DataFormat.XLSX,
      'parquet': DataFormat.PARQUET,
      'avro': DataFormat.AVRO,
      'orc': DataFormat.ORC
    };

    return formatMap[extension || ''] || DataFormat.CSV;
  }
}

export default DataProcessingAPI;