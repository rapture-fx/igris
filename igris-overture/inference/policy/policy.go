package policy

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/hashicorp/vault/api"
	"github.com/prometheus/client_golang/api"
	v1 "github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/rs/zerolog/log"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	pb "github.com/Schlep-engine/igris-inertial/proto/orchestration"
	"github.com/Schlep-engine/igris-inertial/internal/metrics"
	"github.com/Schlep-engine/igris-inertial/internal/cache"
	"github.com/Schlep-engine/igris-inertial/internal/vault"
)

// PolicyEngine handles routing decision-making based on policies and live metrics
type PolicyEngine struct {
	// Configuration
	config *PolicyEngineConfig
	vault  *vault.Client
	cache  *cache.PrometheusCache
	client api.Client

	// Policy storage
	policies map[string]*pb.RoutingPolicy
	mu       sync.RWMutex

	// Metrics integration
	metricsCollector *PrometheusMetricsCollector

	// Runtime information
	modelRegistry    ModelRegistry
	infraProvider    InfrastructureProvider
}

// PolicyEngineConfig holds configuration for the policy engine
type PolicyEngineConfig struct {
	// Vault configuration
	VaultAddr         string        `json:"vault_addr"`
	VaultToken        string        `json:"vault_token"`
	VaultEnginePath    string        `json:"vault_engine_path"`
	VaultPoliciesPath string        `json:"vault_policies_path"`

	// Metrics configuration
	PrometheusURL    string        `json:"prometheus_url"`
	MetricsTimeout   time.Duration `json:"metrics_timeout"`
	MetricsCacheTTL   time.Duration `json:"metrics_cache_ttl"`

	// Cache configuration
	PolicyCacheTTL       time.Duration `json:"policy_cache_ttl"`
	PrometheusCacheTTL    time.Duration `json:"prometheus_cache_ttl"`
	DecisionCacheTTL     time.Duration `json:"decision_cache_ttl"`

	// Routing configuration
	DefaultRetryAttempts int             `json:"default_retry_attempts"`
	DefaultRetryDelay    time.Duration   `json:"default_retry_delay"`
	DefaultTimeout      time.Duration   `json:"default_timeout"`

	// Performance settings
	MaxConcurrentDecisions int             `json:"max_concurrent_decisions"`
	MetricsUpdateInterval   time.Duration   `json:"metrics_update_interval"`
}

// PrometheusMetricsCollector interfaces with Prometheus for live metrics
type PrometheusMetricsCollector struct {
	client v1.API
	config *PolicyEngineConfig
}

// ModelRegistry provides model information and availability
type ModelRegistry interface {
	GetModel(modelID string) (*pb.ModelInfo, error)
	ListModels(filters ModelFilters) ([]*pb.ModelInfo, error)
	IsModelAvailable(modelID string) bool
	GetModelMetrics(modelID string) (*ModelMetrics, error)
}

// InfrastructureProvider provides infrastructure information
type InfrastructureProvider interface {
	GetRegionInfo() (*RegionInfo, error)
	GetServerLoad(serverID string) (*ServerLoad, error)
	GetNetworkLatency(source, target string) (time.Duration, error)
}

// DecisionCache caches routing decisions
type DecisionCache interface {
	Get(key string) (*RoutingDecision, bool)
	Set(key string, decision *RoutingDecision, ttl time.Duration)
	Invalidate(pattern string)
}

