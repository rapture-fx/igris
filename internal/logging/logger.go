package logging

import (
	"context"
	"os"
	"time"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

// TraceIDKey is the context key for trace IDs
type contextKey string

const TraceIDKey contextKey = "trace_id"

var logger zerolog.Logger

// Init initializes the structured logger
func Init(serviceName string, debug bool) {
	// Configure zerolog
	zerolog.TimeFieldFormat = time.RFC3339Nano

	// Pretty print for development
	if debug {
		logger = zerolog.New(zerolog.ConsoleWriter{Out: os.Stdout, TimeFormat: time.RFC3339}).
			With().
			Timestamp().
			Str("service", serviceName).
			Logger()
	} else {
		// JSON logging for production
		logger = zerolog.New(os.Stdout).
			With().
			Timestamp().
			Str("service", serviceName).
			Logger()
	}

	// Set global logger
	log.Logger = logger
}

// Logger returns the global logger instance
func Logger() *zerolog.Logger {
	return &logger
}

// WithTraceID returns a logger with trace_id attached
func WithTraceID(ctx context.Context) *zerolog.Logger {
	traceID := GetTraceID(ctx)
	if traceID != "" {
		l := logger.With().Str("trace_id", traceID).Logger()
		return &l
	}
	return &logger
}

// GetTraceID retrieves trace_id from context
func GetTraceID(ctx context.Context) string {
	if traceID, ok := ctx.Value(TraceIDKey).(string); ok {
		return traceID
	}
	return ""
}

// InferenceFields represents structured fields for inference logging
type InferenceFields struct {
	TraceID          string  `json:"trace_id"`
	Provider         string  `json:"provider"`
	Model            string  `json:"model"`
	LatencyMs        int64   `json:"latency_ms"`
	PromptTokens     int     `json:"prompt_tokens,omitempty"`
	CompletionTokens int     `json:"completion_tokens,omitempty"`
	TotalTokens      int     `json:"total_tokens,omitempty"`
	CostUSD          float64 `json:"cost_usd,omitempty"`
	Status           string  `json:"status"` // success, error
	ErrorMessage     string  `json:"error_message,omitempty"`
}

// LogInferenceRequest logs a structured inference request
func LogInferenceRequest(fields InferenceFields) {
	event := logger.Info().
		Str("trace_id", fields.TraceID).
		Str("provider", fields.Provider).
		Str("model", fields.Model).
		Int64("latency_ms", fields.LatencyMs).
		Str("status", fields.Status)

	if fields.PromptTokens > 0 {
		event = event.Int("prompt_tokens", fields.PromptTokens)
	}
	if fields.CompletionTokens > 0 {
		event = event.Int("completion_tokens", fields.CompletionTokens)
	}
	if fields.TotalTokens > 0 {
		event = event.Int("total_tokens", fields.TotalTokens)
	}
	if fields.CostUSD > 0 {
		event = event.Float64("cost_usd", fields.CostUSD)
	}
	if fields.ErrorMessage != "" {
		event = event.Str("error", fields.ErrorMessage)
	}

	event.Msg("inference_request_completed")
}

// LogInfo logs an info message with trace ID if available
func LogInfo(ctx context.Context, message string, fields map[string]interface{}) {
	event := WithTraceID(ctx).Info()
	for k, v := range fields {
		event = event.Interface(k, v)
	}
	event.Msg(message)
}

// LogError logs an error message with trace ID if available
func LogError(ctx context.Context, err error, message string, fields map[string]interface{}) {
	event := WithTraceID(ctx).Error().Err(err)
	for k, v := range fields {
		event = event.Interface(k, v)
	}
	event.Msg(message)
}

// LogWarn logs a warning message with trace ID if available
func LogWarn(ctx context.Context, message string, fields map[string]interface{}) {
	event := WithTraceID(ctx).Warn()
	for k, v := range fields {
		event = event.Interface(k, v)
	}
	event.Msg(message)
}

// LogDebug logs a debug message with trace ID if available
func LogDebug(ctx context.Context, message string, fields map[string]interface{}) {
	event := WithTraceID(ctx).Debug()
	for k, v := range fields {
		event = event.Interface(k, v)
	}
	event.Msg(message)
}
