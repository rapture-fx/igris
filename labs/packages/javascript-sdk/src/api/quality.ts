/**
 * Data Quality API for Schlep-engine JavaScript SDK
 * Provides comprehensive data quality assessment and monitoring capabilities
 */

import { BaseAPI } from './base';
import { APIResponse } from '../types/common';
import { DataQualityReport, ValidationRule, ValidationResult } from '../types/data';

/**
 * Quality check types
 */
export enum QualityCheckType {
  COMPLETENESS = 'completeness',
  ACCURACY = 'accuracy',
  CONSISTENCY = 'consistency',
  VALIDITY = 'validity',
  UNIQUENESS = 'uniqueness',
  TIMELINESS = 'timeliness',
  INTEGRITY = 'integrity'
}

/**
 * Quality profile configuration
 */
export interface QualityProfile {
  id?: string;
  name: string;
  description?: string;
  rules: ValidationRule[];
  thresholds?: QualityThresholds;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

/**
 * Quality thresholds
 */
export interface QualityThresholds {
  min_completeness?: number;
  min_accuracy?: number;
  min_validity?: number;
  max_duplicates?: number;
  max_null_percentage?: number;
}

/**
 * Quality assessment configuration
 */
export interface QualityAssessmentConfig {
  data_path?: string;
  data_source?: string;
  checks?: QualityCheckType[];
  rules?: ValidationRule[];
  profile_id?: string;
  sample_size?: number;
  detailed_report?: boolean;
}

/**
 * Quality monitoring configuration
 */
export interface QualityMonitoringConfig {
  data_source: string;
  profile_id: string;
  schedule: MonitoringSchedule;
  alerts?: QualityAlert[];
  retention_days?: number;
}

/**
 * Monitoring schedule
 */
export interface MonitoringSchedule {
  frequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
  time?: string;
  day_of_week?: number;
  day_of_month?: number;
  timezone?: string;
}

/**
 * Quality alert configuration
 */
export interface QualityAlert {
  metric: string;
  condition: 'below' | 'above' | 'equals';
  threshold: number;
  severity: 'low' | 'medium' | 'high';
  recipients?: string[];
  channels?: ('email' | 'slack' | 'webhook')[];
}

/**
 * Quality trend data
 */
export interface QualityTrend {
  metric: string;
  data_points: Array<{
    timestamp: string;
    value: number;
  }>;
  trend: 'improving' | 'declining' | 'stable';
  change_percentage?: number;
}

/**
 * Anomaly detection result
 */
export interface AnomalyDetectionResult {
  anomalies: DataAnomaly[];
  total_records: number;
  anomaly_rate: number;
  confidence_threshold: number;
}

/**
 * Data anomaly
 */
export interface DataAnomaly {
  record_id?: string;
  column: string;
  value: unknown;
  anomaly_type: AnomalyType;
  score: number;
  expected_range?: {
    min: unknown;
    max: unknown;
  };
  description: string;
}

/**
 * Anomaly types
 */
export enum AnomalyType {
  OUTLIER = 'outlier',
  MISSING = 'missing',
  INVALID_FORMAT = 'invalid_format',
  DUPLICATE = 'duplicate',
  INCONSISTENT = 'inconsistent',
  OUT_OF_RANGE = 'out_of_range'
}

/**
 * Data profiling result
 */
export interface DataProfilingResult {
  dataset_id: string;
  total_records: number;
  total_columns: number;
  column_profiles: ColumnProfile[];
  data_types: Record<string, number>;
  null_counts: Record<string, number>;
  profiled_at: string;
}

/**
 * Column profile
 */
export interface ColumnProfile {
  name: string;
  data_type: string;
  null_count: number;
  null_percentage: number;
  unique_count: number;
  unique_percentage: number;
  cardinality: 'low' | 'medium' | 'high';
  statistics?: ColumnStatistics;
  patterns?: string[];
  sample_values?: unknown[];
}

/**
 * Column statistics
 */
export interface ColumnStatistics {
  mean?: number;
  median?: number;
  mode?: unknown;
  std_dev?: number;
  variance?: number;
  min?: unknown;
  max?: unknown;
  percentiles?: Record<string, number>;
  skewness?: number;
  kurtosis?: number;
}

/**
 * Data Quality API client
 *
 * Provides comprehensive data quality assessment, validation, monitoring,
 * and anomaly detection capabilities.
 *
 * @example
 * ```typescript
 * // Assess data quality
 * const report = await client.quality.assessQuality({
 *   data_path: '/data/customers.csv',
 *   checks: [
 *     QualityCheckType.COMPLETENESS,
 *     QualityCheckType.VALIDITY,
 *     QualityCheckType.UNIQUENESS
 *   ],
 *   detailed_report: true
 * });
 *
 * // Create quality profile
 * const profile = await client.quality.createProfile({
 *   name: 'Customer Data Profile',
 *   rules: [
 *     {
 *       name: 'Email Format',
 *       type: ValidationType.PATTERN,
 *       column: 'email',
 *       parameters: { pattern: '^[\\w\\.-]+@[\\w\\.-]+\\.\\w+$' },
 *       severity: 'error'
 *     }
 *   ]
 * });
 * ```
 */
export class DataQualityAPI extends BaseAPI {
  protected override basePath = '/quality';

