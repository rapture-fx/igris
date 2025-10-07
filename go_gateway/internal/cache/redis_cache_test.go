package cache

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
)

func setupMockRedis(t *testing.T) (*miniredis.Miniredis, *PredictionCache) {
	// Create mock Redis server
	mr, err := miniredis.Run()
	if err != nil {
		t.Fatalf("Failed to start miniredis: %v", err)
	}

	redisURL := "redis://" + mr.Addr()
	cache, err := NewPredictionCache(redisURL, 5*time.Minute)
	if err != nil {
		mr.Close()
		t.Fatalf("Failed to create PredictionCache: %v", err)
	}

	return mr, cache
}

func TestNewPredictionCache_Success(t *testing.T) {
	mr, cache := setupMockRedis(t)
	defer mr.Close()
	defer cache.Close()

	if cache.client == nil {
		t.Error("Expected non-nil Redis client")
	}

	if cache.ttl != 5*time.Minute {
		t.Errorf("TTL = %v, want 5m", cache.ttl)
	}
}

func TestNewPredictionCache_InvalidURL(t *testing.T) {
	_, err := NewPredictionCache("invalid-redis-url", 5*time.Minute)
	if err == nil {
		t.Error("Expected error for invalid Redis URL")
	}
}

func TestNewPredictionCache_ConnectionFailure(t *testing.T) {
	// Use non-existent Redis server
	_, err := NewPredictionCache("redis://localhost:99999", 1*time.Second)
	if err == nil {
		t.Error("Expected error for connection failure")
	}
}

func TestHashFeatures(t *testing.T) {
	features1 := []float64{1.0, 2.0, 3.0}
	features2 := []float64{1.0, 2.0, 3.0}
	features3 := []float64{3.0, 2.0, 1.0}

	hash1 := hashFeatures(features1)
	hash2 := hashFeatures(features2)
	hash3 := hashFeatures(features3)

	// Same features should produce same hash
	if hash1 != hash2 {
		t.Error("Same features should produce identical hash")
	}

	// Different features should produce different hash
	if hash1 == hash3 {
		t.Error("Different features should produce different hash")
	}

	// Hash should be non-empty
	if hash1 == "" {
		t.Error("Hash should not be empty")
	}
}

func TestPredictionCache_Set_Get(t *testing.T) {
	mr, cache := setupMockRedis(t)
	defer mr.Close()
	defer cache.Close()

	ctx := context.Background()
	modelID := "test-model-v1"
	features := []float64{1.0, 2.0, 3.0, 4.0}

	prediction := &CachedPrediction{
		Prediction: 0.95,
		Confidence: 0.87,
		ModelID:    modelID,
		Metadata: map[string]string{
			"version": "1.0",
		},
	}

	// Set prediction
	err := cache.Set(ctx, modelID, features, prediction)
	if err != nil {
		t.Fatalf("Set() error = %v", err)
	}

	// Get prediction
	cached, err := cache.Get(ctx, modelID, features)
	if err != nil {
		t.Fatalf("Get() error = %v", err)
	}

	if cached == nil {
		t.Fatal("Expected non-nil cached prediction")
	}

	if cached.Prediction != 0.95 {
		t.Errorf("Prediction = %v, want 0.95", cached.Prediction)
	}

	if cached.Confidence != 0.87 {
		t.Errorf("Confidence = %v, want 0.87", cached.Confidence)
	}

	if cached.ModelID != modelID {
		t.Errorf("ModelID = %v, want %v", cached.ModelID, modelID)
	}

	if cached.Timestamp.IsZero() {
		t.Error("Timestamp should be set")
	}

	if cached.Metadata["version"] != "1.0" {
		t.Error("Metadata should be preserved")
	}
}

func TestPredictionCache_Get_CacheMiss(t *testing.T) {
	mr, cache := setupMockRedis(t)
	defer mr.Close()
	defer cache.Close()

	ctx := context.Background()
	modelID := "non-existent-model"
	features := []float64{1.0, 2.0, 3.0}

	cached, err := cache.Get(ctx, modelID, features)
	if err != nil {
		t.Fatalf("Get() error = %v", err)
	}

	if cached != nil {
		t.Error("Expected nil for cache miss")
	}
}