// NewPolicyEngine creates a new policy engine instance
func NewPolicyEngine(config *PolicyEngineConfig, vault *vault.Client, client api.Client) (*PolicyEngine, error) {
	if config == nil {
		return nil, fmt.Errorf("policy engine config is required")
	}
	
	// Initialize metrics collector
	metricsClient, err := api.NewClient(api.Config{
		Address: config.PrometheusURL,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create Prometheus client: %w", err)
	}

	metricsCollector := &PrometheusMetricsCollector{
		client: metricsClient,
		config: config,
	}

	// Initialize caches
	policyCache := cache.NewPrometheusCache(metricsClient, "policies", config.PolicyCacheTTL)
	prometheusCache := cache.NewPrometheusCache(metricsClient, "routing_metrics", config.PrometheusCacheTTL)
	
	engine := &PolicyEngine{
		config:            config,
		vault:             vault,
		cache:             policyCache,
		client:            metricsClient,
		metricsCollector:  metricsCollector,
		policies:          make(map[string]*pb.RoutingPolicy),
		decisionCache:     NewMemoryDecisionCache(config.DecisionCacheTTL),
	}

	// Initialize policies from Vault
	if err := engine.loadPoliciesFromVault(); err != nil {
		log.Error().Err(err).Msg("Failed to load policies from Vault")
		return nil, err
	}

	// Start metrics updates
	go engine.updateMetricsLoop()

	log.Info().
		Int("loaded_policies", len(engine.policies)).
		Str("vault_addr", config.VaultAddr).
		Str("prometheus_url", config.PrometheusURL).
		Msg("Policy engine initialized")

	return engine, nil
}

// RouteInference determines the best model and routing for an inference request
func (e *PolicyEngine) RouteInference(ctx context.Context, req *pb.RouteInferenceRequest) (*pb.RouteInferenceResponse, error) {
	startTime := time.Now()
	
	// Create decision cache key
	cacheKey := e.createDecisionCacheKey(req)
	
	// Check cache first
	if decision, found := e.decisionCache.Get(cacheKey); found {
		log.Debug().Str("cache_key", cacheKey).Msg("Cache hit for routing decision")
		return decision, nil
	}

	// Evaluate routing policies
	selectedPolicy, err := e.evaluatePolicies(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("policy evaluation failed: %w", err)
	}

	// Get available models
	availableModels, err := e.getAvailableModels(ctx, selectedPolicy)
	if err != nil {
		return nil, fmt.Errorf("failed to get available models: %w", err)
	}

	// Select best model using policy preferences
	selectedModel, decisions, err := e.selectBestModel(ctx, selectedPolicy, availableModels, req)
	if err != nil {
		return nil, fmt.Errorf("model selection failed: %w", err)
	}

	// Generate response
	response := &pb.RouteInferenceResponse{
		ModelId:       selectedModel.ModelId,
		PolicyId:       selectedPolicy.PolicyId,
		RuntimeType:   selectedModel.RuntimeType,
		DecisionInfo: &pb.RoutingDecisionInfo{
			Decisions:     decisions,
			TotalScore:    calculateTotalScore(decisions),
			Reasoning:     generateRoutingReasoning(decisions),
			RequiresWarmStart: requiresWarmStart(selectedModel),
		},
		PerformanceEstimate: e.estimatePerformance(selectedModel, decisions),
		CostEstimate:      e.estimateCost(selectedModel, decisions),
		QueueInfo:         e.getQueueInfo(selectedModel),
	}

	// Cache the decision
	e.decisionCache.Set(cacheKey, response, time.Duration(selectedPolicy.Preferences.PrimaryCriteria))

	// Record metrics
	e.recordRoutingMetrics(selectedPolicy, selectedModel, decisions, time.Since(startTime))

	return response, nil
}

// evaluatePolicies finds the best policy for the given request
func (e *PolicyEngine) evaluatePolicies(ctx context.Context, req *pb.RouteInferenceRequest) (*pb.RoutingPolicy, error) {
	e.mu.RLock()
	defer e.mu.RUnlock()

	// Filter applicable policies based on conditions
	applicablePolicies := make([]*pb.RoutingPolicy, 0)
	
	for _, policy := range e.policies {
		if !policy.Enabled {
			continue
		}

		// Check if conditions match
		if e.matchesConditions(policy, req) {
			applicablePolicies = append(applicablePolicies, policy)
		}
	}

	if len(applicablePolicies) == 0 {
		return nil, fmt.Errorf("no applicable policy found for request")
	}

	// Sort policies by priority (highest first)
	sort.Slice(applicablePolicies, func(i, j int) bool {
		return applicablePolicies[i].Priority > applicablePolicies[j].Priority
	})

	// Return the highest priority applicable policy
	log.Debug().
		Str("selected_policy", applicablePolicies[0].PolicyId).
		Int("applicable_policies", len(applicablePolicies)).
		Msg("Policy selection completed")

	return applicablePolicies[0], nil
}

// matchesConditions checks if a policy's conditions match the request
func (e *PolicyEngine) matchesConditions(policy *pb.RoutingPolicy, req *pb.RouteInferenceRequest) bool {
	conditions := policy.Conditions
	
	// Check model conditions
	if len(conditions.ModelIds) > 0 {
		// Extract model preference from request
		preferredModels := req.RoutingHints.PreferredModels
		if containsAny(preferredModels, conditions.ModelIds) {
			return true
		}
	}
	
	// Check model families
	if len(conditions.ModelFamilies) > 0 {
		// Would need model registry to check families
		return true // Simplified for now
	}
	
	// Check request size constraints
	if conditions.RequestSize != nil {
		featureCount := len(req.InferenceRequest.GetEmbedding().GetText()) // Simplified
		if conditions.RequestSize.MinFeatures > 0 && featureCount < int(conditions.RequestSize.MinFeatures) {
			return false
		}
		if conditions.RequestSize.MaxFeatures > 0 && featureCount > int(conditions.RequestSize.MaxFeatures) {
			return false
		}
	}
	
	// Check regions
	if len(conditions.AllowedRegions) > 0 {
		requestRegion := req.Context.Region
		if requestRegion != "" && !containsAny([]string{requestRegion}, conditions.AllowedRegions) {
			return false
		}
	}

	return true
}

// getAvailableModels returns models that satisfy the policy conditions and are available
func (e *PolicyEngine) getAvailableModels(ctx context.Context, policy *pb.RoutingPolicy) ([]*pb.ModelInfo, error) {
	// Get all models from registry
	models, err := e.modelRegistry.ListModels(ModelFilters{
		Families:     policy.Conditions.ModelFamilies,
		Capabilities: policy.Conditions.ModelCapabilities,
		Regions:     policy.Conditions.AllowedRegions,
	})
	if err != nil {
		return nil, err
	}

	// Filter by availability and policy preferences
	availableModels := make([]*pb.ModelInfo, 0)
	
	for _, model := range models {
		// Check availability
		if !model.Available {
			continue
		}

		// Check blocked models
		if containsAny(policy.Preferences.BlockedModels, []string{model.ModelId}) {
			continue
		}

		// Check if model supports required capabilities
		if len(policy.Conditions.ModelCapabilities) > 0 {
			if !modelSupportsCapabilities(model, policy.Conditions.ModelCapabilities) {
				continue
			}
		}

		// Check performance requirements
		if !meetsPerformanceRequirements(model, policy.Conditions.Performance) {
			continue
		}

		availableModels = append(availableModels, model)
	}

	if len(availableModels) == 0 {
		return nil, fmt.Errorf("no available models satisfy policy requirements")
	}

	return availableModels, nil
}

// selectBestModel chooses the best model based on policy preferences and current metrics
func (e *PolicyEngine) selectBestModel(ctx context.Context, policy *pb.RoutingPolicy, models []*pb.ModelInfo, req *pb.RouteInferenceRequest) (*pb.ModelInfo, []*pb.RoutingDecision, error) {
	
	// Get current metrics for all models
	metricsMap, err := e.getModelsMetrics(ctx, models)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get model metrics: %w", err)
	}

	// Score models based on policy preferences
	scores := make([]*ModelScore, 0)
	
	for _, model := range models {
		score, err := e.scoreModel(model, metricsMap[model.ModelId], policy, req)
		if err != nil {
			log.Warn().Err(err).Str("model_id", model.ModelId).Msg("Failed to score model")
			continue
		}
		scores = append(scores, score)
	}

	if len(scores) == 0 {
		return nil, nil, fmt.Errorf("no models could be scored")
	}

	// Sort by score (highest first)
	sort.Slice(scores, func(i, j int) bool {
		return scores[i].TotalScore > scores[j].TotalScore
	})

	// Select the best scoring model
	bestScore := scores[0]
	log.Debug().
		Str("selected_model", bestScore.Model.ModelId).
		Float64("total_score", bestScore.TotalScore).
		Str("policy_id", policy.PolicyId).
		Msg("Best model selected")

	return bestScore.Model, bestScore.Decisions, nil
}

