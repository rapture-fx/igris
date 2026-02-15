/**
 * Machine Learning types for Igris-engine JavaScript SDK
 */

/**
 * Machine learning task types
 */
export enum MLTaskType {
  CLASSIFICATION = 'classification',
  REGRESSION = 'regression',
  CLUSTERING = 'clustering',
  ANOMALY_DETECTION = 'anomaly_detection',
  TIME_SERIES_FORECASTING = 'time_series_forecasting',
  RECOMMENDATION = 'recommendation',
  NATURAL_LANGUAGE_PROCESSING = 'nlp',
  COMPUTER_VISION = 'computer_vision'
}

/**
 * Supported model types
 */
export enum ModelType {
  LINEAR_REGRESSION = 'linear_regression',
  LOGISTIC_REGRESSION = 'logistic_regression',
  RANDOM_FOREST = 'random_forest',
  GRADIENT_BOOSTING = 'gradient_boosting',
  SVM = 'svm',
  NEURAL_NETWORK = 'neural_network',
  DEEP_LEARNING = 'deep_learning',
  ENSEMBLE = 'ensemble'
}

/**
 * Training job status
 */
export enum TrainingStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

/**
 * Machine learning pipeline configuration
 */
export interface MLPipelineConfig {
  name: string;
  task_type: MLTaskType;
  model_type: ModelType;
  target_column: string;
  feature_columns?: string[];
  training_data_path?: string;
  validation_split?: number;
  test_split?: number;
  hyperparameters?: Record<string, unknown>;
  preprocessing_steps?: Array<Record<string, unknown>>;
  evaluation_metrics?: string[];
  cross_validation_folds?: number;
  auto_feature_selection?: boolean;
  auto_hyperparameter_tuning?: boolean;
  early_stopping?: boolean;
  description?: string;
  tags?: string[];
}

/**
 * Model evaluation metrics
 */
export interface ModelMetrics {
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1_score?: number;
  auc_roc?: number;
  mse?: number;
  rmse?: number;
  mae?: number;
  r2_score?: number;
  confusion_matrix?: number[][];
  classification_report?: Record<string, unknown>;
  feature_importance?: Record<string, number>;
  custom_metrics?: Record<string, number>;
}

/**
 * Machine learning training job
 */
export interface TrainingJob {
  job_id: string;
  pipeline_id: string;
  status: TrainingStatus;
  progress_percentage: number;
  current_epoch?: number;
  total_epochs?: number;
  training_loss?: number;
  validation_loss?: number;
  best_score?: number;
  training_time_seconds: number;
  estimated_time_remaining?: number;
  model_path?: string;
  metrics?: ModelMetrics;
  logs: string[];
  error_message?: string;
  created_at?: string;
  started_at?: string;
  completed_at?: string;
}

/**
 * Result of ML pipeline execution
 */
export interface MLPipelineResult {
  pipeline_id: string;
  job_id: string;
  status: TrainingStatus;
  model_id?: string;
  model_path?: string;
  metrics?: ModelMetrics;
  predictions?: unknown[];
  feature_importance?: Record<string, number>;
  hyperparameters_used?: Record<string, unknown>;
  training_summary?: Record<string, unknown>;
  artifacts?: Record<string, string>; // artifact_name -> path
}

/**
 * Request for model prediction
 */
export interface PredictionRequest {
  model_id: string;
  input_data: Record<string, unknown> | Array<Record<string, unknown>>;
  return_probabilities?: boolean;
  explain_predictions?: boolean;
}

/**
 * Result of model prediction
 */
export interface PredictionResult {
  predictions: unknown[];
  probabilities?: number[][];
  explanations?: Array<Record<string, unknown>>;
  model_version?: string;
  prediction_time_ms: number;
}

/**
 * Information about a trained model
 */
export interface ModelInfo {
  model_id: string;
  name: string;
  model_type: ModelType;
  task_type: MLTaskType;
  version: string;
  status: string;
  accuracy?: number;
  training_date?: string;
  last_used?: string;
  size_bytes?: number;
  feature_columns: string[];
  target_column?: string;
  metrics?: ModelMetrics;
  tags: string[];
  description?: string;
}

/**
 * Hyperparameter tuning configuration
 */
export interface HyperparameterConfig {
  method: 'grid_search' | 'random_search' | 'bayesian' | 'genetic';
  parameters: Record<string, ParameterRange>;
  max_trials?: number;
  timeout_minutes?: number;
  early_stopping?: boolean;
  scoring_metric: string;
}

/**
 * Parameter range for hyperparameter tuning
 */
