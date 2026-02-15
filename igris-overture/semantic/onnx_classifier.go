//go:build onnx
package semantic

import (
	"context"
	"errors"
	"fmt"
	"math"
	"os"
	"sync"
	"time"

	ort "github.com/yalue/onnxruntime_go"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// ONNXClassifier implements ML-based semantic classification using ONNX Runtime
type ONNXClassifier struct {
	session         *ort.AdvancedSession
	tokenizer       *SimpleTokenizer
	classes         []string
	confidenceThreshold float64
	shadowMode      bool // If true, compare with keyword classifier but don't use for routing

	// Metrics
	inferenceLatency prometheus.Histogram
	confidence       prometheus.Gauge
	fallbacks        prometheus.Counter
	shadowMismatches prometheus.Counter

	mu sync.RWMutex
}

// SimpleTokenizer provides basic tokenization (simplified version - production should use HuggingFace tokenizer)
type SimpleTokenizer struct {
	vocabSize int
	maxLength int
}

// ONNXConfig holds configuration for the ONNX classifier
type ONNXConfig struct {
	ModelPath           string
	ConfidenceThreshold float64
	ShadowMode          bool
	MaxLength           int
}

// NewONNXClassifier initializes the ONNX-based classifier
func NewONNXClassifier(config ONNXConfig) (*ONNXClassifier, error) {
	// Initialize ONNX Runtime
	if err := ort.InitializeEnvironment(); err != nil {
		return nil, fmt.Errorf("failed to initialize ONNX runtime: %w", err)
	}

	// Check if model file exists
	if _, err := os.Stat(config.ModelPath); os.IsNotExist(err) {
		return nil, fmt.Errorf("model file not found: %s", config.ModelPath)
	}

	// Load ONNX session
	session, err := ort.NewAdvancedSession(config.ModelPath,
		[]string{"input_ids", "attention_mask"},
		[]string{"logits"},
		nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create ONNX session: %w", err)
	}

	// Initialize tokenizer
	tokenizer := &SimpleTokenizer{
		vocabSize: 30522, // DistilBERT vocab size
		maxLength: config.MaxLength,
	}

	// Define semantic classes
	classes := []string{
		"code_generation",
		"question_answering",
		"translation",
		"summarization",
		"creative_writing",
		"data_analysis",
		"conversational",
		"default",
	}

	classifier := &ONNXClassifier{
		session:             session,
		tokenizer:           tokenizer,
		classes:             classes,
		confidenceThreshold: config.ConfidenceThreshold,
		shadowMode:          config.ShadowMode,
	}

	// Initialize Prometheus metrics
	classifier.initMetrics()

	return classifier, nil
}

// initMetrics initializes Prometheus metrics
func (c *ONNXClassifier) initMetrics() {
	c.inferenceLatency = promauto.NewHistogram(prometheus.HistogramOpts{
		Name:    "igris_semantic_model_inference_latency_ms",
		Help:    "ONNX model inference latency in milliseconds",
		Buckets: prometheus.ExponentialBuckets(1, 2, 10), // 1ms to 512ms
	})

	c.confidence = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "igris_semantic_model_confidence",
		Help: "ONNX model classification confidence score",
	})

	c.fallbacks = promauto.NewCounter(prometheus.CounterOpts{
		Name: "igris_semantic_model_fallbacks_total",
		Help: "Total number of fallbacks to keyword classifier",
	})

	c.shadowMismatches = promauto.NewCounter(prometheus.CounterOpts{
		Name: "igris_semantic_shadow_mismatches_total",
		Help: "Total mismatches between ONNX and keyword classifiers in shadow mode",
	})
}

// Classify performs semantic classification using the ONNX model
func (c *ONNXClassifier) Classify(ctx context.Context, prompt string) (*ClassificationResult, error) {
	start := time.Now()

	// Tokenize input
	inputIDs, attentionMask, err := c.tokenizer.Tokenize(prompt)
	if err != nil {
		return nil, fmt.Errorf("tokenization failed: %w", err)
	}

	// Prepare ONNX inputs
	inputTensor, err := ort.NewTensor(ort.NewShape(1, int64(len(inputIDs))), inputIDs)
	if err != nil {
		return nil, fmt.Errorf("failed to create input tensor: %w", err)
	}
	defer inputTensor.Destroy()

	maskTensor, err := ort.NewTensor(ort.NewShape(1, int64(len(attentionMask))), attentionMask)
	if err != nil {
		return nil, fmt.Errorf("failed to create mask tensor: %w", err)
	}
	defer maskTensor.Destroy()

	// Run inference
	outputs, err := c.session.Run([]ort.ArbitraryTensor{inputTensor, maskTensor})
	if err != nil {
		return nil, fmt.Errorf("ONNX inference failed: %w", err)
	}
	defer outputs[0].Destroy()

	// Extract logits
	logits := outputs[0].GetData().([]float32)

	// Apply softmax to get probabilities
	probabilities := softmax(logits)

	// Find predicted class and confidence
	predictedIdx, maxProb := argmax(probabilities)

	// Calculate latency
	latency := time.Since(start)
	c.inferenceLatency.Observe(float64(latency.Milliseconds()))
	c.confidence.Set(float64(maxProb))

	// Check confidence threshold
	if maxProb < c.confidenceThreshold {
		c.fallbacks.Inc()
		return nil, errors.New("confidence below threshold")
	}

	// Build result
	result := &ClassificationResult{
		Class:             c.classes[predictedIdx],
		Confidence:        float64(maxProb),
		LatencyMs:         latency.Milliseconds(),
		CacheHit:          false, // ONNX inference is always a cache miss
		PromptHash:        "",
		ClassifierVersion: "onnx-v1",
	}

	// Add alternative classes
	for i, prob := range probabilities {
		if i != predictedIdx && prob > 0.1 { // Only include if >10% probability
			result.AlternativeClasses = append(result.AlternativeClasses, AlternativeClass{
				Class:      c.classes[i],
				Confidence: float64(prob),
			})
		}
	}

	return result, nil
}

