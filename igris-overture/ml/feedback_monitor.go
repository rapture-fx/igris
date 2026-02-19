package ml

import (
	"context"
	"fmt"
	"log"
	"math"
	"sync"
	"sync/atomic"
	"time"

	"github.com/Igris-inertial/system/igris-overture/observability"
)

// FeedbackSignal represents telemetry feedback from an inference
type FeedbackSignal struct {
	ModelID       string
	RequestID     string
	Timestamp     time.Time
	Latency       time.Duration
	Success       bool
	Prediction    float64
	Confidence    float64
	ActualValue   *float64 // Ground truth if available
	RuntimeUsed   string
	ErrorType     string
	UserFeedback  *UserFeedback
	Metadata      map[string]interface{}
}

// UserFeedback contains optional user-provided feedback
type UserFeedback struct {
	Rating      int     // 1-5 star rating
	Helpful     bool    // Was prediction helpful
	Accuracy    float64 // User-reported accuracy (0-1)
	Comments    string
}

// DriftMetrics tracks model drift indicators
type DriftMetrics struct {
	ModelID               string
	WindowStart           time.Time
	WindowEnd             time.Time
	TotalSamples          int64
	SuccessRate           float64
	AvgLatencyMs          float64
	AvgConfidence         float64
	PredictionMean        float64
	PredictionStdDev      float64
	DriftScore            float64 // 0-1, higher = more drift
	GroundTruthAvailable  int64
	GroundTruthAccuracy   float64
	RecommendRetraining   bool
}

// ModelPerformanceUpdater is the interface FeedbackMonitor uses to record
// inference outcomes back into the routing bandit.  Satisfied by
// *core.MultiModelRouter without creating a circular import.
type ModelPerformanceUpdater interface {
	UpdateModelPerformance(modelID string, success bool, latency time.Duration)
}

// FeedbackMonitor collects and analyzes inference feedback
type FeedbackMonitor struct {
	router     ModelPerformanceUpdater

	// Signal collection
	signals        []FeedbackSignal
	signalsMutex   sync.RWMutex
	maxSignals     int

	// Drift detection
	driftWindows   map[string]*DriftWindow
	driftMutex     sync.RWMutex
	windowDuration time.Duration
	driftThreshold float64

	// Statistics
	totalSignals   int64
	alertsRaised   int64

	// Background monitoring
	ctx            context.Context
	cancel         context.CancelFunc
	wg             sync.WaitGroup
}

// DriftWindow tracks metrics within a time window
type DriftWindow struct {
	ModelID          string
	StartTime        time.Time
	EndTime          time.Time

	// Aggregated metrics
	Count            int64
	SuccessCount     int64
	LatencySum       int64
	ConfidenceSum    float64
	PredictionSum    float64
	PredictionSqSum  float64 // For std dev calculation

	// Ground truth comparison
	GroundTruthCount int64
	GroundTruthError float64

	// Baseline for drift detection
	BaselineMean     float64
	BaselineStdDev   float64

	mu               sync.RWMutex
}

// NewFeedbackMonitor creates a new feedback monitoring system
func NewFeedbackMonitor(router ModelPerformanceUpdater) *FeedbackMonitor {
	ctx, cancel := context.WithCancel(context.Background())

	monitor := &FeedbackMonitor{
		router:         router,
		signals:        make([]FeedbackSignal, 0, 10000),
		maxSignals:     10000,
		driftWindows:   make(map[string]*DriftWindow),
		windowDuration: 5 * time.Minute,
		driftThreshold: 0.15, // 15% drift triggers alert
		ctx:            ctx,
		cancel:         cancel,
	}

	// Start background monitoring
	monitor.wg.Add(1)
	go monitor.monitorLoop()

	log.Printf("[FeedbackMonitor] Started (window: %v, drift threshold: %.2f)",
		monitor.windowDuration, monitor.driftThreshold)

	return monitor
}

// RecordFeedback records an inference feedback signal
func (f *FeedbackMonitor) RecordFeedback(signal FeedbackSignal) {
	atomic.AddInt64(&f.totalSignals, 1)

	// Store signal
	f.signalsMutex.Lock()
	if len(f.signals) >= f.maxSignals {
		// Remove oldest 10%
		f.signals = f.signals[f.maxSignals/10:]
	}
	f.signals = append(f.signals, signal)
	f.signalsMutex.Unlock()

	// Update drift window
	f.updateDriftWindow(signal)

	// Update router with performance feedback
	if f.router != nil {
		f.router.UpdateModelPerformance(signal.ModelID, signal.Success, signal.Latency)
	}

	// Record telemetry metrics
	observability.RecordInferenceFeedback(
		signal.ModelID,
		signal.Success,
		signal.Latency.Milliseconds(),
		signal.Confidence,
	)
}