// scoreModel calculates a score for a model based on policy preferences
func (e *PolicyEngine) scoreModel(model *pb.ModelInfo, metrics *ModelMetrics, policy *pb.RoutingPolicy, req *pb.RouteInferenceRequest) (*ModelScore, error) {
	decisions := make([]*pb.RoutingDecision, 0)
	totalScore := 0.0

	// Score based on primary criterion
	primaryScore := e.scoreByCriterion(model, metrics, policy.Preferences.PrimaryCriteria)
	decisions = append(decisions, primaryScore)
	totalScore += primaryScore.Score * 1.0 // Primary has highest weight

	// Score based on secondary criteria
	for _, criterion := range policy.Preferences.SecondaryCriteria {
		score := e.scoreByCriterion(model, metrics, criterion)
		decisions = append(decisions, score)
		totalScore += score.Score * 0.2 // Secondary criteria have lower weight
	}

	// Apply policy-specific modifiers
	if policy.Preferences.PreferCheapest {
		costDecision := e.scoreByCost(model, metrics)
		decisions = append(decisions, costDecision)
		totalScore += costDecision.Score * 0.3
	}

	if policy.Preferences.PreferFastest {
		latencyDecision := e.scoreByLatency(model, metrics)
		decisions = append(decisions, latencyDecision)
		totalScore += latencyDecision.Score * 0.3
	}

	return &ModelScore{
		Model:      model,
		Decisions:  decisions,
		TotalScore: totalScore,
	}, nil
}

