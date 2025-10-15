/**
 * Data processing types for Schlep-engine JavaScript SDK
 */

import { JobStatus } from './common';

/**
 * Supported data formats
 */
export enum DataFormat {
  CSV = 'csv',
  JSON = 'json',
  XLSX = 'xlsx',
  PARQUET = 'parquet',
  AVRO = 'avro',
  ORC = 'orc'
}

/**
 * Data processing modes
 */
export enum ProcessingMode {
  BATCH = 'batch',
  STREAMING = 'streaming',
  REAL_TIME = 'real_time'
}

/**
 * Data quality levels
 */
export enum QualityLevel {
  EXCELLENT = 'excellent', // 90-100%
  GOOD = 'good',           // 75-89%
  FAIR = 'fair',           // 60-74%
  POOR = 'poor'            // Below 60%
}

/**
 * Request for data processing operation
 */
export interface DataProcessingRequest {
  source_path?: string;
  source_url?: string;
  data_format?: DataFormat;
  processing_mode?: ProcessingMode;
  transformations?: Array<Record<string, unknown>>;
  output_format?: DataFormat;
  options?: Record<string, unknown>;
}

/**
 * Result of data processing operation
 */
export interface DataProcessingResult {
  job_id: string;
  status: JobStatus;
  input_records: number;
  output_records: number;
  processing_time_seconds: number;
  output_path?: string;
  output_url?: string;
  metadata?: Record<string, unknown>;
  error_message?: string;
  created_at?: string;
  completed_at?: string;
  success_rate: number;
  records_per_second: number;
}

/**
 * Individual data quality metric
 */
export interface DataQualityMetric {
  name: string;
  score: number;
  description: string;
  details?: Record<string, unknown>;
  quality_level: QualityLevel;
}

/**
 * Comprehensive data quality assessment report
 */
export interface DataQualityReport {
  overall_score: number;
  overall_quality_level: QualityLevel;
  total_records: number;
  valid_records: number;
  invalid_records: number;
  validity_rate: number;
  metrics: DataQualityMetric[];
  column_profiles: Record<string, Record<string, unknown>>;
  issues: Array<Record<string, unknown>>;
  recommendations: string[];
  generated_at?: string;
}

/**
 * Data transformation rule
 */
export interface TransformationRule {
  name: string;
  type: string; // e.g., "filter", "map", "aggregate", "join"
  parameters?: Record<string, unknown>;
  condition?: string;
  description?: string;
}

/**
 * Data processing pipeline configuration
 */
