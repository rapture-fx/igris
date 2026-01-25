package semantic

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/Igris-inertial/system/igris-overture/observability"
)

// Classifier performs semantic classification of prompts
type Classifier struct {
	version          string
	classes          map[string]*SemanticClass
	defaultClass     string
	cache            ClassificationCache
	mu               sync.RWMutex
	minConfidence    float64
	enableCache      bool
	cacheDB          ClassificationDB // Database persistence
}

// SemanticClass represents a classification category
type SemanticClass struct {
	Name             string
	DisplayName      string
	Description      string
	Keywords         []string
	Patterns         []string
	MinConfidence    float64
	Weight           float64 // Weight for scoring when multiple matches
}

// ClassificationResult contains the result of prompt classification
type ClassificationResult struct {
	Class            string
	Confidence       float64
	LatencyMs        int64
	CacheHit         bool
	PromptHash       string
	ClassifierVersion string
	AlternativeClasses []AlternativeClass
}

// AlternativeClass represents an alternative classification with lower confidence
type AlternativeClass struct {
	Class      string
	Confidence float64
}

// ClassificationCache interface for caching classifications
type ClassificationCache interface {
	Get(ctx context.Context, promptHash string) (*ClassificationResult, error)
	Set(ctx context.Context, promptHash string, result *ClassificationResult, ttl time.Duration) error
}

// ClassificationDB interface for database persistence
type ClassificationDB interface {
	Save(ctx context.Context, promptHash, promptPreview, class string, confidence float64, latencyMs int64, cacheHit bool) error
	GetStats(ctx context.Context, class string) (totalClassifications int, avgConfidence float64, err error)
}

// NewClassifier creates a new semantic classifier
func NewClassifier(cache ClassificationCache, db ClassificationDB) *Classifier {
	c := &Classifier{
		version:       "v1.0",
		classes:       make(map[string]*SemanticClass),
		defaultClass:  "default",
		cache:         cache,
		cacheDB:       db,
		minConfidence: 0.5,
		enableCache:   true,
	}

	// Initialize with default semantic classes
	c.initializeDefaultClasses()

	return c
}

// initializeDefaultClasses loads the default semantic classification categories
func (c *Classifier) initializeDefaultClasses() {
	c.classes = map[string]*SemanticClass{
		"code_generation": {
			Name:          "code_generation",
			DisplayName:   "Code Generation",
			Description:   "Generate code snippets, functions, or complete programs",
			Keywords:      []string{"code", "function", "implement", "write", "generate", "program", "script", "class", "method", "api", "algorithm"},
			MinConfidence: 0.7,
			Weight:        1.0,
		},
		"question_answering": {
			Name:          "question_answering",
			DisplayName:   "Question Answering",
			Description:   "Answer factual or analytical questions",
			Keywords:      []string{"what", "how", "why", "when", "where", "who", "explain", "tell me", "describe", "definition", "meaning"},
			MinConfidence: 0.6,
			Weight:        0.9,
		},
		"translation": {
			Name:          "translation",
			DisplayName:   "Translation",
			Description:   "Translate text between languages",
			Keywords:      []string{"translate", "translation", "convert to", "in spanish", "in french", "in german", "in chinese", "in japanese", "language"},
			MinConfidence: 0.8,
			Weight:        1.2,
		},
		"summarization": {
			Name:          "summarization",
			DisplayName:   "Summarization",
			Description:   "Summarize long-form content into concise form",
			Keywords:      []string{"summarize", "summary", "tldr", "brief", "condense", "overview", "key points", "main ideas"},
			MinConfidence: 0.7,
			Weight:        1.0,
		},
		"creative_writing": {
			Name:          "creative_writing",
			DisplayName:   "Creative Writing",
			Description:   "Generate creative content like stories, poems, or marketing copy",
			Keywords:      []string{"write", "story", "poem", "creative", "marketing", "blog", "article", "narrative", "fiction", "essay"},
			MinConfidence: 0.6,
			Weight:        0.8,
		},
		"data_analysis": {
			Name:          "data_analysis",
			DisplayName:   "Data Analysis",
			Description:   "Analyze data, generate insights, or perform calculations",
			Keywords:      []string{"analyze", "analysis", "calculate", "compute", "statistics", "data", "metrics", "report", "insights", "trend"},
			MinConfidence: 0.75,
			Weight:        1.1,
		},
		"conversational": {
			Name:          "conversational",
			DisplayName:   "Conversational",
			Description:   "General conversational queries and chat",
			Keywords:      []string{"hello", "hi", "hey", "chat", "talk", "discuss", "conversation", "thanks", "please", "help"},
			MinConfidence: 0.5,
			Weight:        0.7,
		},
		"default": {
			Name:          "default",
			DisplayName:   "Default",
			Description:   "Fallback for unclassified prompts",
			Keywords:      []string{},
			MinConfidence: 0.0,
			Weight:        0.5,
		},
	}
}

