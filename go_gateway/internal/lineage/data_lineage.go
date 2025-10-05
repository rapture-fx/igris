package lineage

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/nats-io/nats.go"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

// DataLineageTracker tracks data flow and transformations throughout the system
type DataLineageTracker struct {
	natsConn *nats.Conn
	tracer   trace.Tracer
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

// NewDataLineageTracker creates a new lineage tracker
func NewDataLineageTracker(natsURL string, tracer trace.Tracer) (*DataLineageTracker, error) {
	nc, err := nats.Connect(natsURL)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to NATS: %w", err)
	}

	return &DataLineageTracker{
		natsConn: nc,
		tracer:   tracer,
	}, nil
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

	// Publish to NATS for persistence
	data, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("failed to marshal lineage event: %w", err)
	}

	subject := fmt.Sprintf("lineage.events.%s", event.Stage)
	if err := dlt.natsConn.Publish(subject, data); err != nil {
		return fmt.Errorf("failed to publish lineage event: %w", err)
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

// GetLineageTrace retrieves complete lineage trace for a request
func (dlt *DataLineageTracker) GetLineageTrace(requestID string) ([]*LineageEvent, error) {
	// This would typically query a time-series database (e.g., TimescaleDB)
	// For now, we'll return from NATS JetStream if available

	// Subscribe to lineage events for this request
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
