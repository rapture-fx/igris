package quality

import (
	"regexp"
	"strings"
)

// detectDomain determines the domain of a request based on content analysis
func detectDomain(content string) string {
	lowerContent := strings.ToLower(content)

	// Score each domain (0.0-1.0)
	codeScore := scoreCodeDomain(lowerContent)
	creativeScore := scoreCreativeDomain(lowerContent)
	analyticalScore := scoreAnalyticalDomain(lowerContent)

	// Return the highest scoring domain
	maxScore := 0.0
	domain := "general" // Default

	if codeScore > maxScore && codeScore >= 0.3 {
		maxScore = codeScore
		domain = "code"
	}
	if creativeScore > maxScore && creativeScore >= 0.3 {
		maxScore = creativeScore
		domain = "creative"
	}
	if analyticalScore > maxScore && analyticalScore >= 0.3 {
		maxScore = analyticalScore
		domain = "analytical"
	}

	return domain
}

// scoreCodeDomain scores how likely content is code-related (0.0-1.0)
func scoreCodeDomain(content string) float64 {
	score := 0.0

	// Keywords related to coding (0.0-0.4)
	codeKeywords := []string{
		"function", "class", "variable", "code", "programming",
		"algorithm", "implement", "debug", "error", "syntax",
		"compile", "runtime", "library", "api", "framework",
		"refactor", "optimize", "test", "unit test", "bug",
		"repository", "git", "commit", "branch", "merge",
	}

	keywordCount := 0
	for _, keyword := range codeKeywords {
		if strings.Contains(content, keyword) {
			keywordCount++
		}
	}

	if keywordCount >= 5 {
		score += 0.4
	} else if keywordCount >= 3 {
		score += 0.3
	} else if keywordCount >= 1 {
		score += 0.2
	}

	// Programming language mentions (0.0-0.3)
	languages := []string{
		"python", "javascript", "typescript", "java", "golang", "go",
		"rust", "c++", "c#", "ruby", "php", "swift", "kotlin",
		"react", "vue", "angular", "node", "django", "flask",
	}

	for _, lang := range languages {
		if strings.Contains(content, lang) {
			score += 0.3
			break
		}
	}

	// Code patterns (0.0-0.3)
	codePatterns := []*regexp.Regexp{
		regexp.MustCompile(`\bdef\s+\w+\(`),           // Python function
		regexp.MustCompile(`\bfunction\s+\w+\(`),      // JS/TS function
		regexp.MustCompile(`\bclass\s+\w+`),           // Class definition
		regexp.MustCompile(`\bimport\s+\w+`),          // Import statement
		regexp.MustCompile(`\bconst\s+\w+\s*=`),       // Const declaration
		regexp.MustCompile(`\bvar\s+\w+\s*=`),         // Var declaration
		regexp.MustCompile(`\{\s*\n\s+`),              // Code block indentation
		regexp.MustCompile(`\bif\s*\(`),               // If statement
		regexp.MustCompile(`\bfor\s*\(`),              // For loop
		regexp.MustCompile(`\breturn\s+`),             // Return statement
		regexp.MustCompile(`\bprintf\(`),              // Printf
		regexp.MustCompile(`\bconsole\.log\(`),        // Console.log
		regexp.MustCompile(`\[\]\(\)`),                // Array/function symbols
		regexp.MustCompile(`\{.*:.*\}`),               // Object literal
	}

	patternMatches := 0
	for _, pattern := range codePatterns {
		if pattern.MatchString(content) {
			patternMatches++
		}
	}

	if patternMatches >= 3 {
		score += 0.3
	} else if patternMatches >= 1 {
		score += 0.2
	}

	// Normalize
	if score > 1.0 {
		score = 1.0
	}

	return score
}

// scoreCreativeDomain scores how likely content is creative writing (0.0-1.0)
func scoreCreativeDomain(content string) float64 {
	score := 0.0

	// Creative keywords (0.0-0.4)
	creativeKeywords := []string{
		"story", "write", "creative", "narrative", "character",
		"plot", "scene", "dialogue", "poem", "poetry",
		"fiction", "novel", "short story", "essay", "article",
		"blog", "content", "marketing", "copy", "caption",
		"describe", "imagine", "create", "generate", "compose",
	}

	keywordCount := 0
	for _, keyword := range creativeKeywords {
		if strings.Contains(content, keyword) {
			keywordCount++
		}
	}

	if keywordCount >= 4 {
		score += 0.4
	} else if keywordCount >= 2 {
		score += 0.3
	} else if keywordCount >= 1 {
		score += 0.2
	}

	// Creative phrases (0.0-0.3)
	creativePhrases := []string{
		"make it engaging", "make it compelling", "creative writing",
		"tell a story", "write a", "create a story", "generate content",
		"blog post about", "article about", "social media",
		"once upon a time", "in a world where", "imagine a",
	}

	for _, phrase := range creativePhrases {
		if strings.Contains(content, phrase) {
			score += 0.3
			break
		}
	}

	// Creative content requests (0.0-0.3)
	if strings.Contains(content, "write") || strings.Contains(content, "create") {
		if strings.Contains(content, "story") || strings.Contains(content, "poem") ||
			strings.Contains(content, "article") || strings.Contains(content, "blog") {
			score += 0.3
		}
	}

	// Normalize
	if score > 1.0 {
		score = 1.0
	}

	return score
}

// scoreAnalyticalDomain scores how likely content is analytical (0.0-1.0)
func scoreAnalyticalDomain(content string) float64 {
	score := 0.0

	// Analytical keywords (0.0-0.4)
	analyticalKeywords := []string{
		"analyze", "analysis", "evaluate", "assessment", "compare",
		"comparison", "contrast", "review", "examine", "investigate",
		"research", "study", "data", "statistics", "metrics",
		"measure", "calculate", "compute", "determine", "estimate",
		"reasoning", "logic", "proof", "theorem", "hypothesis",
	}

	keywordCount := 0
	for _, keyword := range analyticalKeywords {
		if strings.Contains(content, keyword) {
			keywordCount++
		}
	}

	if keywordCount >= 5 {
		score += 0.4
	} else if keywordCount >= 3 {
		score += 0.3
	} else if keywordCount >= 1 {
		score += 0.2
	}

	// Question words indicating analysis (0.0-0.3)
	analyticalQuestions := []string{
		"why", "how does", "what causes", "what is the reason",
		"explain why", "why is", "what are the implications",
		"what factors", "how can we", "what would happen",
	}

	for _, question := range analyticalQuestions {
		if strings.Contains(content, question) {
			score += 0.3
			break
		}
	}

	// Math/Science indicators (0.0-0.3)
	mathScienceIndicators := []string{
		"equation", "formula", "theorem", "proof", "derivative",
		"integral", "matrix", "vector", "probability", "hypothesis",
		"experiment", "scientific", "mathematical", "statistical",
	}

	for _, indicator := range mathScienceIndicators {
		if strings.Contains(content, indicator) {
			score += 0.3
			break
		}
	}

	// Normalize
	if score > 1.0 {
		score = 1.0
	}

	return score
}
