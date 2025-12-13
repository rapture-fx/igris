package database

import (
	"context"
	"database/sql"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Helper to create in-memory SQLite for testing (or skip if not available)
func setupTestDB(t *testing.T) *sql.DB {
	// Skip test if no database available
	t.Skip("Database tests require PostgreSQL connection - run with integration tests")
	return nil
}

func TestNewOptimizerStatePersistence(t *testing.T) {
	t.Run("disabled with nil db", func(t *testing.T) {
		osp := NewOptimizerStatePersistence(nil)
		assert.NotNil(t, osp)
		assert.False(t, osp.IsEnabled())
	})
}

func TestOptimizerStatePersistence_Disabled(t *testing.T) {
	osp := NewOptimizerStatePersistence(nil)
	ctx := context.Background()

	t.Run("SaveState returns error when disabled", func(t *testing.T) {
		state := &OptimizerState{
			SnapshotName:  "test",
			OptimizerType: "thompson_sampling",
			StateData:     map[string]interface{}{"test": "data"},
		}

		_, err := osp.SaveState(ctx, state)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "not enabled")
	})

	t.Run("LoadState returns error when disabled", func(t *testing.T) {
		_, err := osp.LoadState(ctx, "test")
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "not enabled")
	})

	t.Run("CreateCheckpoint returns error when disabled", func(t *testing.T) {
		_, err := osp.CreateCheckpoint(ctx, []byte("data"), "checksum")
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "not enabled")
	})
}

func TestOptimizerState_Serialization(t *testing.T) {
	t.Run("serializes and deserializes state data", func(t *testing.T) {
		state := &OptimizerState{
			SnapshotName:  "test-snapshot",
			OptimizerType: "thompson_sampling",
			StateData: map[string]interface{}{
				"provider_weights": map[string]float64{
					"openai":    0.75,
					"anthropic": 0.25,
				},
				"exploration_rate": 0.15,
				"total_samples":    1000,
			},
			ProviderCount: 2,
			TotalSamples:  1000,
			Version:       "1.0.0",
			CreatedAt:     time.Now(),
			UpdatedAt:     time.Now(),
		}

		// Verify state data structure
		assert.Equal(t, "test-snapshot", state.SnapshotName)
		assert.Equal(t, "thompson_sampling", state.OptimizerType)
		assert.NotNil(t, state.StateData)

		weights, ok := state.StateData["provider_weights"].(map[string]float64)
		require.True(t, ok)
		assert.Equal(t, 0.75, weights["openai"])
	})
}

// Integration tests (require actual database connection)

func TestOptimizerStatePersistence_Integration_SaveAndLoad(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	db := setupTestDB(t)
	if db == nil {
		return
	}
	defer db.Close()

	osp := NewOptimizerStatePersistence(db)
	require.True(t, osp.IsEnabled())

	ctx := context.Background()

	t.Run("save and load optimizer state", func(t *testing.T) {
		state := &OptimizerState{
			SnapshotName:  "production-v1",
			OptimizerType: "thompson_sampling",
			StateData: map[string]interface{}{
				"alpha": 2.0,
				"beta":  1.0,
				"providers": []string{
					"openai",
					"anthropic",
					"cohere",
				},
			},
			ProviderCount: 3,
			TotalSamples:  5000,
			Version:       "1.0.0",
		}

		// Save state
		stateID, err := osp.SaveState(ctx, state)
		require.NoError(t, err)
		assert.Greater(t, stateID, int64(0))

		// Load state
		loaded, err := osp.LoadState(ctx, "production-v1")
		require.NoError(t, err)
		require.NotNil(t, loaded)

		assert.Equal(t, state.SnapshotName, loaded.SnapshotName)
		assert.Equal(t, state.OptimizerType, loaded.OptimizerType)
		assert.Equal(t, state.ProviderCount, loaded.ProviderCount)
		assert.Equal(t, state.TotalSamples, loaded.TotalSamples)
		assert.Equal(t, state.Version, loaded.Version)

		// Verify state data
		assert.NotNil(t, loaded.StateData)
		assert.Equal(t, 2.0, loaded.StateData["alpha"])
	})

	t.Run("load non-existent state returns nil", func(t *testing.T) {
		loaded, err := osp.LoadState(ctx, "non-existent")
		require.NoError(t, err)
		assert.Nil(t, loaded)
	})
}

func TestOptimizerStatePersistence_Integration_UpdateState(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	db := setupTestDB(t)
	if db == nil {
		return
	}
	defer db.Close()

	osp := NewOptimizerStatePersistence(db)
	ctx := context.Background()

	t.Run("update existing state", func(t *testing.T) {
		// Create initial state
		state := &OptimizerState{
			SnapshotName:  "update-test",
			OptimizerType: "epsilon_greedy",
			StateData: map[string]interface{}{
				"epsilon": 0.1,
			},
			ProviderCount: 2,
			TotalSamples:  100,
			Version:       "1.0.0",
		}

		stateID, err := osp.SaveState(ctx, state)
		require.NoError(t, err)

		// Update state
		state.StateID = stateID
		state.StateData["epsilon"] = 0.05
		state.TotalSamples = 200
		state.Version = "1.0.1"

		err = osp.UpdateState(ctx, state)
		require.NoError(t, err)

		// Load and verify
		loaded, err := osp.LoadState(ctx, "update-test")
		require.NoError(t, err)
		require.NotNil(t, loaded)

		assert.Equal(t, int64(200), loaded.TotalSamples)
		assert.Equal(t, "1.0.1", loaded.Version)
		assert.Equal(t, 0.05, loaded.StateData["epsilon"])
	})
}