  /**
   * Assess data quality
   *
   * Performs comprehensive quality assessment on a dataset,
   * checking completeness, validity, consistency, and more.
   *
   * @param config - Assessment configuration
   * @returns Quality assessment report
   *
   * @example
   * ```typescript
   * const report = await client.quality.assessQuality({
   *   data_path: '/data/sales.csv',
   *   checks: [
   *     QualityCheckType.COMPLETENESS,
   *     QualityCheckType.ACCURACY,
   *     QualityCheckType.VALIDITY
   *   ],
   *   detailed_report: true
   * });
   *
   * console.log(`Overall score: ${report.data.overall_score}`);
   * console.log(`Valid records: ${report.data.valid_records}/${report.data.total_records}`);
   * ```
   */
  async assessQuality(
    config: QualityAssessmentConfig
  ): Promise<APIResponse<DataQualityReport>> {
    return this.post<DataQualityReport>('/assess', {
      params: config as any
    });
  }

  /**
   * Get quality report by ID
   *
   * @param reportId - Report ID
   * @returns Quality report
   */
  async getReport(reportId: string): Promise<APIResponse<DataQualityReport>> {
    return this.get<DataQualityReport>(`/reports/${reportId}`);
  }

  /**
   * List quality reports
   *
   * @param dataSource - Optional data source filter
   * @param page - Page number
   * @param pageSize - Items per page
   * @returns Paginated list of quality reports
   */
  async listReports(
    dataSource?: string,
    page: number = 1,
    pageSize: number = 20
  ): Promise<APIResponse<DataQualityReport[]>> {
    const params = this.buildQueryParams({
      data_source: dataSource,
      page,
      page_size: pageSize
    });

    return this.paginatedRequest<DataQualityReport>('/reports', params);
  }

  /**
   * Create a quality profile
   *
   * Creates a reusable quality profile with validation rules and thresholds.
   *
   * @param profile - Profile configuration
   * @returns Created profile
   *
   * @example
   * ```typescript
   * const profile = await client.quality.createProfile({
   *   name: 'Product Data Profile',
   *   description: 'Quality rules for product catalog',
   *   rules: [
   *     {
   *       name: 'Price Range',
   *       type: ValidationType.RANGE,
   *       column: 'price',
   *       parameters: { min: 0, max: 100000 },
   *       severity: 'error'
   *     },
   *     {
   *       name: 'SKU Format',
   *       type: ValidationType.PATTERN,
   *       column: 'sku',
   *       parameters: { pattern: '^[A-Z]{3}-\\d{6}$' },
   *       severity: 'error'
   *     }
   *   ],
   *   thresholds: {
   *     min_completeness: 0.95,
   *     min_validity: 0.98,
   *     max_duplicates: 0.01
   *   },
   *   is_active: true
   * });
   * ```
   */
  async createProfile(
    profile: Omit<QualityProfile, 'id' | 'created_at' | 'updated_at'>
  ): Promise<APIResponse<QualityProfile>> {
    return this.post<QualityProfile>('/profiles', {
      params: profile as any
    });
  }

  /**
   * Get quality profile by ID
   *
   * @param profileId - Profile ID
   * @returns Quality profile
   */
  async getProfile(profileId: string): Promise<APIResponse<QualityProfile>> {
    return this.get<QualityProfile>(`/profiles/${profileId}`);
  }

