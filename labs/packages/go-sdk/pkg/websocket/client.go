package websocket

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/igris-inertial/go-sdk/pkg/config"
	"github.com/igris-inertial/go-sdk/pkg/models"
	"github.com/igris-inertial/go-sdk/pkg/observability"
	"go.opentelemetry.io/otel/attribute"
)

// StreamingClient handles real-time WebSocket connections for data streaming
type StreamingClient struct {
	config      *config.Config
	logger      *observability.Logger
	metrics     *observability.MetricsCollector
	tracer      *observability.Tracer
	
	// Connection management
	conn        *websocket.Conn
	connMu      sync.RWMutex
	connected   bool
	
	// Event handling
	eventHandlers map[models.EventType][]EventHandler
	handlersMu    sync.RWMutex
	
	// Channels for internal communication
	writeCh     chan []byte
	closeCh     chan struct{}
	reconnectCh chan struct{}
	
	// Configuration
	reconnectAttempts int
	reconnectDelay    time.Duration
	pingInterval      time.Duration
	writeTimeout      time.Duration
	readTimeout       time.Duration
	
	// Authentication
	authToken string
}

// EventHandler defines a function that handles WebSocket events
type EventHandler func(event *models.Event) error

// StreamingConfig contains configuration for the streaming client
type StreamingConfig struct {
	ReconnectAttempts int           `json:"reconnect_attempts"`
	ReconnectDelay    time.Duration `json:"reconnect_delay"`
	PingInterval      time.Duration `json:"ping_interval"`
	WriteTimeout      time.Duration `json:"write_timeout"`
	ReadTimeout       time.Duration `json:"read_timeout"`
}

// DefaultStreamingConfig returns default configuration for streaming
func DefaultStreamingConfig() *StreamingConfig {
	return &StreamingConfig{
		ReconnectAttempts: 5,
		ReconnectDelay:    2 * time.Second,
		PingInterval:      30 * time.Second,
		WriteTimeout:      10 * time.Second,
		ReadTimeout:       60 * time.Second,
	}
}

// NewStreamingClient creates a new WebSocket streaming client
func NewStreamingClient(cfg *config.Config, authToken string) *StreamingClient {
	streamingConfig := DefaultStreamingConfig()
	
	logger, _ := observability.NewLogger(cfg.ServiceName, cfg.ServiceVersion, cfg.LogLevel, cfg.EnableLogging)
	metrics := observability.NewMetricsCollector(cfg.ServiceName, cfg.EnableMetrics)
	tracer, _ := observability.NewTracer(observability.TracingConfig{
		Enabled:        cfg.EnableTracing,
		ServiceName:    cfg.ServiceName,
		ServiceVersion: cfg.ServiceVersion,
		SamplingRatio:  1.0,
	})

	return &StreamingClient{
		config:            cfg,
		logger:            logger,
		metrics:           metrics,
		tracer:            tracer,
		eventHandlers:     make(map[models.EventType][]EventHandler),
		writeCh:           make(chan []byte, 100),
		closeCh:           make(chan struct{}),
		reconnectCh:       make(chan struct{}),
		reconnectAttempts: streamingConfig.ReconnectAttempts,
		reconnectDelay:    streamingConfig.ReconnectDelay,
		pingInterval:      streamingConfig.PingInterval,
		writeTimeout:      streamingConfig.WriteTimeout,
		readTimeout:       streamingConfig.ReadTimeout,
		authToken:         authToken,
	}
}

