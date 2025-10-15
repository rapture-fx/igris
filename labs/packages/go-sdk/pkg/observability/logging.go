package observability

import (
	"context"
	"io"
	"os"
	"strings"

	"github.com/sirupsen/logrus"
	"go.opentelemetry.io/otel/trace"
)

// Logger wraps logrus with additional functionality for the SDK
type Logger struct {
	*logrus.Logger
	serviceName    string
	serviceVersion string
}

// NewLogger creates a new logger instance
func NewLogger(serviceName, serviceVersion, level string, enableJSON bool) (*Logger, error) {
	logger := logrus.New()

	// Set log level
	logLevel, err := logrus.ParseLevel(strings.ToLower(level))
	if err != nil {
		logLevel = logrus.InfoLevel
	}
	logger.SetLevel(logLevel)

	// Set formatter
	if enableJSON {
		logger.SetFormatter(&logrus.JSONFormatter{
			TimestampFormat: "2006-01-02T15:04:05.000Z07:00",
			FieldMap: logrus.FieldMap{
				logrus.FieldKeyTime:  "timestamp",
				logrus.FieldKeyLevel: "level",
				logrus.FieldKeyMsg:   "message",
				logrus.FieldKeyFunc:  "caller",
			},
		})
	} else {
		logger.SetFormatter(&logrus.TextFormatter{
			FullTimestamp:   true,
			TimestampFormat: "2006-01-02T15:04:05.000Z07:00",
		})
	}

	// Set output
	logger.SetOutput(os.Stdout)

	return &Logger{
		Logger:         logger,
		serviceName:    serviceName,
		serviceVersion: serviceVersion,
	}, nil
}

// SetOutput sets the logger output
func (l *Logger) SetOutput(out io.Writer) {
	l.Logger.SetOutput(out)
}

// WithContext adds context information to log entries, including trace information
func (l *Logger) WithContext(ctx context.Context) *logrus.Entry {
	entry := l.WithFields(logrus.Fields{
		"service_name":    l.serviceName,
		"service_version": l.serviceVersion,
	})

	// Add trace context if available
	span := trace.SpanFromContext(ctx)
	if span.SpanContext().IsValid() {
		spanCtx := span.SpanContext()
		entry = entry.WithFields(logrus.Fields{
			"trace_id": spanCtx.TraceID().String(),
			"span_id":  spanCtx.SpanID().String(),
		})
	}

	return entry
}

// WithError adds error information to log entries
func (l *Logger) WithError(err error) *logrus.Entry {
	return l.Logger.WithError(err).WithFields(logrus.Fields{
		"service_name":    l.serviceName,
		"service_version": l.serviceVersion,
	})
}

// WithFields adds custom fields to log entries
func (l *Logger) WithFields(fields map[string]interface{}) *logrus.Entry {
	logrusFields := make(logrus.Fields)
	for k, v := range fields {
		logrusFields[k] = v
	}
	logrusFields["service_name"] = l.serviceName
	logrusFields["service_version"] = l.serviceVersion
	
	return l.Logger.WithFields(logrusFields)
}

// WithComponent adds component information to log entries
func (l *Logger) WithComponent(component string) *logrus.Entry {
	return l.WithFields(map[string]interface{}{
		"component": component,
	})
}

// WithRequest adds HTTP request information to log entries
func (l *Logger) WithRequest(method, path, userAgent string, statusCode int, duration float64) *logrus.Entry {
	return l.WithFields(map[string]interface{}{
		"http_method":        method,
		"http_path":          path,
		"http_user_agent":    userAgent,
		"http_status_code":   statusCode,
		"http_duration_ms":   duration,
		"component":          "http_client",
	})
}

// WithJob adds job information to log entries
func (l *Logger) WithJob(jobID, jobType string, status string) *logrus.Entry {
	return l.WithFields(map[string]interface{}{
		"job_id":     jobID,
		"job_type":   jobType,
		"job_status": status,
		"component":  "job_processor",
	})
}

// WithAuth adds authentication information to log entries
func (l *Logger) WithAuth(method, userID string) *logrus.Entry {
	fields := map[string]interface{}{
		"auth_method": method,
		"component":   "authentication",
	}
	if userID != "" {
		fields["user_id"] = userID
	}
	return l.WithFields(fields)
}

// WithMetrics adds metrics information to log entries
func (l *Logger) WithMetrics(metricName string, value float64, tags map[string]string) *logrus.Entry {
	fields := map[string]interface{}{
		"metric_name":  metricName,
		"metric_value": value,
		"component":    "metrics",
	}
	for k, v := range tags {
		fields["tag_"+k] = v
	}
	return l.WithFields(fields)
}

// LogAPICall logs an API call with structured information
func (l *Logger) LogAPICall(ctx context.Context, method, path string, statusCode int, duration float64, err error) {
	entry := l.WithContext(ctx).WithRequest(method, path, "", statusCode, duration)
	
	if err != nil {
		entry.WithError(err).Error("API call failed")
	} else if statusCode >= 400 {
		entry.Warn("API call returned error status")
	} else {
		entry.Info("API call completed")
	}
}