func TestPredictionCache_Invalidate(t *testing.T) {
	mr, cache := setupMockRedis(t)
	defer mr.Close()
	defer cache.Close()

	ctx := context.Background()
	modelID := "test-model"
	features := []float64{1.0, 2.0, 3.0}

	prediction := &CachedPrediction{
		Prediction: 0.95,
		Confidence: 0.87,
		ModelID:    modelID,
	}

	// Set prediction
	err := cache.Set(ctx, modelID, features, prediction)
	if err != nil {
		t.Fatalf("Set() error = %v", err)
	}

	// Verify it's cached
	cached, _ := cache.Get(ctx, modelID, features)
	if cached == nil {
		t.Fatal("Expected cached prediction")
	}

	// Invalidate
	err = cache.Invalidate(ctx, modelID, features)
	if err != nil {
		t.Fatalf("Invalidate() error = %v", err)
	}

	// Verify it's removed
	cached, _ = cache.Get(ctx, modelID, features)
	if cached != nil {
		t.Error("Expected nil after invalidation")
	}
}

func TestPredictionCache_InvalidateModel(t *testing.T) {
	mr, cache := setupMockRedis(t)
	defer mr.Close()
	defer cache.Close()

	ctx := context.Background()
	modelID := "test-model"

	// Set multiple predictions for the same model
	features1 := []float64{1.0, 2.0}
	features2 := []float64{3.0, 4.0}
	features3 := []float64{5.0, 6.0}

	prediction := &CachedPrediction{
		Prediction: 0.95,
		Confidence: 0.87,
		ModelID:    modelID,
	}

	_ = cache.Set(ctx, modelID, features1, prediction)
	_ = cache.Set(ctx, modelID, features2, prediction)
	_ = cache.Set(ctx, modelID, features3, prediction)

	// Verify all are cached
	cached1, _ := cache.Get(ctx, modelID, features1)
	cached2, _ := cache.Get(ctx, modelID, features2)
	if cached1 == nil || cached2 == nil {
		t.Fatal("Expected cached predictions")
	}

	// Invalidate entire model
	err := cache.InvalidateModel(ctx, modelID)
	if err != nil {
		t.Fatalf("InvalidateModel() error = %v", err)
	}

	// Verify all are removed
	cached1, _ = cache.Get(ctx, modelID, features1)
	cached2, _ = cache.Get(ctx, modelID, features2)
	cached3, _ := cache.Get(ctx, modelID, features3)

	if cached1 != nil || cached2 != nil || cached3 != nil {
		t.Error("Expected all predictions to be invalidated")
	}
}

func TestPredictionCache_DifferentModels(t *testing.T) {
	mr, cache := setupMockRedis(t)
	defer mr.Close()
	defer cache.Close()

	ctx := context.Background()
	features := []float64{1.0, 2.0, 3.0}

	// Set predictions for different models with same features
	pred1 := &CachedPrediction{
		Prediction: 0.90,
		Confidence: 0.85,
		ModelID:    "model-1",
	}

	pred2 := &CachedPrediction{
		Prediction: 0.75,
		Confidence: 0.80,
		ModelID:    "model-2",
	}

	_ = cache.Set(ctx, "model-1", features, pred1)
	_ = cache.Set(ctx, "model-2", features, pred2)

	// Get predictions for different models
	cached1, _ := cache.Get(ctx, "model-1", features)
	cached2, _ := cache.Get(ctx, "model-2", features)

	if cached1 == nil || cached2 == nil {
		t.Fatal("Expected cached predictions for both models")
	}

	if cached1.Prediction != 0.90 {
		t.Errorf("Model-1 prediction = %v, want 0.90", cached1.Prediction)
	}

	if cached2.Prediction != 0.75 {
		t.Errorf("Model-2 prediction = %v, want 0.75", cached2.Prediction)
	}
}

func TestPredictionCache_TTL(t *testing.T) {
	mr, _ := setupMockRedis(t)
	defer mr.Close()

	// Create cache with short TTL
	redisURL := "redis://" + mr.Addr()
	cache, _ := NewPredictionCache(redisURL, 100*time.Millisecond)
	defer cache.Close()

	ctx := context.Background()
	modelID := "test-model"
	features := []float64{1.0, 2.0}

	prediction := &CachedPrediction{
		Prediction: 0.95,
		Confidence: 0.87,
		ModelID:    modelID,
	}

	// Set prediction
	_ = cache.Set(ctx, modelID, features, prediction)

	// Verify it's cached immediately
	cached, _ := cache.Get(ctx, modelID, features)
	if cached == nil {
		t.Fatal("Expected cached prediction immediately after set")
	}

	// Fast-forward time in miniredis
	mr.FastForward(200 * time.Millisecond)

	// Should be expired now
	cached, _ = cache.Get(ctx, modelID, features)
	if cached != nil {
		t.Error("Expected prediction to be expired after TTL")
	}
}

