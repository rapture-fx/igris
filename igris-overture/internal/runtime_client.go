// Package internal provides internal Overture utilities not exposed to external packages.
package internal

import (
	"bytes"
	"context"
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"github.com/Igris-inertial/system/igris-overture/models"
	"github.com/google/uuid"
)

// RuntimeClient forwards execution requests from Overture to an igris-runtime
// instance.  Overture remains the control plane (auth, routing decision, billing,
// tenancy); the Runtime is the sole execution authority.
type RuntimeClient struct {
	baseURL    string
	secret     string             // IGRIS_RUNTIME_SECRET — sent as Authorization: Bearer <secret>
	publicKey  ed25519.PublicKey  // IGRIS_RUNTIME_PUBLIC_KEY (hex) — used to verify execution envelopes
	signingKey ed25519.PrivateKey // IGRIS_OVERTURE_SIGNING_KEY (hex) — signs routing decisions
	httpClient *http.Client
}

// NewRuntimeClient creates a RuntimeClient targeting the given base URL
// (e.g. "http://localhost:8080" or the cloud-runtime URL).
// It reads IGRIS_RUNTIME_SECRET and IGRIS_RUNTIME_TIMEOUT from the environment.
func NewRuntimeClient(baseURL string) *RuntimeClient {
	timeout := 5 * time.Second
	if v := os.Getenv("IGRIS_RUNTIME_TIMEOUT"); v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			timeout = d
		}
	}
	var pubKey ed25519.PublicKey
	if hexKey := os.Getenv("IGRIS_RUNTIME_PUBLIC_KEY"); hexKey != "" {
		if decoded, err := hex.DecodeString(hexKey); err == nil && len(decoded) == ed25519.PublicKeySize {
			pubKey = ed25519.PublicKey(decoded)
		}
	}

	var signingKey ed25519.PrivateKey
	if hexKey := os.Getenv("IGRIS_OVERTURE_SIGNING_KEY"); hexKey != "" {
		if decoded, err := hex.DecodeString(hexKey); err == nil && len(decoded) == ed25519.PrivateKeySize {
			signingKey = ed25519.PrivateKey(decoded)
		}
	}

	return &RuntimeClient{
		baseURL:    baseURL,
		secret:     os.Getenv("IGRIS_RUNTIME_SECRET"),
		publicKey:  pubKey,
		signingKey: signingKey,
		httpClient: &http.Client{
			Timeout: timeout,
		},
	}
}

// setAuthHeader adds Authorization: Bearer <secret> when a secret is configured.
func (c *RuntimeClient) setAuthHeader(req *http.Request) {
	if c.secret != "" {
		req.Header.Set("Authorization", "Bearer "+c.secret)
	}
}

// setDecisionSigHeader signs the request body with Overture's Ed25519 signing key
// and attaches the base64-encoded signature as X-Igris-Decision-Sig. No-op when
// IGRIS_OVERTURE_SIGNING_KEY is not configured.
func (c *RuntimeClient) setDecisionSigHeader(req *http.Request, body []byte) {
	if len(c.signingKey) == 0 {
		return
	}
	hash := sha256.Sum256(body)
	sig := ed25519.Sign(c.signingKey, hash[:])
	req.Header.Set("X-Igris-Decision-Sig", base64.StdEncoding.EncodeToString(sig))
}

// CancelTask sends a best-effort cancellation signal to an assigned runtime task.
// It uses the same auth and decision-signature model as other Overture→Runtime calls.
func (c *RuntimeClient) CancelTask(ctx context.Context, taskID uuid.UUID, tenantID string) error {
	body := []byte(`{}`)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, fmt.Sprintf("%s/v1/runtime/task/%s/cancel", c.baseURL, taskID), bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Igris-Tenant", tenantID)
	c.setAuthHeader(req)
	c.setDecisionSigHeader(req, body)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusAccepted && resp.StatusCode != http.StatusNotFound && resp.StatusCode != http.StatusConflict {
		raw, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return fmt.Errorf("runtime cancel failed: status=%d body=%s", resp.StatusCode, string(raw))
	}
	return nil
}