// Connect establishes a WebSocket connection
func (c *StreamingClient) Connect(ctx context.Context) error {
	// Start tracing
	ctx, span := c.tracer.StartSpan(ctx, "websocket_connect")
	defer span.End()

	c.connMu.Lock()
	defer c.connMu.Unlock()

	if c.connected {
		return fmt.Errorf("already connected")
	}

	// Build WebSocket URL
	wsURL := fmt.Sprintf("ws://%s/api/v1/websocket/connect", c.config.BaseURL)
	if c.config.BaseURL[:8] == "https://" {
		wsURL = fmt.Sprintf("wss://%s/api/v1/websocket/connect", c.config.BaseURL[8:])
	} else if c.config.BaseURL[:7] == "http://" {
		wsURL = fmt.Sprintf("ws://%s/api/v1/websocket/connect", c.config.BaseURL[7:])
	}

	c.logger.WithContext(ctx).WithFields(map[string]interface{}{
		"websocket_url": wsURL,
	}).Info("Connecting to WebSocket")

	// Set up connection headers
	headers := make(map[string][]string)
	if c.authToken != "" {
		headers["Authorization"] = []string{fmt.Sprintf("Bearer %s", c.authToken)}
	}
	headers["User-Agent"] = []string{c.config.UserAgent}

	// Connect to WebSocket
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, headers)
	if err != nil {
		c.tracer.RecordError(span, err, "WebSocket connection failed")
		return fmt.Errorf("failed to connect to WebSocket: %w", err)
	}

	c.conn = conn
	c.connected = true

	// Set connection timeouts
	c.conn.SetReadDeadline(time.Now().Add(c.readTimeout))
	c.conn.SetWriteDeadline(time.Now().Add(c.writeTimeout))

	// Start connection handlers
	go c.readHandler()
	go c.writeHandler()
	go c.pingHandler()

	// Record metrics
	c.metrics.RecordWebSocketConnection(true)

	c.logger.WithContext(ctx).Info("WebSocket connection established")
	return nil
}

// Disconnect closes the WebSocket connection
func (c *StreamingClient) Disconnect(ctx context.Context) error {
	// Start tracing
	ctx, span := c.tracer.StartSpan(ctx, "websocket_disconnect")
	defer span.End()

	c.connMu.Lock()
	defer c.connMu.Unlock()

	if !c.connected {
		return nil
	}

	c.logger.WithContext(ctx).Info("Disconnecting WebSocket")

	// Signal handlers to stop
	close(c.closeCh)

	// Close connection
	if c.conn != nil {
		if err := c.conn.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, "")); err != nil {
			c.logger.WithContext(ctx).WithError(err).Warn("Failed to send close message")
		}
		c.conn.Close()
		c.conn = nil
	}

	c.connected = false

	// Record metrics
	c.metrics.RecordWebSocketConnection(false)

	c.logger.WithContext(ctx).Info("WebSocket disconnected")
	return nil
}

// IsConnected returns whether the client is connected
func (c *StreamingClient) IsConnected() bool {
	c.connMu.RLock()
	defer c.connMu.RUnlock()
	return c.connected
}

