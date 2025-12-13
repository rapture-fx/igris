package tests

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/igris-inertial/go-sdk/pkg/websocket"
	"github.com/igris-inertial/go-sdk/pkg/models/streaming"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

// MockWebSocketServer creates a test WebSocket server
type MockWebSocketServer struct {
	*httptest.Server
	clients    []*websocket.Conn
	messages   []streaming.WebSocketMessage
	mu         sync.RWMutex
	authToken  string
	authResult bool
}

func NewMockWebSocketServer() *MockWebSocketServer {
	server := &MockWebSocketServer{
		clients:    make([]*websocket.Conn, 0),
		messages:   make([]streaming.WebSocketMessage, 0),
		authToken:  "test_token_123",
		authResult: true,
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/stream", server.handleWebSocket)
	server.Server = httptest.NewServer(mux)

	return server
}

func (s *MockWebSocketServer) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}

	s.mu.Lock()
	s.clients = append(s.clients, conn)
	s.mu.Unlock()

	defer func() {
		s.mu.Lock()
		for i, c := range s.clients {
			if c == conn {
				s.clients = append(s.clients[:i], s.clients[i+1:]...)
				break
			}
		}
		s.mu.Unlock()
		conn.Close()
	}()

	for {
		var msg streaming.WebSocketMessage
		err := conn.ReadJSON(&msg)
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				fmt.Printf("WebSocket error: %v\n", err)
			}
			break
		}

		s.mu.Lock()
		s.messages = append(s.messages, msg)
		s.mu.Unlock()

		// Handle authentication
		if msg.Type == "authenticate" {
			authResponse := streaming.WebSocketMessage{
				Type:      "auth_response",
				Success:   s.authResult,
				Timestamp: time.Now(),
			}
			if s.authResult {
				authResponse.Data = map[string]interface{}{
					"user_id":    "user123",
					"session_id": "session_abc",
				}
			} else {
				authResponse.Error = "Invalid token"
			}
			conn.WriteJSON(authResponse)
		}

		// Handle subscription
		if msg.Type == "subscribe" {
			subResponse := streaming.WebSocketMessage{
				Type:      "subscription_confirmed",
				Channel:   msg.Channel,
				Timestamp: time.Now(),
				Data: map[string]interface{}{
					"status": "subscribed",
				},
			}
			conn.WriteJSON(subResponse)
		}

		// Handle ping
		if msg.Type == "ping" {
			pongResponse := streaming.WebSocketMessage{
				Type:      "pong",
				Timestamp: time.Now(),
			}
			conn.WriteJSON(pongResponse)
		}
	}
}

func (s *MockWebSocketServer) BroadcastMessage(msg streaming.WebSocketMessage) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	for _, conn := range s.clients {
		conn.WriteJSON(msg)
	}
}

func (s *MockWebSocketServer) GetMessages() []streaming.WebSocketMessage {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return append([]streaming.WebSocketMessage{}, s.messages...)
}

func (s *MockWebSocketServer) SetAuthResult(result bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.authResult = result
}

func (s *MockWebSocketServer) GetURL() string {
	return "ws" + strings.TrimPrefix(s.Server.URL, "http") + "/stream"
}

func TestStreamingClient_Connect(t *testing.T) {
	server := NewMockWebSocketServer()
	defer server.Close()

	tests := []struct {
		name        string
		authResult  bool
		expectError bool
	}{
		{
			name:        "successful connection and authentication",
			authResult:  true,
			expectError: false,
		},
		{
			name:        "authentication failure",
			authResult:  false,
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server.SetAuthResult(tt.authResult)

			config := &websocket.Config{
				URL:                 server.GetURL(),
				AuthToken:           "test_token_123",
				ReconnectInterval:   time.Second,
				MaxReconnectAttempts: 3,
				PingInterval:        30 * time.Second,
				PingTimeout:         10 * time.Second,
				MessageQueueSize:    1000,
			}

			client := websocket.NewStreamingClient(config)

			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()

			err := client.Connect(ctx)

			if tt.expectError {
				assert.Error(t, err)
				assert.False(t, client.IsConnected())
			} else {
				assert.NoError(t, err)
				assert.True(t, client.IsConnected())
				
				// Clean disconnect
				client.Disconnect()
				assert.False(t, client.IsConnected())
			}
		})
	}
}

