package models

import (
	"time"
)

// MLFramework represents supported ML frameworks
type MLFramework string

const (
	MLFrameworkScikit     MLFramework = "scikit-learn"
	MLFrameworkTensorFlow MLFramework = "tensorflow"
	MLFrameworkPyTorch    MLFramework = "pytorch"
	MLFrameworkXGBoost    MLFramework = "xgboost"
	MLFrameworkLightGBM   MLFramework = "lightgbm"
	MLFrameworkAutoML     MLFramework = "auto-ml"
)

// ModelType represents different types of ML models
type ModelType string

const (
	ModelTypeClassification ModelType = "classification"
	ModelTypeRegression     ModelType = "regression"
	ModelTypeClustering     ModelType = "clustering"
	ModelTypeAnomalyDetection ModelType = "anomaly_detection"
	ModelTypeTimeSeries     ModelType = "time_series"
	ModelTypeNLP            ModelType = "nlp"
	ModelTypeComputerVision ModelType = "computer_vision"
	ModelTypeRecommendation ModelType = "recommendation"
)

// ModelStatus represents the status of an ML model
type ModelStatus string

const (
	ModelStatusTraining   ModelStatus = "training"
	ModelStatusTrained    ModelStatus = "trained"
	ModelStatusDeployed   ModelStatus = "deployed"
	ModelStatusDeprecated ModelStatus = "deprecated"
	ModelStatusFailed     ModelStatus = "failed"
)

// MLPipeline represents an ML pipeline configuration
type MLPipeline struct {
	ID                string                 `json:"id,omitempty"`
	Name              string                 `json:"name"`
	Description       *string                `json:"description,omitempty"`
	Type              ModelType              `json:"type"`
	Framework         MLFramework            `json:"framework"`
	Configuration     MLPipelineConfig       `json:"configuration"`
	DataSources       []string               `json:"data_sources"`      // Data source IDs
	FeatureEngineering []FeatureEngineering   `json:"feature_engineering,omitempty"`
	ModelConfig       ModelConfiguration     `json:"model_config"`
	TrainingConfig    TrainingConfiguration  `json:"training_config"`
	ValidationConfig  ValidationConfiguration `json:"validation_config"`
	Status            ModelStatus            `json:"status"`
	CreatedAt         time.Time              `json:"created_at"`
	UpdatedAt         time.Time              `json:"updated_at"`
	CreatedBy         string                 `json:"created_by,omitempty"`
	Tags              []string               `json:"tags,omitempty"`
	Metadata          map[string]interface{} `json:"metadata,omitempty"`
}

// MLPipelineConfig represents pipeline configuration
type MLPipelineConfig struct {
	AutoML                bool                   `json:"auto_ml"`
	ExperimentTracking    bool                   `json:"experiment_tracking"`
	HyperparameterTuning  bool                   `json:"hyperparameter_tuning"`
	FeatureSelection      bool                   `json:"feature_selection"`
	CrossValidation       bool                   `json:"cross_validation"`
	Earlystopping        bool                   `json:"early_stopping"`
	ModelExplainability   bool                   `json:"model_explainability"`
	CustomCode            *string                `json:"custom_code,omitempty"`
	Environment           map[string]interface{} `json:"environment,omitempty"`
	ResourceRequirements  ResourceRequirements   `json:"resource_requirements,omitempty"`
}

// FeatureEngineering represents feature engineering configuration
type FeatureEngineering struct {
	Name        string                 `json:"name"`
	Type        string                 `json:"type"` // "encoding", "scaling", "transformation", "selection"
	Parameters  map[string]interface{} `json:"parameters,omitempty"`
	InputColumns []string              `json:"input_columns,omitempty"`
	OutputColumns []string             `json:"output_columns,omitempty"`
	Description *string                `json:"description,omitempty"`
	Order       int                    `json:"order,omitempty"`
}

// ModelConfiguration represents model-specific configuration
type ModelConfiguration struct {
	Algorithm        string                 `json:"algorithm"`
	Hyperparameters  map[string]interface{} `json:"hyperparameters,omitempty"`
	Architecture     *string                `json:"architecture,omitempty"` // For neural networks
	PretrainedModel  *string                `json:"pretrained_model,omitempty"`
	CustomParameters map[string]interface{} `json:"custom_parameters,omitempty"`
}

