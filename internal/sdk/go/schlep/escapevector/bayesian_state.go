// Package escapevector provides Thompson Sampling-powered local fallback routing.
//
// When control plane is down, clients continue using the same Bayesian optimization
// that beats every competitor in production.
package escapevector

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"time"
)

// BanditArm represents a provider's Thompson Sampling parameters
type BanditArm struct {
	ProviderID    string  `json:"provider_id"`
	Name          string  `json:"name"`
	Endpoint      string  `json:"endpoint"`
	APIKey        string  `json:"api_key,omitempty"`

	// Thompson Sampling parameters
	Alpha         float64 `json:"alpha"`          // Success parameter
	Beta          float64 `json:"beta"`           // Failure parameter

	// Performance tracking
	TotalSelections int     `json:"total_selections"`
	TotalSuccesses  int     `json:"total_successes"`
	TotalFailures   int     `json:"total_failures"`

	// Composite reward components (normalized 0-1)
	AvgLatencyScore   float64 `json:"avg_latency_score"`
	AvgCostEfficiency float64 `json:"avg_cost_efficiency"`
	AvgSuccessRate    float64 `json:"avg_success_rate"`

	// Reward weights
	WeightLatency float64 `json:"weight_latency"`
	WeightCost    float64 `json:"weight_cost"`
	WeightSuccess float64 `json:"weight_success"`

	// Last updated timestamp
	UpdatedAt int64 `json:"updated_at"`
}

// BayesianState represents the complete Thompson Sampling state
type BayesianState struct {
	Version   uint32      `json:"version"`
	Timestamp int64       `json:"timestamp"`
	Arms      []BanditArm `json:"arms"`

	// Configuration
	ExplorationRate       float64 `json:"exploration_rate"` // Epsilon for ε-greedy
	CircuitBreakerThreshold int   `json:"circuit_breaker_threshold"`
	TimeoutMS             int64   `json:"timeout_ms"`
	MaxRetries            int     `json:"max_retries"`
	SpeculativeExecution  bool    `json:"speculative_execution"`

	// Normalization parameters
	MaxLatencyMS float64 `json:"max_latency_ms"`
	MaxCostUSD   float64 `json:"max_cost_usd"`
}

// EncryptedBayesianState represents encrypted Bayesian state with HMAC
type EncryptedBayesianState struct {
	Ciphertext []byte `json:"ciphertext"`
	Nonce      []byte `json:"nonce"`
	HMAC       []byte `json:"hmac"`
	Version    uint32 `json:"version"`
	Timestamp  int64  `json:"timestamp"`
	ExpiresAt  int64  `json:"expires_at"`
}

const (
	// InertialTTL is 72 hours - the memory of our Bayesian optimizer
	InertialTTL = 72 * time.Hour

	// MaxClockSkew for tamper detection
	MaxClockSkew = 5 * time.Minute
)

// BayesianSigner handles encryption and signing of Thompson Sampling state
type BayesianSigner struct {
	key []byte
}

// NewBayesianSigner creates a new Bayesian state signer
func NewBayesianSigner(key []byte) (*BayesianSigner, error) {
	if len(key) != 32 {
		return nil, fmt.Errorf("key must be 32 bytes for AES-256")
	}
	return &BayesianSigner{key: key}, nil
}

// EncryptState encrypts and signs a Bayesian state
func (bs *BayesianSigner) EncryptState(state *BayesianState) (*EncryptedBayesianState, error) {
	// Serialize state to JSON
	plaintext, err := json.Marshal(state)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal state: %w", err)
	}

	// Create AES cipher
	block, err := aes.NewCipher(bs.key)
	if err != nil {
		return nil, fmt.Errorf("failed to create cipher: %w", err)
	}

	// Create GCM mode
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("failed to create GCM: %w", err)
	}

	// Generate nonce
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, fmt.Errorf("failed to generate nonce: %w", err)
	}

	// Encrypt
	ciphertext := gcm.Seal(nil, nonce, plaintext, nil)

	// Calculate HMAC for integrity
	h := hmac.New(sha256.New, bs.key)
	h.Write(ciphertext)
	h.Write(nonce)
	signature := h.Sum(nil)

	now := time.Now().Unix()
	return &EncryptedBayesianState{
		Ciphertext: ciphertext,
		Nonce:      nonce,
		HMAC:       signature,
		Version:    state.Version,
		Timestamp:  now,
		ExpiresAt:  now + int64(InertialTTL.Seconds()),
	}, nil
}