func TestStreamingClient_SendMessage(t *testing.T) {
	server := NewMockWebSocketServer()
	defer server.Close()

	config := &websocket.Config{
		URL:                 server.GetURL(),
		AuthToken:           "test_token_123",
		ReconnectInterval:   time.Second,
		MaxReconnectAttempts: 3,
	}

	client := websocket.NewStreamingClient(config)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err := client.Connect(ctx)
	require.NoError(t, err)
	defer client.Disconnect()

	tests := []struct {
		name    string
		message streaming.StreamingMessage
	}{
		{
			name: "subscribe message",
			message: streaming.StreamingMessage{
				Type:    streaming.MessageTypeSubscribe,
				Channel: "data_processing",
				Payload: map[string]interface{}{
					"job_id": "job_123",
				},
			},
		},
		{
			name: "data message",
			message: streaming.StreamingMessage{
				Type: streaming.MessageTypeData,
				Payload: map[string]interface{}{
					"test": "data",
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := client.SendMessage(tt.message)
			assert.NoError(t, err)

			// Allow message to be processed
			time.Sleep(100 * time.Millisecond)

			messages := server.GetMessages()
			found := false
			for _, msg := range messages {
				if msg.Type == string(tt.message.Type) && msg.Channel == tt.message.Channel {
					found = true
					break
				}
			}
			assert.True(t, found, "Message not found on server")
		})
	}
}

func TestStreamingClient_ReceiveMessage(t *testing.T) {
	server := NewMockWebSocketServer()
	defer server.Close()

	config := &websocket.Config{
		URL:       server.GetURL(),
		AuthToken: "test_token_123",
	}

	client := websocket.NewStreamingClient(config)

	var receivedMessages []streaming.StreamingMessage
	var mu sync.Mutex

	client.OnMessage(func(msg streaming.StreamingMessage) {
		mu.Lock()
		receivedMessages = append(receivedMessages, msg)
		mu.Unlock()
	})

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err := client.Connect(ctx)
	require.NoError(t, err)
	defer client.Disconnect()

	// Send a test message from server to client
	testMessage := streaming.WebSocketMessage{
		Type:    "job_update",
		Channel: "data_processing",
		Data: map[string]interface{}{
			"job_id":   "job_123",
			"status":   "completed",
			"progress": 100,
		},
		Timestamp: time.Now(),
	}

	server.BroadcastMessage(testMessage)

	// Allow message to be processed
	time.Sleep(100 * time.Millisecond)

	mu.Lock()
	defer mu.Unlock()

	assert.Len(t, receivedMessages, 1)
	assert.Equal(t, streaming.MessageTypeJobUpdate, receivedMessages[0].Type)
	assert.Equal(t, "data_processing", receivedMessages[0].Channel)
}

func TestStreamingClient_Subscription(t *testing.T) {
	server := NewMockWebSocketServer()
	defer server.Close()

	config := &websocket.Config{
		URL:       server.GetURL(),
		AuthToken: "test_token_123",
	}

	client := websocket.NewStreamingClient(config)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err := client.Connect(ctx)
	require.NoError(t, err)
	defer client.Disconnect()

	// Test subscription
	channels := []string{"data_processing", "ml_pipeline", "analytics"}

	for _, channel := range channels {
		err := client.Subscribe(channel)
		assert.NoError(t, err)
		assert.True(t, client.IsSubscribed(channel))
	}

	// Test unsubscription
	err = client.Unsubscribe("data_processing")
	assert.NoError(t, err)
	assert.False(t, client.IsSubscribed("data_processing"))
	assert.True(t, client.IsSubscribed("ml_pipeline"))
	assert.True(t, client.IsSubscribed("analytics"))
}

func TestStreamingClient_Heartbeat(t *testing.T) {
	server := NewMockWebSocketServer()
	defer server.Close()

	config := &websocket.Config{
		URL:          server.GetURL(),
		AuthToken:    "test_token_123",
		PingInterval: 100 * time.Millisecond, // Short interval for testing
		PingTimeout:  50 * time.Millisecond,
	}

	client := websocket.NewStreamingClient(config)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err := client.Connect(ctx)
	require.NoError(t, err)
	defer client.Disconnect()

	// Allow some ping messages to be sent
	time.Sleep(300 * time.Millisecond)

	messages := server.GetMessages()
	pingCount := 0
	for _, msg := range messages {
		if msg.Type == "ping" {
			pingCount++
		}
	}

	assert.Greater(t, pingCount, 0, "Expected at least one ping message")
}

func TestStreamingClient_Reconnection(t *testing.T) {
	server := NewMockWebSocketServer()
	defer server.Close()

	config := &websocket.Config{
		URL:                  server.GetURL(),
		AuthToken:            "test_token_123",
		ReconnectInterval:    100 * time.Millisecond,
		MaxReconnectAttempts: 3,
	}

	client := websocket.NewStreamingClient(config)

	var reconnectAttempts int
	var mu sync.Mutex

	client.OnReconnectAttempt(func(attempt int) {
		mu.Lock()
		reconnectAttempts = attempt
		mu.Unlock()
	})

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err := client.Connect(ctx)
	require.NoError(t, err)

	// Subscribe to a channel to test restoration
	err = client.Subscribe("data_processing")
	require.NoError(t, err)

	// Simulate server restart
	server.Close()
	server = NewMockWebSocketServer()
	defer server.Close()

	// Update URL for reconnection
	client.UpdateURL(server.GetURL())

	// Allow reconnection attempts
	time.Sleep(500 * time.Millisecond)

	mu.Lock()
	attempts := reconnectAttempts
	mu.Unlock()

	assert.Greater(t, attempts, 0, "Expected reconnection attempts")

	client.Disconnect()
}

func TestStreamingClient_MessageQueue(t *testing.T) {
	server := NewMockWebSocketServer()
	defer server.Close()

	config := &websocket.Config{
		URL:              server.GetURL(),
		AuthToken:        "test_token_123",
		MessageQueueSize: 5, // Small queue for testing
	}

	client := websocket.NewStreamingClient(config)

	// Don't connect yet, so messages will be queued
	messages := []streaming.StreamingMessage{
		{Type: streaming.MessageTypeData, Payload: map[string]interface{}{"seq": 1}},
		{Type: streaming.MessageTypeData, Payload: map[string]interface{}{"seq": 2}},
		{Type: streaming.MessageTypeData, Payload: map[string]interface{}{"seq": 3}},
		{Type: streaming.MessageTypeData, Payload: map[string]interface{}{"seq": 4}},
		{Type: streaming.MessageTypeData, Payload: map[string]interface{}{"seq": 5}},
		{Type: streaming.MessageTypeData, Payload: map[string]interface{}{"seq": 6}}, // Should be dropped
		{Type: streaming.MessageTypeData, Payload: map[string]interface{}{"seq": 7}}, // Should be dropped
	}

	for _, msg := range messages {
		err := client.SendMessage(msg)
		assert.NoError(t, err)
	}

	assert.Equal(t, 5, client.GetQueueSize())

	// Now connect and verify queued messages are sent
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err := client.Connect(ctx)
	require.NoError(t, err)
	defer client.Disconnect()

	// Allow queued messages to be processed
	time.Sleep(100 * time.Millisecond)

	assert.Equal(t, 0, client.GetQueueSize())

	serverMessages := server.GetMessages()
	dataMessageCount := 0
	for _, msg := range serverMessages {
		if msg.Type == "data" {
			dataMessageCount++
		}
	}

	assert.Equal(t, 5, dataMessageCount, "Expected 5 queued messages to be sent")
}

func TestStreamingClient_ConcurrentOperations(t *testing.T) {
	server := NewMockWebSocketServer()
	defer server.Close()

	config := &websocket.Config{
		URL:       server.GetURL(),
		AuthToken: "test_token_123",
	}

	client := websocket.NewStreamingClient(config)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err := client.Connect(ctx)
	require.NoError(t, err)
	defer client.Disconnect()

	// Concurrent subscriptions
	channels := []string{"channel1", "channel2", "channel3", "channel4", "channel5"}
	var wg sync.WaitGroup
	var errors []error
	var mu sync.Mutex

	for _, channel := range channels {
		wg.Add(1)
		go func(ch string) {
			defer wg.Done()
			err := client.Subscribe(ch)
			if err != nil {
				mu.Lock()
				errors = append(errors, err)
				mu.Unlock()
			}
		}(channel)
	}

	wg.Wait()

	assert.Empty(t, errors, "No errors expected during concurrent subscriptions")

	for _, channel := range channels {
		assert.True(t, client.IsSubscribed(channel))
	}

	// Concurrent message sending
	wg = sync.WaitGroup{}
	errors = []error{}

	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func(seq int) {
			defer wg.Done()
			msg := streaming.StreamingMessage{
				Type: streaming.MessageTypeData,
				Payload: map[string]interface{}{
					"sequence": seq,
				},
			}
			err := client.SendMessage(msg)
			if err != nil {
				mu.Lock()
				errors = append(errors, err)
				mu.Unlock()
			}
		}(i)
	}

	wg.Wait()

	assert.Empty(t, errors, "No errors expected during concurrent message sending")
}

