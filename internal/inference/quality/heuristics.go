package quality

import (
	"regexp"
	"strings"
	"unicode/utf8"
)

// QualityHeuristics contains various heuristic checks for quality scoring
type QualityHeuristics struct {
	ResponseLength    float64 // Score based on response length (0.0-1.0)
	RefusalDetected   bool    // Whether the response contains a refusal
	StructureQuality  float64 // Score for response structure (0.0-1.0)
	CoherenceScore    float64 // Score for coherence and readability (0.0-1.0)
	DomainSpecific    float64 // Domain-specific quality score (0.0-1.0)
}

// CalculateHeuristics computes all quality heuristics for a response
func CalculateHeuristics(content string, domain string) QualityHeuristics {
	return QualityHeuristics{
		ResponseLength:   scoreResponseLength(content),
		RefusalDetected:  detectRefusal(content),
		StructureQuality: scoreStructure(content),
		CoherenceScore:   scoreCoherence(content),
		DomainSpecific:   scoreDomainSpecificQuality(content, domain),
	}
}

// scoreResponseLength scores quality based on response length
// Too short suggests low effort, too long might be verbose
func scoreResponseLength(content string) float64 {
	length := float64(utf8.RuneCountInString(content))

	// Optimal range: 200-2000 characters
	if length < 50 {
		// Very short response, likely low quality
		return 0.2
	} else if length < 200 {
		// Short but acceptable
		return 0.5
	} else if length < 2000 {
		// Good length
		return 1.0
	} else if length < 5000 {
		// Acceptable, might be detailed
		return 0.8
	} else {
		// Very long, might be overly verbose
		return 0.6
	}
}

// detectRefusal checks if the response contains a refusal/inability to help
func detectRefusal(content string) bool {
	lowerContent := strings.ToLower(content)

	refusalPhrases := []string{
		"i cannot",
		"i can't",
		"i am unable",
		"i'm unable",
		"i do not have the ability",
		"i don't have the ability",
		"i am not able",
		"i'm not able",
		"i cannot help",
		"i can't help",
		"i apologize, but i cannot",
		"i'm sorry, but i cannot",
		"i'm sorry, i cannot",
		"as an ai",
		"as a language model",
		"i don't have access",
		"i cannot access",
		"i'm not capable",
		"beyond my capabilities",
		"outside my capabilities",
	}

	for _, phrase := range refusalPhrases {
		if strings.Contains(lowerContent, phrase) {
			return true
		}
	}

	return false
}

// scoreStructure evaluates the structure and formatting of the response
func scoreStructure(content string) float64 {
	score := 0.0

	// Check for paragraphs (multiple newlines)
	paragraphCount := strings.Count(content, "\n\n")
	if paragraphCount > 0 {
		score += 0.2
	}

	// Check for lists (bullet points or numbered)
	hasLists := strings.Contains(content, "- ") ||
		strings.Contains(content, "* ") ||
		regexp.MustCompile(`\d+\.\s`).MatchString(content)
	if hasLists {
		score += 0.2
	}

	// Check for code blocks
	hasCodeBlocks := strings.Contains(content, "```") ||
		strings.Contains(content, "    ") // Indented code
	if hasCodeBlocks {
		score += 0.2
	}

	// Check for headers/sections
	hasHeaders := strings.Contains(content, "#") ||
		strings.Contains(content, "**") ||
		regexp.MustCompile(`\n[A-Z][^.!?\n]{10,}\n`).MatchString(content)
	if hasHeaders {
		score += 0.2
	}

	// Check for proper capitalization and punctuation
	if hasProperCapitalization(content) {
		score += 0.2
	}

	// Normalize
	if score > 1.0 {
		score = 1.0
	}

	return score
}

// hasProperCapitalization checks for basic capitalization rules
func hasProperCapitalization(content string) bool {
	// Remove leading whitespace
	trimmed := strings.TrimSpace(content)
	if len(trimmed) == 0 {
		return false
	}

	// Check if first character is uppercase
	firstChar := rune(trimmed[0])
	return firstChar >= 'A' && firstChar <= 'Z'
}

