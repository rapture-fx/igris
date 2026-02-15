"""
Comprehensive WebSocket and real-time streaming tests for Igris-engine Python SDK

This test suite covers WebSocket connections, real-time data streaming,
connection management, error handling, and reconnection logic.
"""

import pytest
import asyncio
import json
import ssl
from unittest.mock import AsyncMock, MagicMock, patch, call
from datetime import datetime, timedelta
import websockets
from websockets.exceptions import ConnectionClosed, InvalidStatusCode, InvalidURI

from igris.websocket.streaming_client import StreamingClient
from igris.websocket.message_handler import MessageHandler
from igris.models.streaming import (
    StreamingMessage,
    MessageType,
    ConnectionStatus,
    StreamingConfig,
    RealtimeEvent
)
from igris.exceptions.base import (
    WebSocketError,
    ConnectionError,
    AuthenticationError,
    StreamingError
)


class TestStreamingClient:
    """Comprehensive tests for WebSocket streaming client."""

    @pytest.fixture
    def streaming_config(self):
        """Default streaming configuration."""
        return StreamingConfig(
            url="wss://api.test.com/stream",
            auth_token="test_token_123",
            reconnect_interval=1.0,
            max_reconnect_attempts=3,
            ping_interval=30.0,
            ping_timeout=10.0,
            message_queue_size=1000,
            compression=True
        )

    @pytest.fixture
    def streaming_client(self, streaming_config):
        """Create streaming client with mock configuration."""
        return StreamingClient(streaming_config)

    @pytest.fixture
    def mock_websocket(self):
        """Mock WebSocket connection."""
        ws = AsyncMock()
        ws.close_code = None
        ws.close_reason = None
        ws.closed = False
        return ws

    @pytest.mark.asyncio
    async def test_websocket_connection_success(self, streaming_client, mock_websocket):
        """Test successful WebSocket connection."""
        with patch('websockets.connect', new_callable=AsyncMock) as mock_connect:
            mock_connect.return_value.__aenter__.return_value = mock_websocket
            
            await streaming_client.connect()
            
            assert streaming_client.is_connected()
            assert streaming_client.connection_status == ConnectionStatus.CONNECTED
            mock_connect.assert_called_once()

    @pytest.mark.asyncio
    async def test_websocket_connection_failure(self, streaming_client):
        """Test WebSocket connection failure."""
        with patch('websockets.connect', new_callable=AsyncMock) as mock_connect:
            mock_connect.side_effect = ConnectionRefusedError("Connection refused")
            
            with pytest.raises(ConnectionError):
                await streaming_client.connect()
            
            assert not streaming_client.is_connected()
            assert streaming_client.connection_status == ConnectionStatus.DISCONNECTED

    @pytest.mark.asyncio
    async def test_websocket_authentication_success(self, streaming_client, mock_websocket):
        """Test successful WebSocket authentication."""
        auth_response = {
            "type": "auth_response",
            "success": True,
            "user_id": "user123",
            "session_id": "session_abc"
        }

        mock_websocket.recv.return_value = json.dumps(auth_response)
        
        with patch('websockets.connect', new_callable=AsyncMock) as mock_connect:
            mock_connect.return_value.__aenter__.return_value = mock_websocket
            
            await streaming_client.connect()
            
            # Verify auth message was sent
            mock_websocket.send.assert_called()
            auth_call = mock_websocket.send.call_args_list[0][0][0]
            auth_message = json.loads(auth_call)
            assert auth_message["type"] == "authenticate"
            assert auth_message["token"] == "test_token_123"

    @pytest.mark.asyncio
    async def test_websocket_authentication_failure(self, streaming_client, mock_websocket):
        """Test WebSocket authentication failure."""
        auth_response = {
            "type": "auth_response", 
            "success": False,
            "error": "Invalid token"
        }

        mock_websocket.recv.return_value = json.dumps(auth_response)
        
        with patch('websockets.connect', new_callable=AsyncMock) as mock_connect:
            mock_connect.return_value.__aenter__.return_value = mock_websocket
            
            with pytest.raises(AuthenticationError):
                await streaming_client.connect()

    @pytest.mark.asyncio
    async def test_message_sending(self, streaming_client, mock_websocket):
        """Test sending messages through WebSocket."""
        with patch('websockets.connect', new_callable=AsyncMock) as mock_connect:
            mock_connect.return_value.__aenter__.return_value = mock_websocket
            
            await streaming_client.connect()
            
            message = StreamingMessage(
                type=MessageType.SUBSCRIBE,
                channel="data_processing",
                payload={"job_id": "job_123"}
            )
            
            await streaming_client.send_message(message)
            
            # Verify message was sent
            sent_message = json.loads(mock_websocket.send.call_args[0][0])
            assert sent_message["type"] == "subscribe"
            assert sent_message["channel"] == "data_processing"
            assert sent_message["payload"]["job_id"] == "job_123"

    @pytest.mark.asyncio
    async def test_message_receiving(self, streaming_client, mock_websocket):
        """Test receiving and handling messages from WebSocket."""
        incoming_message = {
            "type": "job_update",
            "channel": "data_processing",
            "payload": {
                "job_id": "job_123",
                "status": "completed",
                "progress": 100
            },
            "timestamp": datetime.now().isoformat()
        }

        messages_received = []
        
        async def message_handler(message):
            messages_received.append(message)

        streaming_client.on_message(message_handler)
        
        mock_websocket.recv.side_effect = [
            json.dumps({"type": "auth_response", "success": True}),
            json.dumps(incoming_message),
            ConnectionClosed(None, None)  # Simulate connection close
        ]
        
        with patch('websockets.connect', new_callable=AsyncMock) as mock_connect:
            mock_connect.return_value.__aenter__.return_value = mock_websocket
            
            await streaming_client.connect()
            await streaming_client.listen()
            
            assert len(messages_received) == 1
            received = messages_received[0]
            assert received.type == MessageType.JOB_UPDATE
            assert received.payload["job_id"] == "job_123"
            assert received.payload["status"] == "completed"

    @pytest.mark.asyncio
    async def test_subscription_management(self, streaming_client, mock_websocket):
        """Test channel subscription and unsubscription."""
        with patch('websockets.connect', new_callable=AsyncMock) as mock_connect:
            mock_connect.return_value.__aenter__.return_value = mock_websocket
            
            await streaming_client.connect()
            
            # Subscribe to channels
            await streaming_client.subscribe("data_processing")
            await streaming_client.subscribe("ml_pipeline") 
            
            # Verify subscriptions
            assert streaming_client.is_subscribed("data_processing")
            assert streaming_client.is_subscribed("ml_pipeline")
            assert not streaming_client.is_subscribed("non_existent")
            
            # Unsubscribe
            await streaming_client.unsubscribe("data_processing")
            
            assert not streaming_client.is_subscribed("data_processing")
            assert streaming_client.is_subscribed("ml_pipeline")

    @pytest.mark.asyncio
    async def test_connection_heartbeat(self, streaming_client, mock_websocket):
        """Test WebSocket heartbeat/ping mechanism."""
        with patch('websockets.connect', new_callable=AsyncMock) as mock_connect:
            mock_connect.return_value.__aenter__.return_value = mock_websocket
            
            # Mock ping/pong responses
            mock_websocket.ping.return_value = asyncio.Future()
            mock_websocket.ping.return_value.set_result(None)
            
            await streaming_client.connect()
            
            # Start heartbeat (with short interval for testing)
            streaming_client.config.ping_interval = 0.1
            heartbeat_task = asyncio.create_task(streaming_client._heartbeat_loop())
            
            # Let it run for a bit
            await asyncio.sleep(0.3)
            heartbeat_task.cancel()
            
            # Verify pings were sent
            assert mock_websocket.ping.call_count >= 2

    @pytest.mark.asyncio
    async def test_automatic_reconnection(self, streaming_client, mock_websocket):
        """Test automatic reconnection on connection loss."""
        reconnect_attempts = []
        
        def track_reconnect():
            reconnect_attempts.append(datetime.now())
        
        streaming_client.on_reconnect(track_reconnect)
        
        with patch('websockets.connect', new_callable=AsyncMock) as mock_connect:
            # First connection succeeds
            mock_connect.return_value.__aenter__.return_value = mock_websocket
            
            await streaming_client.connect()
            
            # Simulate connection loss
            mock_websocket.closed = True
            mock_websocket.close_code = 1006  # Abnormal closure
            
            # Setup reconnection scenario
            new_mock_ws = AsyncMock()
            new_mock_ws.closed = False
            mock_connect.return_value.__aenter__.return_value = new_mock_ws
            
            # Trigger reconnection
            await streaming_client._handle_connection_loss()
            
            assert len(reconnect_attempts) >= 1
            assert streaming_client.is_connected()

    @pytest.mark.asyncio
    async def test_reconnection_max_attempts(self, streaming_client):
        """Test reconnection gives up after max attempts."""
        streaming_client.config.max_reconnect_attempts = 2
        
        with patch('websockets.connect', new_callable=AsyncMock) as mock_connect:
            # All connection attempts fail
            mock_connect.side_effect = ConnectionRefusedError("Connection refused")
            
            with pytest.raises(ConnectionError) as exc_info:
                await streaming_client.connect()
            
            assert "max reconnection attempts" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_message_queue_overflow(self, streaming_client, mock_websocket):
        """Test message queue overflow handling."""
        streaming_client.config.message_queue_size = 5  # Small queue for testing
        
        with patch('websockets.connect', new_callable=AsyncMock) as mock_connect:
            mock_connect.return_value.__aenter__.return_value = mock_websocket
            
            await streaming_client.connect()
            
            # Send messages faster than they can be processed
            for i in range(10):
                message = StreamingMessage(
                    type=MessageType.DATA,
                    payload={"sequence": i}
                )
                await streaming_client.send_message(message)
            
            # Verify queue size is limited
            assert streaming_client.get_queue_size() <= 5

    @pytest.mark.asyncio
    async def test_ssl_connection(self, streaming_client):
        """Test SSL/TLS WebSocket connection."""
        streaming_client.config.url = "wss://secure-api.test.com/stream"
        streaming_client.config.ssl_verify = True
        
        mock_websocket = AsyncMock()
        
        with patch('websockets.connect', new_callable=AsyncMock) as mock_connect:
            mock_connect.return_value.__aenter__.return_value = mock_websocket
            
            await streaming_client.connect()
            
            # Verify SSL context was used
            call_kwargs = mock_connect.call_args[1]
            assert 'ssl' in call_kwargs

    @pytest.mark.asyncio
    async def test_custom_headers(self, streaming_client):
        """Test WebSocket connection with custom headers."""
        custom_headers = {
            "X-API-Version": "v1",
            "X-Client-Type": "python-sdk"
        }
        streaming_client.config.extra_headers = custom_headers
        
        mock_websocket = AsyncMock()
        
        with patch('websockets.connect', new_callable=AsyncMock) as mock_connect:
            mock_connect.return_value.__aenter__.return_value = mock_websocket
            
            await streaming_client.connect()
            
            # Verify custom headers were included
            call_kwargs = mock_connect.call_args[1]
            assert call_kwargs['extra_headers'] == custom_headers

    @pytest.mark.asyncio
    async def test_connection_timeout(self, streaming_client):
        """Test connection timeout handling."""
        streaming_client.config.connect_timeout = 0.1  # Very short timeout
        
        with patch('websockets.connect', new_callable=AsyncMock) as mock_connect:
            # Simulate slow connection
            slow_future = asyncio.Future()
            mock_connect.return_value = slow_future
            
            with pytest.raises(ConnectionError):
                await streaming_client.connect()

    @pytest.mark.asyncio
    async def test_malformed_message_handling(self, streaming_client, mock_websocket):
        """Test handling of malformed incoming messages."""
        malformed_messages = [
            "not json",
            '{"incomplete": json',
            '{"missing_required_field": "value"}',
            '{"type": "unknown_type", "data": "test"}'
        ]
        
        messages_received = []
        errors_received = []
        
        async def message_handler(message):
            messages_received.append(message)
        
        async def error_handler(error):
            errors_received.append(error)
            
        streaming_client.on_message(message_handler)
        streaming_client.on_error(error_handler)
        
        mock_websocket.recv.side_effect = malformed_messages + [ConnectionClosed(None, None)]
        
        with patch('websockets.connect', new_callable=AsyncMock) as mock_connect:
            mock_connect.return_value.__aenter__.return_value = mock_websocket
            
            await streaming_client.connect()
            await streaming_client.listen()
            
            # Should handle malformed messages gracefully
            assert len(errors_received) >= 3  # At least 3 malformed messages
            assert len(messages_received) == 0  # No valid messages

    @pytest.mark.asyncio
    async def test_concurrent_message_handling(self, streaming_client, mock_websocket):
        """Test concurrent processing of multiple messages."""
        messages = [
            {
                "type": "job_update",
                "payload": {"job_id": f"job_{i}", "status": "running"}
            }
            for i in range(100)
        ]
        
        messages_received = []
        
        async def message_handler(message):
            await asyncio.sleep(0.001)  # Simulate processing time
            messages_received.append(message)
            
        streaming_client.on_message(message_handler)
        
        mock_websocket.recv.side_effect = [
            json.dumps({"type": "auth_response", "success": True})
        ] + [json.dumps(msg) for msg in messages] + [ConnectionClosed(None, None)]
        
        with patch('websockets.connect', new_callable=AsyncMock) as mock_connect:
            mock_connect.return_value.__aenter__.return_value = mock_websocket
            
            await streaming_client.connect()
            await streaming_client.listen()
            
            assert len(messages_received) == 100

    @pytest.mark.asyncio
    async def test_graceful_disconnection(self, streaming_client, mock_websocket):
        """Test graceful disconnection process."""
        with patch('websockets.connect', new_callable=AsyncMock) as mock_connect:
            mock_connect.return_value.__aenter__.return_value = mock_websocket
            
            await streaming_client.connect()
            assert streaming_client.is_connected()
            
            await streaming_client.disconnect()
            
            assert not streaming_client.is_connected()
            assert streaming_client.connection_status == ConnectionStatus.DISCONNECTED
            mock_websocket.close.assert_called_once()


