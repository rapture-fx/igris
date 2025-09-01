/**
 * WebSocket Monitoring System for Real-time Connection Health Tracking
 * ===================================================================
 * 
 * Comprehensive WebSocket monitoring with:
 * - Connection health monitoring and automatic reconnection
 * - Message throughput and latency tracking
 * - Connection quality metrics and diagnostics
 * - Integration with error tracking and alerting systems
 * - Real-time dashboard for WebSocket status
 */

import React, { 
  createContext, 
  useContext, 
  useEffect, 
  useState, 
  useRef, 
  useCallback,
  useMemo
} from 'react';
import { 
  Activity, 
  Wifi, 
  WifiOff, 
  AlertTriangle, 
  Clock, 
  TrendingUp, 
  TrendingDown,
  Signal,
  Zap,
  RotateCcw
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { Alert, AlertDescription } from '../components/ui/alert';
import { ErrorReporter } from './sentry';
import { useErrorTracking } from './error-boundaries';

/**
 * WebSocket connection states
 */
export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  FAILED = 'failed',
}

/**
 * WebSocket monitoring metrics
 */
interface WebSocketMetrics {
  connectionState: ConnectionState;
  connectionQuality: 'excellent' | 'good' | 'poor' | 'critical';
  latency: number;
  averageLatency: number;
  messagesSent: number;
  messagesReceived: number;
  messagesPerSecond: number;
  reconnectAttempts: number;
  totalUptime: number;
  totalDowntime: number;
  lastConnected: Date | null;
  lastDisconnected: Date | null;
  errorCount: number;
  bytesTransferred: number;
}

interface ConnectionConfig {
  url: string;
  protocols?: string[];
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
  timeoutMs?: number;
  enableMetrics?: boolean;
  enableLatencyTracking?: boolean;
}

interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: number;
  id?: string;
}

/**
 * WebSocket monitoring context
 */
interface WebSocketMonitoringContext {
  metrics: WebSocketMetrics;
  connectionState: ConnectionState;
  connect: (config: ConnectionConfig) => void;
  disconnect: () => void;
  sendMessage: (message: WebSocketMessage) => boolean;
  isConnected: boolean;
  latestError: Error | null;
  getConnectionHistory: () => ConnectionEvent[];
  resetMetrics: () => void;
}

interface ConnectionEvent {
  type: 'connected' | 'disconnected' | 'error' | 'message' | 'heartbeat';
  timestamp: Date;
  data?: any;
  latency?: number;
}

const WebSocketContext = createContext<WebSocketMonitoringContext | null>(null);

/**
 * WebSocket Monitoring Provider
 */
