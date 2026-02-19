package core

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/websocket/v2"
	"github.com/Igris-inertial/system/igris-overture/observability"
)

// InferResult holds the output of a model inference call.
type InferResult struct {
	Prediction float64
	Confidence float64
}

// InferencePool is satisfied by *ml.AdaptiveInferencePool.
type InferencePool interface{}

// InferenceRuntime is satisfied by *ml.GPURuntime.
type InferenceRuntime interface {
	Infer(ctx context.Context, features []float64, modelID string) (*InferResult, error)
}

// ModelRouter is satisfied by *core.MultiModelRouter (or *ml.MultiModelRouter).
type ModelRouter interface {
	SelectModel(requestedModelID string) (string, RuntimeType)
}

// StreamingInferenceHandler manages WebSocket streaming inference
type StreamingInferenceHandler struct {
	pool           InferencePool
	gpuRuntime     InferenceRuntime
	router         ModelRouter

	// Connection management
	connections    map[string]*StreamConnection
	connMutex      sync.RWMutex

	// Configuration
	maxConnections int
	streamTimeout  time.Duration
	batchSize      int
}

// StreamConnection represents an active WebSocket connection
type StreamConnection struct {
	ID            string
	Conn          *websocket.Conn
	Context       context.Context
	Cancel        context.CancelFunc
	SendChan      chan StreamMessage
	LastActivity  time.Time
	ModelID       string
	mu            sync.Mutex
}

// StreamMessage represents a streaming inference message
type StreamMessage struct {
	Type      string                 `json:"type"`       // "token", "batch", "result", "error", "heartbeat"
	Data      interface{}            `json:"data"`
	Metadata  map[string]interface{} `json:"metadata"`
	Timestamp time.Time              `json:"timestamp"`
}

// StreamRequest represents a streaming inference request
type StreamRequest struct {
	ModelID     string                 `json:"model_id"`
	Features    []float64              `json:"features"`
	StreamMode  string                 `json:"stream_mode"`  // "token", "batch", "continuous"
	BatchSize   int                    `json:"batch_size"`
	Metadata    map[string]interface{} `json:"metadata"`
}

// StreamResult represents a partial or complete inference result
type StreamResult struct {
	Prediction  float64                `json:"prediction"`
	Confidence  float64                `json:"confidence"`
	TokenIndex  int                    `json:"token_index,omitempty"`
	BatchIndex  int                    `json:"batch_index,omitempty"`
	IsComplete  bool                   `json:"is_complete"`
	RuntimeUsed string                 `json:"runtime_used"`
	LatencyMs   int64                  `json:"latency_ms"`
}

// NewStreamingInferenceHandler creates a new streaming handler
func NewStreamingInferenceHandler(
	pool InferencePool,
	gpuRuntime InferenceRuntime,
	router ModelRouter,
) *StreamingInferenceHandler {
	return &StreamingInferenceHandler{
		pool:           pool,
		gpuRuntime:     gpuRuntime,
		router:         router,
		connections:    make(map[string]*StreamConnection),
		maxConnections: 1000,
		streamTimeout:  5 * time.Minute,
		batchSize:      10,
	}
}

// HandleWebSocket is the main WebSocket handler
func (h *StreamingInferenceHandler) HandleWebSocket() fiber.Handler {
	return websocket.New(func(c *websocket.Conn) {
		connID := h.generateConnectionID()

		ctx, cancel := context.WithTimeout(context.Background(), h.streamTimeout)
		defer cancel()

		conn := &StreamConnection{
			ID:           connID,
			Conn:         c,
			Context:      ctx,
			Cancel:       cancel,
			SendChan:     make(chan StreamMessage, 100),
			LastActivity: time.Now(),
		}

		// Register connection
		if !h.registerConnection(conn) {
			_ = c.WriteJSON(StreamMessage{
				Type:      "error",
				Data:      "max connections reached",
				Timestamp: time.Now(),
			})
			return
		}
		defer h.unregisterConnection(connID)

		log.Printf("[StreamHandler] WebSocket connected: %s", connID)

		// Start sender goroutine
		go h.sender(conn)

		// Start heartbeat
		go h.heartbeat(conn)

		// Handle incoming messages
		h.receiver(conn)
	})
}

// receiver handles incoming WebSocket messages
func (h *StreamingInferenceHandler) receiver(conn *StreamConnection) {
	defer func() {
		conn.Cancel()
		close(conn.SendChan)
	}()

	for {
		var req StreamRequest
		err := conn.Conn.ReadJSON(&req)
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("[StreamHandler] WebSocket error: %v", err)
			}
			return
		}

		conn.mu.Lock()
		conn.LastActivity = time.Now()
		conn.ModelID = req.ModelID
		conn.mu.Unlock()

		// Process the streaming request
		go h.processStreamRequest(conn, &req)
	}
}