func TestStreamingClient_ErrorHandling(t *testing.T) {
	t.Run("connection timeout", func(t *testing.T) {
		config := &websocket.Config{
			URL:       "ws://nonexistent.example.com/stream",
			AuthToken: "test_token_123",
		}

		client := websocket.NewStreamingClient(config)

		ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
		defer cancel()

		err := client.Connect(ctx)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "context deadline exceeded")
	})

	t.Run("invalid URL", func(t *testing.T) {
		config := &websocket.Config{
			URL:       "invalid-url",
			AuthToken: "test_token_123",
		}

		client := websocket.NewStreamingClient(config)

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		err := client.Connect(ctx)
		assert.Error(t, err)
	})

	t.Run("empty auth token", func(t *testing.T) {
		server := NewMockWebSocketServer()
		defer server.Close()

		config := &websocket.Config{
			URL:       server.GetURL(),
			AuthToken: "",
		}

		assert.Panics(t, func() {
			websocket.NewStreamingClient(config)
		}, "Expected panic for empty auth token")
	})

	t.Run("malformed message handling", func(t *testing.T) {
		server := NewMockWebSocketServer()
		defer server.Close()

		config := &websocket.Config{
			URL:       server.GetURL(),
			AuthToken: "test_token_123",
		}

		client := websocket.NewStreamingClient(config)

		var errors []error
		var mu sync.Mutex

		client.OnError(func(err error) {
			mu.Lock()
			errors = append(errors, err)
			mu.Unlock()
		})

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		err := client.Connect(ctx)
		require.NoError(t, err)
		defer client.Disconnect()

		// Send malformed message from server
		malformedMessage := streaming.WebSocketMessage{
			Type: "invalid_type",
			Data: "invalid_data_structure",
		}

		server.BroadcastMessage(malformedMessage)

		// Allow message to be processed
		time.Sleep(100 * time.Millisecond)

		mu.Lock()
		defer mu.Unlock()

		// Should handle malformed messages gracefully without crashing
		assert.True(t, client.IsConnected())
	})
}

