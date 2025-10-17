package models

import (
	"context"
	"os"
	"testing"
	"time"
)

func TestModelReloader_LoadModel(t *testing.T) {
	store := NewInMemoryStore()
	registry := NewModelRegistry(store)
	reloader := NewModelReloader(registry)

	tmpFile, _ := os.CreateTemp("", "test_model_*.pkl")
	defer os.Remove(tmpFile.Name())
	tmpFile.WriteString("test model content")
	tmpFile.Close()

	metadata := &ModelMetadata{
		ModelID:  "test_model",
		Version:  "1.0.0",
		LoadPath: tmpFile.Name(),
	}

	registry.Register(metadata)

	// Load model
	err := reloader.LoadModel("test_model")
	if err != nil {
		t.Fatalf("Failed to load model: %v", err)
	}

	// Verify model is loaded
	loaded, err := reloader.GetLoadedModel("test_model")
	if err != nil {
		t.Fatalf("Failed to get loaded model: %v", err)
	}

	if loaded.Metadata.ModelID != "test_model" {
		t.Errorf("Expected model_id 'test_model', got '%s'", loaded.Metadata.ModelID)
	}

	// Verify status is active
	meta, _ := registry.Get("test_model")
	if meta.Status != StatusActive {
		t.Errorf("Expected status 'active', got '%s'", meta.Status)
	}
}

func TestModelReloader_UnloadModel(t *testing.T) {
	store := NewInMemoryStore()
	registry := NewModelRegistry(store)
	reloader := NewModelReloader(registry)

	tmpFile, _ := os.CreateTemp("", "test_model_*.pkl")
	defer os.Remove(tmpFile.Name())
	tmpFile.WriteString("test")
	tmpFile.Close()

	metadata := &ModelMetadata{
		ModelID:  "test_model",
		Version:  "1.0.0",
		LoadPath: tmpFile.Name(),
	}

	registry.Register(metadata)
	reloader.LoadModel("test_model")

	// Unload model
	err := reloader.UnloadModel("test_model")
	if err != nil {
		t.Fatalf("Failed to unload model: %v", err)
	}

	// Verify model is unloaded
	_, err = reloader.GetLoadedModel("test_model")
	if err == nil {
		t.Error("Expected error when getting unloaded model")
	}

	// Verify status is deprecated
	meta, _ := registry.Get("test_model")
	if meta.Status != StatusDeprecated {
		t.Errorf("Expected status 'deprecated', got '%s'", meta.Status)
	}
}