class TestMessageHandler:
    """Test message processing and filtering."""

    @pytest.fixture
    def message_handler(self):
        """Create message handler."""
        return MessageHandler()

    def test_message_filtering_by_type(self, message_handler):
        """Test filtering messages by type."""
        job_messages = []
        error_messages = []
        
        message_handler.on_message_type(MessageType.JOB_UPDATE, job_messages.append)
        message_handler.on_message_type(MessageType.ERROR, error_messages.append)
        
        # Process different message types
        job_message = StreamingMessage(
            type=MessageType.JOB_UPDATE,
            payload={"job_id": "job_123"}
        )
        error_message = StreamingMessage(
            type=MessageType.ERROR,
            payload={"error": "Processing failed"}
        )
        data_message = StreamingMessage(
            type=MessageType.DATA,
            payload={"data": "some data"}
        )
        
        message_handler.handle_message(job_message)
        message_handler.handle_message(error_message)
        message_handler.handle_message(data_message)
        
        assert len(job_messages) == 1
        assert len(error_messages) == 1
        assert job_messages[0].payload["job_id"] == "job_123"

    def test_message_filtering_by_channel(self, message_handler):
        """Test filtering messages by channel."""
        processing_messages = []
        ml_messages = []
        
        message_handler.on_channel("data_processing", processing_messages.append)
        message_handler.on_channel("ml_pipeline", ml_messages.append)
        
        # Messages for different channels
        processing_msg = StreamingMessage(
            type=MessageType.DATA,
            channel="data_processing",
            payload={"status": "active"}
        )
        ml_msg = StreamingMessage(
            type=MessageType.DATA,
            channel="ml_pipeline", 
            payload={"model": "trained"}
        )
        other_msg = StreamingMessage(
            type=MessageType.DATA,
            channel="analytics",
            payload={"metric": "value"}
        )
        
        message_handler.handle_message(processing_msg)
        message_handler.handle_message(ml_msg)
        message_handler.handle_message(other_msg)
        
        assert len(processing_messages) == 1
        assert len(ml_messages) == 1

    def test_message_transformation(self, message_handler):
        """Test message transformation/enrichment."""
        transformed_messages = []
        
        def transform_job_message(message):
            """Add timestamp and client info to job messages."""
            if message.type == MessageType.JOB_UPDATE:
                message.payload["client_timestamp"] = datetime.now().isoformat()
                message.payload["client_id"] = "python-sdk"
            transformed_messages.append(message)
        
        message_handler.add_transformer(transform_job_message)
        
        job_message = StreamingMessage(
            type=MessageType.JOB_UPDATE,
            payload={"job_id": "job_123", "status": "running"}
        )
        
        message_handler.handle_message(job_message)
        
        assert len(transformed_messages) == 1
        transformed = transformed_messages[0]
        assert "client_timestamp" in transformed.payload
        assert transformed.payload["client_id"] == "python-sdk"

    def test_message_validation(self, message_handler):
        """Test message validation and rejection."""
        valid_messages = []
        invalid_messages = []
        
        def validate_job_message(message):
            """Validate job update messages have required fields."""
            if message.type == MessageType.JOB_UPDATE:
                required_fields = ["job_id", "status"]
                return all(field in message.payload for field in required_fields)
            return True
        
        message_handler.add_validator(validate_job_message)
        message_handler.on_valid_message(valid_messages.append)
        message_handler.on_invalid_message(invalid_messages.append)
        
        valid_job_message = StreamingMessage(
            type=MessageType.JOB_UPDATE,
            payload={"job_id": "job_123", "status": "running"}
        )
        
        invalid_job_message = StreamingMessage(
            type=MessageType.JOB_UPDATE,
            payload={"job_id": "job_456"}  # Missing status
        )
        
        message_handler.handle_message(valid_job_message)
        message_handler.handle_message(invalid_job_message)
        
        assert len(valid_messages) == 1
        assert len(invalid_messages) == 1


