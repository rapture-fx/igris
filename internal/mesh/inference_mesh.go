package mesh

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/nats-io/nats.go"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

// InferenceMesh manages a distributed mesh of inference services
type InferenceMesh struct {
	natsConn      *nats.Conn
	nodes         map[string]*MeshNode
	mu            sync.RWMutex
	healthChecker *HealthChecker
	tracer        trace.Tracer

	// Metrics
	meshRequests    prometheus.Counter
	meshLatency     prometheus.Histogram
	meshErrors      prometheus.Counter
	activeNodes     prometheus.Gauge
}

// MeshNode represents a single node in the inference mesh
type MeshNode struct {
	ID           string
	ServiceName  string
	Address      string
	Port         int
	Capabilities []string
	Metadata     map[string]string

	// Health & Status
	Status       NodeStatus
	LastSeen     time.Time
	HealthScore  float64

	// Performance
	ResponseTime time.Duration
	RequestCount int64
	ErrorCount   int64

	mu sync.RWMutex
}

type NodeStatus string

const (
	NodeStatusHealthy    NodeStatus = "healthy"
	NodeStatusDegraded   NodeStatus = "degraded"
	NodeStatusUnhealthy  NodeStatus = "unhealthy"
	NodeStatusUnreachable NodeStatus = "unreachable"
)

type MeshRequest struct {
	RequestID    string                 `json:"request_id"`
	TargetNode   string                 `json:"target_node,omitempty"`
	ModelName    string                 `json:"model_name"`
	InputData    interface{}            `json:"input_data"`
	Metadata     map[string]string      `json:"metadata,omitempty"`
	Timeout      time.Duration          `json:"timeout"`
	Capabilities []string               `json:"capabilities,omitempty"`
}

type MeshResponse struct {
	RequestID   string                 `json:"request_id"`
	NodeID      string                 `json:"node_id"`
	Prediction  interface{}            `json:"prediction"`
	Confidence  float64                `json:"confidence"`
	Latency     time.Duration          `json:"latency"`
	Metadata    map[string]string      `json:"metadata,omitempty"`
	Error       string                 `json:"error,omitempty"`
}

type NodeRegistration struct {
	NodeID       string            `json:"node_id"`
	ServiceName  string            `json:"service_name"`
	Address      string            `json:"address"`
	Port         int               `json:"port"`
	Capabilities []string          `json:"capabilities"`
	Metadata     map[string]string `json:"metadata,omitempty"`
}

type HealthChecker struct {
	mesh          *InferenceMesh
	checkInterval time.Duration
	timeout       time.Duration
	stopChan      chan struct{}
}

// NewInferenceMesh creates a new inference mesh instance
func NewInferenceMesh(natsURL string) (*InferenceMesh, error) {
	nc, err := nats.Connect(natsURL)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to NATS: %w", err)
	}

	mesh := &InferenceMesh{
		natsConn: nc,
		nodes:    make(map[string]*MeshNode),
		tracer:   otel.Tracer("inference-mesh"),

		meshRequests: promauto.NewCounter(prometheus.CounterOpts{
			Name: "inference_mesh_requests_total",
			Help: "Total number of inference mesh requests",
		}),
		meshLatency: promauto.NewHistogram(prometheus.HistogramOpts{
			Name:    "inference_mesh_latency_seconds",
			Help:    "Inference mesh request latency",
			Buckets: prometheus.DefBuckets,
		}),
		meshErrors: promauto.NewCounter(prometheus.CounterOpts{
			Name: "inference_mesh_errors_total",
			Help: "Total number of inference mesh errors",
		}),
		activeNodes: promauto.NewGauge(prometheus.GaugeOpts{
			Name: "inference_mesh_active_nodes",
			Help: "Number of active nodes in the mesh",
		}),
	}

	// Subscribe to node registration events
	if err := mesh.subscribeToRegistrations(); err != nil {
		nc.Close()
		return nil, fmt.Errorf("failed to subscribe to registrations: %w", err)
	}

	// Start health checker
	mesh.healthChecker = &HealthChecker{
		mesh:          mesh,
		checkInterval: 10 * time.Second,
		timeout:       5 * time.Second,
		stopChan:      make(chan struct{}),
	}
	go mesh.healthChecker.Start()

	return mesh, nil
}

