package router

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"
)

func TestRoutingMetadata_BasicGeneration(t *testing.T) {
	router := NewAdaptiveRouter(PolicyLeastLatency, 5*time.Minute)

	backend := &Backend{
		ID:          "backend-1",
		URL:         "http://backend1.local",
		Type:        BackendTypeMLPython,
		Capabilities: []string{"inference"},
		MaxCapacity: 100,
		Healthy:     true,
	}
	router.RegisterBackend(backend)
	router.SetReportedMetrics(backend.ID, 100.0, 0.01, 0.01)

	// Warm up for trust verification
	for i := 0; i < 110; i++ {
		router.RecordResult(backend.ID, 100*time.Millisecond, nil)
	}

	req := &RoutingRequest{
		ModelName:     "test-model",
		UserTier:      "premium",
		Capabilities:  []string{"inference"},
		LatencyBudget: 200 * time.Millisecond,
	}

	decision, err := router.Route(context.Background(), req)
	if err != nil {
		t.Fatalf("Routing failed: %v", err)
	}

	// Verify metadata exists
	if decision.Metadata == nil {
		t.Fatal("Expected metadata to be generated")
	}

	metadata := decision.Metadata

	// Verify request identification
	if metadata.RequestID == "" {
		t.Error("Expected non-empty request ID")
	}

	if metadata.ModelName != "test-model" {
		t.Errorf("Expected model name 'test-model', got '%s'", metadata.ModelName)
	}

	if metadata.UserTier != "premium" {
		t.Errorf("Expected user tier 'premium', got '%s'", metadata.UserTier)
	}

	// Verify selection metadata
	if metadata.SelectedBackendID != backend.ID {
		t.Errorf("Expected selected backend '%s', got '%s'", backend.ID, metadata.SelectedBackendID)
	}

	if metadata.RoutingPolicy != string(PolicyLeastLatency) {
		t.Errorf("Expected routing policy '%s', got '%s'", PolicyLeastLatency, metadata.RoutingPolicy)
	}

	// Verify candidate counts
	if metadata.TotalCandidates != 1 {
		t.Errorf("Expected 1 total candidate, got %d", metadata.TotalCandidates)
	}

	if metadata.HealthyCandidates != 1 {
		t.Errorf("Expected 1 healthy candidate, got %d", metadata.HealthyCandidates)
	}

	if metadata.TrustedCandidates != 1 {
		t.Errorf("Expected 1 trusted candidate, got %d", metadata.TrustedCandidates)
	}

	// Verify candidate scores
	if len(metadata.CandidateScores) != 1 {
		t.Fatalf("Expected 1 candidate score, got %d", len(metadata.CandidateScores))
	}

	score := metadata.CandidateScores[0]
	if score.BackendID != backend.ID {
		t.Errorf("Expected candidate backend ID '%s', got '%s'", backend.ID, score.BackendID)
	}

	if !score.Healthy {
		t.Error("Expected candidate to be healthy")
	}

	if !score.Trusted {
		t.Error("Expected candidate to be trusted")
	}

	if !score.Selected {
		t.Error("Expected candidate to be selected")
	}
}

