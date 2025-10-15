package shadow

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// ComparisonLog represents a single comparison log entry
type ComparisonLog struct {
	TraceID        string         `json:"trace_id"`
	Timestamp      string         `json:"timestamp"`
	GoDecision     string         `json:"go_decision"`
	RustDecision   string         `json:"rust_decision"`
	Agreed         bool           `json:"agreed"`
	GoCostUsd      float64        `json:"go_cost_usd"`
	RustCostUsd    float64        `json:"rust_cost_usd"`
	CostDeltaUsd   float64        `json:"cost_delta_usd"`
	GoLatencyMs    int            `json:"go_latency_ms"`
	RustLatencyMs  int            `json:"rust_latency_ms"`
	LatencyDeltaMs int            `json:"latency_delta_ms"`
	Policy         string         `json:"policy"`
	Arms           []ArmSnapshot  `json:"arms,omitempty"`
}

// ArmSnapshot represents a snapshot of arm state at decision time
type ArmSnapshot struct {
	ID    string  `json:"id"`
	Alpha float64 `json:"alpha"`
	Beta  float64 `json:"beta"`
	Score float64 `json:"score"`
}

// ShadowLogger handles writing comparison logs to JSONL files with rotation
type ShadowLogger struct {
	logDir     string
	file       *os.File
	mu         sync.Mutex
	currentDay string
}

// NewShadowLogger creates a new shadow logger
func NewShadowLogger(logDir string) (*ShadowLogger, error) {
	// Ensure log directory exists
	if err := os.MkdirAll(logDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create log directory: %w", err)
	}

	logger := &ShadowLogger{
		logDir: logDir,
	}

	// Open initial log file
	if err := logger.rotateIfNeeded(); err != nil {
		return nil, fmt.Errorf("failed to initialize log file: %w", err)
	}

	return logger, nil
}

// Log writes a comparison log entry
func (l *ShadowLogger) Log(entry ComparisonLog) error {
	l.mu.Lock()
	defer l.mu.Unlock()

	// Check if rotation is needed
	if err := l.rotateIfNeeded(); err != nil {
		return fmt.Errorf("failed to rotate log: %w", err)
	}

	// Set timestamp if not already set
	if entry.Timestamp == "" {
		entry.Timestamp = time.Now().UTC().Format(time.RFC3339)
	}

	// Marshal to JSON
	data, err := json.Marshal(entry)
	if err != nil {
		return fmt.Errorf("failed to marshal log entry: %w", err)
	}

	// Write to file
	if _, err := l.file.Write(append(data, '\n')); err != nil {
		return fmt.Errorf("failed to write log entry: %w", err)
	}

	return nil
}

// rotateIfNeeded rotates the log file if the day has changed
func (l *ShadowLogger) rotateIfNeeded() error {
	today := time.Now().UTC().Format("20060102")

	if l.currentDay == today && l.file != nil {
		return nil
	}

	// Close existing file
	if l.file != nil {
		if err := l.file.Close(); err != nil {
			return fmt.Errorf("failed to close existing log file: %w", err)
		}
	}

	// Open new file for today
	filename := filepath.Join(l.logDir, fmt.Sprintf("shadow-%s.jsonl", today))
	file, err := os.OpenFile(filename, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0644)
	if err != nil {
		return fmt.Errorf("failed to open log file: %w", err)
	}

	l.file = file
	l.currentDay = today

	return nil
}

// Close closes the logger and flushes any pending writes
func (l *ShadowLogger) Close() error {
	l.mu.Lock()
	defer l.mu.Unlock()

	if l.file != nil {
		if err := l.file.Sync(); err != nil {
			return fmt.Errorf("failed to sync log file: %w", err)
		}
		if err := l.file.Close(); err != nil {
			return fmt.Errorf("failed to close log file: %w", err)
		}
		l.file = nil
	}

	return nil
}

// Sync flushes pending writes to disk
func (l *ShadowLogger) Sync() error {
	l.mu.Lock()
	defer l.mu.Unlock()

	if l.file != nil {
		return l.file.Sync()
	}

	return nil
}

// GetCurrentLogPath returns the path to the current log file
func (l *ShadowLogger) GetCurrentLogPath() string {
	l.mu.Lock()
	defer l.mu.Unlock()

	if l.currentDay == "" {
		return ""
	}

	return filepath.Join(l.logDir, fmt.Sprintf("shadow-%s.jsonl", l.currentDay))
}

// CleanupOldLogs removes log files older than the specified number of days
func (l *ShadowLogger) CleanupOldLogs(daysToKeep int) error {
	l.mu.Lock()
	defer l.mu.Unlock()

	cutoffDate := time.Now().UTC().AddDate(0, 0, -daysToKeep)

	entries, err := os.ReadDir(l.logDir)
	if err != nil {
		return fmt.Errorf("failed to read log directory: %w", err)
	}

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		// Check if it's a shadow log file
		matched, err := filepath.Match("shadow-*.jsonl", entry.Name())
		if err != nil || !matched {
			continue
		}

		info, err := entry.Info()
		if err != nil {
			continue
		}

		// Remove if older than cutoff
		if info.ModTime().Before(cutoffDate) {
			path := filepath.Join(l.logDir, entry.Name())
			if err := os.Remove(path); err != nil {
				return fmt.Errorf("failed to remove old log file %s: %w", path, err)
			}
		}
	}

	return nil
}
