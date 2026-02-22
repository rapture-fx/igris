package lineage

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/nats-io/nats.go"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

// DataLineageTracker tracks data flow and transformations throughout the system.
// FIX-2026-02: data-lineage — added db field for durable event persistence.
type DataLineageTracker struct {
	natsConn *nats.Conn
	tracer   trace.Tracer
	db       *sql.DB // FIX-2026-02: data-lineage — non-nil enables DB persistence
}

// LineageEvent represents a single event in the data lineage
type LineageEvent struct {
	EventID       string                 `json:"event_id"`
	RequestID     string                 `json:"request_id"`
	Timestamp     time.Time              `json:"timestamp"`
	Stage         string                 `json:"stage"`
	Component     string                 `json:"component"`
	Operation     string                 `json:"operation"`
	InputSchema   string                 `json:"input_schema,omitempty"`
	OutputSchema  string                 `json:"output_schema,omitempty"`
	DataSize      int64                  `json:"data_size_bytes"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
	ParentEventID string                 `json:"parent_event_id,omitempty"`
}

// DataTransformation represents a transformation applied to data
type DataTransformation struct {
	Type        string                 `json:"type"`
	Description string                 `json:"description"`
	Parameters  map[string]interface{} `json:"parameters,omitempty"`
	Applied     bool                   `json:"applied"`
	Error       string                 `json:"error,omitempty"`
}

// FeedbackLoop represents inference feedback for model improvement
type FeedbackLoop struct {
	FeedbackID    string                 `json:"feedback_id"`
	RequestID     string                 `json:"request_id"`
	Timestamp     time.Time              `json:"timestamp"`
	ModelName     string                 `json:"model_name"`
	ModelVersion  string                 `json:"model_version"`
	PredictionID  string                 `json:"prediction_id"`
	GroundTruth   interface{}            `json:"ground_truth,omitempty"`
	UserFeedback  string                 `json:"user_feedback,omitempty"` // positive/negative/neutral
	Confidence    float64                `json:"confidence"`
	Accuracy      float64                `json:"accuracy,omitempty"`
	Latency       time.Duration          `json:"latency_ms"`
	DriftScore    float64                `json:"drift_score,omitempty"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
}