export interface DataPipeline {
  name: string;
  description?: string;
  source_config?: Record<string, unknown>;
  transformations: TransformationRule[];
  destination_config?: Record<string, unknown>;
  schedule?: string; // Cron expression
  is_active: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Data source connection configuration
 */
export interface DataSourceConfig {
  type: DataSourceType;
  name: string;
  connection_params: Record<string, unknown>;
  credentials?: Record<string, unknown>;
  test_query?: string;
  is_active: boolean;
}

/**
 * Supported data source types
 */
export enum DataSourceType {
  DATABASE = 'database',
  FILE = 'file',
  API = 'api',
  CLOUD_STORAGE = 'cloud_storage',
  STREAMING = 'streaming',
  WEBHOOK = 'webhook'
}

/**
 * Database connection types
 */
export enum DatabaseType {
  POSTGRESQL = 'postgresql',
  MYSQL = 'mysql',
  SQLITE = 'sqlite',
  MONGODB = 'mongodb',
  REDIS = 'redis',
  ELASTICSEARCH = 'elasticsearch'
}

/**
 * Cloud storage types
 */
export enum CloudStorageType {
  AWS_S3 = 'aws_s3',
  GOOGLE_CLOUD = 'google_cloud',
  AZURE_BLOB = 'azure_blob',
  DROPBOX = 'dropbox',
  ONEDRIVE = 'onedrive'
}

/**
 * Data profiling result
 */
export interface DataProfile {
  column_name: string;
  data_type: string;
  null_count: number;
  unique_count: number;
  mean?: number;
  median?: number;
  std_dev?: number;
  min_value?: unknown;
  max_value?: unknown;
  most_common?: Array<{ value: unknown; count: number }>;
  patterns?: string[];
  quality_score: number;
}

/**
 * Column statistics
 */
export interface ColumnStatistics {
  name: string;
  type: string;
  count: number;
  null_count: number;
  unique_count: number;
  mean?: number;
  std?: number;
  min?: unknown;
  max?: unknown;
  percentiles?: Record<string, number>;
  histogram?: Array<{ bin: string; count: number }>;
}

/**
 * Data sampling configuration
 */
export interface SamplingConfig {
  method: 'random' | 'systematic' | 'stratified';
  size?: number;
  percentage?: number;
  seed?: number;
  stratify_by?: string;
}

/**
 * Data validation rule
 */
export interface ValidationRule {
  name: string;
  type: ValidationType;
  column?: string;
  parameters: Record<string, unknown>;
  severity: 'error' | 'warning' | 'info';
  description?: string;
}

/**
 * Validation types
 */
export enum ValidationType {
  NOT_NULL = 'not_null',
  UNIQUE = 'unique',
  RANGE = 'range',
  PATTERN = 'pattern',
  ENUM = 'enum',
  CUSTOM = 'custom'
}

/**
 * Validation result
 */
export interface ValidationResult {
  rule_name: string;
  passed: boolean;
  failed_records: number;
  total_records: number;
  error_rate: number;
  details: Array<{
    record_id?: string;
    column?: string;
    value?: unknown;
    error: string;
  }>;
}

/**
 * Data anonymization configuration
 */
export interface AnonymizationConfig {
  method: AnonymizationMethod;
  columns: string[];
  parameters?: Record<string, unknown>;
  preserve_format?: boolean;
}

/**
 * Anonymization methods
 */
export enum AnonymizationMethod {
  MASK = 'mask',
  HASH = 'hash',
  ENCRYPT = 'encrypt',
  RANDOM = 'random',
  GENERALIZE = 'generalize',
  SUPPRESS = 'suppress'
}

/**
 * Data export configuration
 */
export interface ExportConfig {
  [key: string]: any;
  format: DataFormat;
  destination: ExportDestination;
  compression?: CompressionType;
  partitioning?: PartitionConfig;
  encryption?: EncryptionConfig;
  metadata?: Record<string, unknown>;
}

/**
 * Export destinations
 */
export enum ExportDestination {
  LOCAL = 'local',
  CLOUD_STORAGE = 'cloud_storage',
  DATABASE = 'database',
  API = 'api',
  EMAIL = 'email'
}

/**
 * Compression types
 */
export enum CompressionType {
  GZIP = 'gzip',
  BZIP2 = 'bzip2',
  LZMA = 'lzma',
  SNAPPY = 'snappy',
  LZO = 'lzo'
}

/**
 * Partition configuration
 */
export interface PartitionConfig {
  column: string;
  strategy: 'date' | 'hash' | 'range';
  size?: number;
}

/**
 * Encryption configuration
 */
export interface EncryptionConfig {
  algorithm: 'AES256' | 'RSA' | 'ChaCha20';
  key_source: 'generated' | 'provided' | 'kms';
  key?: string;
}

/**
 * Real-time streaming configuration
 */
export interface StreamingConfig {
  source_type: 'kafka' | 'kinesis' | 'pubsub' | 'eventbridge';
  connection_params: Record<string, unknown>;
  batch_size?: number;
  flush_interval?: number;
  error_handling?: 'skip' | 'retry' | 'dlq';
}

/**
 * Batch processing configuration
 */
export interface BatchConfig {
  chunk_size: number;
  parallel_workers?: number;
  memory_limit?: number;
  timeout?: number;
  retry_policy?: RetryPolicy;
}

/**
 * Retry policy configuration
 */
export interface RetryPolicy {
  max_attempts: number;
  initial_delay: number;
  max_delay: number;
  backoff_factor: number;
  retry_conditions?: string[];
}

export default {};