/**
 * RL Optimization API for Schlep-engine JavaScript SDK
 * Provides interfaces for reinforcement learning optimization services
 */

import { BaseAPI } from './base';
import {
  RLStrategy,
  RLObjective,
  OptimizationType,
  SessionStatus,
  RLOptimizationConfig,
  RLOptimizationRequest,
  RLOptimizationSession,
  RLOptimizationStatus,
  RLSessionMetrics,
  OptimizationResult,
  IndustryPreset
} from '../types/rl-optimization';

export class RLOptimizationAPI extends BaseAPI {
  private baseUrl: string;

  constructor(client: any) {
    super(client);
    this.baseUrl = `${this.client.baseUrl}/api/v1/rl`;
  }

  /**
   * Start hyperparameter optimization using RL
   */
  async startHyperparameterOptimization({
    pipelineId,
    trainingDataPath,
    validationDataPath,
    strategy = RLStrategy.PPO,
    objective = RLObjective.BALANCED_PERFORMANCE,
    maxEpisodes = 50,
    maxTrainingTime = 3600,
    earlyStoppingPatience = 10,
    customConfig
  }: {
    pipelineId: string;
    trainingDataPath: string;
    validationDataPath?: string;
    strategy?: RLStrategy;
    objective?: RLObjective;
    maxEpisodes?: number;
    maxTrainingTime?: number;
    earlyStoppingPatience?: number;
    customConfig?: Record<string, any>;
  }): Promise<RLOptimizationSession> {
    const requestData = {
      pipeline_id: pipelineId,
      optimization_type: 'hyperparameter',
      training_data_path: trainingDataPath,
      validation_data_path: validationDataPath,
      optimization_config: {
        strategy,
        objective,
        max_episodes: maxEpisodes,
        max_training_time: maxTrainingTime,
        early_stopping_patience: earlyStoppingPatience,
        ...customConfig
      }
    };

    const response = await this.post(`${this.baseUrl}/hyperparameters/optimize`, requestData);
    return this.mapToRLOptimizationSession(response);
  }

  /**
   * Start resource allocation optimization using RL
   */
  async startResourceAllocationOptimization({
    pipelineConfigs,
    resourceConstraints,
    strategy = RLStrategy.PPO,
    optimizationObjective = 'cost_efficiency'
  }: {
    pipelineConfigs: Array<Record<string, any>>;
    resourceConstraints: Record<string, any>;
    strategy?: RLStrategy;
    optimizationObjective?: string;
  }): Promise<RLOptimizationSession> {
    const requestData = {
      optimization_type: 'resource_allocation',
      pipeline_configs: pipelineConfigs,
      resource_constraints: resourceConstraints,
      optimization_config: {
        strategy,
        objective: optimizationObjective,
        max_episodes: 30,
        max_training_time: 1800
      }
    };

    const response = await this.post(`${this.baseUrl}/resource-allocation/optimize`, requestData);
    return this.mapToRLOptimizationSession(response);
  }

  /**
   * Get status of an RL optimization session
   */
  async getSessionStatus(sessionId: string): Promise<RLOptimizationStatus> {
    const response = await this.get(`${this.baseUrl}/sessions/${sessionId}/status`);
    return this.mapToRLOptimizationStatus(response);
  }

  /**
   * Get detailed metrics for an RL optimization session
   */
  async getSessionMetrics(
    sessionId: string,
    includeEpisodes: boolean = true
  ): Promise<RLSessionMetrics> {
    const params = { include_episodes: includeEpisodes };
    const response = await this.get(`${this.baseUrl}/sessions/${sessionId}/metrics`, { params });
    return this.mapToRLSessionMetrics(response);
  }

  /**
   * Stop a running RL optimization session
   */
  async stopOptimization(sessionId: string): Promise<boolean> {
    const response = await this.post(`${this.baseUrl}/sessions/${sessionId}/stop`);
    return response.success || false;
  }

  /**
   * Get final results from a completed RL optimization session
   */
  async getOptimizationResult(sessionId: string): Promise<OptimizationResult> {
    const response = await this.get(`${this.baseUrl}/sessions/${sessionId}/result`);
    return this.mapToOptimizationResult(response);
  }

