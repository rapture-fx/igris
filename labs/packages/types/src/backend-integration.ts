// Backend Integration Types - Generated for Igris-engine API
// Comprehensive types for all backend endpoints
// Note: Authentication types are now in auth.ts to avoid duplication


// Data Processing Types
export interface DataSource {
  id: string
  name: string
  type: 'csv' | 'json' | 'parquet' | 'xlsx' | 'database'
  size: number
  rowCount: number
  columnCount: number
  uploadedAt: string
  status: 'pending' | 'processing' | 'completed' | 'error'
  metadata: DataSourceMetadata
  quality?: DataQualityReport
}

export interface DataSourceMetadata {
  filename: string
  encoding: string
  delimiter?: string
  headers: string[]
  sampleData: Record<string, any>[]
  schema: DataSchema
}

export interface DataSchema {
  fields: DataField[]
  primaryKey?: string
  relationships?: DataRelationship[]
}

export interface DataField {
  name: string
  type: 'string' | 'number' | 'boolean' | 'date' | 'json'
  nullable: boolean
  unique: boolean
  description?: string
  constraints?: FieldConstraints
}

export interface FieldConstraints {
  min?: number
  max?: number
  pattern?: string
  enum?: string[]
}

export interface DataRelationship {
  type: 'one-to-one' | 'one-to-many' | 'many-to-many'
  targetTable: string
  foreignKey: string
  targetKey: string
}

export interface DataQualityReport {
  id: string
  sourceId: string
  overallScore: number
  checks: DataQualityCheck[]
  issues: DataQualityIssue[]
  recommendations: string[]
  generatedAt: string
}

export interface DataQualityCheck {
  name: string
  type: 'completeness' | 'validity' | 'uniqueness' | 'consistency'
  status: 'passed' | 'failed' | 'warning'
  score: number
  details: any
}

export interface DataQualityIssue {
  type: 'missing_values' | 'invalid_format' | 'duplicates' | 'outliers'
  severity: 'low' | 'medium' | 'high' | 'critical'
  count: number
  affectedColumns: string[]
  description: string
  suggestedFix?: string
}

// Job Management Types
export interface Job {
  id: string
  type: 'data_processing' | 'ml_training' | 'data_export' | 'quality_check'
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  sourceId: string
  config: JobConfig
  progress: number
  result?: JobResult
  error?: JobError
  createdAt: string
  startedAt?: string
  completedAt?: string
  estimatedDuration?: number
}

export interface JobConfig {
  operation: string
  parameters: Record<string, any>
  options: JobOptions
}

export interface JobOptions {
  priority: 'low' | 'normal' | 'high'
  timeout: number
  retryAttempts: number
  notifyOnCompletion: boolean
}

export interface JobResult {
  outputPath?: string
  metrics: Record<string, any>
  summary: string
  artifacts: JobArtifact[]
}

export interface JobArtifact {
  name: string
  type: string
  path: string
  size: number
  description?: string
}

export interface JobError {
  code: string
  message: string
  stack?: string
  context: Record<string, any>
}

// ML and AI Types
export interface MLModel {
  id: string
  name: string
  type: 'classification' | 'regression' | 'clustering' | 'anomaly_detection'
  version: string
  status: 'training' | 'ready' | 'error' | 'deprecated'
  accuracy?: number
  metadata: MLModelMetadata
  createdAt: string
  updatedAt: string
}

export interface MLModelMetadata {
  algorithm: string
  parameters: Record<string, any>
  trainingData: string
  features: string[]
  targetColumn?: string
  performance: ModelPerformance
}

export interface ModelPerformance {
  accuracy: number
  precision: number
  recall: number
  f1Score: number
  roc: number
  confusionMatrix?: number[][]
}

export interface PredictionRequest {
  modelId: string
  data: Record<string, any>[]
  options?: PredictionOptions
}

export interface PredictionOptions {
  includeConfidence: boolean
  includeExplanation: boolean
  batchSize?: number
}

export interface PredictionResult {
  predictions: Prediction[]
  metadata: PredictionMetadata
}

export interface Prediction {
  input: Record<string, any>
  output: any
  confidence?: number
  explanation?: PredictionExplanation
}

export interface PredictionExplanation {
  featureImportance: Record<string, number>
  reasoning: string
}