  /**
   * List quality profiles
   *
   * @param page - Page number
   * @param pageSize - Items per page
   * @returns Paginated list of profiles
   */
  async listProfiles(
    page: number = 1,
    pageSize: number = 20
  ): Promise<APIResponse<QualityProfile[]>> {
    return this.paginatedRequest<QualityProfile>(
      '/profiles',
      this.buildQueryParams({ page, page_size: pageSize })
    );
  }

  /**
   * Update a quality profile
   *
   * @param profileId - Profile ID
   * @param updates - Profile updates
   * @returns Updated profile
   */
  async updateProfile(
    profileId: string,
    updates: Partial<QualityProfile>
  ): Promise<APIResponse<QualityProfile>> {
    return this.patch<QualityProfile>(`/profiles/${profileId}`, {
      params: updates as any
    });
  }

  /**
   * Delete a quality profile
   *
   * @param profileId - Profile ID
   * @returns Deletion confirmation
   */
  async deleteProfile(profileId: string): Promise<APIResponse<void>> {
    return this.delete<void>(`/profiles/${profileId}`);
  }

  /**
   * Validate data against rules
   *
   * Runs validation rules against a dataset and returns detailed results.
   *
   * @param dataPath - Path to data
   * @param rules - Validation rules
   * @returns Validation results
   *
   * @example
   * ```typescript
   * const results = await client.quality.validateData(
   *   '/data/customers.csv',
   *   [
   *     {
   *       name: 'Email Required',
   *       type: ValidationType.NOT_NULL,
   *       column: 'email',
   *       parameters: {},
   *       severity: 'error'
   *     }
   *   ]
   * );
   *
   * results.data.forEach(result => {
   *   if (!result.passed) {
   *     console.log(`Rule "${result.rule_name}" failed:`);
   *     console.log(`${result.failed_records}/${result.total_records} records`);
   *   }
   * });
   * ```
   */
  async validateData(
    dataPath: string,
    rules: ValidationRule[]
  ): Promise<APIResponse<ValidationResult[]>> {
    return this.post<ValidationResult[]>('/validate', {
      params: { data_path: dataPath, rules } as any
    });
  }

  /**
   * Detect anomalies in data
   *
   * Uses statistical and machine learning methods to detect anomalies.
   *
   * @param dataPath - Path to data
   * @param columns - Optional columns to analyze
   * @param confidenceThreshold - Confidence threshold (0-1)
   * @returns Detected anomalies
   *
   * @example
   * ```typescript
   * const anomalies = await client.quality.detectAnomalies(
   *   '/data/transactions.csv',
   *   ['amount', 'quantity'],
   *   0.95
   * );
   *
   * console.log(`Found ${anomalies.data.anomalies.length} anomalies`);
   * console.log(`Anomaly rate: ${anomalies.data.anomaly_rate}%`);
   *
   * anomalies.data.anomalies.forEach(anomaly => {
   *   console.log(`${anomaly.column}: ${anomaly.value} (${anomaly.anomaly_type})`);
   * });
   * ```
   */
  async detectAnomalies(
    dataPath: string,
    columns?: string[],
    confidenceThreshold: number = 0.95
  ): Promise<APIResponse<AnomalyDetectionResult>> {
    return this.post<AnomalyDetectionResult>('/anomalies', {
      params: {
        data_path: dataPath,
        columns,
        confidence_threshold: confidenceThreshold
      } as any
    });
  }

  /**
   * Profile dataset
   *
   * Generates comprehensive statistical profile of a dataset.
   *
   * @param dataPath - Path to data
   * @param sampleSize - Optional sample size
   * @returns Data profiling result
   *
   * @example
   * ```typescript
   * const profile = await client.quality.profileData('/data/products.csv');
   *
   * console.log(`Dataset: ${profile.data.total_records} records, ${profile.data.total_columns} columns`);
   *
   * profile.data.column_profiles.forEach(col => {
   *   console.log(`${col.name} (${col.data_type}):`);
   *   console.log(`  Null: ${col.null_percentage}%`);
   *   console.log(`  Unique: ${col.unique_percentage}%`);
   * });
   * ```
   */
  async profileData(
    dataPath: string,
    sampleSize?: number
  ): Promise<APIResponse<DataProfilingResult>> {
    return this.post<DataProfilingResult>('/profile', {
      params: { data_path: dataPath, sample_size: sampleSize } as any
    });
  }