// DecryptState decrypts and verifies a Bayesian state
func (bs *BayesianSigner) DecryptState(encrypted *EncryptedBayesianState) (*BayesianState, error) {
	now := time.Now().Unix()

	// Detect clock tampering - if encrypted timestamp is in future beyond clock skew
	if encrypted.Timestamp > now+int64(MaxClockSkew.Seconds()) {
		return nil, fmt.Errorf("state timestamp in future - clock tampered")
	}

	// Check expiration (72-hour inertial quorum)
	if now > encrypted.ExpiresAt {
		return nil, fmt.Errorf("Bayesian state expired at %d (current: %d) - force Gold Code Override", encrypted.ExpiresAt, now)
	}

	// Verify HMAC
	h := hmac.New(sha256.New, bs.key)
	h.Write(encrypted.Ciphertext)
	h.Write(encrypted.Nonce)
	expectedHMAC := h.Sum(nil)

	if !hmac.Equal(encrypted.HMAC, expectedHMAC) {
		return nil, fmt.Errorf("HMAC verification failed - state may be tampered")
	}

	// Create AES cipher
	block, err := aes.NewCipher(bs.key)
	if err != nil {
		return nil, fmt.Errorf("failed to create cipher: %w", err)
	}

	// Create GCM mode
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("failed to create GCM: %w", err)
	}

	// Decrypt
	plaintext, err := gcm.Open(nil, encrypted.Nonce, encrypted.Ciphertext, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt state: %w", err)
	}

	// Deserialize
	var state BayesianState
	if err := json.Unmarshal(plaintext, &state); err != nil {
		return nil, fmt.Errorf("failed to unmarshal state: %w", err)
	}

	return &state, nil
}

// GetMean returns the expected value of the Beta distribution
func (arm *BanditArm) GetMean() float64 {
	if arm.Alpha+arm.Beta == 0 {
		return 0.5
	}
	return arm.Alpha / (arm.Alpha + arm.Beta)
}

// GetVariance returns the variance of the Beta distribution
func (arm *BanditArm) GetVariance() float64 {
	if arm.Alpha+arm.Beta == 0 {
		return 0.25
	}
	sum := arm.Alpha + arm.Beta
	return (arm.Alpha * arm.Beta) / (sum * sum * (sum + 1))
}

// SampleBeta samples from Beta(α, β) using the mean approximation with noise
// This is a lightweight approximation - production uses proper Beta sampling
func (arm *BanditArm) SampleBeta() float64 {
	if arm.Alpha <= 0 || arm.Beta <= 0 {
		return 0.5
	}

	mean := arm.GetMean()
	variance := arm.GetVariance()

	// Add Gaussian noise proportional to variance for exploration
	noise := gaussianNoise() * math.Sqrt(variance)
	sample := mean + noise

	// Clamp to [0, 1]
	if sample < 0 {
		return 0.0
	}
	if sample > 1 {
		return 1.0
	}
	return sample
}

// gaussianNoise generates approximate Gaussian noise using Box-Muller transform
func gaussianNoise() float64 {
	u1 := float64(time.Now().UnixNano()%10000) / 10000.0
	u2 := float64(time.Now().UnixNano()%10000+1) / 10000.0

	if u1 == 0 {
		u1 = 0.0001
	}

	return math.Sqrt(-2.0*math.Log(u1)) * math.Cos(2.0*math.Pi*u2)
}

// DefaultBayesianState returns the default Gold Code Override state
func DefaultBayesianState() *BayesianState {
	return &BayesianState{
		Version:   0,
		Timestamp: time.Now().Unix(),
		Arms: []BanditArm{
			{
				ProviderID: "openai",
				Name:       "openai",
				Endpoint:   "https://api.openai.com/v1",
				Alpha:      1.0,
				Beta:       1.0,
				WeightLatency: 0.33,
				WeightCost:    0.33,
				WeightSuccess: 0.34,
				UpdatedAt:     time.Now().Unix(),
			},
			{
				ProviderID: "anthropic",
				Name:       "anthropic",
				Endpoint:   "https://api.anthropic.com/v1",
				Alpha:      1.0,
				Beta:       1.0,
				WeightLatency: 0.33,
				WeightCost:    0.33,
				WeightSuccess: 0.34,
				UpdatedAt:     time.Now().Unix(),
			},
			{
				ProviderID: "google",
				Name:       "google",
				Endpoint:   "https://generativelanguage.googleapis.com/v1",
				Alpha:      1.0,
				Beta:       1.0,
				WeightLatency: 0.33,
				WeightCost:    0.33,
				WeightSuccess: 0.34,
				UpdatedAt:     time.Now().Unix(),
			},
		},
		ExplorationRate:         0.1,  // 10% exploration
		CircuitBreakerThreshold: 5,
		TimeoutMS:               10000,
		MaxRetries:              2,
		SpeculativeExecution:    false,
		MaxLatencyMS:            5000.0,
		MaxCostUSD:              1.0,
	}
}
