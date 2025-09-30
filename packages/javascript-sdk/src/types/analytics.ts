/**
 * Analytics types for Schlep-engine JavaScript SDK
 */

/**
 * Aggregation types for analytics queries
 */
export enum AggregationType {
  COUNT = 'count',
  SUM = 'sum',
  AVG = 'avg',
  MIN = 'min',
  MAX = 'max',
  MEDIAN = 'median',
  PERCENTILE = 'percentile',
  STDDEV = 'stddev',
  VARIANCE = 'variance',
  DISTINCT_COUNT = 'distinct_count'
}

/**
 * Time granularity for time-series analytics
 */
export enum TimeGranularity {
  SECOND = 'second',
  MINUTE = 'minute',
  HOUR = 'hour',
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  QUARTER = 'quarter',
  YEAR = 'year'
}

/**
 * Filter operator types
 */
export enum FilterOperator {
  EQUALS = 'eq',
  NOT_EQUALS = 'ne',
  GREATER_THAN = 'gt',
  GREATER_THAN_OR_EQUAL = 'gte',
  LESS_THAN = 'lt',
  LESS_THAN_OR_EQUAL = 'lte',
  IN = 'in',
  NOT_IN = 'not_in',
  CONTAINS = 'contains',
  STARTS_WITH = 'starts_with',
  ENDS_WITH = 'ends_with',
  IS_NULL = 'is_null',
  IS_NOT_NULL = 'is_not_null',
  BETWEEN = 'between'
}

/**
 * Analytics query filter
 */
export interface AnalyticsFilter {
  field: string;
  operator: FilterOperator;
  value?: unknown;
  values?: unknown[];
}

/**
 * Analytics dimension for grouping
 */
export interface AnalyticsDimension {
  field: string;
  alias?: string;
  time_granularity?: TimeGranularity;
}

/**
 * Analytics metric definition
 */
export interface AnalyticsMetric {
  field: string;
  aggregation: AggregationType;
  alias?: string;
  distinct?: boolean;
  percentile?: number; // For percentile aggregation
}

/**
 * Sort order for results
 */
export interface SortOrder {
  field: string;
  direction: 'asc' | 'desc';
}

/**
 * Date range for analytics queries
 */
export interface DateRange {
  start_date: string; // ISO 8601 format
  end_date: string;   // ISO 8601 format
  timezone?: string;
}

/**
 * Analytics query configuration
 */
export interface AnalyticsQuery {
  dataset: string;
  metrics: AnalyticsMetric[];
  dimensions?: AnalyticsDimension[];
  filters?: AnalyticsFilter[];
  date_range?: DateRange;
  sort?: SortOrder[];
  limit?: number;
  offset?: number;
  having?: AnalyticsFilter[]; // Post-aggregation filters
  time_series?: boolean;
  compare_to_previous?: boolean;
  cache?: boolean;
}

/**
 * Analytics query result row
 */
export interface AnalyticsResultRow {
  dimensions: Record<string, unknown>;
  metrics: Record<string, number>;
  timestamp?: string;
}

/**
 * Analytics query result
 */
export interface AnalyticsResult {
  query_id: string;
  dataset: string;
  rows: AnalyticsResultRow[];
  total_rows: number;
  execution_time_ms: number;
  cached?: boolean;
  metadata?: Record<string, unknown>;
  summary?: Record<string, number>;
  comparison?: AnalyticsComparison;
}

/**
 * Comparison data for period-over-period analysis
 */
export interface AnalyticsComparison {
  previous_period: {
    start_date: string;
    end_date: string;
    rows: AnalyticsResultRow[];
  };
  change_metrics: Record<string, {
    absolute_change: number;
    percentage_change: number;
    trend: 'up' | 'down' | 'stable';
  }>;
}

/**
 * Dataset information
 */
export interface Dataset {
  id: string;
  name: string;
  description?: string;
  schema: DatasetSchema;
  row_count?: number;
  size_bytes?: number;
  last_updated?: string;
  created_at?: string;
  tags?: string[];
  is_active: boolean;
}

/**
 * Dataset schema definition
 */
export interface DatasetSchema {
  fields: DatasetField[];
  primary_key?: string;
  indexes?: string[];
  partitioning?: PartitionInfo;
}

/**
 * Dataset field definition
 */
export interface DatasetField {
  name: string;
  type: FieldType;
  description?: string;
  nullable?: boolean;
  unique?: boolean;
  indexed?: boolean;
  default_value?: unknown;
  validation?: FieldValidation;
}

/**
 * Field data types
 */
export enum FieldType {
  STRING = 'string',
  INTEGER = 'integer',
  FLOAT = 'float',
  BOOLEAN = 'boolean',
  DATE = 'date',
  DATETIME = 'datetime',
  TIMESTAMP = 'timestamp',
  JSON = 'json',
  ARRAY = 'array',
  OBJECT = 'object'
}

/**
 * Field validation rules
 */
export interface FieldValidation {
  min?: number;
  max?: number;
  pattern?: string;
  enum?: unknown[];
  format?: string;
}

/**
 * Partition information
 */
export interface PartitionInfo {
  field: string;
  strategy: 'date' | 'hash' | 'range';
  partitions: number;
}

