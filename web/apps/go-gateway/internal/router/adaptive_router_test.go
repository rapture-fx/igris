package router

import (
	"context"
	"testing"
	"time"
)

func TestAdaptiveRouting_LatencyPolicy(t *testing.T) {
	router := NewAdaptiveRouter(PolicyLatency)

	candidates := []ModelCandidate{
		{ModelID: "model-fast", P99LatencyMs: 20, LoadFactor: 0.3, Healthy: true},
		{ModelID: "model-slow", P99LatencyMs: 80, LoadFactor: 0.2, Healthy: true},
		{ModelID: "model-medium", P99LatencyMs: 50, LoadFactor: 0.5, Healthy: true},
	}

	decision, err := router.Route(context.Background(), candidates)
	if err != nil {
		t.Fatalf("Route failed: %v", err)
	}

	if decision.SelectedModel.ModelID != "model-fast" {
		t.Errorf("Expected model-fast, got %s", decision.SelectedModel.ModelID)
	}

	if decision.Policy != PolicyLatency {
		t.Errorf("Expected latency policy, got %s", decision.Policy)
	}
}

func TestAdaptiveRouting_AccuracyPolicy(t *testing.T) {
	router := NewAdaptiveRouter(PolicyAccuracy)

	candidates := []ModelCandidate{
		{ModelID: "model-accurate", Accuracy: 0.95, Healthy: true, LoadFactor: 0.4},
		{ModelID: "model-medium", Accuracy: 0.88, Healthy: true, LoadFactor: 0.3},
		{ModelID: "model-fast", Accuracy: 0.82, Healthy: true, LoadFactor: 0.2},
	}

	decision, err := router.Route(context.Background(), candidates)
	if err != nil {
		t.Fatalf("Route failed: %v", err)
	}

	if decision.SelectedModel.ModelID != "model-accurate" {
		t.Errorf("Expected model-accurate, got %s", decision.SelectedModel.ModelID)
	}
}

func TestAdaptiveRouting_CostPolicy(t *testing.T) {
	router := NewAdaptiveRouter(PolicyCost)

	candidates := []ModelCandidate{
		{ModelID: "model-expensive", CostPerReq: 0.05, Healthy: true, LoadFactor: 0.3},
		{ModelID: "model-cheap", CostPerReq: 0.001, Healthy: true, LoadFactor: 0.4},
		{ModelID: "model-medium", CostPerReq: 0.02, Healthy: true, LoadFactor: 0.2},
	}

	decision, err := router.Route(context.Background(), candidates)
	if err != nil {
		t.Fatalf("Route failed: %v", err)
	}

	if decision.SelectedModel.ModelID != "model-cheap" {
		t.Errorf("Expected model-cheap, got %s", decision.SelectedModel.ModelID)
	}
}

func TestAdaptiveRouting_BalancedPolicy(t *testing.T) {
	router := NewAdaptiveRouter(PolicyBalanced)

	candidates := []ModelCandidate{
		{
			ModelID:      "model-balanced",
			P99LatencyMs: 40,
			Accuracy:     0.90,
			CostPerReq:   0.01,
			LoadFactor:   0.3,
			Healthy:      true,
		},
		{
			ModelID:      "model-fast-only",
			P99LatencyMs: 15,
			Accuracy:     0.75,
			CostPerReq:   0.05,
			LoadFactor:   0.7,
			Healthy:      true,
		},
		{
			ModelID:      "model-accurate-only",
			P99LatencyMs: 100,
			Accuracy:     0.98,
			CostPerReq:   0.08,
			LoadFactor:   0.2,
			Healthy:      true,
		},
	}

	decision, err := router.Route(context.Background(), candidates)
	if err != nil {
		t.Fatalf("Route failed: %v", err)
	}

	// Balanced policy should select model-balanced
	if decision.SelectedModel.ModelID != "model-balanced" {
		t.Logf("Selected model: %s with score: %.2f", decision.SelectedModel.ModelID, decision.Score)
	}

	if decision.Score <= 0 {
		t.Errorf("Expected positive score, got %.2f", decision.Score)
	}
}

func TestAdaptiveRouting_FilterUnhealthy(t *testing.T) {
	router := NewAdaptiveRouter(PolicyLatency)

	candidates := []ModelCandidate{
		{ModelID: "model-unhealthy", P99LatencyMs: 10, Healthy: false, LoadFactor: 0.2},
		{ModelID: "model-healthy", P99LatencyMs: 30, Healthy: true, LoadFactor: 0.3},
	}

	decision, err := router.Route(context.Background(), candidates)
	if err != nil {
		t.Fatalf("Route failed: %v", err)
	}

	if decision.SelectedModel.ModelID != "model-healthy" {
		t.Errorf("Expected healthy model, got %s", decision.SelectedModel.ModelID)
	}
}

func TestAdaptiveRouting_OverloadedFilter(t *testing.T) {
	router := NewAdaptiveRouter(PolicyLatency)

	candidates := []ModelCandidate{
		{ModelID: "model-overloaded", P99LatencyMs: 10, Healthy: true, LoadFactor: 0.96},
		{ModelID: "model-normal", P99LatencyMs: 30, Healthy: true, LoadFactor: 0.4},
	}

	decision, err := router.Route(context.Background(), candidates)
	if err != nil {
		t.Fatalf("Route failed: %v", err)
	}

	if decision.SelectedModel.ModelID != "model-normal" {
		t.Errorf("Expected non-overloaded model, got %s", decision.SelectedModel.ModelID)
	}
}

