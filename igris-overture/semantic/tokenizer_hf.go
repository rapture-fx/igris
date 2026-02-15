//go:build onnx
package semantic

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// HFTokenizer implements HuggingFace-style tokenization
// This is a Go-native implementation that loads HuggingFace vocabulary files
// For production, consider using github.com/sugarme/tokenizer (Rust binding)
type HFTokenizer struct {
	config TokenizerConfig

	// Vocabulary mapping
	vocab       map[string]int64
	reverseVocab map[int64]string
	vocabSize   int

	// Special tokens
	unkTokenID  int64
	padTokenID  int64
	clsTokenID  int64
	sepTokenID  int64
	maskTokenID int64

	// Tokenization settings
	maxLength   int
	doLowerCase bool

	// WordPiece tokenization
	useWordPiece bool

	// Metrics
	tokenizationLatency prometheus.Histogram
	tokenizationCount   prometheus.Counter
	fallbackCount       prometheus.Counter

	mu sync.RWMutex
}

// NewHFTokenizer creates a new HuggingFace-compatible tokenizer
func NewHFTokenizer(config TokenizerConfig) (*HFTokenizer, error) {
	if config.VocabFile == "" {
		return nil, ErrVocabNotFound
	}

	tokenizer := &HFTokenizer{
		config:       config,
		vocab:        make(map[string]int64),
		reverseVocab: make(map[int64]string),
		maxLength:    config.MaxLength,
		doLowerCase:  config.DoLowerCase,
		useWordPiece: true,
	}

	if tokenizer.maxLength == 0 {
		tokenizer.maxLength = 512
	}

	// Load vocabulary
	if err := tokenizer.loadVocab(config.VocabFile); err != nil {
		return nil, fmt.Errorf("failed to load vocabulary: %w", err)
	}

	// Set special token IDs
	tokenizer.initSpecialTokens(config)

	// Initialize metrics
	tokenizer.initMetrics()

	return tokenizer, nil
}

// loadVocab loads vocabulary from file (supports both txt and json formats)
func (t *HFTokenizer) loadVocab(vocabFile string) error {
	file, err := os.Open(vocabFile)
	if err != nil {
		return err
	}
	defer file.Close()

	// Determine format by extension
	ext := filepath.Ext(vocabFile)

	switch ext {
	case ".json":
		return t.loadVocabJSON(file)
	case ".txt":
		return t.loadVocabTxt(file)
	default:
		// Try JSON first, then txt
		if err := t.loadVocabJSON(file); err != nil {
			file.Seek(0, 0)
			return t.loadVocabTxt(file)
		}
		return nil
	}
}

// loadVocabJSON loads vocabulary from JSON file (HuggingFace format)
func (t *HFTokenizer) loadVocabJSON(file *os.File) error {
	var vocabMap map[string]int64
	decoder := json.NewDecoder(file)

	if err := decoder.Decode(&vocabMap); err != nil {
		return err
	}

	t.vocab = vocabMap
	t.vocabSize = len(vocabMap)

	// Build reverse mapping
	for token, id := range vocabMap {
		t.reverseVocab[id] = token
	}

	return nil
}

// loadVocabTxt loads vocabulary from text file (one token per line)
func (t *HFTokenizer) loadVocabTxt(file *os.File) error {
	scanner := bufio.NewScanner(file)
	var idx int64 = 0

	for scanner.Scan() {
		token := scanner.Text()
		if token == "" {
			continue
		}

		t.vocab[token] = idx
		t.reverseVocab[idx] = token
		idx++
	}

	t.vocabSize = int(idx)

	return scanner.Err()
}