func TestPredictionCache_Stats(t *testing.T) {
	mr, cache := setupMockRedis(t)
	defer mr.Close()
	defer cache.Close()

	ctx := context.Background()

	stats, err := cache.Stats(ctx)
	// miniredis doesn't support INFO command, so we expect an error
	// In real Redis, this would return stats
	if err == nil {
		if stats == nil {
			t.Fatal("Expected non-nil stats when no error")
		}

		if _, exists := stats["info"]; !exists {
			t.Error("Expected 'info' key in stats")
		}
	} else {
		// Expected for miniredis
		t.Logf("Stats() error expected with miniredis: %v", err)
	}
}

func TestPredictionCache_Close(t *testing.T) {
	mr, cache := setupMockRedis(t)
	defer mr.Close()

	err := cache.Close()
	if err != nil {
		t.Errorf("Close() error = %v", err)
	}

	// Verify connection is closed by attempting an operation
	ctx := context.Background()
	_, err = cache.Get(ctx, "test", []float64{1.0})
	if err == nil {
		t.Error("Expected error when using closed cache")
	}
}

func TestPredictionCache_ConcurrentAccess(t *testing.T) {
	mr, cache := setupMockRedis(t)
	defer mr.Close()
	defer cache.Close()

	ctx := context.Background()
	modelID := "test-model"

	// Concurrent writes
	done := make(chan bool, 10)
	for i := 0; i < 10; i++ {
		go func(idx int) {
			features := []float64{float64(idx), float64(idx + 1)}
			prediction := &CachedPrediction{
				Prediction: float64(idx) * 0.1,
				Confidence: 0.85,
				ModelID:    modelID,
			}
			_ = cache.Set(ctx, modelID, features, prediction)
			done <- true
		}(i)
	}

	// Wait for all writes
	for i := 0; i < 10; i++ {
		<-done
	}

	// Concurrent reads
	for i := 0; i < 10; i++ {
		go func(idx int) {
			features := []float64{float64(idx), float64(idx + 1)}
			_, _ = cache.Get(ctx, modelID, features)
			done <- true
		}(i)
	}

	// Wait for all reads
	for i := 0; i < 10; i++ {
		<-done
	}
}

func TestPredictionCache_ErrorHandling(t *testing.T) {
	mr, cache := setupMockRedis(t)
	defer cache.Close()

	ctx := context.Background()
	modelID := "test-model"
	features := []float64{1.0, 2.0}

	// Close miniredis to simulate connection error
	mr.Close()

	// Operations should return errors
	_, err := cache.Get(ctx, modelID, features)
	if err == nil {
		t.Error("Expected error when Redis is unavailable")
	}

	prediction := &CachedPrediction{
		Prediction: 0.95,
		Confidence: 0.87,
		ModelID:    modelID,
	}

	err = cache.Set(ctx, modelID, features, prediction)
	if err == nil {
		t.Error("Expected error when Redis is unavailable")
	}
}

func TestCachedPrediction_JSONMarshaling(t *testing.T) {
	prediction := &CachedPrediction{
		Prediction: 0.95,
		Confidence: 0.87,
		ModelID:    "test-model",
		Timestamp:  time.Now(),
		Metadata: map[string]string{
			"version": "1.0",
			"source":  "production",
		},
	}

	// Marshal to JSON
	data, err := json.Marshal(prediction)
	if err != nil {
		t.Fatalf("Marshal error = %v", err)
	}

	// Unmarshal from JSON
	var decoded CachedPrediction
	err = json.Unmarshal(data, &decoded)
	if err != nil {
		t.Fatalf("Unmarshal error = %v", err)
	}

	if decoded.Prediction != prediction.Prediction {
		t.Error("Prediction not preserved after JSON round-trip")
	}

	if decoded.Confidence != prediction.Confidence {
		t.Error("Confidence not preserved after JSON round-trip")
	}

	if decoded.ModelID != prediction.ModelID {
		t.Error("ModelID not preserved after JSON round-trip")
	}

	if decoded.Metadata["version"] != "1.0" {
		t.Error("Metadata not preserved after JSON round-trip")
	}
}