// scoreCoherence evaluates coherence and readability
func scoreCoherence(content string) float64 {
	score := 0.0

	// Check for complete sentences (ending with punctuation)
	sentenceEndings := strings.Count(content, ".") +
		strings.Count(content, "!") +
		strings.Count(content, "?")

	if sentenceEndings >= 3 {
		score += 0.3
	} else if sentenceEndings >= 1 {
		score += 0.2
	}

	// Check for transition words (indicates flow)
	transitionWords := []string{
		"however", "therefore", "furthermore", "additionally",
		"moreover", "consequently", "thus", "hence",
		"first", "second", "finally", "in conclusion",
		"for example", "such as", "in other words",
	}

	transitionCount := 0
	lowerContent := strings.ToLower(content)
	for _, word := range transitionWords {
		if strings.Contains(lowerContent, word) {
			transitionCount++
		}
	}

	if transitionCount >= 3 {
		score += 0.3
	} else if transitionCount >= 1 {
		score += 0.2
	}

	// Check for reasonable word variety (not too repetitive)
	if hasReasonableVariety(content) {
		score += 0.4
	} else {
		score += 0.2
	}

	// Normalize
	if score > 1.0 {
		score = 1.0
	}

	return score
}

// hasReasonableVariety checks if the text has reasonable word variety
func hasReasonableVariety(content string) bool {
	words := strings.Fields(strings.ToLower(content))
	if len(words) < 10 {
		return true // Too short to evaluate
	}

	// Count unique words
	uniqueWords := make(map[string]bool)
	for _, word := range words {
		uniqueWords[word] = true
	}

	// Ratio of unique words to total words
	// Good variety: > 50% unique
	variety := float64(len(uniqueWords)) / float64(len(words))
	return variety > 0.5
}

// scoreDomainSpecificQuality evaluates domain-specific quality
func scoreDomainSpecificQuality(content string, domain string) float64 {
	switch domain {
	case "code":
		return scoreCodeQuality(content)
	case "creative":
		return scoreCreativeQuality(content)
	case "analytical":
		return scoreAnalyticalQuality(content)
	default:
		return 0.7 // Default score for general domain
	}
}

// scoreCodeQuality evaluates code-specific quality
func scoreCodeQuality(content string) float64 {
	score := 0.0

	// Check for code blocks
	hasCodeBlocks := strings.Contains(content, "```")
	if hasCodeBlocks {
		score += 0.3
	}

	// Check for code-related explanations
	hasExplanation := strings.Contains(strings.ToLower(content), "this code") ||
		strings.Contains(strings.ToLower(content), "the function") ||
		strings.Contains(strings.ToLower(content), "explanation")
	if hasExplanation {
		score += 0.2
	}

	// Check for proper code structure (indentation, brackets)
	codeStructurePatterns := []*regexp.Regexp{
		regexp.MustCompile(`\{\s*\n`),    // Opening bracket with newline
		regexp.MustCompile(`\n\s+\w+`),   // Indented lines
		regexp.MustCompile(`\n\s*\}`),    // Closing bracket
		regexp.MustCompile(`def\s+\w+`),  // Python function def
		regexp.MustCompile(`function\s+\w+`), // JS function
	}

	structureMatches := 0
	for _, pattern := range codeStructurePatterns {
		if pattern.MatchString(content) {
			structureMatches++
		}
	}

	if structureMatches >= 2 {
		score += 0.3
	} else if structureMatches >= 1 {
		score += 0.2
	}

	// Check for comments in code
	hasComments := strings.Contains(content, "//") ||
		strings.Contains(content, "#") ||
		strings.Contains(content, "/*")
	if hasComments {
		score += 0.2
	}

	// Normalize
	if score > 1.0 {
		score = 1.0
	}

	return score
}