// sender sends messages to the WebSocket client
func (h *StreamingInferenceHandler) sender(conn *StreamConnection) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case msg, ok := <-conn.SendChan:
			if !ok {
				return
			}

			err := conn.Conn.WriteJSON(msg)
			if err != nil {
				log.Printf("[StreamHandler] Write error: %v", err)
				return
			}

		case <-ticker.C:
			// Ping to keep connection alive
			if err := conn.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}

		case <-conn.Context.Done():
			return
		}
	}
}

// processStreamRequest processes a streaming inference request
func (h *StreamingInferenceHandler) processStreamRequest(conn *StreamConnection, req *StreamRequest) {
	start := time.Now()

	// Select model using the router
	selectedModel, runtime := h.router.SelectModel(req.ModelID)

	switch req.StreamMode {
	case "token":
		h.processTokenStream(conn, req, selectedModel, runtime)
	case "batch":
		h.processBatchStream(conn, req, selectedModel, runtime)
	case "continuous":
		h.processContinuousStream(conn, req, selectedModel, runtime)
	default:
		h.processStandardInference(conn, req, selectedModel, runtime)
	}

	// Record metrics
	duration := time.Since(start)
	observability.RecordStreamInference(req.StreamMode, req.ModelID, duration.Milliseconds())
}

// processTokenStream streams results token by token (for generative models)
func (h *StreamingInferenceHandler) processTokenStream(
	conn *StreamConnection,
	req *StreamRequest,
	modelID string,
	runtime RuntimeType,
) {
	// Simulate token-by-token streaming (real implementation would use actual model)
	numTokens := 50 // Simulated token count

	for i := 0; i < numTokens; i++ {
		select {
		case <-conn.Context.Done():
			return
		default:
		}

		start := time.Now()

		// Perform inference for this token
		result, err := h.gpuRuntime.Infer(conn.Context, req.Features, modelID)
		if err != nil {
			h.sendError(conn, fmt.Sprintf("token inference failed: %v", err))
			return
		}

		latency := time.Since(start)

		// Stream the token result
		streamResult := StreamResult{
			Prediction:  result.Prediction,
			Confidence:  result.Confidence,
			TokenIndex:  i,
			IsComplete:  i == numTokens-1,
			RuntimeUsed: string(runtime),
			LatencyMs:   latency.Milliseconds(),
		}

		h.sendResult(conn, "token", streamResult)

		// Small delay between tokens for realistic streaming
		time.Sleep(10 * time.Millisecond)
	}
}

// processBatchStream processes and streams results in batches
func (h *StreamingInferenceHandler) processBatchStream(
	conn *StreamConnection,
	req *StreamRequest,
	modelID string,
	runtime RuntimeType,
) {
	batchSize := req.BatchSize
	if batchSize <= 0 {
		batchSize = h.batchSize
	}

	numBatches := 5 // Simulated batch count

	for batch := 0; batch < numBatches; batch++ {
		select {
		case <-conn.Context.Done():
			return
		default:
		}

		start := time.Now()

		// Process batch inference
		result, err := h.gpuRuntime.Infer(conn.Context, req.Features, modelID)
		if err != nil {
			h.sendError(conn, fmt.Sprintf("batch inference failed: %v", err))
			return
		}

		latency := time.Since(start)

		streamResult := StreamResult{
			Prediction:  result.Prediction,
			Confidence:  result.Confidence,
			BatchIndex:  batch,
			IsComplete:  batch == numBatches-1,
			RuntimeUsed: string(runtime),
			LatencyMs:   latency.Milliseconds(),
		}

		h.sendResult(conn, "batch", streamResult)

		// Delay between batches
		time.Sleep(50 * time.Millisecond)
	}
}

// processContinuousStream maintains continuous inference stream
func (h *StreamingInferenceHandler) processContinuousStream(
	conn *StreamConnection,
	req *StreamRequest,
	modelID string,
	runtime RuntimeType,
) {
	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()

	count := 0
	maxIterations := 100

	for {
		select {
		case <-conn.Context.Done():
			return
		case <-ticker.C:
			if count >= maxIterations {
				return
			}

			start := time.Now()
			result, err := h.gpuRuntime.Infer(conn.Context, req.Features, modelID)
			if err != nil {
				h.sendError(conn, fmt.Sprintf("continuous inference failed: %v", err))
				return
			}

			latency := time.Since(start)

			streamResult := StreamResult{
				Prediction:  result.Prediction,
				Confidence:  result.Confidence,
				IsComplete:  false,
				RuntimeUsed: string(runtime),
				LatencyMs:   latency.Milliseconds(),
			}

			h.sendResult(conn, "continuous", streamResult)
			count++
		}
	}
}

// processStandardInference performs standard one-shot inference
func (h *StreamingInferenceHandler) processStandardInference(
	conn *StreamConnection,
	req *StreamRequest,
	modelID string,
	runtime RuntimeType,
) {
	start := time.Now()

	result, err := h.gpuRuntime.Infer(conn.Context, req.Features, modelID)
	if err != nil {
		h.sendError(conn, fmt.Sprintf("inference failed: %v", err))
		return
	}

	latency := time.Since(start)

	streamResult := StreamResult{
		Prediction:  result.Prediction,
		Confidence:  result.Confidence,
		IsComplete:  true,
		RuntimeUsed: string(runtime),
		LatencyMs:   latency.Milliseconds(),
	}

	h.sendResult(conn, "result", streamResult)
}