func TestRoutingMetadata_TrustFilteringMetadata(t *testing.T) {
	router := NewAdaptiveRouter(PolicyLeastLatency, 5*time.Minute)

	// Register three backends
	trustedBackend := &Backend{
		ID:          "backend-trusted",
		URL:         "http://backend-trusted.local",
		Type:        BackendTypeMLGPU,
		Capabilities: []string{"inference"},
		MaxCapacity: 100,
		Healthy:     true,
	}

	untrustedBackend1 := &Backend{
		ID:          "backend-untrusted-1",
		URL:         "http://backend-untrusted-1.local",
		Type:        BackendTypeMLCPU,
		Capabilities: []string{"inference"},
		MaxCapacity: 100,
		Healthy:     true,
	}

	untrustedBackend2 := &Backend{
		ID:          "backend-untrusted-2",
		URL:         "http://backend-untrusted-2.local",
		Type:        BackendTypeMLPython,
		Capabilities: []string{"inference"},
		MaxCapacity: 100,
		Healthy:     true,
	}

	router.RegisterBackend(trustedBackend)
	router.RegisterBackend(untrustedBackend1)
	router.RegisterBackend(untrustedBackend2)

	router.SetReportedMetrics(trustedBackend.ID, 100.0, 0.01, 0.01)
	router.SetReportedMetrics(untrustedBackend1.ID, 100.0, 0.01, 0.01)
	router.SetReportedMetrics(untrustedBackend2.ID, 100.0, 0.01, 0.01)

	// Warm up trusted backend
	for i := 0; i < 110; i++ {
		router.RecordResult(trustedBackend.ID, 100*time.Millisecond, nil)
	}

	// Leave untrusted backends with insufficient samples (cold-start block)
	for i := 0; i < 10; i++ {
		router.RecordResult(untrustedBackend1.ID, 100*time.Millisecond, nil)
		router.RecordResult(untrustedBackend2.ID, 100*time.Millisecond, nil)
	}

	req := &RoutingRequest{
		ModelName:     "test-model",
		Capabilities:  []string{"inference"},
		LatencyBudget: 200 * time.Millisecond,
	}

	decision, err := router.Route(context.Background(), req)
	if err != nil {
		t.Fatalf("Routing failed: %v", err)
	}

	// Verify trust filtering metadata
	if decision.Metadata.TrustFiltering == nil {
		t.Fatal("Expected trust filtering metadata")
	}

	trustMeta := decision.Metadata.TrustFiltering

	if trustMeta.TotalCandidates != 3 {
		t.Errorf("Expected 3 total candidates, got %d", trustMeta.TotalCandidates)
	}

	if trustMeta.TrustedCount != 1 {
		t.Errorf("Expected 1 trusted backend, got %d", trustMeta.TrustedCount)
	}

	if trustMeta.BlockedCount != 2 {
		t.Errorf("Expected 2 blocked backends, got %d", trustMeta.BlockedCount)
	}

	// Verify candidate scores show rejection reasons
	untrustedCount := 0
	for _, score := range decision.Metadata.CandidateScores {
		if !score.Trusted {
			untrustedCount++
			if score.RejectionReason != "trust verification failed" {
				t.Errorf("Expected rejection reason 'trust verification failed', got '%s'", score.RejectionReason)
			}
		}
	}

	if untrustedCount != 2 {
		t.Errorf("Expected 2 untrusted backends in scores, got %d", untrustedCount)
	}
}

func TestRoutingMetadata_ThompsonSamplingMetadata(t *testing.T) {
	router := NewAdaptiveRouter(PolicyThompsonSampling, 5*time.Minute)

	backend := &Backend{
		ID:          "backend-ts",
		URL:         "http://backend-ts.local",
		Type:        BackendTypeMLPython,
		Capabilities: []string{"inference"},
		MaxCapacity: 100,
		Healthy:     true,
	}
	router.RegisterBackend(backend)
	router.SetReportedMetrics(backend.ID, 100.0, 0.01, 0.01)

	// Warm up for trust verification
	for i := 0; i < 110; i++ {
		router.RecordResult(backend.ID, 100*time.Millisecond, nil)
	}

	req := &RoutingRequest{
		ModelName:     "test-model",
		Capabilities:  []string{"inference"},
		LatencyBudget: 200 * time.Millisecond,
	}

	decision, err := router.Route(context.Background(), req)
	if err != nil {
		t.Fatalf("Routing failed: %v", err)
	}

	// Verify Thompson Sampling metadata exists
	if decision.Metadata.ThompsonSampling == nil {
		t.Fatal("Expected Thompson Sampling metadata for Thompson Sampling policy")
	}

	tsMeta := decision.Metadata.ThompsonSampling

	if tsMeta.DecisionType == "" {
		t.Error("Expected non-empty decision type")
	}

	if tsMeta.SelectedBackendPhase == "" {
		t.Error("Expected non-empty backend phase")
	}

	if tsMeta.SelectedBackendSamples == 0 {
		t.Error("Expected non-zero backend samples")
	}

	if tsMeta.SelectedBackendAlpha <= 0 {
		t.Error("Expected positive alpha value")
	}

	if tsMeta.SelectedBackendBeta <= 0 {
		t.Error("Expected positive beta value")
	}
}