// RegisterNode registers a new node in the mesh
func (im *InferenceMesh) RegisterNode(reg *NodeRegistration) error {
	im.mu.Lock()
	defer im.mu.Unlock()

	node := &MeshNode{
		ID:           reg.NodeID,
		ServiceName:  reg.ServiceName,
		Address:      reg.Address,
		Port:         reg.Port,
		Capabilities: reg.Capabilities,
		Metadata:     reg.Metadata,
		Status:       NodeStatusHealthy,
		LastSeen:     time.Now(),
		HealthScore:  1.0,
	}

	im.nodes[reg.NodeID] = node
	im.activeNodes.Set(float64(len(im.nodes)))

	// Publish registration event
	event := map[string]interface{}{
		"event_type": "node_registered",
		"node_id":    reg.NodeID,
		"service":    reg.ServiceName,
		"timestamp":  time.Now().Unix(),
	}

	data, _ := json.Marshal(event)
	im.natsConn.Publish("mesh.events.registration", data)

	return nil
}

// UnregisterNode removes a node from the mesh
func (im *InferenceMesh) UnregisterNode(nodeID string) error {
	im.mu.Lock()
	defer im.mu.Unlock()

	if _, exists := im.nodes[nodeID]; !exists {
		return fmt.Errorf("node %s not found", nodeID)
	}

	delete(im.nodes, nodeID)
	im.activeNodes.Set(float64(len(im.nodes)))

	// Publish unregistration event
	event := map[string]interface{}{
		"event_type": "node_unregistered",
		"node_id":    nodeID,
		"timestamp":  time.Now().Unix(),
	}

	data, _ := json.Marshal(event)
	im.natsConn.Publish("mesh.events.unregistration", data)

	return nil
}