// TrainingConfiguration represents training configuration
type TrainingConfiguration struct {
	TrainTestSplit      float64                `json:"train_test_split"`      // 0.0-1.0
	ValidationSplit     float64                `json:"validation_split"`      // 0.0-1.0
	RandomSeed          *int                   `json:"random_seed,omitempty"`
	MaxTrainingTime     *int                   `json:"max_training_time_minutes,omitempty"`
	EarlyStoppingConfig *EarlyStoppingConfig   `json:"early_stopping_config,omitempty"`
	ResourceLimits      *ResourceRequirements  `json:"resource_limits,omitempty"`
	DataAugmentation    *DataAugmentationConfig `json:"data_augmentation,omitempty"`
	ClassWeights        map[string]float64     `json:"class_weights,omitempty"`
	BatchSize           *int                   `json:"batch_size,omitempty"`
	Epochs              *int                   `json:"epochs,omitempty"`
	LearningRate        *float64               `json:"learning_rate,omitempty"`
}

// EarlyStoppingConfig represents early stopping configuration
type EarlyStoppingConfig struct {
	Enabled   bool    `json:"enabled"`
	Metric    string  `json:"metric"`    // "loss", "accuracy", "f1", etc.
	Patience  int     `json:"patience"`  // Number of epochs without improvement
	MinDelta  float64 `json:"min_delta"` // Minimum change to qualify as improvement
	Mode      string  `json:"mode"`      // "min" or "max"
}

// ValidationConfiguration represents validation configuration
type ValidationConfiguration struct {
	Method          string                 `json:"method"` // "holdout", "cross_validation", "time_series_split"
	CrossValidationFolds *int              `json:"cross_validation_folds,omitempty"`
	Metrics         []string               `json:"metrics"` // ["accuracy", "precision", "recall", "f1", "auc"]
	CustomMetrics   map[string]interface{} `json:"custom_metrics,omitempty"`
	TestDatasetID   *string                `json:"test_dataset_id,omitempty"`
}

// DataAugmentationConfig represents data augmentation configuration
type DataAugmentationConfig struct {
	Enabled    bool                   `json:"enabled"`
	Techniques []string               `json:"techniques"` // ["rotation", "flip", "noise", "crop", etc.]
	Parameters map[string]interface{} `json:"parameters,omitempty"`
}

// ResourceRequirements represents resource requirements for training/inference
type ResourceRequirements struct {
	CPUCores    *int   `json:"cpu_cores,omitempty"`
	MemoryGB    *int   `json:"memory_gb,omitempty"`
	GPUCount    *int   `json:"gpu_count,omitempty"`
	GPUType     *string `json:"gpu_type,omitempty"`
	StorageGB   *int   `json:"storage_gb,omitempty"`
	MaxRuntime  *int   `json:"max_runtime_minutes,omitempty"`
}

// TrainingRequest represents a request to train an ML model
type TrainingRequest struct {
	PipelineID     string                 `json:"pipeline_id,omitempty"`
	Pipeline       *MLPipeline            `json:"pipeline,omitempty"` // For inline pipeline creation
	DatasetID      string                 `json:"dataset_id"`
	TargetColumn   string                 `json:"target_column"`
	FeatureColumns []string               `json:"feature_columns,omitempty"` // If empty, auto-select
	Options        map[string]interface{} `json:"options,omitempty"`
	Tags           []string               `json:"tags,omitempty"`
	ExperimentName *string                `json:"experiment_name,omitempty"`
}

// TrainingJob represents a training job
type TrainingJob struct {
	JobID           string                 `json:"job_id"`
	PipelineID      string                 `json:"pipeline_id"`
	Status          JobStatus              `json:"status"`
	Progress        float64                `json:"progress"` // 0-100
	Stage           string                 `json:"stage"`    // "preprocessing", "training", "validation", "completed"
	DatasetID       string                 `json:"dataset_id"`
	ModelID         *string                `json:"model_id,omitempty"`
	Metrics         *TrainingMetrics       `json:"metrics,omitempty"`
	ResourceUsage   *ResourceUsage         `json:"resource_usage,omitempty"`
	Logs            []string               `json:"logs,omitempty"`
	Artifacts       []TrainingArtifact     `json:"artifacts,omitempty"`
	ErrorMessage    *string                `json:"error_message,omitempty"`
	CreatedAt       time.Time              `json:"created_at"`
	StartedAt       *time.Time             `json:"started_at,omitempty"`
	CompletedAt     *time.Time             `json:"completed_at,omitempty"`
	EstimatedTime   *int                   `json:"estimated_time_minutes,omitempty"`
	TrainingTime    *float64               `json:"training_time_minutes,omitempty"`
	ExperimentID    *string                `json:"experiment_id,omitempty"`
	UserID          string                 `json:"user_id"`
}

