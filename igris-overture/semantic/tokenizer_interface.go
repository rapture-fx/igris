//go:build onnx
package semantic

import (
	"errors"
)

// Tokenizer defines the interface for text tokenization
type Tokenizer interface {
	// Tokenize converts text to token IDs and attention mask
	Tokenize(text string) (inputIDs []int64, attentionMask []int64, err error)

	// TokenizeWithOptions tokenizes with additional options
	TokenizeWithOptions(text string, opts TokenizerOptions) (*TokenizedOutput, error)

	// Decode converts token IDs back to text
	Decode(tokenIDs []int64) (string, error)

	// GetVocabSize returns the vocabulary size
	GetVocabSize() int

	// GetMaxLength returns the maximum sequence length
	GetMaxLength() int

	// Close releases tokenizer resources
	Close() error
}

// TokenizerOptions holds tokenization options
type TokenizerOptions struct {
	MaxLength       int
	Padding         PaddingStrategy
	Truncation      TruncationStrategy
	AddSpecialTokens bool
	ReturnTensorType string // "pt" for PyTorch, "tf" for TensorFlow, "np" for NumPy
}

// PaddingStrategy defines how to pad sequences
type PaddingStrategy string

const (
	PaddingNone      PaddingStrategy = "none"
	PaddingMaxLength PaddingStrategy = "max_length"
	PaddingLongest   PaddingStrategy = "longest"
)

// TruncationStrategy defines how to truncate sequences
type TruncationStrategy string

const (
	TruncationNone      TruncationStrategy = "none"
	TruncationOnlyFirst TruncationStrategy = "only_first"
	TruncationOnlySecond TruncationStrategy = "only_second"
	TruncationLongestFirst TruncationStrategy = "longest_first"
)

// TokenizedOutput represents the output of tokenization
type TokenizedOutput struct {
	InputIDs      []int64
	AttentionMask []int64
	TokenTypeIDs  []int64
	SpecialTokensMask []int64
	OverflowingTokens []int64
	NumTruncatedTokens int
	Tokens        []string
}

// Common tokenizer errors
var (
	ErrTokenizerNotInitialized = errors.New("tokenizer not initialized")
	ErrInvalidInput           = errors.New("invalid input text")
	ErrVocabNotFound          = errors.New("vocabulary file not found")
	ErrModelNotFound          = errors.New("tokenizer model file not found")
	ErrTokenizationFailed     = errors.New("tokenization failed")
)

// TokenizerType represents different tokenizer implementations
type TokenizerType string

const (
	TokenizerTypeSimple TokenizerType = "simple"
	TokenizerTypeHF     TokenizerType = "huggingface"
	TokenizerTypeBERT   TokenizerType = "bert"
	TokenizerTypeGPT2   TokenizerType = "gpt2"
)

// TokenizerConfig holds tokenizer configuration
type TokenizerConfig struct {
	Type        TokenizerType
	VocabFile   string
	MergesFile  string // For BPE tokenizers (GPT-2)
	ModelFile   string // For SentencePiece tokenizers
	MaxLength   int
	DoLowerCase bool
	UNKToken    string
	SEPToken    string
	PADToken    string
	CLSToken    string
	MASKToken   string
}

// DefaultTokenizerConfig returns default configuration for BERT-style tokenizer
func DefaultTokenizerConfig() TokenizerConfig {
	return TokenizerConfig{
		Type:        TokenizerTypeBERT,
		MaxLength:   512,
		DoLowerCase: true,
		UNKToken:    "[UNK]",
		SEPToken:    "[SEP]",
		PADToken:    "[PAD]",
		CLSToken:    "[CLS]",
		MASKToken:   "[MASK]",
	}
}

// TokenizerFactory creates tokenizers based on configuration
type TokenizerFactory struct{}

// NewTokenizerFactory creates a new tokenizer factory
func NewTokenizerFactory() *TokenizerFactory {
	return &TokenizerFactory{}
}

// Create creates a tokenizer based on type
func (f *TokenizerFactory) Create(config TokenizerConfig) (Tokenizer, error) {
	switch config.Type {
	case TokenizerTypeSimple:
		return NewSimpleTokenizerFromConfig(config), nil
	case TokenizerTypeHF, TokenizerTypeBERT:
		return NewHFTokenizer(config)
	default:
		return nil, errors.New("unsupported tokenizer type")
	}
}

// SimpleTokenizer is a basic whitespace tokenizer
type SimpleTokenizer struct {
	vocabSize int
	maxLength int
}

// Tokenize implements Tokenizer interface
func (st *SimpleTokenizer) Tokenize(text string) (*TokenizedOutput, error) {
	// Simple whitespace tokenization
	tokens := splitByWhitespace(text)
	if len(tokens) > st.maxLength {
		tokens = tokens[:st.maxLength]
	}

	inputIDs := make([]int64, len(tokens))
	attentionMask := make([]int64, len(tokens))
	for i := range tokens {
		inputIDs[i] = int64(i % st.vocabSize)
		attentionMask[i] = 1
	}

	return &TokenizedOutput{
		InputIDs:      inputIDs,
		AttentionMask: attentionMask,
		Tokens:        tokens,
	}, nil
}

// Decode implements Tokenizer interface
func (st *SimpleTokenizer) Decode(tokenIDs []int64) (string, error) {
	// Simple decode - just return empty for now
	return "", nil
}

// Close implements Tokenizer interface
func (st *SimpleTokenizer) Close() error {
	return nil
}

// splitByWhitespace splits text by whitespace
func splitByWhitespace(text string) []string {
	var tokens []string
	current := ""
	for _, r := range text {
		if r == ' ' || r == '\t' || r == '\n' || r == '\r' {
			if current != "" {
				tokens = append(tokens, current)
				current = ""
			}
		} else {
			current += string(r)
		}
	}
	if current != "" {
		tokens = append(tokens, current)
	}
	return tokens
}

// NewSimpleTokenizerFromConfig creates a simple tokenizer from config
func NewSimpleTokenizerFromConfig(config TokenizerConfig) *SimpleTokenizer {
	maxLength := config.MaxLength
	if maxLength == 0 {
		maxLength = 512
	}

	return &SimpleTokenizer{
		vocabSize: 30522, // Default BERT vocab size
		maxLength: maxLength,
	}
}

// TokenizerStats holds tokenizer performance statistics
type TokenizerStats struct {
	TotalTokenizations int64
	TotalTokens       int64
	AvgTokensPerText  float64
	AvgLatencyMs      float64
	FallbackCount     int64
}