func TestRoutingMetadata_JSONSerialization(t *testing.T) {
	router := NewAdaptiveRouter(PolicyLeastLatency, 5*time.Minute)

	backend := &Backend{
		ID:          "backend-json",
		URL:         "http://backend-json.local",
		Type:        BackendTypeMLPython,
		Capabilities: []string{"inference"},
		MaxCapacity: 100,
		Healthy:     true,
	}
	router.RegisterBackend(backend)
	router.SetReportedMetrics(backend.ID, 100.0, 0.01, 0.01)

	// Warm up
	for i := 0; i < 110; i++ {
		router.RecordResult(backend.ID, 100*time.Millisecond, nil)
	}

	req := &RoutingRequest{
		ModelName:     "test-model",
		Capabilities:  []string{"inference"},
		LatencyBudget: 200 * time.Millisecond,
	}

	decision, err := router.Route(context.Background(), req)
	if err != nil {
		t.Fatalf("Routing failed: %v", err)
	}

	// Serialize to JSON
	jsonStr, err := decision.Metadata.ToJSON()
	if err != nil {
		t.Fatalf("JSON serialization failed: %v", err)
	}

	// Verify JSON is valid
	var jsonData map[string]interface{}
	if err := json.Unmarshal([]byte(jsonStr), &jsonData); err != nil {
		t.Fatalf("Invalid JSON: %v", err)
	}

	// Verify key fields exist
	if _, ok := jsonData["request_id"]; !ok {
		t.Error("JSON missing request_id field")
	}

	if _, ok := jsonData["selected_backend_id"]; !ok {
		t.Error("JSON missing selected_backend_id field")
	}

	if _, ok := jsonData["candidate_scores"]; !ok {
		t.Error("JSON missing candidate_scores field")
	}

	// Deserialize back
	metadata, err := FromJSON(jsonStr)
	if err != nil {
		t.Fatalf("JSON deserialization failed: %v", err)
	}

	if metadata.RequestID != decision.Metadata.RequestID {
		t.Errorf("Request ID mismatch after deserialization")
	}

	if metadata.ModelName != decision.Metadata.ModelName {
		t.Errorf("Model name mismatch after deserialization")
	}
}

func TestRoutingMetadata_PrettyJSON(t *testing.T) {
	router := NewAdaptiveRouter(PolicyLeastLatency, 5*time.Minute)

	backend := &Backend{
		ID:          "backend-pretty",
		URL:         "http://backend-pretty.local",
		Type:        BackendTypeMLPython,
		Capabilities: []string{"inference"},
		MaxCapacity: 100,
		Healthy:     true,
	}
	router.RegisterBackend(backend)
	router.SetReportedMetrics(backend.ID, 100.0, 0.01, 0.01)

	// Warm up
	for i := 0; i < 110; i++ {
		router.RecordResult(backend.ID, 100*time.Millisecond, nil)
	}

	req := &RoutingRequest{
		ModelName:     "test-model",
		Capabilities:  []string{"inference"},
		LatencyBudget: 200 * time.Millisecond,
	}

	decision, err := router.Route(context.Background(), req)
	if err != nil {
		t.Fatalf("Routing failed: %v", err)
	}

	// Serialize to pretty JSON
	prettyJSON, err := decision.Metadata.ToJSONPretty()
	if err != nil {
		t.Fatalf("Pretty JSON serialization failed: %v", err)
	}

	// Verify JSON is formatted (contains newlines and indentation)
	if !strings.Contains(prettyJSON, "\n") {
		t.Error("Pretty JSON should contain newlines")
	}

	if !strings.Contains(prettyJSON, "  ") {
		t.Error("Pretty JSON should contain indentation")
	}

	// Verify it's still valid JSON
	var jsonData map[string]interface{}
	if err := json.Unmarshal([]byte(prettyJSON), &jsonData); err != nil {
		t.Fatalf("Pretty JSON is invalid: %v", err)
	}
}