// scoreByCriterion scores a model based on a specific criterion
func (e *PolicyEngine) scoreByCriterion(model *pb.ModelInfo, metrics *ModelMetrics, criterion pb.SelectionCriteria) *pb.RoutingDecision {
	var score float64
	var reasoning string

	switch criterion {
	case pb.SELECTION_CRITERIA_COST:
		costPerInference := metrics.CostPer1000Inferences
		// Lower cost = higher score
		score = 1000.0 / (costPerInference + 1e-6) // Avoid division by zero
		reasoning = fmt.Sprintf("Cost score: $%.4f per 1k inferences", costPerInference)

	case pb.SELECTION_CRITERIA_LATENCY:
		latencyP95 := metrics.AvgLatencyMs
		// Lower latency = higher score
		score = 1000.0 / (float64(latencyP95) + 1e-6)
		reasoning = fmt.Sprintf("Latency score: %dms P95", latencyP95)

	case pb.SELECTION_CRITERIA_AVAILABILITY:
		availability := metrics.Availability
		score = availability * 100.0
		reasoning = fmt.Sprintf("Availability: %.1f%%", availability*100)

	case pb.SELECTION_CRITERIA_ACCURACY:
		accuracy := model.Quality.OverallScore
		score = accuracy * 100.0
		reasoning = fmt.Sprintf("Accuracy: %.1f%%", accuracy*100)

	case pb.SELECTION_CRITERIA_THROUGHPUT:
		throughput := model.Performance.MaxThroughputRps
		score = float64(throughput) / 1000.0
		reasoning = fmt.Sprintf("Throughput: %d RPS", throughput)

	default:
		score = 50.0 // Neutral score
		reasoning = fmt.Sprintf("Criterion %s not implemented", criterion.String())
	}

	return &pb.RoutingDecision{
		Criterion: criterion.String(),
		ModelId:   model.ModelId,
		Score:     score,
		Selected:  false,
		Reasoning: reasoning,
	}
}