/**
 * Dashboard configuration
 */
export interface Dashboard {
  id: string;
  name: string;
  description?: string;
  widgets: DashboardWidget[];
  layout?: DashboardLayout;
  filters?: AnalyticsFilter[];
  refresh_interval?: number;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  is_public?: boolean;
  tags?: string[];
}

/**
 * Dashboard widget configuration
 */
export interface DashboardWidget {
  id: string;
  type: WidgetType;
  title: string;
  query: AnalyticsQuery;
  visualization: VisualizationConfig;
  position: WidgetPosition;
  size: WidgetSize;
  refresh_interval?: number;
}

/**
 * Widget types
 */
export enum WidgetType {
  LINE_CHART = 'line_chart',
  BAR_CHART = 'bar_chart',
  PIE_CHART = 'pie_chart',
  TABLE = 'table',
  METRIC = 'metric',
  GAUGE = 'gauge',
  HEATMAP = 'heatmap',
  SCATTER_PLOT = 'scatter_plot',
  AREA_CHART = 'area_chart',
  FUNNEL = 'funnel'
}

/**
 * Visualization configuration
 */
export interface VisualizationConfig {
  chart_type: WidgetType;
  colors?: string[];
  labels?: boolean;
  legend?: boolean;
  x_axis?: AxisConfig;
  y_axis?: AxisConfig;
  tooltips?: boolean;
  animations?: boolean;
  stacked?: boolean;
  custom_options?: Record<string, unknown>;
}

/**
 * Chart axis configuration
 */
export interface AxisConfig {
  label?: string;
  scale?: 'linear' | 'logarithmic' | 'time';
  min?: number;
  max?: number;
  format?: string;
}

/**
 * Widget position in dashboard
 */
export interface WidgetPosition {
  x: number;
  y: number;
}

/**
 * Widget size
 */
export interface WidgetSize {
  width: number;
  height: number;
}

/**
 * Dashboard layout configuration
 */
export interface DashboardLayout {
  columns: number;
  rows: number;
  spacing: number;
  responsive?: boolean;
}

/**
 * Report configuration
 */
export interface Report {
  id: string;
  name: string;
  description?: string;
  queries: AnalyticsQuery[];
  schedule?: ReportSchedule;
  recipients?: string[];
  format: ReportFormat;
  template?: string;
  created_at?: string;
  last_generated?: string;
  is_active: boolean;
}

/**
 * Report schedule configuration
 */
export interface ReportSchedule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  day_of_week?: number; // 0-6 for weekly
  day_of_month?: number; // 1-31 for monthly
  time: string; // HH:mm format
  timezone?: string;
}

/**
 * Report output formats
 */
export enum ReportFormat {
  PDF = 'pdf',
  EXCEL = 'excel',
  CSV = 'csv',
  HTML = 'html',
  JSON = 'json'
}

/**
 * Insight detection configuration
 */
export interface InsightConfig {
  dataset: string;
  metrics: string[];
  dimensions?: string[];
  date_range?: DateRange;
  sensitivity?: 'low' | 'medium' | 'high';
  types?: InsightType[];
}

/**
 * Types of insights to detect
 */
export enum InsightType {
  ANOMALY = 'anomaly',
  TREND = 'trend',
  CORRELATION = 'correlation',
  SEASONALITY = 'seasonality',
  SPIKE = 'spike',
  DROP = 'drop',
  PATTERN = 'pattern'
}

/**
 * Detected insight
 */
export interface Insight {
  id: string;
  type: InsightType;
  dataset: string;
  metric: string;
  dimension?: string;
  timestamp?: string;
  confidence: number;
  description: string;
  value: number;
  expected_value?: number;
  deviation?: number;
  severity: 'low' | 'medium' | 'high';
  metadata?: Record<string, unknown>;
}

/**
 * Funnel analysis configuration
 */
export interface FunnelConfig {
  dataset: string;
  steps: FunnelStep[];
  date_range?: DateRange;
  filters?: AnalyticsFilter[];
  conversion_window?: number; // in seconds
}

/**
 * Funnel step definition
 */
export interface FunnelStep {
  name: string;
  event: string;
  filters?: AnalyticsFilter[];
}

/**
 * Funnel analysis result
 */
export interface FunnelResult {
  steps: FunnelStepResult[];
  total_entries: number;
  overall_conversion_rate: number;
  average_time_to_convert?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Funnel step result
 */
export interface FunnelStepResult {
  name: string;
  count: number;
  conversion_rate: number;
  drop_off_rate: number;
  time_to_convert_avg?: number;
}

/**
 * Cohort analysis configuration
 */
export interface CohortConfig {
  dataset: string;
  cohort_dimension: string;
  metric: AnalyticsMetric;
  date_range?: DateRange;
  cohort_size?: TimeGranularity;
}

/**
 * Cohort analysis result
 */
export interface CohortResult {
  cohorts: CohortData[];
  overall_average: number;
  metadata?: Record<string, unknown>;
}

/**
 * Individual cohort data
 */
export interface CohortData {
  cohort: string;
  size: number;
  values: number[];
  retention_rates?: number[];
}

export default {};