class TestRealtimeEvents:
    """Test real-time event processing and notifications."""

    @pytest.fixture
    def event_processor(self):
        """Create event processor."""
        from igris.websocket.event_processor import EventProcessor
        return EventProcessor()

    def test_job_progress_events(self, event_processor):
        """Test processing of job progress events."""
        progress_updates = []
        
        event_processor.on_job_progress(progress_updates.append)
        
        # Simulate job progress events
        for progress in [25, 50, 75, 100]:
            event = RealtimeEvent(
                event_type="job_progress",
                data={
                    "job_id": "job_123",
                    "progress": progress,
                    "estimated_completion": (datetime.now() + timedelta(minutes=10)).isoformat()
                },
                timestamp=datetime.now()
            )
            
            event_processor.process_event(event)
        
        assert len(progress_updates) == 4
        assert progress_updates[-1].data["progress"] == 100

    def test_error_event_handling(self, event_processor):
        """Test handling of error events."""
        error_events = []
        
        event_processor.on_error_event(error_events.append)
        
        error_event = RealtimeEvent(
            event_type="processing_error",
            data={
                "job_id": "job_failed",
                "error_code": "INVALID_DATA",
                "error_message": "Data validation failed",
                "details": {
                    "line_number": 150,
                    "column": "email",
                    "value": "invalid-email"
                }
            },
            timestamp=datetime.now(),
            severity="error"
        )
        
        event_processor.process_event(error_event)
        
        assert len(error_events) == 1
        assert error_events[0].data["error_code"] == "INVALID_DATA"

    def test_data_quality_alerts(self, event_processor):
        """Test data quality alert processing."""
        quality_alerts = []
        
        event_processor.on_quality_alert(quality_alerts.append)
        
        alert_event = RealtimeEvent(
            event_type="quality_alert",
            data={
                "job_id": "job_quality_issue",
                "alert_type": "low_completeness",
                "metric": "completeness_score",
                "value": 0.65,
                "threshold": 0.80,
                "affected_fields": ["phone_number", "address"]
            },
            timestamp=datetime.now(),
            severity="warning"
        )
        
        event_processor.process_event(alert_event)
        
        assert len(quality_alerts) == 1
        assert quality_alerts[0].data["alert_type"] == "low_completeness"
        assert quality_alerts[0].data["value"] < quality_alerts[0].data["threshold"]