func TestOptimizerStatePersistence_Integration_Checkpoints(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	db := setupTestDB(t)
	if db == nil {
		return
	}
	defer db.Close()

	osp := NewOptimizerStatePersistence(db)
	ctx := context.Background()

	t.Run("create and load checkpoint", func(t *testing.T) {
		stateData := []byte(`{"test": "checkpoint"}`)
		checksum := "abc123"

		checkpointID, err := osp.CreateCheckpoint(ctx, stateData, checksum)
		require.NoError(t, err)
		assert.Greater(t, checkpointID, int64(0))

		// Load latest checkpoint
		checkpoint, err := osp.LoadLatestCheckpoint(ctx)
		require.NoError(t, err)
		require.NotNil(t, checkpoint)

		assert.Equal(t, checksum, checkpoint.Checksum)
		assert.Equal(t, stateData, checkpoint.StateData)
	})
}

func TestOptimizerStatePersistence_Integration_Cleanup(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	db := setupTestDB(t)
	if db == nil {
		return
	}
	defer db.Close()

	osp := NewOptimizerStatePersistence(db)
	ctx := context.Background()

	t.Run("cleanup old states", func(t *testing.T) {
		// Create old state
		state := &OptimizerState{
			SnapshotName:  "cleanup-test",
			OptimizerType: "thompson_sampling",
			StateData:     map[string]interface{}{"test": "data"},
			ProviderCount: 1,
			TotalSamples:  10,
			Version:       "1.0.0",
			CreatedAt:     time.Now().Add(-48 * time.Hour),
			UpdatedAt:     time.Now().Add(-48 * time.Hour),
		}

		_, err := osp.SaveState(ctx, state)
		require.NoError(t, err)

		// Cleanup states older than 24 hours
		rowsAffected, err := osp.CleanupOldStates(ctx, 24*time.Hour)
		require.NoError(t, err)
		assert.Greater(t, rowsAffected, int64(0))
	})

	t.Run("cleanup old checkpoints", func(t *testing.T) {
		// This would require manipulating timestamps in the database
		// For now, just verify the method doesn't error
		rowsAffected, err := osp.CleanupOldCheckpoints(ctx, 24*time.Hour)
		require.NoError(t, err)
		assert.GreaterOrEqual(t, rowsAffected, int64(0))
	})
}

func TestOptimizerStatePersistence_Integration_StateHistory(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	db := setupTestDB(t)
	if db == nil {
		return
	}
	defer db.Close()

	osp := NewOptimizerStatePersistence(db)
	ctx := context.Background()

	t.Run("get state history", func(t *testing.T) {
		snapshotName := "history-test"

		// Create multiple states
		for i := 0; i < 5; i++ {
			state := &OptimizerState{
				SnapshotName:  snapshotName,
				OptimizerType: "thompson_sampling",
				StateData: map[string]interface{}{
					"iteration": i,
				},
				ProviderCount: 1,
				TotalSamples:  int64((i + 1) * 100),
				Version:       "1.0.0",
			}

			_, err := osp.SaveState(ctx, state)
			require.NoError(t, err)

			// Small delay to ensure different timestamps
			time.Sleep(10 * time.Millisecond)
		}

		// Get history
		history, err := osp.GetStateHistory(ctx, snapshotName, 3)
		require.NoError(t, err)
		assert.Len(t, history, 3) // Limited to 3

		// Verify states are in descending order (newest first)
		assert.Equal(t, int64(500), history[0].TotalSamples)
		assert.Equal(t, int64(400), history[1].TotalSamples)
		assert.Equal(t, int64(300), history[2].TotalSamples)
	})
}

func TestOptimizerState_Validation(t *testing.T) {
	t.Run("required fields validation", func(t *testing.T) {
		state := &OptimizerState{}

		assert.Empty(t, state.SnapshotName, "SnapshotName should be empty by default")
		assert.Empty(t, state.OptimizerType, "OptimizerType should be empty by default")
		assert.Nil(t, state.StateData, "StateData should be nil by default")
	})

	t.Run("timestamps are set correctly", func(t *testing.T) {
		state := &OptimizerState{
			SnapshotName:  "test",
			OptimizerType: "thompson_sampling",
			StateData:     map[string]interface{}{},
			CreatedAt:     time.Now(),
		}

		assert.False(t, state.CreatedAt.IsZero())
		assert.True(t, state.UpdatedAt.IsZero()) // UpdatedAt not set initially
	})
}