// Subscribe subscribes to a specific event channel
func (c *StreamingClient) Subscribe(ctx context.Context, channel string) error {
	// Start tracing
	ctx, span := c.tracer.StartSpan(ctx, "websocket_subscribe")
	defer span.End()

	span.SetAttributes(attribute.String("channel", channel))

	if !c.IsConnected() {
		return fmt.Errorf("not connected")
	}

	subscribeMsg := models.WebSocketMessage{
		Type:      "subscribe",
		Channel:   channel,
		Timestamp: time.Now(),
	}

	data, err := json.Marshal(subscribeMsg)
	if err != nil {
		c.tracer.RecordError(span, err, "Failed to marshal subscribe message")
		return fmt.Errorf("failed to marshal subscribe message: %w", err)
	}

	// Send subscription message
	select {
	case c.writeCh <- data:
		c.logger.WithContext(ctx).WithFields(map[string]interface{}{
			"channel": channel,
		}).Info("Subscribed to channel")
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

// Unsubscribe unsubscribes from a specific event channel
func (c *StreamingClient) Unsubscribe(ctx context.Context, channel string) error {
	// Start tracing
	ctx, span := c.tracer.StartSpan(ctx, "websocket_unsubscribe")
	defer span.End()

	span.SetAttributes(attribute.String("channel", channel))

	if !c.IsConnected() {
		return fmt.Errorf("not connected")
	}

	unsubscribeMsg := models.WebSocketMessage{
		Type:      "unsubscribe",
		Channel:   channel,
		Timestamp: time.Now(),
	}

	data, err := json.Marshal(unsubscribeMsg)
	if err != nil {
		c.tracer.RecordError(span, err, "Failed to marshal unsubscribe message")
		return fmt.Errorf("failed to marshal unsubscribe message: %w", err)
	}

	// Send unsubscription message
	select {
	case c.writeCh <- data:
		c.logger.WithFields(map[string]interface{}{
			"channel": channel,
		}).Info("Unsubscribed from channel")
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

// On registers an event handler for a specific event type
func (c *StreamingClient) On(eventType models.EventType, handler EventHandler) {
	c.handlersMu.Lock()
	defer c.handlersMu.Unlock()

	if c.eventHandlers[eventType] == nil {
		c.eventHandlers[eventType] = make([]EventHandler, 0)
	}
	c.eventHandlers[eventType] = append(c.eventHandlers[eventType], handler)

	c.logger.WithFields(map[string]interface{}{
		"event_type":     string(eventType),
		"handler_count": len(c.eventHandlers[eventType]),
	}).Debug("Event handler registered")
}

// SendMessage sends a custom message through the WebSocket
func (c *StreamingClient) SendMessage(ctx context.Context, message *models.WebSocketMessage) error {
	// Start tracing
	ctx, span := c.tracer.StartSpan(ctx, "websocket_send_message")
	defer span.End()

	span.SetAttributes(
		attribute.String("message.type", message.Type),
		attribute.String("message.channel", message.Channel),
	)

	if !c.IsConnected() {
		return fmt.Errorf("not connected")
	}

	message.Timestamp = time.Now()
	data, err := json.Marshal(message)
	if err != nil {
		c.tracer.RecordError(span, err, "Failed to marshal message")
		return fmt.Errorf("failed to marshal message: %w", err)
	}

	// Send message
	select {
	case c.writeCh <- data:
		c.logger.WithContext(ctx).WithFields(map[string]interface{}{
			"message_type": message.Type,
			"channel":     message.Channel,
		}).Debug("Message sent")
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

// readHandler handles incoming WebSocket messages
func (c *StreamingClient) readHandler() {
	defer c.logger.Debug("WebSocket read handler stopped")

	for {
		select {
		case <-c.closeCh:
			return
		default:
		}

		if !c.IsConnected() {
			return
		}

		// Set read deadline
		c.conn.SetReadDeadline(time.Now().Add(c.readTimeout))

		// Read message
		_, data, err := c.conn.ReadMessage()
		if err != nil {
			c.logger.WithError(err).Error("Failed to read WebSocket message")
			c.handleConnectionError(err)
			return
		}

		// Parse message
		var wsMessage models.WebSocketMessage
		if err := json.Unmarshal(data, &wsMessage); err != nil {
			c.logger.WithError(err).Error("Failed to parse WebSocket message")
			continue
		}

		// Handle different message types
		switch wsMessage.Type {
		case "event":
			c.handleEvent(&wsMessage)
		case "pong":
			c.logger.Debug("Received pong")
		case "error":
			c.logger.WithFields(map[string]interface{}{
				"error": wsMessage.Data,
			}).Error("Received error from server")
		default:
			c.logger.WithFields(map[string]interface{}{
				"message_type": wsMessage.Type,
			}).Debug("Received unknown message type")
		}

		// Record metrics
		c.metrics.RecordWebSocketMessage("received", wsMessage.Type)
	}
}

// writeHandler handles outgoing WebSocket messages
func (c *StreamingClient) writeHandler() {
	defer c.logger.Debug("WebSocket write handler stopped")

	for {
		select {
		case <-c.closeCh:
			return
		case data := <-c.writeCh:
			if !c.IsConnected() {
				return
			}

			// Set write deadline
			c.conn.SetWriteDeadline(time.Now().Add(c.writeTimeout))

			// Send message
			if err := c.conn.WriteMessage(websocket.TextMessage, data); err != nil {
				c.logger.WithError(err).Error("Failed to write WebSocket message")
				c.handleConnectionError(err)
				return
			}

			// Record metrics
			c.metrics.RecordWebSocketMessage("sent", "message")
		}
	}
}

// pingHandler sends periodic ping messages to keep the connection alive
func (c *StreamingClient) pingHandler() {
	ticker := time.NewTicker(c.pingInterval)
	defer ticker.Stop()
	defer c.logger.Debug("WebSocket ping handler stopped")

	for {
		select {
		case <-c.closeCh:
			return
		case <-ticker.C:
			if !c.IsConnected() {
				return
			}

			pingMsg := models.WebSocketMessage{
				Type:      "ping",
				Timestamp: time.Now(),
			}

			data, err := json.Marshal(pingMsg)
			if err != nil {
				c.logger.WithError(err).Error("Failed to marshal ping message")
				continue
			}

			select {
			case c.writeCh <- data:
				c.logger.Debug("Sent ping")
			case <-time.After(c.writeTimeout):
				c.logger.Warn("Ping send timeout")
			}
		}
	}
}

// handleEvent processes incoming events and calls registered handlers
func (c *StreamingClient) handleEvent(wsMessage *models.WebSocketMessage) {
	// Parse event data
	eventData, err := json.Marshal(wsMessage.Data)
	if err != nil {
		c.logger.WithError(err).Error("Failed to marshal event data")
		return
	}

	var event models.Event
	if err := json.Unmarshal(eventData, &event); err != nil {
		c.logger.WithError(err).Error("Failed to parse event")
		return
	}

	c.logger.WithFields(map[string]interface{}{
		"event_type": string(event.Type),
		"event_id":   event.ID,
		"source":     event.Source,
	}).Debug("Processing event")

	// Call registered handlers
	c.handlersMu.RLock()
	handlers := c.eventHandlers[event.Type]
	c.handlersMu.RUnlock()

	for _, handler := range handlers {
		go func(h EventHandler) {
			if err := h(&event); err != nil {
				c.logger.WithError(err).WithFields(map[string]interface{}{
					"event_type": string(event.Type),
					"event_id":   event.ID,
				}).Error("Event handler failed")
			}
		}(handler)
	}

	// Record metrics
	c.metrics.RecordWebSocketEvent(string(event.Type), len(handlers))
}

// handleConnectionError handles connection errors and attempts reconnection
func (c *StreamingClient) handleConnectionError(err error) {
	c.connMu.Lock()
	c.connected = false
	if c.conn != nil {
		c.conn.Close()
		c.conn = nil
	}
	c.connMu.Unlock()

	c.logger.WithError(err).Warn("WebSocket connection error")

	// Record metrics
	c.metrics.RecordWebSocketConnection(false)
	c.metrics.RecordError("websocket_connection", "websocket_client")

	// Trigger reconnection
	select {
	case c.reconnectCh <- struct{}{}:
	default:
	}
}

// ConnectWithReconnect connects with automatic reconnection on failure
func (c *StreamingClient) ConnectWithReconnect(ctx context.Context) error {
	// Initial connection
	if err := c.Connect(ctx); err != nil {
		return err
	}

	// Start reconnection handler
	go c.reconnectHandler(ctx)

	return nil
}

// reconnectHandler handles automatic reconnection
func (c *StreamingClient) reconnectHandler(ctx context.Context) {
	defer c.logger.Debug("Reconnection handler stopped")

	for {
		select {
		case <-ctx.Done():
			return
		case <-c.reconnectCh:
			c.logger.Info("Starting reconnection process")
			
			for attempts := 0; attempts < c.reconnectAttempts; attempts++ {
				select {
				case <-ctx.Done():
					return
				default:
				}

				c.logger.WithFields(map[string]interface{}{
					"attempt": attempts + 1,
					"max_attempts": c.reconnectAttempts,
				}).Info("Attempting to reconnect")

				if err := c.Connect(ctx); err != nil {
					c.logger.WithError(err).WithFields(map[string]interface{}{
						"attempt": attempts + 1,
					}).Warn("Reconnection attempt failed")
					
					// Wait before next attempt
					select {
					case <-time.After(c.reconnectDelay):
					case <-ctx.Done():
						return
					}
				} else {
					c.logger.Info("Reconnection successful")
					break
				}
			}
		}
	}
}

// Close closes the streaming client and releases resources
func (c *StreamingClient) Close(ctx context.Context) error {
	c.logger.WithContext(ctx).Info("Closing streaming client")
	
	// Disconnect
	if err := c.Disconnect(ctx); err != nil {
		c.logger.WithError(err).Warn("Failed to disconnect cleanly")
	}
	
	// Close tracer
	if err := c.tracer.Close(ctx); err != nil {
		c.logger.WithError(err).Error("Failed to close tracer")
	}
	
	c.logger.WithContext(ctx).Info("Streaming client closed")
	return nil
}