export interface ParameterRange {
  type: 'int' | 'float' | 'categorical' | 'boolean';
  min?: number;
  max?: number;
  values?: unknown[];
  distribution?: 'uniform' | 'log_uniform' | 'normal' | 'log_normal';
}

/**
 * Feature engineering configuration
 */
export interface FeatureEngineering {
  auto_feature_selection: boolean;
  feature_selection_method?: 'correlation' | 'mutual_info' | 'chi2' | 'rfe';
  max_features?: number;
  scaling_method?: 'standard' | 'minmax' | 'robust' | 'quantile';
  encoding_method?: 'onehot' | 'label' | 'target' | 'binary';
  handle_missing?: 'drop' | 'mean' | 'median' | 'mode' | 'constant';
  polynomial_features?: boolean;
  interaction_features?: boolean;
  custom_transformations?: Array<Record<string, unknown>>;
}

/**
 * Cross-validation configuration
 */
export interface CrossValidationConfig {
  method: 'kfold' | 'stratified_kfold' | 'time_series' | 'group_kfold';
  folds: number;
  shuffle?: boolean;
  random_state?: number;
  group_column?: string;
}

/**
 * Model deployment configuration
 */
export interface DeploymentConfig {
  deployment_name: string;
  model_id: string;
  environment: 'staging' | 'production';
  instance_type?: string;
  min_instances?: number;
  max_instances?: number;
  auto_scaling?: boolean;
  monitoring_enabled?: boolean;
  logging_level?: 'debug' | 'info' | 'warning' | 'error';
}

/**
 * Batch prediction job
 */
export interface BatchPredictionJob {
  job_id: string;
  model_id: string;
  input_path: string;
  output_path: string;
  status: TrainingStatus;
  progress_percentage: number;
  total_records?: number;
  processed_records?: number;
  error_records?: number;
  created_at?: string;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
}

/**
 * Model monitoring metrics
 */
export interface ModelMonitoring {
  model_id: string;
  deployment_id: string;
  data_drift_score?: number;
  prediction_drift_score?: number;
  performance_metrics?: ModelMetrics;
  prediction_latency_p95?: number;
  prediction_throughput?: number;
  error_rate?: number;
  last_updated?: string;
  alerts?: ModelAlert[];
}

/**
 * Model alert configuration
 */
export interface ModelAlert {
  alert_id: string;
  type: 'data_drift' | 'performance_degradation' | 'latency' | 'error_rate';
  threshold: number;
  current_value: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  created_at: string;
  resolved_at?: string;
}

/**
 * A/B testing configuration for models
 */
export interface ABTestConfig {
  test_name: string;
  control_model_id: string;
  treatment_model_id: string;
  traffic_split: number; // 0-100, percentage to treatment
  success_metric: string;
  minimum_sample_size: number;
  max_duration_days: number;
  significance_level?: number;
}

/**
 * Model explainability request
 */
export interface ExplainabilityRequest {
  model_id: string;
  input_data: Record<string, unknown>;
  method: 'shap' | 'lime' | 'permutation' | 'integrated_gradients';
  top_k_features?: number;
}

/**
 * Model explainability result
 */
export interface ExplainabilityResult {
  feature_importances: Record<string, number>;
  explanation_method: string;
  prediction_value: unknown;
  baseline_value?: unknown;
  confidence_score?: number;
  visual_explanation?: string; // Base64 encoded image or URL
}

/**
 * AutoML configuration
 */
export interface AutoMLConfig {
  task_type: MLTaskType;
  target_column: string;
  training_data_path: string;
  time_budget_minutes?: number;
  quality_vs_speed?: 'speed' | 'balanced' | 'quality';
  interpretability?: 'low' | 'medium' | 'high';
  include_algorithms?: ModelType[];
  exclude_algorithms?: ModelType[];
  custom_scoring?: string;
  ensemble?: boolean;
}

/**
 * Model registry entry
 */
export interface ModelRegistryEntry {
  model_id: string;
  name: string;
  version: string;
  stage: 'development' | 'staging' | 'production' | 'archived';
  description?: string;
  tags: Record<string, string>;
  metrics: ModelMetrics;
  artifacts: Record<string, string>;
  created_by: string;
  created_at: string;
  updated_at: string;
  lineage?: ModelLineage;
}

/**
 * Model lineage tracking
 */
export interface ModelLineage {
  parent_models?: string[];
  training_data_sources: string[];
  feature_engineering_pipeline?: string;
  hyperparameter_tuning_job?: string;
  evaluation_datasets: string[];
  deployment_history: Array<{
    environment: string;
    deployed_at: string;
    deployed_by: string;
    status: string;
  }>;
}

export default {};