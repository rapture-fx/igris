/**
 * RL Optimization types for Schlep-engine JavaScript SDK
 * Type definitions for reinforcement learning optimization
 */

export enum RLStrategy {
  PPO = 'ppo',
  A2C = 'a2c',
  SAC = 'sac',
  DDPG = 'ddpg'
}

export enum RLObjective {
  ACCURACY = 'accuracy',
  F1_SCORE = 'f1_score',
  PRECISION = 'precision',
  RECALL = 'recall',
  AUC_ROC = 'auc_roc',
  TRAINING_TIME = 'training_time',
  BALANCED_PERFORMANCE = 'balanced_performance'
}

export enum OptimizationType {
  HYPERPARAMETER = 'hyperparameter',
  RESOURCE_ALLOCATION = 'resource_allocation',
  DATA_QUALITY = 'data_quality',
  PIPELINE_SCHEDULING = 'pipeline_scheduling'
}

export enum SessionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  STOPPED = 'stopped'
}

export interface RLOptimizationConfig {
  strategy: RLStrategy;
  objective: RLObjective;
  maxEpisodes?: number;
  maxTrainingTime?: number;
  earlyStoppingPatience?: number;
  learningRate?: number;
  batchSize?: number;
  nSteps?: number;
  gamma?: number;
  gaeLambda?: number;
  enableTensorboard?: boolean;
  saveCheckpoints?: boolean;
  customParams?: Record<string, any>;
}

export interface RLOptimizationRequest {
  pipelineId: string;
  optimizationType: OptimizationType;
  trainingDataPath: string;
  validationDataPath?: string;
  optimizationConfig?: RLOptimizationConfig;
  hyperparameterSpace?: Record<string, any>;
  industryType?: string;
  priority?: number;
  metadata?: Record<string, any>;
}

export interface RLEpisodeMetrics {
  episodeNumber: number;
  reward: number;
  performanceMetrics: Record<string, number>;
  hyperparameters: Record<string, any>;
  trainingTime: number;
  memoryUsage?: number;
  cpuUsage?: number;
  convergenceIndicator?: number;
  timestamp?: Date;
}

export interface RLOptimizationSession {
  sessionId: string;
  pipelineId: string;
  optimizationType: OptimizationType;
  strategy: RLStrategy;
  objective: RLObjective;
  status: SessionStatus;
  config: Record<string, any>;
  bestPerformance?: number;
  bestHyperparameters?: Record<string, any>;
  totalEpisodes?: number;
  optimizationTime?: number;
  convergenceEpisode?: number;
  errorMessage?: string;
  createdAt?: Date;
  updatedAt?: Date;
  completedAt?: Date;
  userId?: string;
}

export interface RLOptimizationStatus {
  sessionId: string;
  status: SessionStatus;
  progress: number; // 0.0 to 1.0
  currentEpisode?: number;
  currentPerformance?: number;
  bestPerformance?: number;
  estimatedTimeRemaining?: number;
  resourceUtilization?: Record<string, number>;
  errorMessage?: string;
  lastUpdated?: Date;
}

export interface RLSessionMetrics {
  sessionId: string;
  performanceHistory: number[];
  hyperparameterHistory: Record<string, any>[];
  episodeMetrics: RLEpisodeMetrics[];
  convergenceAnalysis: Record<string, any>;
  resourceUsageStats: Record<string, any>;
  trainingSummary: Record<string, any>;
}

export interface OptimizationResult {
  sessionId: string;
  bestHyperparameters: Record<string, any>;
  bestPerformance: number;
  totalEpisodes: number;
  optimizationTime: number;
  convergenceEpisode?: number;
  performanceHistory: number[];
  hyperparameterHistory: Record<string, any>[];
  finalModelMetrics: Record<string, number>;
  improvementOverBaseline?: number;
  costAnalysis?: Record<string, any>;
}

export interface IndustryPreset {
  industry: string;
  recommendedStrategy: RLStrategy;
  recommendedObjective: RLObjective;
  defaultConfig: RLOptimizationConfig;
  focusMetrics: string[];
  typicalPerformanceRanges: Record<string, [number, number]>;
  optimizationTips: string[];
}

// API Response types
export interface RLOptimizationResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
  errors?: string[];
}

export interface SessionListResponse {
  sessions: RLOptimizationSession[];
  total: number;
  page: number;
  pageSize: number;
}

// Configuration presets
export interface EcommerceOptimizationConfig extends RLOptimizationConfig {
  focusMetrics: ['conversion_rate', 'click_through_rate', 'revenue_per_visitor'];
  maxEpisodes: 30;
  earlyStoppingPatience: 8;
  learningRate: 5e-4;
}

export interface ManufacturingOptimizationConfig extends RLOptimizationConfig {
  focusMetrics: ['equipment_efficiency', 'defect_rate', 'downtime_reduction'];
  maxEpisodes: 75;
  earlyStoppingPatience: 15;
  learningRate: 1e-4;
}

export interface FinanceOptimizationConfig extends RLOptimizationConfig {
  focusMetrics: ['fraud_detection_rate', 'false_positive_rate', 'risk_score_accuracy'];
  maxEpisodes: 100;
  earlyStoppingPatience: 20;
  learningRate: 1e-4;
}

// Event types for real-time updates
export interface RLOptimizationEvent {
  type: 'episode_completed' | 'session_status_changed' | 'performance_updated' | 'error_occurred';
  sessionId: string;
  timestamp: Date;
  data: any;
}

// Hook types for React integration
export interface UseRLOptimizationResult {
  session: RLOptimizationSession | null;
  status: RLOptimizationStatus | null;
  metrics: RLSessionMetrics | null;
  result: OptimizationResult | null;
  isLoading: boolean;
  error: Error | null;
  startOptimization: (request: RLOptimizationRequest) => Promise<void>;
  stopOptimization: () => Promise<void>;
  refreshStatus: () => Promise<void>;
}

export interface RLOptimizationHookOptions {
  pollInterval?: number;
  autoStart?: boolean;
  onComplete?: (result: OptimizationResult) => void;
  onError?: (error: Error) => void;
  onProgress?: (status: RLOptimizationStatus) => void;
}