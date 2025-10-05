package ml

import (
	"context"
	"fmt"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	pb "github.com/schlep-engine/go-gateway/proto"
)

// ClientPool manages multiple gRPC connections for load balancing
type ClientPool struct {
	clients []*Client
	current int
}

// NewClientPool creates a pool of gRPC clients with round-robin load balancing
func NewClientPool(addresses []string) (*ClientPool, error) {
	clients := make([]*Client, len(addresses))

	for i, addr := range addresses {
		client, err := NewClient(addr)
		if err != nil {
			return nil, fmt.Errorf("failed to connect to %s: %w", addr, err)
		}
		clients[i] = client
	}

	return &ClientPool{
		clients: clients,
		current: 0,
	}, nil
}

// NewClientWithDNSRoundRobin creates a client with DNS-based round-robin load balancing
func NewClientWithDNSRoundRobin(dnsAddress string) (*Client, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Use DNS resolver with round-robin load balancing
	conn, err := grpc.DialContext(ctx, dnsAddress,
		grpc.WithDefaultServiceConfig(`{"loadBalancingPolicy":"round_robin"}`),
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithBlock(),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to ML service at %s: %w", dnsAddress, err)
	}

	return &Client{
		conn:   conn,
		client: pb.NewMLServiceClient(conn),
	}, nil
}

// Next returns the next client in round-robin fashion
func (p *ClientPool) Next() *Client {
	client := p.clients[p.current]
	p.current = (p.current + 1) % len(p.clients)
	return client
}

// Predict calls the next available ML service in the pool
func (p *ClientPool) Predict(ctx context.Context, features []float64, modelId string) (*PredictResponse, error) {
	client := p.Next()
	return client.Predict(ctx, features, modelId)
}

// Close closes all connections in the pool
func (p *ClientPool) Close() error {
	for _, client := range p.clients {
		if err := client.Close(); err != nil {
			return err
		}
	}
	return nil
}

// Client is a gRPC client for the Python ML service (original implementation)
type Client struct {
	conn   *grpc.ClientConn
	client pb.MLServiceClient
}

// NewClient creates a new ML service client
func NewClient(address string) (*Client, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	conn, err := grpc.DialContext(ctx, address,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithBlock(),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to ML service at %s: %w", address, err)
	}

	return &Client{
		conn:   conn,
		client: pb.NewMLServiceClient(conn),
	}, nil
}

// Close closes the gRPC connection
func (c *Client) Close() error {
	if c.conn != nil {
		return c.conn.Close()
	}
	return nil
}

// PredictResponse contains the prediction result
type PredictResponse struct {
	Prediction float64
	Confidence float64
	ModelId    string
}

// Predict calls the Python ML service to make a prediction
func (c *Client) Predict(ctx context.Context, features []float64, modelId string) (*PredictResponse, error) {
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	req := &pb.PredictRequest{
		Features: features,
		ModelId:  modelId,
	}

	resp, err := c.client.Predict(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("prediction failed: %w", err)
	}

	return &PredictResponse{
		Prediction: resp.Prediction,
		Confidence: resp.Confidence,
		ModelId:    resp.ModelId,
	}, nil
}

// HealthCheck checks if the ML service is healthy
func (c *Client) HealthCheck(ctx context.Context) (bool, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	req := &pb.HealthCheckRequest{}
	resp, err := c.client.HealthCheck(ctx, req)
	if err != nil {
		return false, err
	}

	return resp.Status == "healthy", nil
}