@pytest.mark.integration
class TestWebSocketIntegration:
    """Integration tests for WebSocket functionality."""

    @pytest.mark.asyncio
    async def test_real_websocket_connection(self):
        """Test connection to real WebSocket endpoint."""
        pytest.skip("Integration test - requires real WebSocket endpoint")

    @pytest.mark.asyncio
    async def test_end_to_end_streaming(self):
        """Test end-to-end streaming workflow."""
        pytest.skip("Integration test - requires real streaming setup")


@pytest.mark.performance
class TestWebSocketPerformance:
    """Performance tests for WebSocket operations."""

    @pytest.mark.asyncio
    async def test_high_message_throughput(self, streaming_client, mock_websocket):
        """Test handling high message throughput."""
        messages_processed = 0
        
        async def count_messages(message):
            nonlocal messages_processed
            messages_processed += 1
        
        streaming_client.on_message(count_messages)
        
        # Generate 10,000 messages
        messages = [
            json.dumps({
                "type": "data",
                "payload": {"sequence": i, "data": f"test_data_{i}"}
            })
            for i in range(10000)
        ]
        
        mock_websocket.recv.side_effect = [
            json.dumps({"type": "auth_response", "success": True})
        ] + messages + [ConnectionClosed(None, None)]
        
        with patch('websockets.connect', new_callable=AsyncMock) as mock_connect:
            mock_connect.return_value.__aenter__.return_value = mock_websocket
            
            start_time = datetime.now()
            await streaming_client.connect()
            await streaming_client.listen()
            end_time = datetime.now()
            
            processing_time = (end_time - start_time).total_seconds()
            
            assert messages_processed == 10000
            assert processing_time < 30  # Should process 10k messages in under 30 seconds

    @pytest.mark.asyncio
    async def test_memory_usage_long_connection(self, streaming_client, mock_websocket):
        """Test memory usage during long-running connection."""
        # This test would monitor memory usage over time
        # Implementation depends on specific memory monitoring needs
        pytest.skip("Memory monitoring test - implementation specific")