// verifyEnvelope verifies the Ed25519 signature embedded in an execution envelope.
//
// The canonical form is produced by removing "signature" from the envelope map,
// marshalling the remainder with json.Marshal (which sorts map keys alphabetically —
// identical to the Rust BTreeMap serialisation used on the signing side), then
// SHA-256 hashing those bytes. The signature is verified against that hash.
//
// Returns nil if verification succeeds, if no public key is configured, or if the
// envelope is nil. Returns a non-nil error if a key is configured but verification
// fails, which the caller must treat as a security rejection (502).
func (c *RuntimeClient) verifyEnvelope(envelope map[string]interface{}) error {
	return c.verifySignedJSON(envelope, "execution_envelope")
}

// verifySignedJSON is the shared verification primitive used by both
// verifyEnvelope and verifyReceipt.
//
// It accepts a raw JSON map, removes the "signature" key, marshals the
// remainder canonically (json.Marshal sorts map keys alphabetically, matching
// Rust's BTreeMap serialization), SHA-256 hashes the result, and verifies the
// signature with the configured Ed25519 public key.
//
// Returns nil when no public key is configured (skip verification), or when
// the signed field is absent (treated as unsigned / not present). Returns a
// non-nil error when a key is configured and verification fails.
func (c *RuntimeClient) verifySignedJSON(record map[string]interface{}, recordName string) error {
	if len(c.publicKey) == 0 {
		return nil
	}

	sigRaw, ok := record["signature"]
	if !ok {
		// No signature field — reject when a key is configured.
		return fmt.Errorf("%s missing signature field", recordName)
	}
	sigStr, _ := sigRaw.(string)
	if sigStr == "" {
		return fmt.Errorf("%s has empty signature", recordName)
	}
	sigBytes, err := base64.StdEncoding.DecodeString(sigStr)
	if err != nil {
		return fmt.Errorf("%s signature base64 decode: %w", recordName, err)
	}

	// Remove signature before canonical serialisation.
	delete(record, "signature")

	canonBytes, err := json.Marshal(record)

	// Restore signature immediately so the caller can still inspect the record.
	record["signature"] = sigStr

	if err != nil {
		return fmt.Errorf("%s canonical marshal: %w", recordName, err)
	}

	hash := sha256.Sum256(canonBytes)
	if !ed25519.Verify(c.publicKey, hash[:], sigBytes) {
		return fmt.Errorf("%s signature verification failed", recordName)
	}
	return nil
}

// verifyReceipt verifies the Ed25519 signature of an ExecutionReceipt using
// the same canonical-JSON + SHA-256 algorithm as verifyEnvelope.
//
// When IGRIS_RUNTIME_PUBLIC_KEY is configured and verification fails, the
// caller must treat this as ErrRuntimeSecurity (502).
func (c *RuntimeClient) verifyReceipt(receipt map[string]interface{}) error {
	return c.verifySignedJSON(receipt, "execution_receipt")
}

// taskSubmitRequest is the durable task payload sent to POST /v1/runtime/task/submit.
type taskSubmitRequest struct {
	TaskID         string          `json:"task_id"`
	TaskType       taskTypeRequest `json:"task_type"`
	Containment    *executeBounds  `json:"containment,omitempty"`
	IdempotencyKey string          `json:"idempotency_key"`
	TenantID       string          `json:"tenant_id"`
	DeadlineMs     *uint64         `json:"deadline_ms,omitempty"`
}

type executeMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type taskTypeRequest struct {
	Type        string           `json:"type"`
	Model       string           `json:"model,omitempty"`
	Messages    []executeMessage `json:"messages,omitempty"`
	MaxTokens   *uint32          `json:"max_tokens,omitempty"`
	Temperature *float32         `json:"temperature,omitempty"`
	Stream      bool             `json:"stream,omitempty"`
	Mode        string           `json:"mode,omitempty"`
}

type executeBounds struct {
	CpuPercent *uint8  `json:"cpu_percent,omitempty"`
	MemoryMb   *uint32 `json:"memory_mb,omitempty"`
	MaxTickMs  *uint64 `json:"max_tick_ms,omitempty"`
}

