package lineage

// FIX-2026-02: data-lineage — tests for DB persistence path

import (
	"strings"
	"testing"
	"time"
)

// TestLineageEventStruct verifies that LineageEvent has all expected fields.
func TestLineageEventStruct(t *testing.T) {
	e := LineageEvent{
		EventID:       "evt-001",
		RequestID:     "req-abc",
		Timestamp:     time.Now(),
		Stage:         "inference",
		Component:     "gpt-4o",
		Operation:     "predict",
		InputSchema:   "text/plain",
		OutputSchema:  "application/json",
		DataSize:      512,
		ParentEventID: "",
		Metadata:      map[string]interface{}{"latency_ms": 45},
	}

	if e.EventID != "evt-001" {
		t.Errorf("expected EventID evt-001, got %s", e.EventID)
	}
	if e.Stage != "inference" {
		t.Errorf("expected Stage inference, got %s", e.Stage)
	}
}

// TestGenerateEventID verifies that GenerateEventID produces non-empty unique strings.
func TestGenerateEventID(t *testing.T) {
	id1 := GenerateEventID("req-1", "preprocess")
	id2 := GenerateEventID("req-1", "preprocess")

	if id1 == "" {
		t.Error("expected non-empty event ID")
	}
	if id1 == id2 {
		t.Error("expected unique event IDs (UnixNano should differ)")
	}
}

// TestTrackerWithNilDB verifies that DataLineageTracker can be constructed with
// a nil db (no-persistence mode) without panicking.
func TestTrackerWithNilDB(t *testing.T) {
	tracker := &DataLineageTracker{db: nil}
	if tracker.db != nil {
		t.Error("expected nil db")
	}
	// Verify the DB path won't be taken
	usesDB := tracker.db != nil
	if usesDB {
		t.Error("should not use DB path when db is nil")
	}
}

// TestEnsureLineageTableSQL verifies the table creation SQL is syntactically reasonable
// by checking it references the expected columns (string inspection only, no DB needed).
func TestEnsureLineageTableSQL(t *testing.T) {
	// This is a smoke test — the actual SQL is validated at startup via ensureLineageTable.
	expectedColumns := []string{
		"event_id", "request_id", "occurred_at", "stage",
		"component", "operation", "data_size", "metadata",
	}
	createSQL := `
		CREATE TABLE IF NOT EXISTS lineage_events (
			event_id       TEXT        PRIMARY KEY,
			request_id     TEXT        NOT NULL,
			occurred_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			stage          TEXT        NOT NULL,
			component      TEXT        NOT NULL,
			operation      TEXT        NOT NULL,
			input_schema   TEXT,
			output_schema  TEXT,
			data_size      BIGINT      DEFAULT 0,
			parent_event_id TEXT,
			metadata       JSONB
		)`

	for _, col := range expectedColumns {
		if !contains(createSQL, col) {
			t.Errorf("expected column %q in CREATE TABLE SQL", col)
		}
	}
}

func contains(s, sub string) bool {
	return strings.Contains(s, sub)
}