  /**
   * Setup quality monitoring
   *
   * Configures automated quality monitoring for a data source.
   *
   * @param config - Monitoring configuration
   * @returns Monitoring configuration
   *
   * @example
   * ```typescript
   * const monitor = await client.quality.setupMonitoring({
   *   data_source: 'production_db.customers',
   *   profile_id: 'prof_123',
   *   schedule: {
   *     frequency: 'daily',
   *     time: '02:00',
   *     timezone: 'America/New_York'
   *   },
   *   alerts: [
   *     {
   *       metric: 'overall_score',
   *       condition: 'below',
   *       threshold: 0.9,
   *       severity: 'high',
   *       recipients: ['team@example.com'],
   *       channels: ['email', 'slack']
   *     }
   *   ],
   *   retention_days: 90
   * });
   * ```
   */
  async setupMonitoring(
    config: QualityMonitoringConfig
  ): Promise<APIResponse<QualityMonitoringConfig & { id: string }>> {
    return this.post<QualityMonitoringConfig & { id: string }>(
      '/monitoring',
      { params: config as any }
    );
  }

  /**
   * Get monitoring configuration
   *
   * @param monitorId - Monitor ID
   * @returns Monitoring configuration
   */
  async getMonitoring(
    monitorId: string
  ): Promise<APIResponse<QualityMonitoringConfig & { id: string }>> {
    return this.get<QualityMonitoringConfig & { id: string }>(
      `/monitoring/${monitorId}`
    );
  }

  /**
   * List monitoring configurations
   *
   * @param page - Page number
   * @param pageSize - Items per page
   * @returns Paginated list of monitors
   */
  async listMonitoring(
    page: number = 1,
    pageSize: number = 20
  ): Promise<APIResponse<Array<QualityMonitoringConfig & { id: string }>>> {
    return this.paginatedRequest<QualityMonitoringConfig & { id: string }>(
      '/monitoring',
      this.buildQueryParams({ page, page_size: pageSize })
    );
  }

  /**
   * Update monitoring configuration
   *
   * @param monitorId - Monitor ID
   * @param updates - Configuration updates
   * @returns Updated configuration
   */
  async updateMonitoring(
    monitorId: string,
    updates: Partial<QualityMonitoringConfig>
  ): Promise<APIResponse<QualityMonitoringConfig & { id: string }>> {
    return this.patch<QualityMonitoringConfig & { id: string }>(
      `/monitoring/${monitorId}`,
      { params: updates as any }
    );
  }

  /**
   * Delete monitoring configuration
   *
   * @param monitorId - Monitor ID
   * @returns Deletion confirmation
   */
  async deleteMonitoring(monitorId: string): Promise<APIResponse<void>> {
    return this.delete<void>(`/monitoring/${monitorId}`);
  }

  /**
   * Get quality trends
   *
   * Retrieves historical quality metrics showing trends over time.
   *
   * @param dataSource - Data source identifier
   * @param metrics - Metrics to retrieve
   * @param startDate - Start date
   * @param endDate - End date
   * @returns Quality trends
   *
   * @example
   * ```typescript
   * const trends = await client.quality.getQualityTrends(
   *   'production_db.orders',
   *   ['overall_score', 'completeness', 'validity'],
   *   '2025-01-01',
   *   '2025-09-30'
   * );
   *
   * trends.data.forEach(trend => {
   *   console.log(`${trend.metric}: ${trend.trend}`);
   *   console.log(`Change: ${trend.change_percentage}%`);
   * });
   * ```
   */
  async getQualityTrends(
    dataSource: string,
    metrics: string[],
    startDate: string,
    endDate: string
  ): Promise<APIResponse<QualityTrend[]>> {
    return this.get<QualityTrend[]>('/trends', {
      params: {
        data_source: dataSource,
        metrics: metrics.join(','),
        start_date: startDate,
        end_date: endDate
      } as any
    });
  }

  /**
   * Compare quality between datasets
   *
   * @param dataset1 - First dataset path
   * @param dataset2 - Second dataset path
   * @returns Comparison results
   */
  async compareQuality(
    dataset1: string,
    dataset2: string
  ): Promise<APIResponse<{
    dataset1_report: DataQualityReport;
    dataset2_report: DataQualityReport;
    differences: Record<string, number>;
  }>> {
    return this.post<{
      dataset1_report: DataQualityReport;
      dataset2_report: DataQualityReport;
      differences: Record<string, number>;
    }>('/compare', {
      params: { dataset1, dataset2 } as any
    });
  }
}

export default DataQualityAPI;