// TrainingMetrics represents training metrics
type TrainingMetrics struct {
	TrainingMetrics   map[string]float64     `json:"training_metrics"`
	ValidationMetrics map[string]float64     `json:"validation_metrics"`
	TestMetrics       map[string]float64     `json:"test_metrics,omitempty"`
	History           []EpochMetrics         `json:"history,omitempty"`
	FeatureImportance map[string]float64     `json:"feature_importance,omitempty"`
	ConfusionMatrix   [][]int                `json:"confusion_matrix,omitempty"`
	LearningCurves    map[string][]float64   `json:"learning_curves,omitempty"`
	HyperparameterScores map[string]interface{} `json:"hyperparameter_scores,omitempty"`
}

// EpochMetrics represents metrics for a single training epoch
type EpochMetrics struct {
	Epoch             int                `json:"epoch"`
	TrainingLoss      float64            `json:"training_loss"`
	ValidationLoss    *float64           `json:"validation_loss,omitempty"`
	TrainingMetrics   map[string]float64 `json:"training_metrics,omitempty"`
	ValidationMetrics map[string]float64 `json:"validation_metrics,omitempty"`
	Timestamp         time.Time          `json:"timestamp"`
}

// TrainingArtifact represents a training artifact
type TrainingArtifact struct {
	Name        string                 `json:"name"`
	Type        string                 `json:"type"` // "model", "plot", "log", "config", "data"
	Path        string                 `json:"path"`
	URL         *string                `json:"url,omitempty"`
	Size        int64                  `json:"size_bytes"`
	ContentType string                 `json:"content_type"`
	Description *string                `json:"description,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
	CreatedAt   time.Time              `json:"created_at"`
}

// Model represents a trained ML model
type Model struct {
	ID                string                 `json:"id"`
	Name              string                 `json:"name"`
	Description       *string                `json:"description,omitempty"`
	Type              ModelType              `json:"type"`
	Framework         MLFramework            `json:"framework"`
	Algorithm         string                 `json:"algorithm"`
	Version           string                 `json:"version"`
	Status            ModelStatus            `json:"status"`
	PipelineID        string                 `json:"pipeline_id"`
	TrainingJobID     string                 `json:"training_job_id"`
	DatasetID         string                 `json:"dataset_id"`
	Metrics           TrainingMetrics        `json:"metrics"`
	ModelArtifacts    []TrainingArtifact     `json:"model_artifacts"`
	FeatureSchema     map[string]interface{} `json:"feature_schema"`
	Deployment        *ModelDeployment       `json:"deployment,omitempty"`
	CreatedAt         time.Time              `json:"created_at"`
	UpdatedAt         time.Time              `json:"updated_at"`
	CreatedBy         string                 `json:"created_by,omitempty"`
	Tags              []string               `json:"tags,omitempty"`
	Metadata          map[string]interface{} `json:"metadata,omitempty"`
	ExpiresAt         *time.Time             `json:"expires_at,omitempty"`
}

// ModelDeployment represents model deployment information
type ModelDeployment struct {
	ID                string                 `json:"id"`
	Status            string                 `json:"status"` // "deploying", "deployed", "failed", "stopped"
	EndpointURL       *string                `json:"endpoint_url,omitempty"`
	InstanceType      string                 `json:"instance_type"`
	InstanceCount     int                    `json:"instance_count"`
	AutoScaling       *AutoScalingConfig     `json:"auto_scaling,omitempty"`
	ResourceUsage     *ResourceUsage         `json:"resource_usage,omitempty"`
	PerformanceMetrics *InferenceMetrics     `json:"performance_metrics,omitempty"`
	DeployedAt        *time.Time             `json:"deployed_at,omitempty"`
	LastHealthCheck   *time.Time             `json:"last_health_check,omitempty"`
	Configuration     map[string]interface{} `json:"configuration,omitempty"`
}

// AutoScalingConfig represents auto-scaling configuration
type AutoScalingConfig struct {
	Enabled             bool    `json:"enabled"`
	MinInstances        int     `json:"min_instances"`
	MaxInstances        int     `json:"max_instances"`
	TargetCPUUtilization *int   `json:"target_cpu_utilization,omitempty"`
	TargetMemoryUtilization *int `json:"target_memory_utilization,omitempty"`
	ScaleUpCooldown     int     `json:"scale_up_cooldown_seconds"`
	ScaleDownCooldown   int     `json:"scale_down_cooldown_seconds"`
}

// InferenceRequest represents a request for model inference
type InferenceRequest struct {
	ModelID        string                 `json:"model_id"`
	Features       map[string]interface{} `json:"features"`
	BatchFeatures  []map[string]interface{} `json:"batch_features,omitempty"`
	Options        map[string]interface{} `json:"options,omitempty"`
	ExplainPrediction bool                `json:"explain_prediction"`
	IncludeMetadata   bool                `json:"include_metadata"`
}

// InferenceResult represents the result of model inference
type InferenceResult struct {
	ModelID       string                 `json:"model_id"`
	Predictions   interface{}            `json:"predictions"` // Single prediction or array
	Probabilities []float64              `json:"probabilities,omitempty"`
	Confidence    *float64               `json:"confidence,omitempty"`
	Explanation   *PredictionExplanation `json:"explanation,omitempty"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
	ProcessingTime float64               `json:"processing_time_ms"`
	Timestamp     time.Time              `json:"timestamp"`
	RequestID     string                 `json:"request_id,omitempty"`
}