// getModelsMetrics fetches current metrics for multiple models from Prometheus
func (e *PolicyEngine) getModelsMetrics(ctx context.Context, models []*pb.ModelInfo) (map[string]*ModelMetrics, error) {
	metricsMap := make(map[string]*ModelMetrics)

	// Define Prometheus queries for model metrics
	queries := map[string]string{
		"latency":        fmt.Sprintf("histogram_quantile(0.95, sum(rate(ml_prediction_duration_seconds_bucket{model=~\"%s\"}[5m])) by (model)", e.buildModelRegex(models)),
		"availability":   fmt.Sprintf("avg_over_time(5m, sum(rate(ml_requests_total{model=~\"%s\"}[5m])) by (model) / sum(rate(ml_requests_total{model=~\"%s\"}[5m])) by (model)", e.buildModelRegex(models), e.buildModelRegex(models)),
		"cost":          fmt.Sprintf("avg_over_time(5m, avg(ml_cost_per_inference_dollars{model=~\"%s\"}) by (model)", e.buildModelRegex(models)),
		"throughput":    fmt.Sprintf("sum(rate(ml_requests_total{model=~\"%s\"}[5m])) by (model)", e.buildModelRegex(models)),
	}

	// Execute queries in parallel
	results := make(map[string]v1.WireFormatQueryResult)
	for metricName, query := range queries {
		result, warnings, err := e.client.Query(ctx, query, time.Now(), time.Now().Add(-5*time.Minute))
		if err != nil {
			log.Warn().Err(err).Str("metric", metricName).Msg("Failed to query Prometheus")
			continue
		}
		if len(warnings) > 0 {
			log.Warn().Strs("warnings", warnings).Str("metric", metricName).Msg("Prometheus query warnings")
		}
		results[metricName] = result
	}

	// Parse results and build metrics map
	for _, model := range models {
		modelMetrics := &ModelMetrics{}

		// Parse latency
		if latencyResult := results["latency"]; latencyResult != nil {
			for _, sample := range latencyResult.Result {
				if len(sample.Metric) > 0 {
					modelId := sample.Metric[0].Value
					if modelId == model.ModelId {
						if len(sample.Value) > 0 {
							modelMetrics.AvgLatencyMs = int32(sample.Value[0].GetGaugeValue() * 1000)
						}
						break
					}
				}
			}
		}

		// Parse availability
		if availResult := results["availability"]; availResult != nil {
			for _, sample := range availResult.Result {
				if len(sample.Metric) > 0 {
					modelId := sample.Metric[0].Value
					if modelId == model.ModelId {
						if len(sample.Value) > 0 {
							modelMetrics.Availability = sample.Value[0].GetGaugeValue()
						}
						break
					}
				}
			}
		}

		// Parse cost
		if costResult := results["cost"]; costResult != nil {
			for _, sample := range costResult.Result {
				if len(sample.Metric) > 0 {
					modelId := sample.Metric[0].Value
					if modelId == model.ModelId {
						if len(sample.Value) > 0 {
							modelMetrics.CostPer1000Inferences = sample.Value[0].GetGaugeValue()
						}
						break
					}
				}
			}
		}

		// Parse throughput
		if throughputResult := results["throughput"]; throughputResult != nil {
			for _, sample := range throughputResult.Result {
				if len(sample.Metric) > 0 {
					modelId := sample.Metric[0].Value
					if modelId == model.ModelId {
						if len(sample.Value) > 0 {
							modelMetrics.ThroughputRPS = int32(sample.Value[0].GetGaugeValue())
						}
						break
					}
				}
			}
		}

		metricsMap[model.ModelId] = modelMetrics
	}

	return metricsMap, nil
}