type taskSubmitResponse struct {
	TaskID            string                 `json:"task_id"`
	StepsCompleted    uint32                 `json:"steps_completed"`
	StepsTotal        uint32                 `json:"steps_total"`
	Status            string                 `json:"status"`
	Reason            string                 `json:"reason,omitempty"`
	FinalOutput       string                 `json:"final_output,omitempty"`
	Usage             *executeUsage          `json:"usage,omitempty"`
	ExecutionEnvelope map[string]interface{} `json:"execution_envelope,omitempty"`
	ExecutionReceipt  map[string]interface{} `json:"execution_receipt,omitempty"`
}

type executeUsage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}

func parseBoundsHeader(boundsHeader string) (*executeBounds, error) {
	if boundsHeader == "" {
		return nil, nil
	}
	var bounds executeBounds
	if err := json.Unmarshal([]byte(boundsHeader), &bounds); err != nil {
		return nil, fmt.Errorf("runtime_client: parse bounds header: %w", err)
	}
	return &bounds, nil
}

func hasSignature(record map[string]interface{}) bool {
	if record == nil {
		return false
	}
	sig, ok := record["signature"].(string)
	return ok && sig != ""
}

func extractProvider(taskResp taskSubmitResponse) string {
	if value, ok := taskResp.ExecutionEnvelope["provider"].(string); ok && value != "" {
		return value
	}
	if value, ok := taskResp.ExecutionEnvelope["routing_decision"].(string); ok && value != "" {
		return value
	}
	return "runtime"
}

func computeIdempotencyKey(
	tenantID string,
	taskType taskTypeRequest,
	containment *executeBounds,
	deadlineMs *uint64,
) string {
	payload := struct {
		TenantID    string          `json:"tenant_id"`
		TaskType    taskTypeRequest `json:"task_type"`
		Containment *executeBounds  `json:"containment,omitempty"`
		DeadlineMs  *uint64         `json:"deadline_ms,omitempty"`
	}{
		TenantID:    tenantID,
		TaskType:    taskType,
		Containment: containment,
		DeadlineMs:  deadlineMs,
	}
	data, _ := json.Marshal(payload)
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}

func buildExecuteMessages(messages []models.Message) []executeMessage {
	msgs := make([]executeMessage, 0, len(messages))
	for _, m := range messages {
		msgs = append(msgs, executeMessage{
			Role:    m.Role,
			Content: m.GetTextContent(),
		})
	}
	return msgs
}

func buildOptionalMaxTokens(maxTokens int) *uint32 {
	if maxTokens <= 0 {
		return nil
	}
	value := uint32(maxTokens)
	return &value
}

func buildOptionalTemperature(temperature float64) *float32 {
	if temperature == 0 {
		return nil
	}
	value := float32(temperature)
	return &value
}

func (c *RuntimeClient) streamingHTTPClient() *http.Client {
	streamClient := *c.httpClient
	streamClient.Timeout = 0
	return &streamClient
}