// ClassifyWithComparison runs both ONNX and keyword classifiers for shadow mode validation
func (c *ONNXClassifier) ClassifyWithComparison(ctx context.Context, prompt string, keywordClassifier *Classifier) (*ClassificationResult, error) {
	// Run ONNX classifier
	onnxResult, onnxErr := c.Classify(ctx, prompt)

	// Run keyword classifier
	keywordResult, keywordErr := keywordClassifier.Classify(ctx, prompt)

	// If ONNX failed, fall back to keyword
	if onnxErr != nil {
		c.fallbacks.Inc()
		return keywordResult, keywordErr
	}

	// If in shadow mode, compare results but return keyword result
	if c.shadowMode {
		if keywordErr == nil && onnxResult.Class != keywordResult.Class {
			c.shadowMismatches.Inc()
			// Log mismatch for analysis (in production, send to monitoring)
			fmt.Printf("Shadow mode mismatch: ONNX=%s (%.2f) vs Keyword=%s (%.2f)
",
				onnxResult.Class, onnxResult.Confidence,
				keywordResult.Class, keywordResult.Confidence)
		}
		return keywordResult, nil // Return keyword result in shadow mode
	}

	// If not in shadow mode, return ONNX result
	return onnxResult, nil
}

// Close cleans up ONNX resources
func (c *ONNXClassifier) Close() error {
	if c.session != nil {
		if err := c.session.Destroy(); err != nil {
			return fmt.Errorf("failed to destroy ONNX session: %w", err)
		}
	}
	return ort.DestroyEnvironment()
}

// Tokenize converts text to input IDs and attention mask (simplified implementation)
// Production should use HuggingFace tokenizer library
func (t *SimpleTokenizer) Tokenize(text string) ([]int64, []int64, error) {
	// Simplified tokenization - in production, use proper BERT tokenizer
	// For now, we'll create dummy inputs that match the expected shape

	inputIDs := make([]int64, t.maxLength)
	attentionMask := make([]int64, t.maxLength)

	// Simple word-level tokenization (placeholder)
	words := tokenizeSimple(text)

	// Convert to IDs (very simplified - real tokenizer uses WordPiece)
	for i := 0; i < len(words) && i < t.maxLength-2; i++ {
		// Hash word to vocab ID (placeholder)
		inputIDs[i+1] = int64(hashString(words[i]) % t.vocabSize)
		attentionMask[i+1] = 1
	}

	// Add [CLS] token at start
	inputIDs[0] = 101 // [CLS] token ID
	attentionMask[0] = 1

	// Add [SEP] token
	sepIdx := min(len(words)+1, t.maxLength-1)
	inputIDs[sepIdx] = 102 // [SEP] token ID
	attentionMask[sepIdx] = 1

	return inputIDs, attentionMask, nil
}

// Helper functions

func softmax(logits []float32) []float32 {
	probs := make([]float32, len(logits))
	maxLogit := float32(math.Inf(-1))

	// Find max for numerical stability
	for _, l := range logits {
		if l > maxLogit {
			maxLogit = l
		}
	}

	// Compute exp and sum
	var sum float32
	for i, l := range logits {
		probs[i] = float32(math.Exp(float64(l - maxLogit)))
		sum += probs[i]
	}

	// Normalize
	for i := range probs {
		probs[i] /= sum
	}

	return probs
}

func argmax(values []float32) (int, float32) {
	maxIdx := 0
	maxVal := values[0]

	for i, v := range values {
		if v > maxVal {
			maxIdx = i
			maxVal = v
		}
	}

	return maxIdx, maxVal
}

func tokenizeSimple(text string) []string {
	// Very simple whitespace tokenization
	// Production should use proper tokenizer
	words := []string{}
	word := ""

	for _, ch := range text {
		if ch == ' ' || ch == '
' || ch == '	' {
			if word != "" {
				words = append(words, word)
				word = ""
			}
		} else {
			word += string(ch)
		}
	}

	if word != "" {
		words = append(words, word)
	}

	return words
}

func hashString(s string) int {
	hash := 0
	for _, ch := range s {
		hash = hash*31 + int(ch)
	}
	if hash < 0 {
		hash = -hash
	}
	return hash
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// ClassificationResult and AlternativeClass are defined in classifier.go