// ModelMetrics holds current performance metrics for a model
type ModelMetrics struct {
	AvgLatencyMs          int32
	Availability          float64
	CostPer1000Inferences  float64
	ThroughputRPS         int32
	CPUUtilization       float64
	MemoryUtilization    float64
	GPUUtilization       float64
	QueueLength          int32
	ErrorRate             float64
}

// estimatePerformance provides performance estimates for the selected model
func (e *PolicyEngine) estimatePerformance(model *pb.ModelInfo, decisions []*pb.RoutingDecision) *pb.PerformanceEstimate {
	// Get current metrics
	modelMetrics, err := e.modelRegistry.GetModelMetrics(model.ModelId)
	if err != nil {
		return &pb.PerformanceEstimate{
			EstimatedP50LatencyMs: 100,
			EstimatedP95LatencyMs: 200,
			EstimatedThroughputRps: 100,
			EstimatedAvailability:  0.95,
		}
	}

	// Adjust estimates based on routing decisions
	latencyAdjustment := 1.0
	throughputAdjustment := 1.0

	for _, decision := range decisions {
		switch decision.Criterion {
		case "latency":
			if decision.Selected {
				latencyAdjustment *= 0.9 // Slightly faster
			} else {
				latencyAdjustment *= 1.1 // Slightly slower
			}
		case "availability":
			throughputAdjustment *= 1.1 // Higher throughput
		}
	}

	estimates := &pb.PerformanceEstimate{
		EstimatedP50LatencyMs:  int32(float64(modelMetrics.AvgLatencyMs) * latencyAdjustment * 0.5), // P50 typically half of P95
		EstimatedP95LatencyMs:  int32(float64(modelMetrics.AvgLatencyMs) * latencyAdjustment),
		EstimatedThroughputRps: int32(float64(modelMetrics.ThroughputRPS) * throughputAdjustment),
		EstimatedAvailability:  modelMetrics.Availability,
	}

	return estimates
}

// estimateCost provides cost estimates for the selected model
func (e *PolicyEngine) estimateCost(model *pb.ModelInfo, decisions []*pb.RoutingDecision) *pb.CostEstimate {
	// Get pricing information from model
	costPerInference := model.Cost.CostPer1kInferences
	if costPerInference == 0 {
		costPerInference = 0.001 // Default fallback
	}

	// Apply cost adjustments based on decisions
	costMultiplier := 1.0
	for _, decision := range decisions {
		if decision.Criterion == "cost" && decision.Selected {
			costMultiplier *= 0.8 // 20% discount for optimal cost selection
		}
	}

	estimatedCost := costPerInference * costMultiplier

	// Get token cost if available
	costPerTokens := model.Cost.CostPer1kTokens
	if costPerTokens == 0 {
		costPerTokens = costPerInference // Fallback
	}

	return &pb.CostEstimate{
		EstimatedCost:       estimatedCost,
		CostPer1kTokens:      costPerTokens,
		CostPer1kInferences:  costPerInference,
		PricingModel:        model.Cost.PricingModel,
		Currency:           model.Cost.Currency,
	}
}

// getQueueInfo provides current queue information for the selected model
func (e *PolicyEngine) getQueueInfo(model *pb.ModelInfo) *pb.QueueInfo {
	// Get queue metrics from Prometheus
	queueLength := e.getQueueLength(model.ModelId)
	estimatedWaitTime := e.estimateWaitTime(model.ModelId, queueLength)

	return &pb.QueueInfo{
		CurrentQueueLength: queueLength,
		EstimatedWaitTimeMs: int32(estimatedWaitTime),
		QueuePosition:        0, // Would need to calculate based on current request
		QueueFull:           queueLength >= int32(model.MaxConcurrentRequests),
	}
}