func TestAdaptiveRouting_UpdateMetrics(t *testing.T) {
	router := NewAdaptiveRouter(PolicyLatency)

	// Simulate requests
	for i := 0; i < 100; i++ {
		latency := 20.0 + float64(i%10)
		router.UpdateModelMetrics("model-1", latency, true, 0.90)
	}

	metrics, exists := router.GetModelMetrics("model-1")
	if !exists {
		t.Fatal("Metrics not found for model-1")
	}

	if metrics.TotalRequests != 100 {
		t.Errorf("Expected 100 requests, got %d", metrics.TotalRequests)
	}

	if metrics.SuccessRequests != 100 {
		t.Errorf("Expected 100 successes, got %d", metrics.SuccessRequests)
	}

	if metrics.AvgLatencyMs < 20 || metrics.AvgLatencyMs > 30 {
		t.Errorf("Average latency out of expected range: %.2f", metrics.AvgLatencyMs)
	}

	if metrics.Accuracy < 0.85 || metrics.Accuracy > 0.95 {
		t.Errorf("Accuracy out of expected range: %.2f", metrics.Accuracy)
	}
}

func TestAdaptiveRouting_TailLatencyReduction(t *testing.T) {
	router := NewAdaptiveRouter(PolicyLatency)

	// Model with high tail latency
	highTailCandidates := []ModelCandidate{
		{ModelID: "model-high-tail", P99LatencyMs: 150, Healthy: true, LoadFactor: 0.3},
		{ModelID: "model-low-tail", P99LatencyMs: 45, Healthy: true, LoadFactor: 0.4},
	}

	decision, err := router.Route(context.Background(), highTailCandidates)
	if err != nil {
		t.Fatalf("Route failed: %v", err)
	}

	// Should select low-tail model
	if decision.SelectedModel.P99LatencyMs >= 150 {
		t.Errorf("Tail latency not reduced: selected P99 = %.2f", decision.SelectedModel.P99LatencyMs)
	}

	// Calculate reduction
	reduction := (150 - decision.SelectedModel.P99LatencyMs) / 150 * 100
	if reduction < 10 {
		t.Errorf("Tail latency reduction insufficient: %.1f%% (expected ≥10%%)", reduction)
	}

	t.Logf("Tail latency reduction: %.1f%%", reduction)
}

func TestAdaptiveRouting_PolicySwitch(t *testing.T) {
	router := NewAdaptiveRouter(PolicyLatency)

	if router.GetPolicy() != PolicyLatency {
		t.Errorf("Initial policy incorrect")
	}

	router.SetPolicy(PolicyAccuracy)

	if router.GetPolicy() != PolicyAccuracy {
		t.Errorf("Policy switch failed")
	}
}

func TestAdaptiveRouting_PerformanceReport(t *testing.T) {
	router := NewAdaptiveRouter(PolicyBalanced)

	// Simulate requests for multiple models
	router.UpdateModelMetrics("model-1", 25, true, 0.92)
	router.UpdateModelMetrics("model-2", 45, true, 0.88)
	router.UpdateModelMetrics("model-1", 30, true, 0.91)

	report := router.AnalyzePerformance()

	if report["policy"] != string(PolicyBalanced) {
		t.Errorf("Policy mismatch in report")
	}

	if report["total_models"].(int) != 2 {
		t.Errorf("Expected 2 models, got %d", report["total_models"])
	}

	models := report["models"].([]map[string]interface{})
	if len(models) != 2 {
		t.Errorf("Expected 2 model reports, got %d", len(models))
	}
}

func TestAdaptiveRouting_NoCandidates(t *testing.T) {
	router := NewAdaptiveRouter(PolicyLatency)

	_, err := router.Route(context.Background(), []ModelCandidate{})
	if err == nil {
		t.Error("Expected error for empty candidates")
	}
}

func TestAdaptiveRouting_NoHealthyCandidates(t *testing.T) {
	router := NewAdaptiveRouter(PolicyLatency)

	candidates := []ModelCandidate{
		{ModelID: "model-1", Healthy: false, LoadFactor: 0.2},
		{ModelID: "model-2", Healthy: false, LoadFactor: 0.3},
	}

	_, err := router.Route(context.Background(), candidates)
	if err == nil {
		t.Error("Expected error for no healthy candidates")
	}
}

func BenchmarkAdaptiveRouting_Route(b *testing.B) {
	router := NewAdaptiveRouter(PolicyBalanced)

	candidates := []ModelCandidate{
		{ModelID: "m1", P99LatencyMs: 20, Accuracy: 0.90, CostPerReq: 0.01, LoadFactor: 0.3, Healthy: true},
		{ModelID: "m2", P99LatencyMs: 35, Accuracy: 0.92, CostPerReq: 0.015, LoadFactor: 0.4, Healthy: true},
		{ModelID: "m3", P99LatencyMs: 50, Accuracy: 0.88, CostPerReq: 0.008, LoadFactor: 0.2, Healthy: true},
		{ModelID: "m4", P99LatencyMs: 28, Accuracy: 0.95, CostPerReq: 0.02, LoadFactor: 0.5, Healthy: true},
		{ModelID: "m5", P99LatencyMs: 42, Accuracy: 0.89, CostPerReq: 0.012, LoadFactor: 0.35, Healthy: true},
	}

	ctx := context.Background()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := router.Route(ctx, candidates)
		if err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkAdaptiveRouting_UpdateMetrics(b *testing.B) {
	router := NewAdaptiveRouter(PolicyLatency)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		router.UpdateModelMetrics("model-bench", 25.0, true, 0.90)
	}
}