func TestRoutingTrace_OutcomeTracking(t *testing.T) {
	router := NewAdaptiveRouter(PolicyLeastLatency, 5*time.Minute)

	backend := &Backend{
		ID:          "backend-trace",
		URL:         "http://backend-trace.local",
		Type:        BackendTypeMLPython,
		Capabilities: []string{"inference"},
		MaxCapacity: 100,
		Healthy:     true,
	}
	router.RegisterBackend(backend)
	router.SetReportedMetrics(backend.ID, 100.0, 0.01, 0.01)

	// Warm up
	for i := 0; i < 110; i++ {
		router.RecordResult(backend.ID, 100*time.Millisecond, nil)
	}

	req := &RoutingRequest{
		ModelName:     "test-model",
		Capabilities:  []string{"inference"},
		LatencyBudget: 200 * time.Millisecond,
	}

	decision, err := router.Route(context.Background(), req)
	if err != nil {
		t.Fatalf("Routing failed: %v", err)
	}

	// Create routing trace
	trace := &RoutingTrace{
		Metadata: decision.Metadata,
	}

	// Add successful outcome
	trace.AddOutcome(true, 150.5, nil, 200, 1000, 0.02)

	if trace.RequestOutcome == nil {
		t.Fatal("Expected request outcome to be set")
	}

	outcome := trace.RequestOutcome

	if !outcome.Success {
		t.Error("Expected success outcome")
	}

	if outcome.ActualLatencyMs != 150.5 {
		t.Errorf("Expected latency 150.5ms, got %.1fms", outcome.ActualLatencyMs)
	}

	if outcome.StatusCode != 200 {
		t.Errorf("Expected status code 200, got %d", outcome.StatusCode)
	}

	if outcome.TokensUsed != 1000 {
		t.Errorf("Expected 1000 tokens, got %d", outcome.TokensUsed)
	}

	if outcome.ActualCostUSD != 0.02 {
		t.Errorf("Expected cost $0.02, got $%.4f", outcome.ActualCostUSD)
	}

	if outcome.ErrorMessage != "" {
		t.Errorf("Expected no error message, got '%s'", outcome.ErrorMessage)
	}

	// Test trace serialization
	jsonStr, err := trace.ToJSON()
	if err != nil {
		t.Fatalf("Trace JSON serialization failed: %v", err)
	}

	// Verify trace contains both metadata and outcome
	if !strings.Contains(jsonStr, "request_id") {
		t.Error("Trace JSON missing metadata")
	}

	if !strings.Contains(jsonStr, "request_outcome") {
		t.Error("Trace JSON missing outcome")
	}

	if !strings.Contains(jsonStr, "actual_latency_ms") {
		t.Error("Trace JSON missing outcome latency")
	}
}

func TestRoutingMetadata_RejectionReasons(t *testing.T) {
	router := NewAdaptiveRouter(PolicyLeastLatency, 5*time.Minute)

	// Register backends with different health/trust statuses
	healthyBackend := &Backend{
		ID:          "backend-healthy",
		URL:         "http://backend-healthy.local",
		Type:        BackendTypeMLGPU,
		Capabilities: []string{"inference"},
		MaxCapacity: 100,
		Healthy:     true,
	}

	unhealthyBackend := &Backend{
		ID:          "backend-unhealthy",
		URL:         "http://backend-unhealthy.local",
		Type:        BackendTypeMLCPU,
		Capabilities: []string{"inference"},
		MaxCapacity: 100,
		Healthy:     false, // Unhealthy
	}

	untrustedBackend := &Backend{
		ID:          "backend-untrusted",
		URL:         "http://backend-untrusted.local",
		Type:        BackendTypeMLPython,
		Capabilities: []string{"inference"},
		MaxCapacity: 100,
		Healthy:     true,
	}

	router.RegisterBackend(healthyBackend)
	router.RegisterBackend(unhealthyBackend)
	router.RegisterBackend(untrustedBackend)

	router.SetReportedMetrics(healthyBackend.ID, 100.0, 0.01, 0.01)
	router.SetReportedMetrics(untrustedBackend.ID, 100.0, 0.01, 0.01)

	// Warm up only healthy backend
	for i := 0; i < 110; i++ {
		router.RecordResult(healthyBackend.ID, 100*time.Millisecond, nil)
	}

	// Leave untrusted backend with insufficient samples
	for i := 0; i < 10; i++ {
		router.RecordResult(untrustedBackend.ID, 100*time.Millisecond, nil)
	}

	req := &RoutingRequest{
		ModelName:     "test-model",
		Capabilities:  []string{"inference"},
		LatencyBudget: 200 * time.Millisecond,
	}

	decision, err := router.Route(context.Background(), req)
	if err != nil {
		t.Fatalf("Routing failed: %v", err)
	}

	// Verify rejection reasons in candidate scores
	for _, score := range decision.Metadata.CandidateScores {
		switch score.BackendID {
		case healthyBackend.ID:
			if score.RejectionReason != "" {
				t.Errorf("Healthy backend should not have rejection reason, got '%s'", score.RejectionReason)
			}
			if !score.Selected {
				t.Error("Healthy backend should be selected")
			}

		case unhealthyBackend.ID:
			if score.RejectionReason != "unhealthy" {
				t.Errorf("Unhealthy backend should have rejection reason 'unhealthy', got '%s'", score.RejectionReason)
			}
			if score.Selected {
				t.Error("Unhealthy backend should not be selected")
			}

		case untrustedBackend.ID:
			if score.RejectionReason != "trust verification failed" {
				t.Errorf("Untrusted backend should have rejection reason 'trust verification failed', got '%s'", score.RejectionReason)
			}
			if score.Selected {
				t.Error("Untrusted backend should not be selected")
			}
		}
	}
}