// LogJobProgress logs job progress information
func (l *Logger) LogJobProgress(ctx context.Context, jobID, jobType string, status string, progress float64) {
	l.WithContext(ctx).WithJob(jobID, jobType, status).WithFields(map[string]interface{}{
		"progress": progress,
	}).Info("Job progress update")
}

// LogAuthentication logs authentication events
func (l *Logger) LogAuthentication(ctx context.Context, method, userID string, success bool, err error) {
	entry := l.WithContext(ctx).WithAuth(method, userID)
	
	if err != nil {
		entry.WithError(err).Error("Authentication failed")
	} else if success {
		entry.Info("Authentication successful")
	} else {
		entry.Warn("Authentication rejected")
	}
}

// LogCircuitBreakerEvent logs circuit breaker state changes
func (l *Logger) LogCircuitBreakerEvent(ctx context.Context, name string, from, to string) {
	l.WithContext(ctx).WithFields(map[string]interface{}{
		"circuit_breaker_name": name,
		"from_state":          from,
		"to_state":            to,
		"component":           "circuit_breaker",
	}).Warn("Circuit breaker state changed")
}

// LogRetryAttempt logs retry attempts
func (l *Logger) LogRetryAttempt(ctx context.Context, operation string, attempt int, maxAttempts int, err error) {
	entry := l.WithContext(ctx).WithFields(map[string]interface{}{
		"operation":     operation,
		"attempt":       attempt,
		"max_attempts":  maxAttempts,
		"component":     "retry_handler",
	})
	
	if err != nil {
		entry.WithError(err).Warn("Retry attempt failed")
	} else {
		entry.Info("Retry attempt succeeded")
	}
}

// LogConfiguration logs configuration changes or issues
func (l *Logger) LogConfiguration(ctx context.Context, configType, action string, details map[string]interface{}) {
	fields := map[string]interface{}{
		"config_type": configType,
		"action":      action,
		"component":   "configuration",
	}
	for k, v := range details {
		fields[k] = v
	}
	
	l.WithContext(ctx).WithFields(fields).Info("Configuration event")
}

// LogHealthCheck logs health check results
func (l *Logger) LogHealthCheck(ctx context.Context, checkName string, healthy bool, duration float64, err error) {
	entry := l.WithContext(ctx).WithFields(map[string]interface{}{
		"health_check_name": checkName,
		"healthy":          healthy,
		"duration_ms":      duration,
		"component":        "health_check",
	})
	
	if err != nil {
		entry.WithError(err).Error("Health check failed")
	} else if !healthy {
		entry.Warn("Health check unhealthy")
	} else {
		entry.Debug("Health check passed")
	}
}

// LogWebSocketEvent logs WebSocket events
func (l *Logger) LogWebSocketEvent(ctx context.Context, event, channel string, messageType string) {
	l.WithContext(ctx).WithFields(map[string]interface{}{
		"websocket_event":        event,
		"websocket_channel":      channel,
		"websocket_message_type": messageType,
		"component":              "websocket",
	}).Info("WebSocket event")
}

// LogRateLimit logs rate limiting events
func (l *Logger) LogRateLimit(ctx context.Context, operation string, allowed bool, remaining int, resetTime int64) {
	entry := l.WithContext(ctx).WithFields(map[string]interface{}{
		"operation":             operation,
		"rate_limit_allowed":    allowed,
		"rate_limit_remaining":  remaining,
		"rate_limit_reset_time": resetTime,
		"component":             "rate_limiter",
	})
	
	if allowed {
		entry.Debug("Rate limit check passed")
	} else {
		entry.Warn("Rate limit exceeded")
	}
}

// LogCacheEvent logs cache events
func (l *Logger) LogCacheEvent(ctx context.Context, operation, key string, hit bool, duration float64) {
	l.WithContext(ctx).WithFields(map[string]interface{}{
		"cache_operation": operation,
		"cache_key":       key,
		"cache_hit":       hit,
		"duration_ms":     duration,
		"component":       "cache",
	}).Debug("Cache event")
}

// LogSecurityEvent logs security-related events
func (l *Logger) LogSecurityEvent(ctx context.Context, eventType, userID, details string, severity string) {
	l.WithContext(ctx).WithFields(map[string]interface{}{
		"security_event_type": eventType,
		"user_id":            userID,
		"details":            details,
		"severity":           severity,
		"component":          "security",
	}).Warn("Security event")
}

// GetLevel returns the current log level
func (l *Logger) GetLevel() logrus.Level {
	return l.Logger.GetLevel()
}

// SetLevel sets the log level
func (l *Logger) SetLevel(level string) error {
	logLevel, err := logrus.ParseLevel(strings.ToLower(level))
	if err != nil {
		return err
	}
	l.Logger.SetLevel(logLevel)
	return nil
}

// IsDebugEnabled checks if debug logging is enabled
func (l *Logger) IsDebugEnabled() bool {
	return l.Logger.GetLevel() >= logrus.DebugLevel
}

// IsTraceEnabled checks if trace logging is enabled
func (l *Logger) IsTraceEnabled() bool {
	return l.Logger.GetLevel() >= logrus.TraceLevel
}