// scoreCreativeQuality evaluates creative writing quality
func scoreCreativeQuality(content string) float64 {
	score := 0.0

	// Check for descriptive language
	descriptiveWords := []string{
		"beautiful", "vibrant", "mysterious", "ancient", "shimmering",
		"whispered", "echoed", "radiant", "serene", "majestic",
		"gentle", "fierce", "delicate", "powerful", "enchanting",
	}

	descriptiveCount := 0
	lowerContent := strings.ToLower(content)
	for _, word := range descriptiveWords {
		if strings.Contains(lowerContent, word) {
			descriptiveCount++
		}
	}

	if descriptiveCount >= 3 {
		score += 0.3
	} else if descriptiveCount >= 1 {
		score += 0.2
	}

	// Check for dialogue (creative writing often includes dialogue)
	hasDialogue := strings.Contains(content, `"`) && strings.Count(content, `"`) >= 2
	if hasDialogue {
		score += 0.2
	}

	// Check for storytelling elements
	storyElements := []string{
		"once", "began", "journey", "character", "scene",
		"moment", "suddenly", "meanwhile", "finally",
	}

	elementCount := 0
	for _, element := range storyElements {
		if strings.Contains(lowerContent, element) {
			elementCount++
		}
	}

	if elementCount >= 2 {
		score += 0.3
	} else if elementCount >= 1 {
		score += 0.2
	}

	// Check for emotional language
	emotionalWords := []string{
		"felt", "emotion", "heart", "tears", "joy",
		"fear", "hope", "love", "wonder", "sadness",
	}

	emotionalCount := 0
	for _, word := range emotionalWords {
		if strings.Contains(lowerContent, word) {
			emotionalCount++
		}
	}

	if emotionalCount >= 2 {
		score += 0.3
	} else if emotionalCount >= 1 {
		score += 0.2
	}

	// Normalize
	if score > 1.0 {
		score = 1.0
	}

	return score
}

// scoreAnalyticalQuality evaluates analytical content quality
func scoreAnalyticalQuality(content string) float64 {
	score := 0.0

	// Check for structured analysis (numbered points, sections)
	hasStructure := regexp.MustCompile(`\d+\.\s`).MatchString(content) ||
		strings.Contains(content, "First,") ||
		strings.Contains(content, "Second,") ||
		strings.Contains(content, "Finally,")
	if hasStructure {
		score += 0.3
	}

	// Check for analytical reasoning words
	reasoningWords := []string{
		"because", "therefore", "thus", "consequently",
		"as a result", "due to", "leads to", "causes",
		"indicates", "suggests", "implies", "demonstrates",
	}

	reasoningCount := 0
	lowerContent := strings.ToLower(content)
	for _, word := range reasoningWords {
		if strings.Contains(lowerContent, word) {
			reasoningCount++
		}
	}

	if reasoningCount >= 3 {
		score += 0.3
	} else if reasoningCount >= 1 {
		score += 0.2
	}

	// Check for evidence/data references
	evidenceIndicators := []string{
		"data", "evidence", "research", "study", "shows",
		"according to", "based on", "statistics", "findings",
	}

	evidenceCount := 0
	for _, indicator := range evidenceIndicators {
		if strings.Contains(lowerContent, indicator) {
			evidenceCount++
		}
	}

	if evidenceCount >= 2 {
		score += 0.2
	} else if evidenceCount >= 1 {
		score += 0.1
	}

	// Check for balanced perspective (pros/cons, advantages/disadvantages)
	hasBalance := (strings.Contains(lowerContent, "advantage") && strings.Contains(lowerContent, "disadvantage")) ||
		(strings.Contains(lowerContent, "pro") && strings.Contains(lowerContent, "con")) ||
		(strings.Contains(lowerContent, "benefit") && strings.Contains(lowerContent, "drawback"))
	if hasBalance {
		score += 0.2
	}

	// Normalize
	if score > 1.0 {
		score = 1.0
	}

	return score
}