// SendRequest sends an inference request through the mesh
func (im *InferenceMesh) SendRequest(ctx context.Context, req *MeshRequest) (*MeshResponse, error) {
	ctx, span := im.tracer.Start(ctx, "mesh.send_request")
	defer span.End()

	span.SetAttributes(
		attribute.String("request_id", req.RequestID),
		attribute.String("model_name", req.ModelName),
		attribute.String("target_node", req.TargetNode),
	)

	start := time.Now()
	im.meshRequests.Inc()

	// Determine target node
	var targetNode *MeshNode
	var err error

	if req.TargetNode != "" {
		// Explicit node specified
		targetNode, err = im.getNode(req.TargetNode)
		if err != nil {
			im.meshErrors.Inc()
			return nil, err
		}
	} else {
		// Select node based on capabilities
		targetNode, err = im.selectNode(req.Capabilities)
		if err != nil {
			im.meshErrors.Inc()
			return nil, err
		}
	}

	// Send request via NATS
	subject := fmt.Sprintf("mesh.inference.%s", targetNode.ID)
	reqData, err := json.Marshal(req)
	if err != nil {
		im.meshErrors.Inc()
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	// Request-reply pattern with timeout
	timeout := req.Timeout
	if timeout == 0 {
		timeout = 30 * time.Second
	}

	msg, err := im.natsConn.Request(subject, reqData, timeout)
	if err != nil {
		im.meshErrors.Inc()
		targetNode.recordError()
		return nil, fmt.Errorf("mesh request failed: %w", err)
	}

	// Parse response
	var resp MeshResponse
	if err := json.Unmarshal(msg.Data, &resp); err != nil {
		im.meshErrors.Inc()
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	// Record metrics
	latency := time.Since(start)
	im.meshLatency.Observe(latency.Seconds())
	targetNode.recordSuccess(latency)

	span.SetAttributes(
		attribute.String("node_id", resp.NodeID),
		attribute.Float64("latency_ms", float64(latency.Milliseconds())),
		attribute.Float64("confidence", resp.Confidence),
	)

	resp.Latency = latency
	return &resp, nil
}

// BroadcastRequest sends request to all capable nodes and returns fastest response
func (im *InferenceMesh) BroadcastRequest(ctx context.Context, req *MeshRequest) (*MeshResponse, error) {
	ctx, span := im.tracer.Start(ctx, "mesh.broadcast_request")
	defer span.End()

	// Find all capable nodes
	nodes := im.findCapableNodes(req.Capabilities)
	if len(nodes) == 0 {
		return nil, fmt.Errorf("no capable nodes found")
	}

	span.SetAttributes(
		attribute.Int("node_count", len(nodes)),
	)

	// Send to all nodes concurrently
	respChan := make(chan *MeshResponse, len(nodes))
	errChan := make(chan error, len(nodes))

	for _, node := range nodes {
		go func(n *MeshNode) {
			nodeReq := *req
			nodeReq.TargetNode = n.ID

			resp, err := im.SendRequest(ctx, &nodeReq)
			if err != nil {
				errChan <- err
				return
			}
			respChan <- resp
		}(node)
	}

	// Return first successful response
	select {
	case resp := <-respChan:
		return resp, nil
	case err := <-errChan:
		return nil, err
	case <-ctx.Done():
		return nil, ctx.Err()
	case <-time.After(req.Timeout):
		return nil, fmt.Errorf("broadcast timeout")
	}
}

// GetNodeStats returns statistics for all mesh nodes
func (im *InferenceMesh) GetNodeStats() []NodeStats {
	im.mu.RLock()
	defer im.mu.RUnlock()

	stats := make([]NodeStats, 0, len(im.nodes))

	for _, node := range im.nodes {
		node.mu.RLock()
		stats = append(stats, NodeStats{
			ID:           node.ID,
			ServiceName:  node.ServiceName,
			Address:      fmt.Sprintf("%s:%d", node.Address, node.Port),
			Status:       string(node.Status),
			HealthScore:  node.HealthScore,
			ResponseTime: node.ResponseTime.Milliseconds(),
			RequestCount: node.RequestCount,
			ErrorCount:   node.ErrorCount,
			LastSeen:     node.LastSeen.Unix(),
			Capabilities: node.Capabilities,
		})
		node.mu.RUnlock()
	}

	return stats
}

type NodeStats struct {
	ID           string   `json:"id"`
	ServiceName  string   `json:"service_name"`
	Address      string   `json:"address"`
	Status       string   `json:"status"`
	HealthScore  float64  `json:"health_score"`
	ResponseTime int64    `json:"response_time_ms"`
	RequestCount int64    `json:"request_count"`
	ErrorCount   int64    `json:"error_count"`
	LastSeen     int64    `json:"last_seen"`
	Capabilities []string `json:"capabilities"`
}

// Close shuts down the inference mesh
func (im *InferenceMesh) Close() {
	close(im.healthChecker.stopChan)
	im.natsConn.Close()
}

// Helper methods

func (im *InferenceMesh) getNode(nodeID string) (*MeshNode, error) {
	im.mu.RLock()
	defer im.mu.RUnlock()

	node, exists := im.nodes[nodeID]
	if !exists {
		return nil, fmt.Errorf("node %s not found", nodeID)
	}

	return node, nil
}

func (im *InferenceMesh) selectNode(capabilities []string) (*MeshNode, error) {
	im.mu.RLock()
	defer im.mu.RUnlock()

	// Find healthy nodes with required capabilities
	var candidates []*MeshNode

	for _, node := range im.nodes {
		node.mu.RLock()
		if node.Status == NodeStatusHealthy && im.hasCapabilities(node, capabilities) {
			candidates = append(candidates, node)
		}
		node.mu.RUnlock()
	}

	if len(candidates) == 0 {
		return nil, fmt.Errorf("no healthy nodes with required capabilities")
	}

	// Select node with best health score and lowest response time
	var best *MeshNode
	bestScore := 0.0

	for _, node := range candidates {
		node.mu.RLock()
		score := node.HealthScore / (1.0 + float64(node.ResponseTime.Milliseconds())/1000.0)
		node.mu.RUnlock()

		if score > bestScore {
			bestScore = score
			best = node
		}
	}

	return best, nil
}

func (im *InferenceMesh) findCapableNodes(capabilities []string) []*MeshNode {
	im.mu.RLock()
	defer im.mu.RUnlock()

	var nodes []*MeshNode

	for _, node := range im.nodes {
		if im.hasCapabilities(node, capabilities) {
			nodes = append(nodes, node)
		}
	}

	return nodes
}

func (im *InferenceMesh) hasCapabilities(node *MeshNode, required []string) bool {
	if len(required) == 0 {
		return true
	}

	capSet := make(map[string]bool)
	for _, cap := range node.Capabilities {
		capSet[cap] = true
	}

	for _, req := range required {
		if !capSet[req] {
			return false
		}
	}
	return true
}

func (im *InferenceMesh) subscribeToRegistrations() error {
	_, err := im.natsConn.Subscribe("mesh.register", func(msg *nats.Msg) {
		var reg NodeRegistration
		if err := json.Unmarshal(msg.Data, &reg); err != nil {
			return
		}

		im.RegisterNode(&reg)
	})

	return err
}

func (node *MeshNode) recordSuccess(latency time.Duration) {
	node.mu.Lock()
	defer node.mu.Unlock()

	node.RequestCount++
	node.ResponseTime = latency
	node.LastSeen = time.Now()

	// Update health score (exponential moving average)
	successImpact := 0.1
	node.HealthScore = 0.9*node.HealthScore + successImpact
	if node.HealthScore > 1.0 {
		node.HealthScore = 1.0
	}

	if node.HealthScore >= 0.7 {
		node.Status = NodeStatusHealthy
	} else if node.HealthScore >= 0.4 {
		node.Status = NodeStatusDegraded
	} else {
		node.Status = NodeStatusUnhealthy
	}
}

func (node *MeshNode) recordError() {
	node.mu.Lock()
	defer node.mu.Unlock()

	node.ErrorCount++
	node.LastSeen = time.Now()

	// Degrade health score
	errorImpact := 0.2
	node.HealthScore = node.HealthScore - errorImpact
	if node.HealthScore < 0 {
		node.HealthScore = 0
	}

	if node.HealthScore >= 0.7 {
		node.Status = NodeStatusHealthy
	} else if node.HealthScore >= 0.4 {
		node.Status = NodeStatusDegraded
	} else {
		node.Status = NodeStatusUnhealthy
	}
}

// HealthChecker implementation

func (hc *HealthChecker) Start() {
	ticker := time.NewTicker(hc.checkInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			hc.checkAllNodes()
		case <-hc.stopChan:
			return
		}
	}
}

func (hc *HealthChecker) checkAllNodes() {
	hc.mesh.mu.RLock()
	nodes := make([]*MeshNode, 0, len(hc.mesh.nodes))
	for _, node := range hc.mesh.nodes {
		nodes = append(nodes, node)
	}
	hc.mesh.mu.RUnlock()

	for _, node := range nodes {
		go hc.checkNode(node)
	}
}

func (hc *HealthChecker) checkNode(node *MeshNode) {
	subject := fmt.Sprintf("mesh.health.%s", node.ID)

	msg, err := hc.mesh.natsConn.Request(subject, []byte(`{"check":"health"}`), hc.timeout)

	node.mu.Lock()
	defer node.mu.Unlock()

	if err != nil {
		// Health check failed
		node.Status = NodeStatusUnreachable
		node.HealthScore *= 0.5 // Halve health score
	} else {
		// Health check succeeded
		node.LastSeen = time.Now()

		var health map[string]interface{}
		if json.Unmarshal(msg.Data, &health) == nil {
			if status, ok := health["status"].(string); ok && status == "healthy" {
				node.Status = NodeStatusHealthy
				node.HealthScore = 0.9*node.HealthScore + 0.1 // Slowly recover
				if node.HealthScore > 1.0 {
					node.HealthScore = 1.0
				}
			}
		}
	}
}