// Helper functions

func (e *PolicyEngine) createDecisionCacheKey(req *pb.RouteInferenceRequest) string {
	// Create a hash that uniquely identifies routing requirements
	keyParts := []string{
		req.InferenceRequest.RequestId,
		strings.Join(req.RoutingHints.PreferredModels, ","),
		strings.Join(req.RoutingHints.BlockedModels, ","),
		fmt.Sprintf("%v", req.QosRequirements.Priority),
	}
	
	return fmt.Sprintf("routing:%s", strings.Join(keyParts, ":"))
}

func (e *PolicyEngine) loadPoliciesFromVault() error {
	// Load policies from Vault
	policies, err := e.vault.GetSecrets(e.config.VaultPoliciesPath, "")
	if err != nil {
		return fmt.Errorf("failed to load policies from Vault: %w", err)
	}

	// Parse policies
	parsedPolicies := make(map[string]*pb.RoutingPolicy)
	for policyID, policyData := range policies {
		var policy pb.RoutingPolicy
		if err := json.Unmarshal([]byte(policyData), &policy); err != nil {
			log.Error().Err(err).Str("policy_id", policyID).Msg("Failed to parse policy")
			continue
		}
		parsedPolicies[policyID] = &policy
	}

	// Update policies store
	e.mu.Lock()
	e.policies = parsedPolicies
	e.mu.Unlock()

	return nil
}

func (e *PolicyEngine) updateMetricsLoop() {
	ticker := time.NewTicker(e.config.MetricsUpdateInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			e.updatePrometheusMetrics()
		}
	}
}

func (e *PolicyEngine) updatePrometheusMetrics() {
	e.mu.RLock()
	policyCount := len(e.policies)
	e.mu.RUnlock()

	metrics.PoliciesGauge.Set(float64(policyCount))
	metrics.PolicyEngineUptimeGauge.SetToCurrentTime()
}

func (e *PolicyEngine) recordRoutingMetrics(policy *pb.RoutingPolicy, model *pb.ModelInfo, decisions []*pb.RoutingDecision, duration time.Duration) {
	metrics.RoutingRequestsTotal.Inc()
	metrics.RoutingLatencyHistogram.Observe(duration.Seconds())

	// Record policy usage
	metrics.PolicyUsage.WithLabelValues(policy.PolicyId).Inc()
	
	// Record model usage
	metrics.ModelUsage.WithLabelValues(model.ModelId).Inc()

	// Record scoring
	for _, decision := range decisions {
		metrics.CriteriaScore.WithLabelValues(decision.Criterion).Observe(decision.Score)
	}
}

type ModelScore struct {
	Model      *pb.ModelInfo
	Decisions  []*pb.RoutingDecision
	TotalScore float64
}

type MemoryDecisionCache struct {
	decisions map[string]*pb.RouteInferenceResponse
	mu        sync.RWMutex
	ttl       time.Duration
}

func NewMemoryDecisionCache(ttl time.Duration) *MemoryDecisionCache {
	return &MemoryDecisionCache{
		decisions: make(map[string]*pb.RouteInferenceResponse),
		ttl:       ttl,
	}
}

func (c *MemoryDecisionCache) Get(key string) (*pb.RouteInferenceResponse, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	
	if decision, exists := c.decisions[key]; exists {
		// Check TTL (simplified - would need proper timestamp tracking)
		return decision, true
	}
	return nil, false
}

func (c *MemoryDecisionCache) Set(key string, decision *pb.RouteInferenceResponse, ttl time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	
	c.decisions[key] = decision
}

func (c *MemoryDecisionCache) Invalidate(pattern string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	
	// Simple implementation - clear all
	c.decisions = make(map[string]*pb.RouteInferenceResponse)
}

// Additional utility functions would go here
func containsAny(slice []string, targets []string) bool {
	for _, item := range slice {
		for _, target := range targets {
			if item == target {
				return true
			}
		}
	}
	return false
}