// updateDriftWindow updates the drift detection window
func (f *FeedbackMonitor) updateDriftWindow(signal FeedbackSignal) {
	f.driftMutex.Lock()
	defer f.driftMutex.Unlock()

	window, exists := f.driftWindows[signal.ModelID]
	if !exists || time.Since(window.StartTime) > f.windowDuration {
		// Create new window
		window = &DriftWindow{
			ModelID:   signal.ModelID,
			StartTime: time.Now(),
			EndTime:   time.Now().Add(f.windowDuration),
		}

		// Initialize baseline from previous window if exists
		if old, ok := f.driftWindows[signal.ModelID]; ok {
			window.BaselineMean = f.calculateMean(old)
			window.BaselineStdDev = f.calculateStdDev(old)
		}

		f.driftWindows[signal.ModelID] = window
	}

	// Update window statistics
	window.mu.Lock()
	defer window.mu.Unlock()

	atomic.AddInt64(&window.Count, 1)

	if signal.Success {
		atomic.AddInt64(&window.SuccessCount, 1)
	}

	atomic.AddInt64(&window.LatencySum, signal.Latency.Milliseconds())

	window.ConfidenceSum += signal.Confidence
	window.PredictionSum += signal.Prediction
	window.PredictionSqSum += signal.Prediction * signal.Prediction

	// Update ground truth if available
	if signal.ActualValue != nil {
		atomic.AddInt64(&window.GroundTruthCount, 1)
		error := math.Abs(signal.Prediction - *signal.ActualValue)
		window.GroundTruthError += error
	}
}

// AnalyzeDrift analyzes drift for a specific model
func (f *FeedbackMonitor) AnalyzeDrift(modelID string) (*DriftMetrics, error) {
	f.driftMutex.RLock()
	window, exists := f.driftWindows[modelID]
	f.driftMutex.RUnlock()

	if !exists {
		return nil, fmt.Errorf("no drift data for model %s", modelID)
	}

	window.mu.RLock()
	defer window.mu.RUnlock()

	if window.Count == 0 {
		return &DriftMetrics{ModelID: modelID}, nil
	}

	// Calculate metrics
	count := atomic.LoadInt64(&window.Count)
	successCount := atomic.LoadInt64(&window.SuccessCount)
	latencySum := atomic.LoadInt64(&window.LatencySum)

	successRate := float64(successCount) / float64(count)
	avgLatency := float64(latencySum) / float64(count)
	avgConfidence := window.ConfidenceSum / float64(count)

	predMean := f.calculateMean(window)
	predStdDev := f.calculateStdDev(window)

	// Calculate drift score
	driftScore := f.calculateDriftScore(window, predMean, predStdDev)

	// Ground truth accuracy
	var groundTruthAccuracy float64
	gtCount := atomic.LoadInt64(&window.GroundTruthCount)
	if gtCount > 0 {
		groundTruthAccuracy = 1.0 - (window.GroundTruthError / float64(gtCount))
	}

	metrics := &DriftMetrics{
		ModelID:              modelID,
		WindowStart:          window.StartTime,
		WindowEnd:            window.EndTime,
		TotalSamples:         count,
		SuccessRate:          successRate,
		AvgLatencyMs:         avgLatency,
		AvgConfidence:        avgConfidence,
		PredictionMean:       predMean,
		PredictionStdDev:     predStdDev,
		DriftScore:           driftScore,
		GroundTruthAvailable: gtCount,
		GroundTruthAccuracy:  groundTruthAccuracy,
		RecommendRetraining:  driftScore > f.driftThreshold,
	}

	// Record drift metrics
	observability.RecordDriftScore(modelID, driftScore)

	if metrics.RecommendRetraining {
		log.Printf("[FeedbackMonitor] DRIFT ALERT: Model %s (score: %.3f > threshold: %.3f)",
			modelID, driftScore, f.driftThreshold)
		atomic.AddInt64(&f.alertsRaised, 1)
		observability.RecordDriftAlert(modelID, driftScore)
	}

	return metrics, nil
}

// calculateMean calculates mean prediction value
func (f *FeedbackMonitor) calculateMean(window *DriftWindow) float64 {
	count := atomic.LoadInt64(&window.Count)
	if count == 0 {
		return 0
	}
	return window.PredictionSum / float64(count)
}

// calculateStdDev calculates standard deviation of predictions
func (f *FeedbackMonitor) calculateStdDev(window *DriftWindow) float64 {
	count := atomic.LoadInt64(&window.Count)
	if count == 0 {
		return 0
	}

	mean := f.calculateMean(window)
	variance := (window.PredictionSqSum / float64(count)) - (mean * mean)

	if variance < 0 {
		variance = 0
	}

	return math.Sqrt(variance)
}

