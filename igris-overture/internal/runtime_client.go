// Package internal provides internal Overture utilities not exposed to external packages.
package internal

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/Igris-inertial/system/igris-overture/models"
)

// RuntimeClient forwards execution requests from Overture to an igris-runtime
// instance.  Overture remains the control plane (auth, routing decision, billing,
// tenancy); the Runtime is the sole execution authority.
type RuntimeClient struct {
	baseURL    string
	secret     string // IGRIS_RUNTIME_SECRET — sent as Authorization: Bearer <secret>
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
	return &RuntimeClient{
		baseURL: baseURL,
		secret:  os.Getenv("IGRIS_RUNTIME_SECRET"),
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

// executeRequest is the JSON payload sent to POST /v1/runtime/execute.
// Field types match igris-server's ExecuteRequest / Bounds exactly to avoid
// silent truncation at the JSON boundary.
type executeRequest struct {
	Model       string         `json:"model"`
	Messages    []executeMessage `json:"messages"`
	MaxTokens   *uint32        `json:"max_tokens,omitempty"`
	Temperature *float32       `json:"temperature,omitempty"`
	Stream      bool           `json:"stream,omitempty"`
	TenantID    string         `json:"tenant_id,omitempty"`
	Mode        string         `json:"mode,omitempty"`
	Bounds      *executeBounds `json:"bounds,omitempty"`
}

type executeMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type executeBounds struct {
	CpuPercent *uint8  `json:"cpu_percent,omitempty"`
	MemoryMb   *uint32 `json:"memory_mb,omitempty"`
	MaxTickMs  *uint64 `json:"max_tick_ms,omitempty"`
}

// executeResponse mirrors igris-server's ExecuteResponse.
type executeResponse struct {
	ID      string `json:"id"`
	Object  string `json:"object"`
	Created int64  `json:"created"`
	Model   string `json:"model"`
	Choices []struct {
		Index   int `json:"index"`
		Message struct {
			Role    string `json:"role"`
			Content string `json:"content"`
		} `json:"message"`
		FinishReason string `json:"finish_reason"`
	} `json:"choices"`
	Usage struct {
		PromptTokens     int `json:"prompt_tokens"`
		CompletionTokens int `json:"completion_tokens"`
		TotalTokens      int `json:"total_tokens"`
	} `json:"usage"`
	Metadata *struct {
		RuntimeID         string `json:"runtime_id"`
		Provider          string `json:"provider"`
		TenantID          string `json:"tenant_id"`
		ContainmentActive bool   `json:"containment_active"`
	} `json:"metadata,omitempty"`
	// Signature is the Ed25519 signature (base64) over "id:model:finish_reason".
	// Present when the Runtime has a signing key configured.
	Signature string `json:"signature,omitempty"`
}

// ForwardExecution sends req to the Runtime's POST /v1/runtime/execute endpoint
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
	// Build the execute payload.
	msgs := make([]executeMessage, 0, len(req.Messages))
	for _, m := range req.Messages {
		msgs = append(msgs, executeMessage{
			Role:    m.Role,
			Content: m.GetTextContent(),
		})
	}

	payload := executeRequest{
		Model:    req.Model,
		Messages: msgs,
		TenantID: tenantID,
		Stream:   req.Stream,
	}
	if req.MaxTokens > 0 {
		v := uint32(req.MaxTokens)
		payload.MaxTokens = &v
	}
	if req.Temperature != 0 {
		v := float32(req.Temperature)
		payload.Temperature = &v
	}
	if req.SpeculativeMode != "" {
		payload.Mode = req.SpeculativeMode
	}

	data, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("runtime_client: marshal: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		c.baseURL+"/v1/runtime/execute",
		bytes.NewReader(data),
	)
	if err != nil {
		return nil, fmt.Errorf("runtime_client: build request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	c.setAuthHeader(httpReq)
	if tenantID != "" {
		httpReq.Header.Set("X-Igris-Tenant", tenantID)
	}
	// Forward SDK containment bounds if provided.
	if boundsHeader != "" {
		httpReq.Header.Set("X-Igris-Bounds", boundsHeader)
	}

	httpResp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("runtime_client: http: %w", err)
	}
	defer httpResp.Body.Close()

	if httpResp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("runtime_client: runtime returned status %d", httpResp.StatusCode)
	}

	var execResp executeResponse
	if err := json.NewDecoder(httpResp.Body).Decode(&execResp); err != nil {
		return nil, fmt.Errorf("runtime_client: decode: %w", err)
	}

	// Convert to the Overture InferResponse type.
	inferResp := models.NewInferResponse(execResp.ID, execResp.Model)
	inferResp.Created = execResp.Created

	for _, ch := range execResp.Choices {
		inferResp.AddChoice(ch.Index, &models.Message{
			Role:    ch.Message.Role,
			Content: ch.Message.Content,
		}, ch.FinishReason)
	}

	inferResp.SetUsage(execResp.Usage.PromptTokens, execResp.Usage.CompletionTokens)

	provider := "runtime"
	if execResp.Metadata != nil && execResp.Metadata.Provider != "" {
		provider = execResp.Metadata.Provider
	}
	inferResp.Metadata = &models.ResponseMetadata{
		Provider:      provider,
		RouteDecision: "forwarded_to_runtime",
		Timestamp:     time.Now(),
	}

	return inferResp, nil
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
