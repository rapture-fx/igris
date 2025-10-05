package analytics

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// FeedbackType represents the type of feedback
type FeedbackType string

const (
	FeedbackCorrect   FeedbackType = "correct"
	FeedbackIncorrect FeedbackType = "incorrect"
	FeedbackPositive  FeedbackType = "positive"
	FeedbackNegative  FeedbackType = "negative"
	FeedbackNeutral   FeedbackType = "neutral"
)

// Feedback represents user feedback on a prediction
type Feedback struct {
	FeedbackID    string       `json:"feedback_id"`
	RequestID     string       `json:"request_id"`
	ModelID       string       `json:"model_id"`
	ModelVersion  string       `json:"model_version"`
	Type          FeedbackType `json:"type"`
	UserID        string       `json:"user_id,omitempty"`
	Timestamp     time.Time    `json:"timestamp"`
	LatencyMs     float64      `json:"latency_ms,omitempty"`
	Prediction    interface{}  `json:"prediction"`
	GroundTruth   interface{}  `json:"ground_truth,omitempty"`
	Comment       string       `json:"comment,omitempty"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
}

// FeedbackStats tracks aggregated feedback statistics
type FeedbackStats struct {
	ModelID         string
	TotalFeedback   int64
	CorrectCount    int64
	IncorrectCount  int64
	PositiveCount   int64
	NegativeCount   int64
	NeutralCount    int64
	AverageLatency  float64
	AccuracyRate    float64
	SatisfactionRate float64
	LastUpdated     time.Time
}

// FeedbackCollector manages feedback collection and aggregation
type FeedbackCollector struct {
	feedbackStore map[string]*Feedback
	stats         map[string]*FeedbackStats
	storeMutex    sync.RWMutex
	statsMutex    sync.RWMutex

	// Metrics
	feedbackTotal *prometheus.CounterVec
	accuracyGauge *prometheus.GaugeVec
	satisfactionGauge *prometheus.GaugeVec
	feedbackLatency *prometheus.HistogramVec
}

// NewFeedbackCollector creates a new feedback collector
func NewFeedbackCollector() *FeedbackCollector {
	return &FeedbackCollector{
		feedbackStore: make(map[string]*Feedback),
		stats:         make(map[string]*FeedbackStats),
		feedbackTotal: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "feedback_total",
				Help: "Total feedback submissions by model and type",
			},
			[]string{"model_id", "type"},
		),
		accuracyGauge: promauto.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "feedback_accuracy_rate",
				Help: "Model accuracy based on feedback",
			},
			[]string{"model_id"},
		),
		satisfactionGauge: promauto.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "feedback_satisfaction_rate",
				Help: "User satisfaction rate based on feedback",
			},
			[]string{"model_id"},
		),
		feedbackLatency: promauto.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "feedback_submission_latency_ms",
				Help:    "Latency of feedback submission",
				Buckets: []float64{1, 5, 10, 25, 50, 100, 250, 500},
			},
			[]string{"model_id"},
		),
	}
}

// SubmitFeedback records user feedback
func (fc *FeedbackCollector) SubmitFeedback(ctx context.Context, feedback *Feedback) error {
	start := time.Now()

	if feedback.FeedbackID == "" {
		feedback.FeedbackID = generateFeedbackID()
	}

	if feedback.Timestamp.IsZero() {
		feedback.Timestamp = time.Now()
	}

	// Validate feedback
	if err := fc.validateFeedback(feedback); err != nil {
		return fmt.Errorf("invalid feedback: %w", err)
	}

	// Store feedback
	fc.storeMutex.Lock()
	fc.feedbackStore[feedback.FeedbackID] = feedback
	fc.storeMutex.Unlock()

	// Update statistics
	fc.updateStats(feedback)

	// Record metrics
	fc.feedbackTotal.WithLabelValues(feedback.ModelID, string(feedback.Type)).Inc()
	fc.feedbackLatency.WithLabelValues(feedback.ModelID).Observe(float64(time.Since(start).Milliseconds()))

	return nil
}

// GetFeedback retrieves feedback by ID
func (fc *FeedbackCollector) GetFeedback(feedbackID string) (*Feedback, bool) {
	fc.storeMutex.RLock()
	defer fc.storeMutex.RUnlock()

	feedback, exists := fc.feedbackStore[feedbackID]
	return feedback, exists
}

// GetModelStats retrieves aggregated statistics for a model
func (fc *FeedbackCollector) GetModelStats(modelID string) (*FeedbackStats, bool) {
	fc.statsMutex.RLock()
	defer fc.statsMutex.RUnlock()

	stats, exists := fc.stats[modelID]
	return stats, exists
}

// GetAllStats retrieves all model statistics
func (fc *FeedbackCollector) GetAllStats() map[string]*FeedbackStats {
	fc.statsMutex.RLock()
	defer fc.statsMutex.RUnlock()

	// Return a copy to avoid race conditions
	statsCopy := make(map[string]*FeedbackStats)
	for k, v := range fc.stats {
		statsCopy[k] = v
	}
	return statsCopy
}

// validateFeedback validates feedback data
func (fc *FeedbackCollector) validateFeedback(feedback *Feedback) error {
	if feedback.ModelID == "" {
		return fmt.Errorf("model_id is required")
	}

	if feedback.RequestID == "" {
		return fmt.Errorf("request_id is required")
	}

	validTypes := map[FeedbackType]bool{
		FeedbackCorrect:   true,
		FeedbackIncorrect: true,
		FeedbackPositive:  true,
		FeedbackNegative:  true,
		FeedbackNeutral:   true,
	}

	if !validTypes[feedback.Type] {
		return fmt.Errorf("invalid feedback type: %s", feedback.Type)
	}

	return nil
}

// updateStats updates aggregated statistics
func (fc *FeedbackCollector) updateStats(feedback *Feedback) {
	fc.statsMutex.Lock()
	defer fc.statsMutex.Unlock()

	stats, exists := fc.stats[feedback.ModelID]
	if !exists {
		stats = &FeedbackStats{
			ModelID: feedback.ModelID,
		}
		fc.stats[feedback.ModelID] = stats
	}

	stats.TotalFeedback++

	switch feedback.Type {
	case FeedbackCorrect:
		stats.CorrectCount++
	case FeedbackIncorrect:
		stats.IncorrectCount++
	case FeedbackPositive:
		stats.PositiveCount++
	case FeedbackNegative:
		stats.NegativeCount++
	case FeedbackNeutral:
		stats.NeutralCount++
	}

	// Update accuracy rate
	if stats.CorrectCount+stats.IncorrectCount > 0 {
		stats.AccuracyRate = float64(stats.CorrectCount) / float64(stats.CorrectCount+stats.IncorrectCount)
		fc.accuracyGauge.WithLabelValues(feedback.ModelID).Set(stats.AccuracyRate)
	}

	// Update satisfaction rate
	if stats.PositiveCount+stats.NegativeCount+stats.NeutralCount > 0 {
		satisfactionScore := float64(stats.PositiveCount) - float64(stats.NegativeCount)
		total := float64(stats.PositiveCount + stats.NegativeCount + stats.NeutralCount)
		stats.SatisfactionRate = (satisfactionScore / total + 1) / 2 // Normalize to 0-1
		fc.satisfactionGauge.WithLabelValues(feedback.ModelID).Set(stats.SatisfactionRate)
	}

	// Update average latency
	if feedback.LatencyMs > 0 {
		currentTotal := stats.AverageLatency * float64(stats.TotalFeedback-1)
		stats.AverageLatency = (currentTotal + feedback.LatencyMs) / float64(stats.TotalFeedback)
	}

	stats.LastUpdated = time.Now()
}

// ExportFeedback exports feedback data for a model
func (fc *FeedbackCollector) ExportFeedback(modelID string, startTime, endTime time.Time) ([]*Feedback, error) {
	fc.storeMutex.RLock()
	defer fc.storeMutex.RUnlock()

	var feedbackList []*Feedback

	for _, fb := range fc.feedbackStore {
		if fb.ModelID == modelID &&
			fb.Timestamp.After(startTime) &&
			fb.Timestamp.Before(endTime) {
			feedbackList = append(feedbackList, fb)
		}
	}

	return feedbackList, nil
}

// ExportFeedbackJSON exports feedback data as JSON
func (fc *FeedbackCollector) ExportFeedbackJSON(modelID string, startTime, endTime time.Time) ([]byte, error) {
	feedbackList, err := fc.ExportFeedback(modelID, startTime, endTime)
	if err != nil {
		return nil, err
	}

	return json.MarshalIndent(feedbackList, "", "  ")
}

// GenerateReport generates a comprehensive feedback report
func (fc *FeedbackCollector) GenerateReport() map[string]interface{} {
	fc.statsMutex.RLock()
	defer fc.statsMutex.RUnlock()

	report := make(map[string]interface{})
	report["timestamp"] = time.Now()
	report["total_models"] = len(fc.stats)

	var totalFeedback int64
	var avgAccuracy float64
	var avgSatisfaction float64

	models := make([]map[string]interface{}, 0)

	for modelID, stats := range fc.stats {
		modelReport := map[string]interface{}{
			"model_id":          modelID,
			"total_feedback":    stats.TotalFeedback,
			"correct_count":     stats.CorrectCount,
			"incorrect_count":   stats.IncorrectCount,
			"positive_count":    stats.PositiveCount,
			"negative_count":    stats.NegativeCount,
			"neutral_count":     stats.NeutralCount,
			"accuracy_rate":     stats.AccuracyRate,
			"satisfaction_rate": stats.SatisfactionRate,
			"average_latency":   stats.AverageLatency,
			"last_updated":      stats.LastUpdated,
		}

		models = append(models, modelReport)
		totalFeedback += stats.TotalFeedback
		avgAccuracy += stats.AccuracyRate
		avgSatisfaction += stats.SatisfactionRate
	}

	if len(fc.stats) > 0 {
		avgAccuracy /= float64(len(fc.stats))
		avgSatisfaction /= float64(len(fc.stats))
	}

	report["total_feedback"] = totalFeedback
	report["average_accuracy"] = avgAccuracy
	report["average_satisfaction"] = avgSatisfaction
	report["models"] = models

	return report
}

// PurgeFeedback removes feedback older than the specified duration
func (fc *FeedbackCollector) PurgeFeedback(olderThan time.Duration) int {
	fc.storeMutex.Lock()
	defer fc.storeMutex.Unlock()

	cutoff := time.Now().Add(-olderThan)
	purged := 0

	for id, fb := range fc.feedbackStore {
		if fb.Timestamp.Before(cutoff) {
			delete(fc.feedbackStore, id)
			purged++
		}
	}

	return purged
}

// generateFeedbackID generates a unique feedback ID
func generateFeedbackID() string {
	return fmt.Sprintf("fb_%d", time.Now().UnixNano())
}