  /**
   * List RL optimization sessions
   */
  async listSessions({
    pipelineId,
    status,
    limit = 50,
    offset = 0
  }: {
    pipelineId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<RLOptimizationSession[]> {
    const params: Record<string, any> = { limit, offset };
    
    if (pipelineId) params.pipeline_id = pipelineId;
    if (status) params.status = status;

    const response = await this.get(`${this.baseUrl}/sessions`, { params });
    return (response.sessions || []).map((session: any) => 
      this.mapToRLOptimizationSession(session)
    );
  }

  /**
   * Wait for an RL optimization session to complete
   */
  async waitForCompletion(
    sessionId: string,
    timeout: number = 3600,
    pollInterval: number = 30
  ): Promise<OptimizationResult> {
    const startTime = Date.now();

    while (true) {
      const status = await this.getSessionStatus(sessionId);

      if (status.status === SessionStatus.COMPLETED) {
        return await this.getOptimizationResult(sessionId);
      } else if (status.status === SessionStatus.FAILED) {
        throw new Error(`Optimization session ${sessionId} failed: ${status.errorMessage}`);
      } else if (Date.now() - startTime > timeout * 1000) {
        throw new Error(`Optimization session ${sessionId} did not complete within ${timeout} seconds`);
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval * 1000));
    }
  }

  /**
   * Get industry-specific optimization configuration preset
   */
  async getIndustryPreset(industry: string): Promise<IndustryPreset> {
    const response = await this.get(`${this.baseUrl}/presets/industry/${industry}`);
    return this.mapToIndustryPreset(response);
  }

  /**
   * Validate an optimization request before submission
   */
  async validateOptimizationRequest(requestData: Record<string, any>): Promise<Record<string, any>> {
    const response = await this.post(`${this.baseUrl}/validate`, requestData);
    return response;
  }

  // Convenience methods for common use cases

  /**
   * Optimize an e-commerce ML pipeline with industry-specific settings
   */
  async optimizeEcommercePipeline(
    pipelineId: string,
    trainingDataPath: string,
    options: Record<string, any> = {}
  ): Promise<RLOptimizationSession> {
    const preset = await this.getIndustryPreset('ecommerce');
    const config = { ...preset.defaultConfig, ...options };

    return await this.startHyperparameterOptimization({
      pipelineId,
      trainingDataPath,
      ...config
    });
  }

  /**
   * Optimize a manufacturing ML pipeline with industry-specific settings
   */
  async optimizeManufacturingPipeline(
    pipelineId: string,
    trainingDataPath: string,
    options: Record<string, any> = {}
  ): Promise<RLOptimizationSession> {
    const preset = await this.getIndustryPreset('manufacturing');
    const config = { ...preset.defaultConfig, ...options };

    return await this.startHyperparameterOptimization({
      pipelineId,
      trainingDataPath,
      ...config
    });
  }

  /**
   * Optimize a finance ML pipeline with industry-specific settings
   */
  async optimizeFinancePipeline(
    pipelineId: string,
    trainingDataPath: string,
    options: Record<string, any> = {}
  ): Promise<RLOptimizationSession> {
    const preset = await this.getIndustryPreset('finance');
    const config = { ...preset.defaultConfig, ...options };

    return await this.startHyperparameterOptimization({
      pipelineId,
      trainingDataPath,
      ...config
    });
  }

  // Private mapping methods

  private mapToRLOptimizationSession(data: any): RLOptimizationSession {
    return {
      sessionId: data.session_id,
      pipelineId: data.pipeline_id,
      optimizationType: data.optimization_type,
      strategy: data.strategy,
      objective: data.objective,
      status: data.status,
      config: data.config || {},
      bestPerformance: data.best_performance,
      bestHyperparameters: data.best_hyperparameters,
      totalEpisodes: data.total_episodes,
      optimizationTime: data.optimization_time,
      convergenceEpisode: data.convergence_episode,
      errorMessage: data.error_message,
      createdAt: data.created_at ? new Date(data.created_at) : undefined,
      updatedAt: data.updated_at ? new Date(data.updated_at) : undefined,
      completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
      userId: data.user_id
    };
  }

  private mapToRLOptimizationStatus(data: any): RLOptimizationStatus {
    return {
      sessionId: data.session_id,
      status: data.status,
      progress: data.progress || 0.0,
      currentEpisode: data.current_episode,
      currentPerformance: data.current_performance,
      bestPerformance: data.best_performance,
      estimatedTimeRemaining: data.estimated_time_remaining,
      resourceUtilization: data.resource_utilization,
      errorMessage: data.error_message,
      lastUpdated: data.last_updated ? new Date(data.last_updated) : undefined
    };
  }

  private mapToRLSessionMetrics(data: any): RLSessionMetrics {
    return {
      sessionId: data.session_id,
      performanceHistory: data.performance_history || [],
      hyperparameterHistory: data.hyperparameter_history || [],
      episodeMetrics: (data.episode_metrics || []).map((episode: any) => ({
        episodeNumber: episode.episode_number,
        reward: episode.reward,
        performanceMetrics: episode.performance_metrics || {},
        hyperparameters: episode.hyperparameters || {},
        trainingTime: episode.training_time,
        memoryUsage: episode.memory_usage,
        cpuUsage: episode.cpu_usage,
        convergenceIndicator: episode.convergence_indicator,
        timestamp: episode.timestamp ? new Date(episode.timestamp) : undefined
      })),
      convergenceAnalysis: data.convergence_analysis || {},
      resourceUsageStats: data.resource_usage_stats || {},
      trainingSummary: data.training_summary || {}
    };
  }

  private mapToOptimizationResult(data: any): OptimizationResult {
    return {
      sessionId: data.session_id,
      bestHyperparameters: data.best_hyperparameters,
      bestPerformance: data.best_performance,
      totalEpisodes: data.total_episodes,
      optimizationTime: data.optimization_time,
      convergenceEpisode: data.convergence_episode,
      performanceHistory: data.performance_history || [],
      hyperparameterHistory: data.hyperparameter_history || [],
      finalModelMetrics: data.final_model_metrics || {},
      improvementOverBaseline: data.improvement_over_baseline,
      costAnalysis: data.cost_analysis
    };
  }

  private mapToIndustryPreset(data: any): IndustryPreset {
    return {
      industry: data.industry,
      recommendedStrategy: data.recommended_strategy,
      recommendedObjective: data.recommended_objective,
      defaultConfig: data.default_config,
      focusMetrics: data.focus_metrics || [],
      typicalPerformanceRanges: data.typical_performance_ranges || {},
      optimizationTips: data.optimization_tips || []
    };
  }
}