// PredictionExplanation represents prediction explanation
type PredictionExplanation struct {
	Method            string                 `json:"method"` // "shap", "lime", "feature_importance"
	FeatureImportance map[string]float64     `json:"feature_importance"`
	LocalExplanation  map[string]interface{} `json:"local_explanation,omitempty"`
	GlobalExplanation map[string]interface{} `json:"global_explanation,omitempty"`
}

// BatchInferenceRequest represents a batch inference request
type BatchInferenceRequest struct {
	ModelID         string                 `json:"model_id"`
	DatasetID       string                 `json:"dataset_id"`
	OutputFormat    DataFormat             `json:"output_format"`
	IncludeProbabilities bool              `json:"include_probabilities"`
	IncludeExplanation   bool              `json:"include_explanation"`
	Options         map[string]interface{} `json:"options,omitempty"`
	Tags            []string               `json:"tags,omitempty"`
}

// BatchInferenceResult represents batch inference result
type BatchInferenceResult struct {
	JobID           string                 `json:"job_id"`
	ModelID         string                 `json:"model_id"`
	Status          JobStatus              `json:"status"`
	Progress        float64                `json:"progress"`
	TotalRecords    int                    `json:"total_records"`
	ProcessedRecords int                   `json:"processed_records"`
	OutputPath      *string                `json:"output_path,omitempty"`
	OutputURL       *string                `json:"output_url,omitempty"`
	Metrics         *InferenceMetrics      `json:"metrics,omitempty"`
	ErrorMessage    *string                `json:"error_message,omitempty"`
	CreatedAt       time.Time              `json:"created_at"`
	StartedAt       *time.Time             `json:"started_at,omitempty"`
	CompletedAt     *time.Time             `json:"completed_at,omitempty"`
	ProcessingTime  *float64               `json:"processing_time_minutes,omitempty"`
}

// InferenceMetrics represents inference performance metrics
type InferenceMetrics struct {
	RequestsPerSecond     float64            `json:"requests_per_second"`
	AverageLatency        time.Duration      `json:"average_latency_ms"`
	P95Latency            time.Duration      `json:"p95_latency_ms"`
	P99Latency            time.Duration      `json:"p99_latency_ms"`
	TotalRequests         int64              `json:"total_requests"`
	SuccessfulRequests    int64              `json:"successful_requests"`
	FailedRequests        int64              `json:"failed_requests"`
	ErrorRate             float64            `json:"error_rate_percent"`
	ThroughputMBPerSec    float64            `json:"throughput_mb_per_sec"`
	AveragePredictionTime time.Duration      `json:"average_prediction_time_ms"`
	ResourceUtilization   *ResourceUsage     `json:"resource_utilization,omitempty"`
}

// Experiment represents an ML experiment
type Experiment struct {
	ID          string                 `json:"id"`
	Name        string                 `json:"name"`
	Description *string                `json:"description,omitempty"`
	Status      string                 `json:"status"` // "active", "completed", "failed", "cancelled"
	Runs        []ExperimentRun        `json:"runs,omitempty"`
	BestRun     *ExperimentRun         `json:"best_run,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
	CreatedAt   time.Time              `json:"created_at"`
	UpdatedAt   time.Time              `json:"updated_at"`
	CreatedBy   string                 `json:"created_by,omitempty"`
	Tags        []string               `json:"tags,omitempty"`
}

// ExperimentRun represents a single experiment run
type ExperimentRun struct {
	ID            string                 `json:"id"`
	ExperimentID  string                 `json:"experiment_id"`
	Name          *string                `json:"name,omitempty"`
	Status        JobStatus              `json:"status"`
	Parameters    map[string]interface{} `json:"parameters"`
	Metrics       map[string]float64     `json:"metrics"`
	Artifacts     []TrainingArtifact     `json:"artifacts,omitempty"`
	StartTime     time.Time              `json:"start_time"`
	EndTime       *time.Time             `json:"end_time,omitempty"`
	Duration      *float64               `json:"duration_minutes,omitempty"`
	ModelID       *string                `json:"model_id,omitempty"`
	TrainingJobID string                 `json:"training_job_id"`
	Notes         *string                `json:"notes,omitempty"`
	Tags          []string               `json:"tags,omitempty"`
}