func TestMessageHandler_Filtering(t *testing.T) {
	handler := websocket.NewMessageHandler()

	var jobMessages []streaming.StreamingMessage
	var errorMessages []streaming.StreamingMessage
	var mu sync.Mutex

	// Register type-specific handlers
	handler.OnMessageType(streaming.MessageTypeJobUpdate, func(msg streaming.StreamingMessage) {
		mu.Lock()
		jobMessages = append(jobMessages, msg)
		mu.Unlock()
	})

	handler.OnMessageType(streaming.MessageTypeError, func(msg streaming.StreamingMessage) {
		mu.Lock()
		errorMessages = append(errorMessages, msg)
		mu.Unlock()
	})

	// Test messages
	messages := []streaming.StreamingMessage{
		{
			Type:    streaming.MessageTypeJobUpdate,
			Payload: map[string]interface{}{"job_id": "job_123"},
		},
		{
			Type:    streaming.MessageTypeError,
			Payload: map[string]interface{}{"error": "processing failed"},
		},
		{
			Type:    streaming.MessageTypeData,
			Payload: map[string]interface{}{"data": "some data"},
		},
	}

	for _, msg := range messages {
		handler.HandleMessage(msg)
	}

	mu.Lock()
	defer mu.Unlock()

	assert.Len(t, jobMessages, 1)
	assert.Len(t, errorMessages, 1)
	assert.Equal(t, "job_123", jobMessages[0].Payload["job_id"])
}

func TestMessageHandler_ChannelFiltering(t *testing.T) {
	handler := websocket.NewMessageHandler()

	var processingMessages []streaming.StreamingMessage
	var mlMessages []streaming.StreamingMessage
	var mu sync.Mutex

	// Register channel-specific handlers
	handler.OnChannel("data_processing", func(msg streaming.StreamingMessage) {
		mu.Lock()
		processingMessages = append(processingMessages, msg)
		mu.Unlock()
	})

	handler.OnChannel("ml_pipeline", func(msg streaming.StreamingMessage) {
		mu.Lock()
		mlMessages = append(mlMessages, msg)
		mu.Unlock()
	})

	// Test messages
	messages := []streaming.StreamingMessage{
		{
			Type:    streaming.MessageTypeData,
			Channel: "data_processing",
			Payload: map[string]interface{}{"status": "active"},
		},
		{
			Type:    streaming.MessageTypeData,
			Channel: "ml_pipeline",
			Payload: map[string]interface{}{"model": "trained"},
		},
		{
			Type:    streaming.MessageTypeData,
			Channel: "analytics",
			Payload: map[string]interface{}{"metric": "value"},
		},
	}

	for _, msg := range messages {
		handler.HandleMessage(msg)
	}

	mu.Lock()
	defer mu.Unlock()

	assert.Len(t, processingMessages, 1)
	assert.Len(t, mlMessages, 1)
	assert.Equal(t, "active", processingMessages[0].Payload["status"])
	assert.Equal(t, "trained", mlMessages[0].Payload["model"])
}