// ForwardExecution sends req to the Runtime's POST /v1/runtime/task/submit endpoint
// and converts the response back to an *models.InferResponse.
//
// If the runtime is unreachable or returns a non-200 status, an error is
// returned so the caller can apply failover logic.
func (c *RuntimeClient) ForwardExecution(
	ctx context.Context,
	tenantID string,
	req *models.InferRequest,
	boundsHeader string,
) (*models.InferResponse, error) {
	if req.Stream {
		return nil, fmt.Errorf("runtime_client: streaming is not supported on the durable task endpoint")
	}

	// Build the execute payload.
	msgs := buildExecuteMessages(req.Messages)

	bounds, err := parseBoundsHeader(boundsHeader)
	if err != nil {
		return nil, err
	}

	maxTokens := buildOptionalMaxTokens(req.MaxTokens)
	temperature := buildOptionalTemperature(req.Temperature)

	var deadlineMs *uint64
	if bounds != nil && bounds.MaxTickMs != nil {
		value := *bounds.MaxTickMs
		deadlineMs = &value
	} else if req.Policy != nil && req.Policy.TimeoutMs > 0 {
		value := uint64(req.Policy.TimeoutMs)
		deadlineMs = &value
	}

	mode := req.SpeculativeMode
	if req.CouncilMode {
		mode = "council"
	}

	taskType := taskTypeRequest{
		Type:        "single_inference",
		Model:       req.Model,
		Messages:    msgs,
		MaxTokens:   maxTokens,
		Temperature: temperature,
		Stream:      req.Stream,
		Mode:        mode,
	}

	payload := taskSubmitRequest{
		TaskID:         uuid.NewString(),
		TaskType:       taskType,
		Containment:    bounds,
		IdempotencyKey: computeIdempotencyKey(tenantID, taskType, bounds, deadlineMs),
		TenantID:       tenantID,
		DeadlineMs:     deadlineMs,
	}

	data, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("runtime_client: marshal: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		c.baseURL+"/v1/runtime/task/submit",
		bytes.NewReader(data),
	)
	if err != nil {
		return nil, fmt.Errorf("runtime_client: build request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	c.setAuthHeader(httpReq)
	c.setDecisionSigHeader(httpReq, data)
	if tenantID != "" {
		httpReq.Header.Set("X-Igris-Tenant", tenantID)
	}

	httpResp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("runtime_client: http: %w", err)
	}
	defer httpResp.Body.Close()

	if httpResp.StatusCode == http.StatusUnauthorized || httpResp.StatusCode == http.StatusForbidden {
		return nil, fmt.Errorf("%w: status %d", models.ErrRuntimeSecurity, httpResp.StatusCode)
	}
	if httpResp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("runtime_client: runtime returned status %d", httpResp.StatusCode)
	}

	var taskResp taskSubmitResponse
	if err := json.NewDecoder(httpResp.Body).Decode(&taskResp); err != nil {
		return nil, fmt.Errorf("runtime_client: decode: %w", err)
	}
	if taskResp.Status != "completed" {
		reason := taskResp.Reason
		if reason == "" {
			reason = fmt.Sprintf("runtime task ended with status %s", taskResp.Status)
		}
		return nil, fmt.Errorf("runtime_client: %s", reason)
	}
	if !hasSignature(taskResp.ExecutionEnvelope) {
		return nil, fmt.Errorf("%w: task response missing signed execution envelope", models.ErrRuntimeSecurity)
	}

	// Verify execution envelope signature before accepting the response.
	if err := c.verifyEnvelope(taskResp.ExecutionEnvelope); err != nil {
		return nil, fmt.Errorf("%w: %v", models.ErrRuntimeSecurity, err)
	}

	// Verify execution receipt signature when present.
	if hasSignature(taskResp.ExecutionReceipt) {
		if err := c.verifyReceipt(taskResp.ExecutionReceipt); err != nil {
			return nil, fmt.Errorf("%w: %v", models.ErrRuntimeSecurity, err)
		}
	}

	// Convert to the Overture InferResponse type.
	inferResp := models.NewInferResponse(taskResp.TaskID, req.Model)
	inferResp.Created = time.Now().Unix()
	inferResp.AddChoice(0, &models.Message{
		Role:    "assistant",
		Content: taskResp.FinalOutput,
	}, "stop")
	if taskResp.Usage != nil {
		inferResp.SetUsage(taskResp.Usage.PromptTokens, taskResp.Usage.CompletionTokens)
	} else {
		inferResp.SetUsage(0, 0)
	}

	provider := extractProvider(taskResp)
	inferResp.Metadata = &models.ResponseMetadata{
		Provider:      provider,
		RouteDecision: "forwarded_to_runtime_task",
		Timestamp:     time.Now(),
	}

	// Attach verified execution envelope for SDK passthrough.
	inferResp.ExecutionEnvelope = taskResp.ExecutionEnvelope

	// Attach verified execution receipt for SDK passthrough.
	if hasSignature(taskResp.ExecutionReceipt) {
		inferResp.ExecutionReceipt = taskResp.ExecutionReceipt
	}

	return inferResp, nil
}