// InferenceResult stores complete inference metadata for feedback analysis
type InferenceResult struct {
	ResultID      string                 `json:"result_id"`
	RequestID     string                 `json:"request_id"`
	Timestamp     time.Time              `json:"timestamp"`
	ModelName     string                 `json:"model_name"`
	ModelVersion  string                 `json:"model_version"`
	InputData     interface{}            `json:"input_data"`
	Prediction    interface{}            `json:"prediction"`
	Confidence    float64                `json:"confidence"`
	Latency       time.Duration          `json:"latency_ms"`
	BackendID     string                 `json:"backend_id"`
	NodeID        string                 `json:"node_id,omitempty"`
	Features      map[string]interface{} `json:"features,omitempty"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
}

// NewDataLineageTracker creates a new lineage tracker (NATS only, no DB persistence).
// Existing callers remain backward-compatible.
func NewDataLineageTracker(natsURL string, tracer trace.Tracer) (*DataLineageTracker, error) {
	nc, err := nats.Connect(natsURL)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to NATS: %w", err)
	}
	return &DataLineageTracker{natsConn: nc, tracer: tracer}, nil
}

// NewDataLineageTrackerWithDB creates a lineage tracker with both NATS real-time
// publish and PostgreSQL persistence for historical trace queries.
// FIX-2026-02: data-lineage — new constructor; existing callers use NewDataLineageTracker.
func NewDataLineageTrackerWithDB(natsURL string, tracer trace.Tracer, db *sql.DB) (*DataLineageTracker, error) {
	nc, err := nats.Connect(natsURL)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to NATS: %w", err)
	}

	// FIX-2026-02: data-lineage — ensure lineage_events table exists
	if db != nil {
		if err := ensureLineageTable(db); err != nil {
			return nil, fmt.Errorf("lineage: failed to ensure DB table: %w", err)
		}
	}

	return &DataLineageTracker{natsConn: nc, tracer: tracer, db: db}, nil
}

// ensureLineageTable creates the lineage_events table if it does not exist.
// FIX-2026-02: data-lineage — idempotent schema bootstrap for the lineage package.
func ensureLineageTable(db *sql.DB) error {
	_, err := db.Exec(`
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
		)
	`)
	if err != nil {
		return fmt.Errorf("CREATE TABLE lineage_events: %w", err)
	}
	_, err = db.Exec(`CREATE INDEX IF NOT EXISTS idx_lineage_request_id ON lineage_events (request_id)`)
	return err
}

// TrackEvent records a lineage event
func (dlt *DataLineageTracker) TrackEvent(ctx context.Context, event *LineageEvent) error {
	span := trace.SpanFromContext(ctx)

	// Add lineage metadata to trace
	span.SetAttributes(
		attribute.String("lineage.event_id", event.EventID),
		attribute.String("lineage.stage", event.Stage),
		attribute.String("lineage.component", event.Component),
		attribute.String("lineage.operation", event.Operation),
		attribute.Int64("lineage.data_size", event.DataSize),
	)

	if event.InputSchema != "" {
		span.SetAttributes(attribute.String("lineage.input_schema", event.InputSchema))
	}
	if event.OutputSchema != "" {
		span.SetAttributes(attribute.String("lineage.output_schema", event.OutputSchema))
	}

	// Publish to NATS for real-time consumers
	data, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("failed to marshal lineage event: %w", err)
	}

	subject := fmt.Sprintf("lineage.events.%s", event.Stage)
	if err := dlt.natsConn.Publish(subject, data); err != nil {
		return fmt.Errorf("failed to publish lineage event: %w", err)
	}

	// FIX-2026-02: data-lineage — persist event to PostgreSQL for historical queries
	if dlt.db != nil {
		metaJSON, _ := json.Marshal(event.Metadata)
		_, dbErr := dlt.db.ExecContext(ctx, `
			INSERT INTO lineage_events
				(event_id, request_id, occurred_at, stage, component, operation,
				 input_schema, output_schema, data_size, parent_event_id, metadata)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
			ON CONFLICT (event_id) DO NOTHING
		`,
			event.EventID,
			event.RequestID,
			event.Timestamp,
			event.Stage,
			event.Component,
			event.Operation,
			event.InputSchema,
			event.OutputSchema,
			event.DataSize,
			event.ParentEventID,
			metaJSON,
		)
		if dbErr != nil {
			// Non-fatal: NATS publish already succeeded; log and continue
			span.SetAttributes(attribute.String("lineage.db_error", dbErr.Error()))
		}
	}

	return nil
}

// TrackTransformation records a data transformation
func (dlt *DataLineageTracker) TrackTransformation(ctx context.Context, requestID string, transformation *DataTransformation) error {
	span := trace.SpanFromContext(ctx)

	span.SetAttributes(
		attribute.String("transformation.type", transformation.Type),
		attribute.String("transformation.description", transformation.Description),
		attribute.Bool("transformation.applied", transformation.Applied),
	)

	// Create lineage event for transformation
	event := &LineageEvent{
		EventID:   fmt.Sprintf("%s-transform-%d", requestID, time.Now().UnixNano()),
		RequestID: requestID,
		Timestamp: time.Now(),
		Stage:     "transformation",
		Component: "rust-ffi",
		Operation: transformation.Type,
		Metadata: map[string]interface{}{
			"transformation": transformation,
		},
	}

	return dlt.TrackEvent(ctx, event)
}

// RecordInferenceResult stores inference result for feedback loop
func (dlt *DataLineageTracker) RecordInferenceResult(ctx context.Context, result *InferenceResult) error {
	span := trace.SpanFromContext(ctx)

	span.SetAttributes(
		attribute.String("inference.result_id", result.ResultID),
		attribute.String("inference.model_name", result.ModelName),
		attribute.String("inference.model_version", result.ModelVersion),
		attribute.Float64("inference.confidence", result.Confidence),
		attribute.Int64("inference.latency_ms", result.Latency.Milliseconds()),
		attribute.String("inference.backend_id", result.BackendID),
	)

	// Publish inference result
	data, err := json.Marshal(result)
	if err != nil {
		return fmt.Errorf("failed to marshal inference result: %w", err)
	}

	subject := fmt.Sprintf("inference.results.%s", result.ModelName)
	if err := dlt.natsConn.Publish(subject, data); err != nil {
		return fmt.Errorf("failed to publish inference result: %w", err)
	}

	// Also create lineage event
	event := &LineageEvent{
		EventID:   result.ResultID,
		RequestID: result.RequestID,
		Timestamp: result.Timestamp,
		Stage:     "inference",
		Component: result.BackendID,
		Operation: "predict",
		Metadata: map[string]interface{}{
			"model_name":    result.ModelName,
			"model_version": result.ModelVersion,
			"confidence":    result.Confidence,
			"latency_ms":    result.Latency.Milliseconds(),
		},
	}

	return dlt.TrackEvent(ctx, event)
}

// SubmitFeedback records user/system feedback for model improvement
func (dlt *DataLineageTracker) SubmitFeedback(ctx context.Context, feedback *FeedbackLoop) error {
	span := trace.SpanFromContext(ctx)

	span.SetAttributes(
		attribute.String("feedback.id", feedback.FeedbackID),
		attribute.String("feedback.model_name", feedback.ModelName),
		attribute.String("feedback.user_feedback", feedback.UserFeedback),
		attribute.Float64("feedback.confidence", feedback.Confidence),
		attribute.Float64("feedback.drift_score", feedback.DriftScore),
	)

	// Publish feedback
	data, err := json.Marshal(feedback)
	if err != nil {
		return fmt.Errorf("failed to marshal feedback: %w", err)
	}

	subject := fmt.Sprintf("feedback.%s", feedback.ModelName)
	if err := dlt.natsConn.Publish(subject, data); err != nil {
		return fmt.Errorf("failed to publish feedback: %w", err)
	}

	// Publish to drift detection stream if drift detected
	if feedback.DriftScore > 0.3 {
		driftSubject := "feedback.drift.detected"
		if err := dlt.natsConn.Publish(driftSubject, data); err != nil {
			return fmt.Errorf("failed to publish drift alert: %w", err)
		}
	}

	return nil
}

// GetLineageTrace retrieves the complete lineage trace for a request.
// FIX-2026-02: data-lineage — queries PostgreSQL when db is set (returns historical data).
// Falls back to the old NATS SubscribeSync path if db is nil (backward-compatible).
func (dlt *DataLineageTracker) GetLineageTrace(requestID string) ([]*LineageEvent, error) {
	if dlt.db != nil {
		return dlt.getLineageTraceFromDB(requestID)
	}
	// FIX-2026-02: data-lineage — legacy NATS path (only sees in-flight messages)
	return dlt.getLineageTraceFromNATS(requestID)
}

// getLineageTraceFromDB queries the lineage_events table for historical trace data.
// FIX-2026-02: data-lineage — replaces in-memory NATS SubscribeSync with real DB query.
func (dlt *DataLineageTracker) getLineageTraceFromDB(requestID string) ([]*LineageEvent, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	rows, err := dlt.db.QueryContext(ctx, `
		SELECT event_id, request_id, occurred_at, stage, component, operation,
		       COALESCE(input_schema, ''), COALESCE(output_schema, ''),
		       data_size, COALESCE(parent_event_id, ''), metadata
		FROM lineage_events
		WHERE request_id = $1
		ORDER BY occurred_at ASC
	`, requestID)
	if err != nil {
		return nil, fmt.Errorf("lineage DB query failed: %w", err)
	}
	defer rows.Close()

	var events []*LineageEvent
	for rows.Next() {
		var e LineageEvent
		var metaJSON []byte
		if err := rows.Scan(
			&e.EventID, &e.RequestID, &e.Timestamp, &e.Stage, &e.Component,
			&e.Operation, &e.InputSchema, &e.OutputSchema,
			&e.DataSize, &e.ParentEventID, &metaJSON,
		); err != nil {
			continue
		}
		if len(metaJSON) > 0 {
			_ = json.Unmarshal(metaJSON, &e.Metadata)
		}
		events = append(events, &e)
	}
	return events, rows.Err()
}

// getLineageTraceFromNATS is the original implementation using SubscribeSync.
// FIX-2026-02: data-lineage — retained for backward-compatibility when db is nil.
func (dlt *DataLineageTracker) getLineageTraceFromNATS(requestID string) ([]*LineageEvent, error) {
	subject := fmt.Sprintf("lineage.events.*.%s", requestID)

	sub, err := dlt.natsConn.SubscribeSync(subject)
	if err != nil {
		return nil, fmt.Errorf("failed to subscribe: %w", err)
	}
	defer sub.Unsubscribe()

	var events []*LineageEvent
	timeout := time.After(2 * time.Second)

	for {
		select {
		case <-timeout:
			return events, nil
		default:
			msg, err := sub.NextMsg(100 * time.Millisecond)
			if err != nil {
				return events, nil
			}
			var event LineageEvent
			if err := json.Unmarshal(msg.Data, &event); err != nil {
				continue
			}
			events = append(events, &event)
		}
	}
}

// AnalyzeDrift analyzes model drift based on recent feedback
func (dlt *DataLineageTracker) AnalyzeDrift(modelName string, window time.Duration) (*DriftAnalysis, error) {
	// Subscribe to recent feedback for this model
	subject := fmt.Sprintf("feedback.%s", modelName)

	sub, err := dlt.natsConn.SubscribeSync(subject)
	if err != nil {
		return nil, fmt.Errorf("failed to subscribe: %w", err)
	}
	defer sub.Unsubscribe()

	var feedbacks []*FeedbackLoop
	cutoff := time.Now().Add(-window)
	timeout := time.After(1 * time.Second)

	for {
		select {
		case <-timeout:
			goto analyze
		default:
			msg, err := sub.NextMsg(100 * time.Millisecond)
			if err != nil {
				goto analyze
			}

			var feedback FeedbackLoop
			if err := json.Unmarshal(msg.Data, &feedback); err != nil {
				continue
			}

			if feedback.Timestamp.After(cutoff) {
				feedbacks = append(feedbacks, &feedback)
			}
		}
	}

analyze:
	if len(feedbacks) == 0 {
		return &DriftAnalysis{
			ModelName:    modelName,
			WindowStart:  cutoff,
			WindowEnd:    time.Now(),
			SampleCount:  0,
			DriftScore:   0,
			Recommendation: "Insufficient data",
		}, nil
	}

	// Calculate drift metrics
	totalDrift := 0.0
	positiveCount := 0
	negativeCount := 0
	avgConfidence := 0.0

	for _, fb := range feedbacks {
		totalDrift += fb.DriftScore
		avgConfidence += fb.Confidence

		switch fb.UserFeedback {
		case "positive":
			positiveCount++
		case "negative":
			negativeCount++
		}
	}

	avgDrift := totalDrift / float64(len(feedbacks))
	avgConfidence /= float64(len(feedbacks))
	feedbackRatio := 0.0
	if positiveCount+negativeCount > 0 {
		feedbackRatio = float64(negativeCount) / float64(positiveCount+negativeCount)
	}

	// Determine recommendation
	recommendation := "Model stable"
	if avgDrift > 0.5 {
		recommendation = "CRITICAL: High drift detected - retrain model immediately"
	} else if avgDrift > 0.3 {
		recommendation = "WARNING: Moderate drift - schedule retraining"
	} else if feedbackRatio > 0.3 {
		recommendation = "WARNING: High negative feedback rate - investigate model quality"
	}

	return &DriftAnalysis{
		ModelName:       modelName,
		WindowStart:     cutoff,
		WindowEnd:       time.Now(),
		SampleCount:     len(feedbacks),
		DriftScore:      avgDrift,
		AvgConfidence:   avgConfidence,
		PositiveFeedback: positiveCount,
		NegativeFeedback: negativeCount,
		FeedbackRatio:   feedbackRatio,
		Recommendation:  recommendation,
	}, nil
}

type DriftAnalysis struct {
	ModelName        string    `json:"model_name"`
	WindowStart      time.Time `json:"window_start"`
	WindowEnd        time.Time `json:"window_end"`
	SampleCount      int       `json:"sample_count"`
	DriftScore       float64   `json:"drift_score"`
	AvgConfidence    float64   `json:"avg_confidence"`
	PositiveFeedback int       `json:"positive_feedback"`
	NegativeFeedback int       `json:"negative_feedback"`
	FeedbackRatio    float64   `json:"feedback_ratio"`
	Recommendation   string    `json:"recommendation"`
}

// Close shuts down the lineage tracker
func (dlt *DataLineageTracker) Close() {
	dlt.natsConn.Close()
}

// Helper function to create standardized event IDs
func GenerateEventID(requestID, stage string) string {
	return fmt.Sprintf("%s-%s-%d", requestID, stage, time.Now().UnixNano())
}

// Helper function to extract schema from data
func ExtractSchema(data interface{}) string {
	// Simplified schema extraction - in production use JSON Schema
	dataType := fmt.Sprintf("%T", data)
	return dataType
}