// Classify performs semantic classification of a prompt
func (c *Classifier) Classify(ctx context.Context, prompt string) (*ClassificationResult, error) {
	startTime := time.Now()

	// Generate prompt hash for caching
	promptHash := c.hashPrompt(prompt)

	// Check cache first
	if c.enableCache && c.cache != nil {
		cached, err := c.cache.Get(ctx, promptHash)
		if err == nil && cached != nil {
			cached.CacheHit = true
			cached.LatencyMs = time.Since(startTime).Milliseconds()

			// Record metrics
			observability.RecordSemanticClassification(
				cached.Class,
				cached.LatencyMs,
				cached.Confidence,
				true,
			)

			return cached, nil
		}
	}

	// Perform classification
	class, confidence, alternatives := c.classifyPrompt(prompt)

	latencyMs := time.Since(startTime).Milliseconds()

	result := &ClassificationResult{
		Class:              class,
		Confidence:         confidence,
		LatencyMs:          latencyMs,
		CacheHit:           false,
		PromptHash:         promptHash,
		ClassifierVersion:  c.version,
		AlternativeClasses: alternatives,
	}

	// Cache the result (5 minute TTL per spec)
	if c.enableCache && c.cache != nil {
		_ = c.cache.Set(ctx, promptHash, result, 5*time.Minute)
	}

	// Persist to database if available
	if c.cacheDB != nil {
		promptPreview := prompt
		if len(promptPreview) > 200 {
			promptPreview = promptPreview[:200] + "..."
		}
		_ = c.cacheDB.Save(ctx, promptHash, promptPreview, class, confidence, latencyMs, false)
	}

	// Record metrics
	observability.RecordSemanticClassification(class, latencyMs, confidence, false)

	return result, nil
}

// classifyPrompt performs the actual classification logic
func (c *Classifier) classifyPrompt(prompt string) (string, float64, []AlternativeClass) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	promptLower := strings.ToLower(prompt)
	scores := make(map[string]float64)

	// Score each class based on keyword matching
	for className, class := range c.classes {
		if className == "default" {
			continue // Skip default class in scoring
		}

		score := 0.0
		matchedKeywords := 0

		for _, keyword := range class.Keywords {
			if strings.Contains(promptLower, strings.ToLower(keyword)) {
				matchedKeywords++
				// Weight score by keyword specificity (longer keywords = more specific)
				keywordWeight := float64(len(keyword)) / 10.0
				if keywordWeight < 1.0 {
					keywordWeight = 1.0
				}
				score += keywordWeight
			}
		}

		// Normalize score by number of keywords in the class
		if len(class.Keywords) > 0 {
			normalizedScore := (float64(matchedKeywords) / float64(len(class.Keywords))) * class.Weight
			scores[className] = normalizedScore
		}
	}

	// Find the highest scoring class
	var bestClass string
	var bestScore float64
	var alternatives []AlternativeClass

	for className, score := range scores {
		if score > bestScore {
			// Push previous best to alternatives
			if bestClass != "" && bestScore >= c.minConfidence {
				alternatives = append(alternatives, AlternativeClass{
					Class:      bestClass,
					Confidence: bestScore,
				})
			}
			bestClass = className
			bestScore = score
		} else if score >= c.minConfidence {
			alternatives = append(alternatives, AlternativeClass{
				Class:      className,
				Confidence: score,
			})
		}
	}

	// Check if best class meets minimum confidence threshold
	if bestClass != "" {
		classConfig := c.classes[bestClass]
		if bestScore >= classConfig.MinConfidence {
			return bestClass, bestScore, alternatives
		}
	}

	// Fallback to default class
	return c.defaultClass, 0.5, alternatives
}

// hashPrompt generates a SHA-256 hash of the prompt for caching
func (c *Classifier) hashPrompt(prompt string) string {
	hash := sha256.Sum256([]byte(prompt))
	return hex.EncodeToString(hash[:])
}

// RegisterClass adds or updates a semantic class
func (c *Classifier) RegisterClass(class *SemanticClass) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if class.Name == "" {
		return fmt.Errorf("class name cannot be empty")
	}

	if class.MinConfidence < 0 || class.MinConfidence > 1 {
		return fmt.Errorf("min confidence must be between 0 and 1")
	}

	c.classes[class.Name] = class
	return nil
}

// GetClass retrieves a semantic class configuration
func (c *Classifier) GetClass(name string) (*SemanticClass, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	class, exists := c.classes[name]
	return class, exists
}

// ListClasses returns all registered semantic classes
func (c *Classifier) ListClasses() []*SemanticClass {
	c.mu.RLock()
	defer c.mu.RUnlock()

	classes := make([]*SemanticClass, 0, len(c.classes))
	for _, class := range c.classes {
		classes = append(classes, class)
	}
	return classes
}

// SetMinConfidence sets the global minimum confidence threshold
func (c *Classifier) SetMinConfidence(threshold float64) error {
	if threshold < 0 || threshold > 1 {
		return fmt.Errorf("threshold must be between 0 and 1")
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	c.minConfidence = threshold
	return nil
}

// SetCacheEnabled enables or disables caching
func (c *Classifier) SetCacheEnabled(enabled bool) {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.enableCache = enabled
}

// GetVersion returns the classifier version
func (c *Classifier) GetVersion() string {
	return c.version
}

// UpdateVersion updates the classifier version
func (c *Classifier) UpdateVersion(version string) {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.version = version
}

// GetStats returns classification statistics
func (c *Classifier) GetStats(ctx context.Context) (map[string]ClassStats, error) {
	if c.cacheDB == nil {
		return nil, fmt.Errorf("database not configured")
	}

	stats := make(map[string]ClassStats)

	for className := range c.classes {
		total, avgConf, err := c.cacheDB.GetStats(ctx, className)
		if err != nil {
			// Continue on error, just skip this class
			continue
		}

		stats[className] = ClassStats{
			ClassName:              className,
			TotalClassifications:   total,
			AverageConfidence:      avgConf,
		}
	}

	return stats, nil
}

// ClassStats represents statistics for a semantic class
type ClassStats struct {
	ClassName            string
	TotalClassifications int
	AverageConfidence    float64
}
