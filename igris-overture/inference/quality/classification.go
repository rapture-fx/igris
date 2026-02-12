package quality

import (
	"strings"

	"github.com/Igris-inertial/system/igris-overture/models"
)

// RequestClassification represents the classification of an inference request
type RequestClassification struct {
	Domain             string  // "code", "creative", "analytical", "general"
	Complexity         string  // "simple", "moderate", "complex"
	QualitySensitivity string  // "low", "medium", "high"
	ComplexityScore    float64 // 0.0-1.0 numeric score
}

// ClassifyRequest analyzes an inference request and classifies it
func ClassifyRequest(req *models.InferRequest) RequestClassification {
	content := extractContent(req)

	classification := RequestClassification{
		Domain:             detectDomain(content),
		Complexity:         "moderate", // Default
		QualitySensitivity: "medium",   // Default
		ComplexityScore:    0.5,        // Default
	}

	// Calculate complexity score
	classification.ComplexityScore = calculateComplexity(content, req)
	classification.Complexity = scoreToComplexityLevel(classification.ComplexityScore)

	// Determine quality sensitivity based on domain and complexity
	classification.QualitySensitivity = determineQualitySensitivity(classification)

	return classification
}

// extractContent extracts the content from the request for analysis
func extractContent(req *models.InferRequest) string {
	if len(req.Messages) == 0 {
		return ""
	}

	// Concatenate all user messages
	var content strings.Builder
	for _, msg := range req.Messages {
		if msg.Role == "user" || msg.Role == "system" {
			content.WriteString(msg.GetTextContent())
			content.WriteString(" ")
		}
	}

	return content.String()
}

// calculateComplexity estimates the complexity of a request (0.0-1.0)
func calculateComplexity(content string, req *models.InferRequest) float64 {
	score := 0.0

	// Factor 1: Content length (0.0-0.3)
	contentLength := float64(len(content))
	if contentLength < 100 {
		score += 0.0
	} else if contentLength < 500 {
		score += 0.1
	} else if contentLength < 1500 {
		score += 0.2
	} else {
		score += 0.3
	}

	// Factor 2: Number of messages (0.0-0.2)
	messageCount := float64(len(req.Messages))
	if messageCount <= 1 {
		score += 0.0
	} else if messageCount <= 3 {
		score += 0.1
	} else {
		score += 0.2
	}

	// Factor 3: Requested output length (0.0-0.2)
	maxTokens := float64(req.MaxTokens)
	if maxTokens < 100 {
		score += 0.0
	} else if maxTokens < 500 {
		score += 0.1
	} else {
		score += 0.2
	}

	// Factor 4: System complexity indicators (0.0-0.3)
	lowerContent := strings.ToLower(content)
	complexityIndicators := []string{
		"analyze", "explain", "complex", "detail", "comprehensive",
		"algorithm", "architecture", "design", "optimize", "evaluate",
		"compare", "contrast", "step by step", "reasoning", "proof",
	}

	indicatorCount := 0
	for _, indicator := range complexityIndicators {
		if strings.Contains(lowerContent, indicator) {
			indicatorCount++
		}
	}

	if indicatorCount >= 5 {
		score += 0.3
	} else if indicatorCount >= 3 {
		score += 0.2
	} else if indicatorCount >= 1 {
		score += 0.1
	}

	// Normalize to 0.0-1.0
	if score > 1.0 {
		score = 1.0
	}

	return score
}

// scoreToComplexityLevel converts numeric score to complexity level
func scoreToComplexityLevel(score float64) string {
	if score < 0.35 {
		return "simple"
	} else if score < 0.70 {
		return "moderate"
	}
	return "complex"
}

// determineQualitySensitivity determines how sensitive the request is to quality
func determineQualitySensitivity(classification RequestClassification) string {
	// Code and analytical tasks are highly sensitive to quality
	if classification.Domain == "code" || classification.Domain == "analytical" {
		if classification.Complexity == "complex" {
			return "high"
		}
		return "medium"
	}

	// Creative tasks have medium sensitivity
	if classification.Domain == "creative" {
		if classification.Complexity == "complex" {
			return "high"
		}
		return "medium"
	}

	// General tasks have lower sensitivity unless complex
	if classification.Complexity == "complex" {
		return "medium"
	}

	return "low"
}