export interface PredictionMetadata {
  modelVersion: string
  processingTime: number
  batchSize: number
}

// Real-time and Streaming Types
export interface StreamingStatus {
  isActive: boolean
  connectedClients: number
  messagesSent: number
  messagesReceived: number
  uptime: number
  lastActivity: string
}

export interface StreamMetrics {
  throughput: number
  latency: number
  errorRate: number
  connectionCount: number
  messageQueue: number
}

export interface WebSocketMessage {
  id: string
  type: string
  payload: any
  timestamp: string
  clientId?: string
}

// Dashboard and Monitoring Types
export interface DashboardStats {
  totalDataSources: number
  activeJobs: number
  completedJobs: number
  failedJobs: number
  totalUsers: number
  storageUsed: number
  apiCalls: number
  uptime: number
}

export interface SystemHealth {
  status: 'healthy' | 'warning' | 'error'
  version: string
  uptime: number
  database: ComponentHealth
  redis: ComponentHealth
  storage: ComponentHealth
  ml_services: ComponentHealth
  external_apis: ComponentHealth[]
}

export interface ComponentHealth {
  status: 'up' | 'down' | 'degraded'
  responseTime?: number
  error?: string
  lastChecked: string
}

export interface SystemMetrics {
  cpu: MetricValue
  memory: MetricValue
  disk: MetricValue
  network: NetworkMetrics
  database: DatabaseMetrics
}

export interface MetricValue {
  current: number
  average: number
  peak: number
  unit: string
}

export interface NetworkMetrics {
  inbound: number
  outbound: number
  errors: number
  unit: 'bytes/sec'
}

export interface DatabaseMetrics {
  connections: number
  queries: number
  slowQueries: number
  size: number
}

export interface Alert {
  id: string
  type: 'warning' | 'error' | 'info'
  title: string
  message: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  component: string
  timestamp: string
  resolved: boolean
  actions?: AlertAction[]
}

export interface AlertAction {
  label: string
  action: string
  url?: string
}

// Billing and Subscription Types
export interface SubscriptionInfo {
  id: string
  plan: SubscriptionPlan
  status: 'active' | 'cancelled' | 'past_due' | 'unpaid'
  currentPeriodStart: string
  currentPeriodEnd: string
  cancelAtPeriodEnd: boolean
  usage: UsageInfo
}

export interface SubscriptionPlan {
  id: string
  name: string
  type: 'free' | 'pro' | 'enterprise'
  price: number
  currency: string
  interval: 'month' | 'year'
  features: PlanFeature[]
}

export interface PlanFeature {
  name: string
  limit?: number
  unlimited: boolean
  description: string
}

export interface UsageInfo {
  dataProcessed: number
  apiCalls: number
  storageUsed: number
  modelInferences: number
  period: {
    start: string
    end: string
  }
}

export interface Invoice {
  id: string
  number: string
  status: 'paid' | 'pending' | 'failed'
  amount: number
  currency: string
  periodStart: string
  periodEnd: string
  paidAt?: string
  dueDate: string
  downloadUrl?: string
}

// Security and Compliance Types

export interface AuditLog {
  id: string
  userId: string
  action: string
  resource: string
  resourceId?: string
  changes?: Record<string, any>
  metadata: Record<string, any>
  timestamp: string
  ipAddress: string
  userAgent?: string
}

export interface ComplianceStatus {
  gdpr: ComplianceCheck
  ccpa: ComplianceCheck
  hipaa?: ComplianceCheck
  sox?: ComplianceCheck
  lastAssessed: string
  nextReview: string
}

export interface ComplianceCheck {
  status: 'compliant' | 'partial' | 'non_compliant'
  score: number
  requirements: ComplianceRequirement[]
  lastChecked: string
}

export interface ComplianceRequirement {
  id: string
  description: string
  status: 'met' | 'partial' | 'not_met'
  evidence?: string[]
  notes?: string
}

// Error Types
export interface APIError {
  code: string
  message: string
  details?: any
  timestamp: string
  requestId?: string
}

// WebSocket Event Types
export type WSEventType = 
  | 'job_status_update'
  | 'data_quality_alert'
  | 'system_notification'
  | 'real_time_metrics'
  | 'user_activity'
  | 'ml_prediction_ready'

export interface WSEvent<T = any> {
  type: WSEventType
  data: T
  timestamp: string
  userId?: string
}