// OpenStreamingExecution opens an SSE stream against the Runtime's
// POST /v1/runtime/task/stream endpoint. The caller owns closing the response body.
func (c *RuntimeClient) OpenStreamingExecution(
	ctx context.Context,
	tenantID string,
	req *models.InferRequest,
	boundsHeader string,
) (*http.Response, error) {
	mode := req.SpeculativeMode
	if req.CouncilMode {
		mode = "council"
	}
	switch mode {
	case "", "latency", "speculative", "thompson", "balanced", "quality", "cost", "council":
	default:
		return nil, fmt.Errorf("runtime_client: streaming runtime relay does not support speculative mode %q", mode)
	}

	bounds, err := parseBoundsHeader(boundsHeader)
	if err != nil {
		return nil, err
	}

	var deadlineMs *uint64
	if bounds != nil && bounds.MaxTickMs != nil {
		value := *bounds.MaxTickMs
		deadlineMs = &value
	} else if req.Policy != nil && req.Policy.TimeoutMs > 0 {
		value := uint64(req.Policy.TimeoutMs)
		deadlineMs = &value
	}

	taskType := taskTypeRequest{
		Type:        "single_inference",
		Model:       req.Model,
		Messages:    buildExecuteMessages(req.Messages),
		MaxTokens:   buildOptionalMaxTokens(req.MaxTokens),
		Temperature: buildOptionalTemperature(req.Temperature),
		Stream:      true,
		Mode:        mode,
	}
	payload := taskSubmitRequest{
		TaskID:         uuid.NewString(),
		TaskType:       taskType,
		Containment:    bounds,
		IdempotencyKey: computeIdempotencyKey(tenantID, taskType, bounds, deadlineMs),
		TenantID:       tenantID,
		DeadlineMs:     deadlineMs,
	}
	data, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("runtime_client: marshal streaming request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		c.baseURL+"/v1/runtime/task/stream",
		bytes.NewReader(data),
	)
	if err != nil {
		return nil, fmt.Errorf("runtime_client: build streaming request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "text/event-stream")
	c.setAuthHeader(httpReq)
	c.setDecisionSigHeader(httpReq, data)
	if tenantID != "" {
		httpReq.Header.Set("X-Igris-Tenant", tenantID)
	}

	httpResp, err := c.streamingHTTPClient().Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("runtime_client: streaming http: %w", err)
	}
	if httpResp.StatusCode == http.StatusUnauthorized || httpResp.StatusCode == http.StatusForbidden {
		defer httpResp.Body.Close()
		return nil, fmt.Errorf("%w: status %d", models.ErrRuntimeSecurity, httpResp.StatusCode)
	}
	if httpResp.StatusCode != http.StatusOK {
		defer httpResp.Body.Close()
		body, _ := io.ReadAll(io.LimitReader(httpResp.Body, 4096))
		return nil, fmt.Errorf("runtime_client: streaming runtime returned status %d: %s", httpResp.StatusCode, string(body))
	}
	return httpResp, nil
}

// GetViolations fetches violation records from the Runtime's
// GET /v1/runtime/violations endpoint.
func (c *RuntimeClient) GetViolations(ctx context.Context) ([]map[string]interface{}, error) {
	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodGet,
		c.baseURL+"/v1/runtime/violations",
		nil,
	)
	if err != nil {
		return nil, err
	}
	c.setAuthHeader(req)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result struct {
		Violations []map[string]interface{} `json:"violations"`
		Count      int                      `json:"count"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return result.Violations, nil
}

// Health pings the Runtime's /v1/health endpoint and returns nil when healthy.
func (c *RuntimeClient) Health(ctx context.Context) error {
	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodGet,
		c.baseURL+"/v1/health",
		nil,
	)
	if err != nil {
		return err
	}
	c.setAuthHeader(req)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("runtime unreachable: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("runtime unhealthy: status %d", resp.StatusCode)
	}
	return nil
}

// BaseURL returns the configured base URL of the Runtime.
func (c *RuntimeClient) BaseURL() string {
	return c.baseURL
}