export const WebSocketMonitoringProvider: React.FC<{
  children: React.ReactNode;
  enableGlobalErrorTracking?: boolean;
}> = ({ children, enableGlobalErrorTracking = true }) => {
  const { reportAsyncError } = useErrorTracking();
  
  const [metrics, setMetrics] = useState<WebSocketMetrics>({
    connectionState: ConnectionState.DISCONNECTED,
    connectionQuality: 'excellent',
    latency: 0,
    averageLatency: 0,
    messagesSent: 0,
    messagesReceived: 0,
    messagesPerSecond: 0,
    reconnectAttempts: 0,
    totalUptime: 0,
    totalDowntime: 0,
    lastConnected: null,
    lastDisconnected: null,
    errorCount: 0,
    bytesTransferred: 0,
  });

  const [connectionHistory, setConnectionHistory] = useState<ConnectionEvent[]>([]);
  const [latestError, setLatestError] = useState<Error | null>(null);
  
  const websocketRef = useRef<WebSocket | null>(null);
  const configRef = useRef<ConnectionConfig | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const metricsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const latencyTrackingRef = useRef<Map<string, number>>(new Map());
  const messageCounterRef = useRef<{ sent: number; received: number; lastReset: number }>({
    sent: 0,
    received: 0,
    lastReset: Date.now(),
  });

  // Connection quality calculation
  const calculateConnectionQuality = useCallback((latency: number, errorCount: number): WebSocketMetrics['connectionQuality'] => {
    if (errorCount > 10 || latency > 1000) return 'critical';
    if (errorCount > 5 || latency > 500) return 'poor';
    if (latency > 200) return 'good';
    return 'excellent';
  }, []);

  // Add connection event
  const addConnectionEvent = useCallback((event: ConnectionEvent) => {
    setConnectionHistory(prev => [event, ...prev].slice(0, 100)); // Keep last 100 events
  }, []);

  // Update metrics
  const updateMetrics = useCallback((updates: Partial<WebSocketMetrics>) => {
    setMetrics(prev => {
      const updated = { ...prev, ...updates };
      updated.connectionQuality = calculateConnectionQuality(updated.averageLatency, updated.errorCount);
      return updated;
    });
  }, [calculateConnectionQuality]);

  // Start heartbeat
  const startHeartbeat = useCallback(() => {
    const config = configRef.current;
    if (!config?.heartbeatInterval || !websocketRef.current) return;

    heartbeatTimeoutRef.current = setInterval(() => {
      if (websocketRef.current?.readyState === WebSocket.OPEN) {
        const heartbeatId = `heartbeat-${Date.now()}`;
        const heartbeatMessage: WebSocketMessage = {
          type: 'heartbeat',
          data: { id: heartbeatId },
          timestamp: Date.now(),
          id: heartbeatId,
        };

        // Track heartbeat latency if enabled
        if (config.enableLatencyTracking) {
          latencyTrackingRef.current.set(heartbeatId, Date.now());
        }

        websocketRef.current.send(JSON.stringify(heartbeatMessage));
        
        addConnectionEvent({
          type: 'heartbeat',
          timestamp: new Date(),
          data: { id: heartbeatId },
        });
      }
    }, config.heartbeatInterval);
  }, [addConnectionEvent]);

  // Stop heartbeat
  const stopHeartbeat = useCallback(() => {
    if (heartbeatTimeoutRef.current) {
      clearInterval(heartbeatTimeoutRef.current);
      heartbeatTimeoutRef.current = null;
    }
  }, []);

  // Start metrics collection
  const startMetricsCollection = useCallback(() => {
    metricsIntervalRef.current = setInterval(() => {
      const now = Date.now();
      const timeSinceReset = now - messageCounterRef.current.lastReset;
      
      if (timeSinceReset >= 1000) { // Update every second
        const messagesPerSecond = (
          (messageCounterRef.current.sent + messageCounterRef.current.received) * 1000
        ) / timeSinceReset;

        updateMetrics({
          messagesPerSecond: Math.round(messagesPerSecond * 10) / 10, // Round to 1 decimal
        });

        // Reset counters
        messageCounterRef.current = {
          sent: 0,
          received: 0,
          lastReset: now,
        };
      }
    }, 1000);
  }, [updateMetrics]);

  // Stop metrics collection
  const stopMetricsCollection = useCallback(() => {
    if (metricsIntervalRef.current) {
      clearInterval(metricsIntervalRef.current);
      metricsIntervalRef.current = null;
    }
  }, []);

  // Handle WebSocket connection
  const connect = useCallback((config: ConnectionConfig) => {
    // Clean up existing connection
    if (websocketRef.current) {
      websocketRef.current.close();
    }

    configRef.current = config;
    
    updateMetrics({
      connectionState: ConnectionState.CONNECTING,
    });

    try {
      const websocket = new WebSocket(config.url, config.protocols);
      websocketRef.current = websocket;

      // Connection timeout
      const connectionTimeout = setTimeout(() => {
        if (websocket.readyState === WebSocket.CONNECTING) {
          websocket.close();
          const error = new Error('WebSocket connection timeout');
          setLatestError(error);
          
          if (enableGlobalErrorTracking) {
            ErrorReporter.reportWebSocketError(error, {
              connectionState: 'timeout',
              url: config.url,
            });
          }
        }
      }, config.timeoutMs || 5000);

      websocket.onopen = () => {
        clearTimeout(connectionTimeout);
        
        const now = new Date();
        updateMetrics({
          connectionState: ConnectionState.CONNECTED,
          lastConnected: now,
          reconnectAttempts: 0,
        });

        addConnectionEvent({
          type: 'connected',
          timestamp: now,
        });

        // Start heartbeat and metrics collection
        if (config.enableMetrics !== false) {
          startMetricsCollection();
        }
        
        if (config.heartbeatInterval) {
          startHeartbeat();
        }

        setLatestError(null);
      };

      websocket.onclose = (event) => {
        clearTimeout(connectionTimeout);
        stopHeartbeat();
        stopMetricsCollection();

        const now = new Date();
        const wasConnected = metrics.connectionState === ConnectionState.CONNECTED;
        
        updateMetrics({
          connectionState: ConnectionState.DISCONNECTED,
          lastDisconnected: now,
        });

        addConnectionEvent({
          type: 'disconnected',
          timestamp: now,
          data: { code: event.code, reason: event.reason },
        });

        // Auto-reconnect if not manually disconnected
        if (event.code !== 1000 && config.maxReconnectAttempts && 
            metrics.reconnectAttempts < config.maxReconnectAttempts) {
          
          updateMetrics({
            connectionState: ConnectionState.RECONNECTING,
            reconnectAttempts: metrics.reconnectAttempts + 1,
          });

          reconnectTimeoutRef.current = setTimeout(() => {
            connect(config);
          }, config.reconnectInterval || 5000);
        } else if (event.code !== 1000) {
          updateMetrics({
            connectionState: ConnectionState.FAILED,
          });
        }
      };

      websocket.onerror = (event) => {
        const error = new Error(`WebSocket error: ${event.type}`);
        setLatestError(error);
        
        updateMetrics({
          errorCount: metrics.errorCount + 1,
        });

        addConnectionEvent({
          type: 'error',
          timestamp: new Date(),
          data: { type: event.type },
        });

        if (enableGlobalErrorTracking) {
          ErrorReporter.reportWebSocketError(error, {
            connectionState: metrics.connectionState,
            url: config.url,
            reconnectAttempts: metrics.reconnectAttempts,
          });
        }
      };

      websocket.onmessage = (event) => {
        const messageSize = event.data.length;
        messageCounterRef.current.received++;
        
        updateMetrics({
          messagesReceived: metrics.messagesReceived + 1,
          bytesTransferred: metrics.bytesTransferred + messageSize,
        });

        try {
          const message = JSON.parse(event.data);
          
          // Handle heartbeat response for latency tracking
          if (message.type === 'heartbeat_response' && config.enableLatencyTracking) {
            const sentTime = latencyTrackingRef.current.get(message.data?.id);
            if (sentTime) {
              const latency = Date.now() - sentTime;
              const newAverage = (metrics.averageLatency * metrics.messagesReceived + latency) / 
                               (metrics.messagesReceived + 1);
              
              updateMetrics({
                latency,
                averageLatency: Math.round(newAverage),
              });

              latencyTrackingRef.current.delete(message.data.id);
            }
          }

          addConnectionEvent({
            type: 'message',
            timestamp: new Date(),
            data: { type: message.type, size: messageSize },
          });
          
        } catch (error) {
          // Message parsing failed - not necessarily an error for monitoring
          addConnectionEvent({
            type: 'message',
            timestamp: new Date(),
            data: { size: messageSize, raw: true },
          });
        }
      };

    } catch (error) {
      const wsError = error as Error;
      setLatestError(wsError);
      
      updateMetrics({
        connectionState: ConnectionState.FAILED,
        errorCount: metrics.errorCount + 1,
      });

      if (enableGlobalErrorTracking) {
        reportAsyncError(wsError, {
          websocket: true,
          url: config.url,
          context: 'connection_attempt',
        });
      }
    }
  }, [
    metrics,
    updateMetrics,
    addConnectionEvent,
    startHeartbeat,
    stopHeartbeat,
    startMetricsCollection,
    stopMetricsCollection,
    enableGlobalErrorTracking,
    reportAsyncError,
  ]);

  // Disconnect WebSocket
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    stopHeartbeat();
    stopMetricsCollection();

    if (websocketRef.current) {
      websocketRef.current.close(1000, 'Manual disconnect');
      websocketRef.current = null;
    }

    updateMetrics({
      connectionState: ConnectionState.DISCONNECTED,
    });
  }, [updateMetrics, stopHeartbeat, stopMetricsCollection]);

  // Send message
  const sendMessage = useCallback((message: WebSocketMessage): boolean => {
    if (!websocketRef.current || websocketRef.current.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      const messageString = JSON.stringify(message);
      websocketRef.current.send(messageString);
      
      messageCounterRef.current.sent++;
      updateMetrics({
        messagesSent: metrics.messagesSent + 1,
        bytesTransferred: metrics.bytesTransferred + messageString.length,
      });

      // Track latency for this message if enabled
      if (configRef.current?.enableLatencyTracking && message.id) {
        latencyTrackingRef.current.set(message.id, Date.now());
      }

      return true;
    } catch (error) {
      const sendError = error as Error;
      setLatestError(sendError);
      
      updateMetrics({
        errorCount: metrics.errorCount + 1,
      });

      if (enableGlobalErrorTracking) {
        reportAsyncError(sendError, {
          websocket: true,
          context: 'send_message',
          messageType: message.type,
        });
      }

      return false;
    }
  }, [metrics, updateMetrics, enableGlobalErrorTracking, reportAsyncError]);

  // Get connection history
  const getConnectionHistory = useCallback(() => connectionHistory, [connectionHistory]);

  // Reset metrics
  const resetMetrics = useCallback(() => {
    setMetrics({
      connectionState: metrics.connectionState,
      connectionQuality: 'excellent',
      latency: 0,
      averageLatency: 0,
      messagesSent: 0,
      messagesReceived: 0,
      messagesPerSecond: 0,
      reconnectAttempts: 0,
      totalUptime: 0,
      totalDowntime: 0,
      lastConnected: null,
      lastDisconnected: null,
      errorCount: 0,
      bytesTransferred: 0,
    });
    setConnectionHistory([]);
    setLatestError(null);
  }, [metrics.connectionState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  const contextValue: WebSocketMonitoringContext = {
    metrics,
    connectionState: metrics.connectionState,
    connect,
    disconnect,
    sendMessage,
    isConnected: metrics.connectionState === ConnectionState.CONNECTED,
    latestError,
    getConnectionHistory,
    resetMetrics,
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
};

/**
 * Hook to use WebSocket monitoring
 */
export function useWebSocketMonitoring(): WebSocketMonitoringContext {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocketMonitoring must be used within WebSocketMonitoringProvider');
  }
  return context;
}

/**
 * WebSocket Status Dashboard Component
 */
export const WebSocketStatusDashboard: React.FC<{
  showDetails?: boolean;
  showHistory?: boolean;
}> = ({ showDetails = true, showHistory = false }) => {
  const {
    metrics,
    connectionState,
    isConnected,
    latestError,
    getConnectionHistory,
    resetMetrics,
  } = useWebSocketMonitoring();

  const getStateColor = (state: ConnectionState) => {
    switch (state) {
      case ConnectionState.CONNECTED:
        return 'text-green-600 bg-green-50 border-green-200';
      case ConnectionState.CONNECTING:
      case ConnectionState.RECONNECTING:
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case ConnectionState.DISCONNECTED:
        return 'text-gray-600 bg-gray-50 border-gray-200';
      case ConnectionState.FAILED:
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStateIcon = (state: ConnectionState) => {
    switch (state) {
      case ConnectionState.CONNECTED:
        return <Wifi className="h-4 w-4" />;
      case ConnectionState.CONNECTING:
      case ConnectionState.RECONNECTING:
        return <RotateCcw className="h-4 w-4 animate-spin" />;
      case ConnectionState.DISCONNECTED:
      case ConnectionState.FAILED:
        return <WifiOff className="h-4 w-4" />;
      default:
        return <WifiOff className="h-4 w-4" />;
    }
  };

  const getQualityColor = (quality: WebSocketMetrics['connectionQuality']) => {
    switch (quality) {
      case 'excellent':
        return 'text-green-600 bg-green-50';
      case 'good':
        return 'text-blue-600 bg-blue-50';
      case 'poor':
        return 'text-yellow-600 bg-yellow-50';
      case 'critical':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const connectionHistory = getConnectionHistory();

  return (
    <div className="space-y-4">
      {/* Main Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            WebSocket Connection Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Connection State */}
            <div className={`p-4 rounded-lg border ${getStateColor(connectionState)}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Connection State</p>
                  <p className="text-lg font-bold capitalize">{connectionState}</p>
                </div>
                {getStateIcon(connectionState)}
              </div>
            </div>

            {/* Connection Quality */}
            <div className={`p-4 rounded-lg ${getQualityColor(metrics.connectionQuality)}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Connection Quality</p>
                  <p className="text-lg font-bold capitalize">{metrics.connectionQuality}</p>
                </div>
                <Signal className="h-5 w-5" />
              </div>
            </div>

            {/* Latency */}
            <div className="p-4 rounded-lg bg-purple-50 text-purple-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Avg Latency</p>
                  <p className="text-lg font-bold">
                    {metrics.averageLatency}
                    <span className="text-sm font-normal">ms</span>
                  </p>
                </div>
                <Zap className="h-5 w-5" />
              </div>
            </div>
          </div>

          {/* Error Alert */}
          {latestError && (
            <Alert className="mt-4 border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-700">
                <strong>Latest Error:</strong> {latestError.message}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Detailed Metrics */}
      {showDetails && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Message Statistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Messages Sent</span>
                <span className="font-medium">{metrics.messagesSent.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Messages Received</span>
                <span className="font-medium">{metrics.messagesReceived.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Messages/Second</span>
                <span className="font-medium">{metrics.messagesPerSecond}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Data Transferred</span>
                <span className="font-medium">{formatBytes(metrics.bytesTransferred)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Connection Health</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Reconnect Attempts</span>
                <span className="font-medium">{metrics.reconnectAttempts}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Error Count</span>
                <span className="font-medium">{metrics.errorCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Current Latency</span>
                <span className="font-medium">{metrics.latency}ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Last Connected</span>
                <span className="font-medium text-xs">
                  {metrics.lastConnected 
                    ? metrics.lastConnected.toLocaleString()
                    : 'Never'
                  }
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Connection History */}
      {showHistory && connectionHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Connection History</span>
              <Button size="sm" variant="outline" onClick={resetMetrics}>
                Reset Metrics
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {connectionHistory.slice(0, 20).map((event, index) => (
                <div key={index} className="flex items-center justify-between text-sm border-b pb-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {event.type}
                    </Badge>
                    <span className="text-gray-600">
                      {event.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                  {event.latency && (
                    <span className="text-purple-600 font-medium">
                      {event.latency}ms
                    </span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

/**
 * WebSocket Status Indicator Component (compact)
 */
export const WebSocketStatusIndicator: React.FC<{
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}> = ({ showLabel = true, size = 'md' }) => {
  const { connectionState, metrics, isConnected } = useWebSocketMonitoring();

  const sizeClasses = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  const getIndicatorColor = () => {
    if (isConnected) {
      switch (metrics.connectionQuality) {
        case 'excellent': return 'text-green-500';
        case 'good': return 'text-blue-500';
        case 'poor': return 'text-yellow-500';
        case 'critical': return 'text-red-500';
      }
    }
    return 'text-gray-400';
  };

  return (
    <div className="flex items-center gap-1">
      <div className={`${getIndicatorColor()} ${sizeClasses[size]}`}>
        {connectionState === ConnectionState.CONNECTING || 
         connectionState === ConnectionState.RECONNECTING ? (
          <RotateCcw className="animate-spin" />
        ) : isConnected ? (
          <Wifi />
        ) : (
          <WifiOff />
        )}
      </div>
      {showLabel && (
        <span className="text-xs text-gray-600 capitalize">
          {connectionState}
        </span>
      )}
    </div>
  );
};