func TestModelReloader_UnloadWithInFlightRequests(t *testing.T) {
	store := NewInMemoryStore()
	registry := NewModelRegistry(store)
	reloader := NewModelReloader(registry)
	reloader.reloadTimeout = 2 * time.Second // Shorter timeout for testing

	tmpFile, _ := os.CreateTemp("", "test_model_*.pkl")
	defer os.Remove(tmpFile.Name())
	tmpFile.Close()

	metadata := &ModelMetadata{
		ModelID:  "test_model",
		Version:  "1.0.0",
		LoadPath: tmpFile.Name(),
	}

	registry.Register(metadata)
	reloader.LoadModel("test_model")

	// Simulate in-flight requests
	reloader.IncrementInFlight("test_model")
	reloader.IncrementInFlight("test_model")

	// Try to unload (should wait for in-flight to complete)
	done := make(chan error)
	go func() {
		done <- reloader.UnloadModel("test_model")
	}()

	// Wait a bit, then complete requests
	time.Sleep(500 * time.Millisecond)
	reloader.DecrementInFlight("test_model")
	reloader.DecrementInFlight("test_model")

	// Unload should complete now
	select {
	case err := <-done:
		if err != nil {
			t.Fatalf("Failed to unload model: %v", err)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("Unload timed out")
	}
}

func TestModelReloader_ReloadModel(t *testing.T) {
	store := NewInMemoryStore()
	registry := NewModelRegistry(store)
	reloader := NewModelReloader(registry)

	tmpFile, _ := os.CreateTemp("", "test_model_*.pkl")
	defer os.Remove(tmpFile.Name())
	tmpFile.WriteString("version 1.0")
	tmpFile.Close()

	metadata := &ModelMetadata{
		ModelID:  "test_model",
		Version:  "1.0.0",
		LoadPath: tmpFile.Name(),
	}

	registry.Register(metadata)
	reloader.LoadModel("test_model")

	// Hot reload to version 2.0
	err := reloader.ReloadModel("test_model", "2.0.0")
	if err != nil {
		t.Fatalf("Failed to reload model: %v", err)
	}

	// Verify new version is loaded
	loaded, _ := reloader.GetLoadedModel("test_model")
	if loaded.Metadata.Version != "2.0.0" {
		t.Errorf("Expected version '2.0.0', got '%s'", loaded.Metadata.Version)
	}
}

func TestModelReloader_ReloadWithChecksumFailure(t *testing.T) {
	store := NewInMemoryStore()
	registry := NewModelRegistry(store)
	reloader := NewModelReloader(registry)

	tmpFile, _ := os.CreateTemp("", "test_model_*.pkl")
	defer os.Remove(tmpFile.Name())
	tmpFile.WriteString("version 1.0")
	tmpFile.Close()

	metadata := &ModelMetadata{
		ModelID:  "test_model",
		Version:  "1.0.0",
		LoadPath: tmpFile.Name(),
	}

	registry.Register(metadata)
	reloader.LoadModel("test_model")

	// Corrupt the file
	tmpFile, _ = os.OpenFile(tmpFile.Name(), os.O_WRONLY|os.O_TRUNC, 0644)
	tmpFile.WriteString("corrupted")
	tmpFile.Close()

	// Reload should fail due to checksum mismatch
	err := reloader.ReloadModel("test_model", "2.0.0")
	if err == nil {
		t.Error("Expected reload to fail due to checksum mismatch")
	}

	// Verify original version is still loaded
	loaded, _ := reloader.GetLoadedModel("test_model")
	if loaded.Metadata.Version != "1.0.0" {
		t.Errorf("Expected rollback to version '1.0.0', got '%s'", loaded.Metadata.Version)
	}
}

func TestModelReloader_Subscribe(t *testing.T) {
	store := NewInMemoryStore()
	registry := NewModelRegistry(store)
	reloader := NewModelReloader(registry)

	tmpFile, _ := os.CreateTemp("", "test_model_*.pkl")
	defer os.Remove(tmpFile.Name())
	tmpFile.Close()

	metadata := &ModelMetadata{
		ModelID:  "test_model",
		Version:  "1.0.0",
		LoadPath: tmpFile.Name(),
	}

	registry.Register(metadata)

	// Subscribe to events
	eventChan := reloader.Subscribe("test_subscriber")
	defer reloader.Unsubscribe("test_subscriber")

	// Load model (should trigger event)
	go func() {
		time.Sleep(100 * time.Millisecond)
		reloader.LoadModel("test_model")
	}()

	// Wait for event
	select {
	case event := <-eventChan:
		if event.ModelID != "test_model" {
			t.Errorf("Expected model_id 'test_model', got '%s'", event.ModelID)
		}
		if event.Action != "load" {
			t.Errorf("Expected action 'load', got '%s'", event.Action)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("Timeout waiting for load event")
	}
}

func TestModelReloader_WatchModelUpdates(t *testing.T) {
	store := NewInMemoryStore()
	registry := NewModelRegistry(store)
	reloader := NewModelReloader(registry)

	tmpFile, _ := os.CreateTemp("", "test_model_*.pkl")
	defer os.Remove(tmpFile.Name())
	tmpFile.Close()

	metadata := &ModelMetadata{
		ModelID:  "test_model",
		Version:  "1.0.0",
		LoadPath: tmpFile.Name(),
	}

	registry.Register(metadata)

	// Create context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Watch updates
	eventChan, err := reloader.WatchModelUpdates(ctx, "watcher_1")
	if err != nil {
		t.Fatalf("Failed to watch updates: %v", err)
	}

	// Trigger load event
	go func() {
		time.Sleep(100 * time.Millisecond)
		reloader.LoadModel("test_model")
	}()

	// Receive event
	select {
	case event := <-eventChan:
		if event.Action != "load" {
			t.Errorf("Expected action 'load', got '%s'", event.Action)
		}
	case <-ctx.Done():
		t.Fatal("Context cancelled before receiving event")
	}
}

func TestModelReloader_ConcurrentReloads(t *testing.T) {
	store := NewInMemoryStore()
	registry := NewModelRegistry(store)
	reloader := NewModelReloader(registry)

	tmpFile, _ := os.CreateTemp("", "test_model_*.pkl")
	defer os.Remove(tmpFile.Name())
	tmpFile.Close()

	// Register multiple models
	for i := 1; i <= 3; i++ {
		metadata := &ModelMetadata{
			ModelID:  fmt.Sprintf("model_%d", i),
			Version:  "1.0.0",
			LoadPath: tmpFile.Name(),
		}
		registry.Register(metadata)
	}

	// Load models concurrently
	done := make(chan error, 3)
	for i := 1; i <= 3; i++ {
		go func(id int) {
			modelID := fmt.Sprintf("model_%d", id)
			done <- reloader.LoadModel(modelID)
		}(i)
	}

	// Wait for all loads
	for i := 0; i < 3; i++ {
		if err := <-done; err != nil {
			t.Errorf("Concurrent load failed: %v", err)
		}
	}

	// Verify all models are loaded
	loaded := reloader.ListLoadedModels()
	if len(loaded) != 3 {
		t.Errorf("Expected 3 loaded models, got %d", len(loaded))
	}
}

func TestModelReloader_Stats(t *testing.T) {
	store := NewInMemoryStore()
	registry := NewModelRegistry(store)
	reloader := NewModelReloader(registry)

	tmpFile, _ := os.CreateTemp("", "test_model_*.pkl")
	defer os.Remove(tmpFile.Name())
	tmpFile.Close()

	// Register and load model
	metadata := &ModelMetadata{
		ModelID:  "test_model",
		Version:  "1.0.0",
		LoadPath: tmpFile.Name(),
	}

	registry.Register(metadata)
	reloader.LoadModel("test_model")

	// Subscribe
	reloader.Subscribe("sub_1")
	reloader.Subscribe("sub_2")

	stats := reloader.Stats()

	if stats.LoadedModels != 1 {
		t.Errorf("Expected 1 loaded model, got %d", stats.LoadedModels)
	}

	if stats.ActiveSubscribers != 2 {
		t.Errorf("Expected 2 active subscribers, got %d", stats.ActiveSubscribers)
	}
}

func BenchmarkModelReloader_LoadModel(b *testing.B) {
	store := NewInMemoryStore()
	registry := NewModelRegistry(store)
	reloader := NewModelReloader(registry)

	tmpFile, _ := os.CreateTemp("", "bench_model_*.pkl")
	defer os.Remove(tmpFile.Name())
	tmpFile.Close()

	// Pre-register models
	for i := 0; i < b.N; i++ {
		metadata := &ModelMetadata{
			ModelID:  fmt.Sprintf("model_%d", i),
			Version:  "1.0.0",
			LoadPath: tmpFile.Name(),
		}
		registry.Register(metadata)
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		reloader.LoadModel(fmt.Sprintf("model_%d", i))
	}
}

func BenchmarkModelReloader_IncrementDecrement(b *testing.B) {
	store := NewInMemoryStore()
	registry := NewModelRegistry(store)
	reloader := NewModelReloader(registry)

	tmpFile, _ := os.CreateTemp("", "bench_model_*.pkl")
	defer os.Remove(tmpFile.Name())
	tmpFile.Close()

	metadata := &ModelMetadata{
		ModelID:  "bench_model",
		Version:  "1.0.0",
		LoadPath: tmpFile.Name(),
	}

	registry.Register(metadata)
	reloader.LoadModel("bench_model")

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		reloader.IncrementInFlight("bench_model")
		reloader.DecrementInFlight("bench_model")
	}
}