// initSpecialTokens initializes special token IDs
func (t *HFTokenizer) initSpecialTokens(config TokenizerConfig) {
	// Set special token IDs from vocabulary
	if id, ok := t.vocab[config.UNKToken]; ok {
		t.unkTokenID = id
	} else {
		t.unkTokenID = t.vocab["[UNK]"]
	}

	if id, ok := t.vocab[config.PADToken]; ok {
		t.padTokenID = id
	} else {
		t.padTokenID = t.vocab["[PAD]"]
	}

	if id, ok := t.vocab[config.CLSToken]; ok {
		t.clsTokenID = id
	} else {
		t.clsTokenID = t.vocab["[CLS]"]
	}

	if id, ok := t.vocab[config.SEPToken]; ok {
		t.sepTokenID = id
	} else {
		t.sepTokenID = t.vocab["[SEP]"]
	}

	if id, ok := t.vocab[config.MASKToken]; ok {
		t.maskTokenID = id
	} else {
		t.maskTokenID = t.vocab["[MASK]"]
	}
}

// initMetrics initializes Prometheus metrics
func (t *HFTokenizer) initMetrics() {
	t.tokenizationLatency = promauto.NewHistogram(prometheus.HistogramOpts{
		Name:    "igris_tokenizer_latency_ms",
		Help:    "HuggingFace tokenizer latency in milliseconds",
		Buckets: prometheus.ExponentialBuckets(0.1, 2, 10), // 0.1ms to 51.2ms
	})

	t.tokenizationCount = promauto.NewCounter(prometheus.CounterOpts{
		Name: "igris_tokenizer_count_total",
		Help: "Total number of tokenization operations",
	})

	t.fallbackCount = promauto.NewCounter(prometheus.CounterOpts{
		Name: "igris_tokenizer_fallback_total",
		Help: "Total number of tokenizer fallbacks to simple tokenizer",
	})
}

// Tokenize converts text to token IDs and attention mask
func (t *HFTokenizer) Tokenize(text string) ([]int64, []int64, error) {
	start := time.Now()
	defer func() {
		t.tokenizationLatency.Observe(float64(time.Since(start).Microseconds()) / 1000.0)
		t.tokenizationCount.Inc()
	}()

	// Preprocess text
	if t.doLowerCase {
		text = strings.ToLower(text)
	}

	// Basic tokenization (whitespace + punctuation)
	basicTokens := t.basicTokenize(text)

	// WordPiece tokenization
	var wordpieceTokens []string
	if t.useWordPiece {
		for _, token := range basicTokens {
			wordpieceTokens = append(wordpieceTokens, t.wordpieceTokenize(token)...)
		}
	} else {
		wordpieceTokens = basicTokens
	}

	// Convert tokens to IDs
	tokenIDs := make([]int64, 0, len(wordpieceTokens)+2)

	// Add [CLS] token at start
	tokenIDs = append(tokenIDs, t.clsTokenID)

	// Add word piece tokens
	for _, token := range wordpieceTokens {
		if id, ok := t.vocab[token]; ok {
			tokenIDs = append(tokenIDs, id)
		} else {
			tokenIDs = append(tokenIDs, t.unkTokenID)
		}

		// Check max length (leave space for [SEP])
		if len(tokenIDs) >= t.maxLength-1 {
			break
		}
	}

	// Add [SEP] token at end
	tokenIDs = append(tokenIDs, t.sepTokenID)

	// Create attention mask (1 for real tokens, 0 for padding)
	attentionMask := make([]int64, t.maxLength)
	for i := 0; i < len(tokenIDs) && i < t.maxLength; i++ {
		attentionMask[i] = 1
	}

	// Pad token IDs to max length
	inputIDs := make([]int64, t.maxLength)
	copy(inputIDs, tokenIDs)

	// Pad remaining with [PAD] token
	for i := len(tokenIDs); i < t.maxLength; i++ {
		inputIDs[i] = t.padTokenID
	}

	return inputIDs, attentionMask, nil
}

// TokenizeWithOptions tokenizes with additional options
func (t *HFTokenizer) TokenizeWithOptions(text string, opts TokenizerOptions) (*TokenizedOutput, error) {
	// Use standard tokenize for now
	inputIDs, attentionMask, err := t.Tokenize(text)
	if err != nil {
		return nil, err
	}

	return &TokenizedOutput{
		InputIDs:      inputIDs,
		AttentionMask: attentionMask,
		TokenTypeIDs:  make([]int64, len(inputIDs)), // All zeros for single sequence
	}, nil
}