func (e *PolicyEngine) buildModelRegex(models []*pb.ModelInfo) string {
	modelIDs := make([]string, len(models))
	for i, model := range models {
		modelIDs[i] = fmt.Sprintf("|%s|", model.ModelId)
	}
	return strings.Join(modelIDs, "")
}

func modelSupportsCapabilities(model *pb.ModelInfo, capabilities []string) bool {
	for _, capability := range capabilities {
		if !containsAny(model.Capabilities, []string{capability}) {
			return false
		}
	}
	return true
}

func meetsPerformanceRequirements(model *pb.ModelInfo, requirements *pb.PerformanceRequirements) bool {
	if requirements.MaxP95LatencyMs > 0 && model.Performance.MaxP95LatencyMs > requirements.MaxP95LatencyMs {
		return false
	}
	if requirements.MaxThroughputRps > 0 && model.Performance.MaxThroughputRps < requirements.MaxThroughputRps {
		return false
	}
	if requirements.MaxMemoryUsage > 0 && model.Performance.MaxMemoryGb > requirements.MaxMemoryUsage {
		return false
	}
	return true
}

func requiresWarmStart(model *pb.ModelInfo) bool {
	return model.Performance.RequiresWarmStart
}

func calculateTotalScore(decisions []*pb.RoutingDecision) float64 {
	total := 0.0
	for _, decision := range decisions {
		total += decision.Score
	}
	return total
}

func generateRoutingReasoning(decisions []*pb.RoutingDecision) string {
	reasons := make([]string, len(decisions))
	for i, decision := range decisions {
		reasons[i] = fmt.Sprintf("%s: %s (%.2f)", decision.Criterion, decision.ModelId, decision.Score)
	}
	return strings.Join(reasons, "; ")
}

// Registry interfaces and implementations would be implemented separately
type ModelFilters struct {
	Families     []string
	Capabilities []string
	Regions     []string
}

type RegionInfo struct {
	Name string
	Code string  
}

type ServerLoad struct {
	ServerID string
	CPU     float64
	Memory  float64
	Network float64
}

// Exported metrics
var (
	PoliciesGauge = prometheus.NewGauge(prometheus.GaugeOpts{
		Name: "router_policies_total",
		Help: "Total number of routing policies loaded",
	})

	PolicyEngineUptimeGauge = prometheus.NewGauge(prometheus.GaugeOpts{
		Name: "router_engine_uptime_seconds",
		Help: "Time since policy engine was started",
	})

	RoutingRequestsTotal = prometheus.NewCounter(prometheus.CounterOpts{
		Name: "router_routing_requests_total",
		Help: "Total number of routing requests processed",
	})

	RoutingRequestsDuration = prometheus.NewHistogram(prometheus.HistogramOpts{
		Name:    "router_routing_duration_seconds",
		Help:    "Time spent on routing decisions",
		Buckets: prometheus.DefBuckets,
	})

	PolicyUsage = prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "router_policy_usage_total",
		Help: "Total usage count per policy",
	}, []string{"policy_id"})

	ModelUsage = prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "router_model_usage_total", 
		Help: "Total usage count per model",
	}, []string{"model_id"})

	CriteriaScore = prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "router_criteria_score",
		Help:    "Score for each selection criterion",
		Buckets: []float64{0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0},
	}, []string{"criterion"})
)

// Initialize metrics (should be called from package init)
func init() {
	prometheus.MustRegister(PoliciesGauge)
	prometheus.MustRegister(PolicyEngineUptimeGauge)
	prometheus.MustRegister(RoutingRequestsTotal)
	prometheus.MustRegister(RoutingRequestsDuration)
	prometheus.MustRegister(PolicyUsage)
	prometheus.MustRegister(ModelUsage)
	prometheus.MustRegister(CriteriaScore)
}