// sendResult sends a result message to the client
func (h *StreamingInferenceHandler) sendResult(conn *StreamConnection, msgType string, result StreamResult) {
	msg := StreamMessage{
		Type:      msgType,
		Data:      result,
		Timestamp: time.Now(),
		Metadata: map[string]interface{}{
			"connection_id": conn.ID,
			"model_id":      conn.ModelID,
		},
	}

	select {
	case conn.SendChan <- msg:
	case <-time.After(1 * time.Second):
		log.Printf("[StreamHandler] Send timeout for connection %s", conn.ID)
	case <-conn.Context.Done():
		return
	}
}

// sendError sends an error message to the client
func (h *StreamingInferenceHandler) sendError(conn *StreamConnection, errMsg string) {
	msg := StreamMessage{
		Type:      "error",
		Data:      errMsg,
		Timestamp: time.Now(),
	}

	select {
	case conn.SendChan <- msg:
	case <-time.After(1 * time.Second):
		log.Printf("[StreamHandler] Error send timeout for connection %s", conn.ID)
	}
}

// heartbeat sends periodic heartbeat messages
func (h *StreamingInferenceHandler) heartbeat(conn *StreamConnection) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			msg := StreamMessage{
				Type:      "heartbeat",
				Data:      map[string]interface{}{"status": "alive"},
				Timestamp: time.Now(),
			}

			select {
			case conn.SendChan <- msg:
			default:
			}

		case <-conn.Context.Done():
			return
		}
	}
}

// registerConnection registers a new WebSocket connection
func (h *StreamingInferenceHandler) registerConnection(conn *StreamConnection) bool {
	h.connMutex.Lock()
	defer h.connMutex.Unlock()

	if len(h.connections) >= h.maxConnections {
		return false
	}

	h.connections[conn.ID] = conn
	observability.RecordActiveStreamConnections(len(h.connections))
	return true
}

// unregisterConnection removes a WebSocket connection
func (h *StreamingInferenceHandler) unregisterConnection(connID string) {
	h.connMutex.Lock()
	defer h.connMutex.Unlock()

	if _, exists := h.connections[connID]; exists {
		delete(h.connections, connID)
		observability.RecordActiveStreamConnections(len(h.connections))
		log.Printf("[StreamHandler] WebSocket disconnected: %s", connID)
	}
}

// generateConnectionID generates a unique connection ID
func (h *StreamingInferenceHandler) generateConnectionID() string {
	return fmt.Sprintf("ws-%d", time.Now().UnixNano())
}

// GetActiveConnections returns the number of active connections
func (h *StreamingInferenceHandler) GetActiveConnections() int {
	h.connMutex.RLock()
	defer h.connMutex.RUnlock()
	return len(h.connections)
}

// GetConnectionStats returns statistics for all connections
func (h *StreamingInferenceHandler) GetConnectionStats() map[string]interface{} {
	h.connMutex.RLock()
	defer h.connMutex.RUnlock()

	stats := map[string]interface{}{
		"total_connections":  len(h.connections),
		"max_connections":    h.maxConnections,
		"stream_timeout_sec": h.streamTimeout.Seconds(),
	}

	return stats
}

// BroadcastToModel sends a message to all connections using a specific model
func (h *StreamingInferenceHandler) BroadcastToModel(modelID string, msg StreamMessage) {
	h.connMutex.RLock()
	connections := make([]*StreamConnection, 0)
	for _, conn := range h.connections {
		if conn.ModelID == modelID {
			connections = append(connections, conn)
		}
	}
	h.connMutex.RUnlock()

	for _, conn := range connections {
		select {
		case conn.SendChan <- msg:
		default:
			log.Printf("[StreamHandler] Broadcast failed for connection %s", conn.ID)
		}
	}
}

// UpgradeHandler returns a Fiber handler that upgrades HTTP to WebSocket
func (h *StreamingInferenceHandler) UpgradeHandler() fiber.Handler {
	return func(c *fiber.Ctx) error {
		if websocket.IsWebSocketUpgrade(c) {
			return c.Next()
		}
		return fiber.ErrUpgradeRequired
	}
}

// SerializeStreamMessage converts StreamMessage to JSON
func SerializeStreamMessage(msg StreamMessage) ([]byte, error) {
	return json.Marshal(msg)
}

// DeserializeStreamMessage converts JSON to StreamMessage
func DeserializeStreamMessage(data []byte) (*StreamMessage, error) {
	var msg StreamMessage
	err := json.Unmarshal(data, &msg)
	if err != nil {
		return nil, err
	}
	return &msg, nil
}