// calculateDriftScore computes drift score based on distribution shift
func (f *FeedbackMonitor) calculateDriftScore(window *DriftWindow, currentMean, currentStdDev float64) float64 {
	// If no baseline, no drift
	if window.BaselineMean == 0 && window.BaselineStdDev == 0 {
		return 0
	}

	// Population Stability Index (PSI) approximation
	// Measures shift in distribution

	meanShift := math.Abs(currentMean - window.BaselineMean)
	stdDevShift := math.Abs(currentStdDev - window.BaselineStdDev)

	// Normalize by baseline
	normalizedMeanShift := meanShift / (math.Abs(window.BaselineMean) + 1e-6)
	normalizedStdDevShift := stdDevShift / (window.BaselineStdDev + 1e-6)

	// Combined drift score (weighted average)
	driftScore := 0.7*normalizedMeanShift + 0.3*normalizedStdDevShift

	// Clamp to [0, 1]
	if driftScore > 1.0 {
		driftScore = 1.0
	}

	return driftScore
}

// GetAllDriftMetrics returns drift metrics for all models
func (f *FeedbackMonitor) GetAllDriftMetrics() map[string]*DriftMetrics {
	f.driftMutex.RLock()
	modelIDs := make([]string, 0, len(f.driftWindows))
	for modelID := range f.driftWindows {
		modelIDs = append(modelIDs, modelID)
	}
	f.driftMutex.RUnlock()

	results := make(map[string]*DriftMetrics)
	for _, modelID := range modelIDs {
		if metrics, err := f.AnalyzeDrift(modelID); err == nil {
			results[modelID] = metrics
		}
	}

	return results
}

// GetRecentSignals returns the N most recent feedback signals
func (f *FeedbackMonitor) GetRecentSignals(n int) []FeedbackSignal {
	f.signalsMutex.RLock()
	defer f.signalsMutex.RUnlock()

	totalSignals := len(f.signals)
	if n > totalSignals {
		n = totalSignals
	}

	// Return last N signals
	start := totalSignals - n
	result := make([]FeedbackSignal, n)
	copy(result, f.signals[start:])

	return result
}

// monitorLoop runs background drift detection
func (f *FeedbackMonitor) monitorLoop() {
	defer f.wg.Done()

	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			f.performPeriodicAnalysis()
		case <-f.ctx.Done():
			return
		}
	}
}

// performPeriodicAnalysis analyzes all models periodically
func (f *FeedbackMonitor) performPeriodicAnalysis() {
	f.driftMutex.RLock()
	modelIDs := make([]string, 0, len(f.driftWindows))
	for modelID := range f.driftWindows {
		modelIDs = append(modelIDs, modelID)
	}
	f.driftMutex.RUnlock()

	for _, modelID := range modelIDs {
		_, _ = f.AnalyzeDrift(modelID)
	}
}

// GetStats returns overall feedback monitor statistics
func (f *FeedbackMonitor) GetStats() map[string]interface{} {
	f.signalsMutex.RLock()
	signalCount := len(f.signals)
	f.signalsMutex.RUnlock()

	f.driftMutex.RLock()
	windowCount := len(f.driftWindows)
	f.driftMutex.RUnlock()

	return map[string]interface{}{
		"total_signals":     atomic.LoadInt64(&f.totalSignals),
		"stored_signals":    signalCount,
		"drift_windows":     windowCount,
		"alerts_raised":     atomic.LoadInt64(&f.alertsRaised),
		"window_duration":   f.windowDuration.String(),
		"drift_threshold":   f.driftThreshold,
	}
}

// SetDriftThreshold updates the drift detection threshold
func (f *FeedbackMonitor) SetDriftThreshold(threshold float64) {
	if threshold < 0 {
		threshold = 0
	}
	if threshold > 1 {
		threshold = 1
	}
	f.driftThreshold = threshold
	log.Printf("[FeedbackMonitor] Drift threshold updated to %.3f", threshold)
}

// Shutdown gracefully shuts down the feedback monitor
func (f *FeedbackMonitor) Shutdown() {
	log.Printf("[FeedbackMonitor] Shutting down...")
	f.cancel()
	f.wg.Wait()
	log.Printf("[FeedbackMonitor] Shutdown complete")
}

// ExportSignals exports feedback signals for offline analysis
func (f *FeedbackMonitor) ExportSignals() []FeedbackSignal {
	f.signalsMutex.RLock()
	defer f.signalsMutex.RUnlock()

	result := make([]FeedbackSignal, len(f.signals))
	copy(result, f.signals)

	return result
}

// ClearSignals clears stored feedback signals (use with caution)
func (f *FeedbackMonitor) ClearSignals() {
	f.signalsMutex.Lock()
	defer f.signalsMutex.Unlock()

	f.signals = make([]FeedbackSignal, 0, f.maxSignals)
	log.Printf("[FeedbackMonitor] Signals cleared")
}
