package logger

import (
	"io"
	"os"
	"time"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

var Logger zerolog.Logger

// Initialize sets up the global logger
func Initialize(level, format string) {
	// Parse log level
	logLevel, err := zerolog.ParseLevel(level)
	if err != nil {
		logLevel = zerolog.InfoLevel
	}

	zerolog.SetGlobalLevel(logLevel)

	// Configure output format
	var output io.Writer
	if format == "json" {
		output = os.Stdout
	} else {
		// Pretty console output for development
		output = zerolog.ConsoleWriter{
			Out:        os.Stdout,
			TimeFormat: time.RFC3339,
		}
	}

	Logger = zerolog.New(output).
		Level(logLevel).
		With().
		Timestamp().
		Caller().
		Logger()

	// Set as global logger
	log.Logger = Logger
}

// Get returns the global logger instance
func Get() *zerolog.Logger {
	return &Logger
}

// WithContext returns a logger with added context fields
func WithContext(fields map[string]interface{}) *zerolog.Logger {
	ctx := Logger.With()
	for k, v := range fields {
		ctx = ctx.Interface(k, v)
	}
	logger := ctx.Logger()
	return &logger
}