func TestMessageHandler_Transformation(t *testing.T) {
	handler := websocket.NewMessageHandler()

	var transformedMessages []streaming.StreamingMessage
	var mu sync.Mutex

	// Add transformer
	handler.AddTransformer(func(msg streaming.StreamingMessage) streaming.StreamingMessage {
		if msg.Type == streaming.MessageTypeJobUpdate {
			if msg.Payload == nil {
				msg.Payload = make(map[string]interface{})
			}
			msg.Payload["client_timestamp"] = time.Now()
			msg.Payload["client_id"] = "go-sdk"
		}
		return msg
	})

	handler.OnMessage(func(msg streaming.StreamingMessage) {
		mu.Lock()
		transformedMessages = append(transformedMessages, msg)
		mu.Unlock()
	})

	jobMessage := streaming.StreamingMessage{
		Type:    streaming.MessageTypeJobUpdate,
		Payload: map[string]interface{}{"job_id": "job_123", "status": "running"},
	}

	handler.HandleMessage(jobMessage)

	mu.Lock()
	defer mu.Unlock()

	assert.Len(t, transformedMessages, 1)
	assert.Contains(t, transformedMessages[0].Payload, "client_timestamp")
	assert.Equal(t, "go-sdk", transformedMessages[0].Payload["client_id"])
}

func TestMessageHandler_Validation(t *testing.T) {
	handler := websocket.NewMessageHandler()

	var validMessages []streaming.StreamingMessage
	var invalidMessages []streaming.StreamingMessage
	var mu sync.Mutex

	// Add validator
	handler.AddValidator(func(msg streaming.StreamingMessage) bool {
		if msg.Type == streaming.MessageTypeJobUpdate {
			if msg.Payload == nil {
				return false
			}
			_, hasJobID := msg.Payload["job_id"]
			_, hasStatus := msg.Payload["status"]
			return hasJobID && hasStatus
		}
		return true
	})

	handler.OnValidMessage(func(msg streaming.StreamingMessage) {
		mu.Lock()
		validMessages = append(validMessages, msg)
		mu.Unlock()
	})

	handler.OnInvalidMessage(func(msg streaming.StreamingMessage) {
		mu.Lock()
		invalidMessages = append(invalidMessages, msg)
		mu.Unlock()
	})

	// Test messages
	validMessage := streaming.StreamingMessage{
		Type:    streaming.MessageTypeJobUpdate,
		Payload: map[string]interface{}{"job_id": "job_123", "status": "running"},
	}

	invalidMessage := streaming.StreamingMessage{
		Type:    streaming.MessageTypeJobUpdate,
		Payload: map[string]interface{}{"job_id": "job_456"}, // Missing status
	}

	handler.HandleMessage(validMessage)
	handler.HandleMessage(invalidMessage)

	mu.Lock()
	defer mu.Unlock()

	assert.Len(t, validMessages, 1)
	assert.Len(t, invalidMessages, 1)
}

// Benchmark tests
func BenchmarkStreamingClient_SendMessage(b *testing.B) {
	server := NewMockWebSocketServer()
	defer server.Close()

	config := &websocket.Config{
		URL:       server.GetURL(),
		AuthToken: "test_token_123",
	}

	client := websocket.NewStreamingClient(config)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	err := client.Connect(ctx)
	require.NoError(b, err)
	defer client.Disconnect()

	message := streaming.StreamingMessage{
		Type:    streaming.MessageTypeData,
		Payload: map[string]interface{}{"test": "data"},
	}

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			err := client.SendMessage(message)
			if err != nil {
				b.Error(err)
			}
		}
	})
}

func BenchmarkMessageHandler_HandleMessage(b *testing.B) {
	handler := websocket.NewMessageHandler()

	messageCount := 0
	handler.OnMessage(func(msg streaming.StreamingMessage) {
		messageCount++
	})

	message := streaming.StreamingMessage{
		Type:    streaming.MessageTypeData,
		Payload: map[string]interface{}{"benchmark": "data"},
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		handler.HandleMessage(message)
	}
}