class TestWebSocketSecurity:
    """Test WebSocket security features."""

    @pytest.mark.asyncio
    async def test_token_validation(self, streaming_client, mock_websocket):
        """Test token validation during connection."""
        # Test with invalid token
        auth_response = {
            "type": "auth_response",
            "success": False,
            "error": "Invalid token",
            "error_code": "AUTH_FAILED"
        }
        
        mock_websocket.recv.return_value = json.dumps(auth_response)
        
        with patch('websockets.connect', new_callable=AsyncMock) as mock_connect:
            mock_connect.return_value.__aenter__.return_value = mock_websocket
            
            with pytest.raises(AuthenticationError) as exc_info:
                await streaming_client.connect()
            
            assert "Invalid token" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_message_encryption(self, streaming_client, mock_websocket):
        """Test message encryption/decryption."""
        # This would test end-to-end encryption if implemented
        pytest.skip("Encryption test - depends on encryption implementation")

    def test_secure_token_storage(self, streaming_client):
        """Test secure storage of authentication tokens."""
        # Verify token is not exposed in logs or string representations
        token = "sensitive_token_12345"
        streaming_client.config.auth_token = token
        
        client_str = str(streaming_client)
        assert token not in client_str
        assert "***" in client_str or "hidden" in client_str.lower()