// basicTokenize performs basic whitespace and punctuation tokenization
func (t *HFTokenizer) basicTokenize(text string) []string {
	// Normalize whitespace
	text = strings.TrimSpace(text)

	// Split on whitespace and punctuation
	var tokens []string
	var currentToken strings.Builder

	for _, char := range text {
		if isWhitespace(char) {
			if currentToken.Len() > 0 {
				tokens = append(tokens, currentToken.String())
				currentToken.Reset()
			}
		} else if isPunctuation(char) {
			if currentToken.Len() > 0 {
				tokens = append(tokens, currentToken.String())
				currentToken.Reset()
			}
			tokens = append(tokens, string(char))
		} else {
			currentToken.WriteRune(char)
		}
	}

	if currentToken.Len() > 0 {
		tokens = append(tokens, currentToken.String())
	}

	return tokens
}

// wordpieceTokenize performs WordPiece tokenization on a single word
func (t *HFTokenizer) wordpieceTokenize(word string) []string {
	if len(word) > 200 {
		// Too long, return as UNK
		return []string{t.config.UNKToken}
	}

	var tokens []string
	start := 0

	for start < len(word) {
		end := len(word)
		var foundSubtoken string

		// Greedy longest-match-first
		for end > start {
			substr := word[start:end]

			// Add ## prefix if not first subtoken
			if start > 0 {
				substr = "##" + substr
			}

			if _, ok := t.vocab[substr]; ok {
				foundSubtoken = substr
				break
			}

			end--
		}

		if foundSubtoken == "" {
			// No match found, use UNK token
			return []string{t.config.UNKToken}
		}

		tokens = append(tokens, foundSubtoken)
		start = end
	}

	return tokens
}

// Decode converts token IDs back to text
func (t *HFTokenizer) Decode(tokenIDs []int64) (string, error) {
	var tokens []string

	for _, id := range tokenIDs {
		// Skip special tokens
		if id == t.padTokenID || id == t.clsTokenID || id == t.sepTokenID {
			continue
		}

		if token, ok := t.reverseVocab[id]; ok {
			tokens = append(tokens, token)
		}
	}

	// Join tokens and clean up
	text := strings.Join(tokens, " ")

	// Remove ## prefix (WordPiece continuations)
	text = strings.ReplaceAll(text, " ##", "")

	return text, nil
}

// GetVocabSize returns the vocabulary size
func (t *HFTokenizer) GetVocabSize() int {
	return t.vocabSize
}

// GetMaxLength returns the maximum sequence length
func (t *HFTokenizer) GetMaxLength() int {
	return t.maxLength
}

// Close releases tokenizer resources
func (t *HFTokenizer) Close() error {
	// Nothing to close for in-memory vocab
	return nil
}

// Helper functions

func isWhitespace(char rune) bool {
	return char == ' ' || char == '	' || char == '
' || char == '
'
}

func isPunctuation(char rune) bool {
	// Common punctuation characters
	punctuation := "!\"#$%&'()*+,-./:;<=>?@[\]^_`{|}~"
	return strings.ContainsRune(punctuation, char)
}

// GetTokenID returns the ID for a given token
func (t *HFTokenizer) GetTokenID(token string) (int64, bool) {
	t.mu.RLock()
	defer t.mu.RUnlock()

	id, ok := t.vocab[token]
	return id, ok
}

// GetToken returns the token for a given ID
func (t *HFTokenizer) GetToken(id int64) (string, bool) {
	t.mu.RLock()
	defer t.mu.RUnlock()

	token, ok := t.reverseVocab[id]
	return token, ok
}

// GetSpecialTokens returns all special token IDs
func (t *HFTokenizer) GetSpecialTokens() map[string]int64 {
	return map[string]int64{
		"unk":  t.unkTokenID,
		"pad":  t.padTokenID,
		"cls":  t.clsTokenID,
		"sep":  t.sepTokenID,
		"mask": t.maskTokenID,
	}
}
