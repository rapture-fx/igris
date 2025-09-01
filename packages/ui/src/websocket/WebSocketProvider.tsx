import React, { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react'
import { 
  WebSocketMessage, 
  WebSocketConnectionState, 
  WebSocketEventType, 
  WebSocketError,
  WebSocketOptions,
  WebSocketContextValue,
  QueuedMessage
} from '@schlep-engine/types'

const WebSocketContext = createContext<WebSocketContextValue | null>(null)

interface WebSocketProviderProps {
  children: React.ReactNode
  options: WebSocketOptions
}

export function WebSocketProvider({ children, options }: WebSocketProviderProps) {
  const [connectionState, setConnectionState] = useState<WebSocketConnectionState>({
    status: 'disconnected',
    reconnectAttempts: 0
  })

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>()
  const heartbeatIntervalRef = useRef<NodeJS.Timeout>()
  const messageQueueRef = useRef<QueuedMessage[]>([])
  const eventHandlersRef = useRef<Map<WebSocketEventType, Set<(data: any) => void>>>(new Map())
  const messageIdRef = useRef(0)

  // Message queue management
  const addToQueue = useCallback((message: Omit<WebSocketMessage, 'id' | 'timestamp' | 'userId'>) => {
    const queuedMessage: QueuedMessage = {
      id: `queued_${messageIdRef.current++}`,
      message: {
        ...message,
        id: `msg_${messageIdRef.current}`,
        timestamp: new Date().toISOString(),
        userId: options.authentication?.token ? 'current_user' : 'anonymous'
      },
      attempts: 0,
      maxAttempts: 3,
      createdAt: new Date().toISOString()
    }

    messageQueueRef.current.push(queuedMessage)
    
    // Limit queue size
    if (messageQueueRef.current.length > (options.messageQueueSize || 100)) {
      messageQueueRef.current.shift()
    }
  }, [options.authentication?.token, options.messageQueueSize])

  // Process queued messages when connected
  const processMessageQueue = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return

    const messagesToProcess = [...messageQueueRef.current]
    messageQueueRef.current = []

    messagesToProcess.forEach(queuedMessage => {
      if (queuedMessage.attempts < queuedMessage.maxAttempts) {
        try {
          wsRef.current?.send(JSON.stringify(queuedMessage.message))
        } catch (error) {
          queuedMessage.attempts++
          queuedMessage.lastAttemptAt = new Date().toISOString()
          
          if (queuedMessage.attempts < queuedMessage.maxAttempts) {
            messageQueueRef.current.push(queuedMessage)
          }
        }
      }
    })
  }, [])

  // WebSocket connection management
  const connect = useCallback(async (): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          resolve()
          return
        }

        setConnectionState(prev => ({
          ...prev,
          status: 'connecting'
        }))

        let wsUrl = options.url
        if (options.authentication?.token) {
          const separator = wsUrl.includes('?') ? '&' : '?'
          wsUrl += `${separator}token=${encodeURIComponent(options.authentication.token)}`
        }

        const ws = new WebSocket(wsUrl, options.protocols)
        wsRef.current = ws

        ws.onopen = () => {
          setConnectionState(prev => ({
            ...prev,
            status: 'connected',
            lastConnectedAt: new Date().toISOString(),
            reconnectAttempts: 0
          }))

          // Start heartbeat
          if (options.heartbeatInterval) {
            heartbeatIntervalRef.current = setInterval(() => {
              if (ws.readyState === WebSocket.OPEN) {
                const heartbeat: WebSocketMessage = {
                  id: `heartbeat_${Date.now()}`,
                  type: 'system_status',
                  timestamp: new Date().toISOString(),
                  userId: options.authentication?.token ? 'current_user' : 'anonymous',
                  data: { type: 'heartbeat' }
                }
                ws.send(JSON.stringify(heartbeat))
              }
            }, options.heartbeatInterval)
          }

          // Process any queued messages
          processMessageQueue()
          resolve()
        }

        ws.onclose = (event) => {
          setConnectionState(prev => ({
            ...prev,
            status: 'disconnected',
            lastDisconnectedAt: new Date().toISOString()
          }))

          // Clear heartbeat
          if (heartbeatIntervalRef.current) {
            clearInterval(heartbeatIntervalRef.current)
          }

          // Attempt reconnection if not manual close
          if (event.code !== 1000 && connectionState.reconnectAttempts < (options.reconnectAttempts || 5)) {
            const delay = Math.min(1000 * Math.pow(2, connectionState.reconnectAttempts), 30000)
            
            setConnectionState(prev => ({
              ...prev,
              status: 'reconnecting',
              reconnectAttempts: prev.reconnectAttempts + 1
            }))

            reconnectTimeoutRef.current = setTimeout(() => {
              connect()
            }, delay)
          }
        }

        ws.onerror = (event) => {
          const error: WebSocketError = {
            code: 'CONNECTION_ERROR',
            message: 'WebSocket connection error',
            retryable: true,
            timestamp: new Date().toISOString()
          }

          setConnectionState(prev => ({
            ...prev,
            status: 'error'
          }))

          // Notify error handlers
          const errorHandlers = eventHandlersRef.current.get('error') || new Set()
          errorHandlers.forEach(handler => handler(error))

          reject(error)
        }

        ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data)
            
            // Update latency if this is a heartbeat response
            if (message.type === 'system_status' && message.data?.type === 'heartbeat_response') {
              const latency = Date.now() - new Date(message.timestamp).getTime()
              setConnectionState(prev => ({ ...prev, latency }))
              return
            }

            // Route message to appropriate handlers
            const handlers = eventHandlersRef.current.get(message.type) || new Set()
            handlers.forEach(handler => handler(message.data))

            // Also notify generic message handlers
            const messageHandlers = eventHandlersRef.current.get('system_status') || new Set()
            messageHandlers.forEach(handler => handler(message))

          } catch (error) {
            console.error('Failed to parse WebSocket message:', error)
          }
        }

      } catch (error) {
        const wsError: WebSocketError = {
          code: 'CONNECTION_FAILED',
          message: error instanceof Error ? error.message : 'Failed to establish WebSocket connection',
          retryable: true,
          timestamp: new Date().toISOString()
        }
        reject(wsError)
      }
    })
  }, [options, connectionState.reconnectAttempts, processMessageQueue])

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }
    
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current)
    }

    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual disconnect')
      wsRef.current = null
    }

    setConnectionState(prev => ({
      ...prev,
      status: 'disconnected',
      lastDisconnectedAt: new Date().toISOString()
    }))
  }, [])

  const subscribe = useCallback((eventType: WebSocketEventType, handler: (data: any) => void) => {
    if (!eventHandlersRef.current.has(eventType)) {
      eventHandlersRef.current.set(eventType, new Set())
    }
    
    const handlers = eventHandlersRef.current.get(eventType)!
    handlers.add(handler)

    // Return unsubscribe function
    return () => {
      handlers.delete(handler)
      if (handlers.size === 0) {
        eventHandlersRef.current.delete(eventType)
      }
    }
  }, [])

  const unsubscribe = useCallback((eventType: WebSocketEventType, handler: (data: any) => void) => {
    const handlers = eventHandlersRef.current.get(eventType)
    if (handlers) {
      handlers.delete(handler)
      if (handlers.size === 0) {
        eventHandlersRef.current.delete(eventType)
      }
    }
  }, [])

  const send = useCallback(async (message: Omit<WebSocketMessage, 'id' | 'timestamp' | 'userId'>): Promise<void> => {
    const fullMessage: WebSocketMessage = {
      ...message,
      id: `msg_${messageIdRef.current++}`,
      timestamp: new Date().toISOString(),
      userId: options.authentication?.token ? 'current_user' : 'anonymous'
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify(fullMessage))
      } catch (error) {
        // Add to queue if send fails
        addToQueue(message)
        throw error
      }
    } else {
      // Queue message if not connected
      addToQueue(message)
    }
  }, [options.authentication?.token, addToQueue])

  const contextValue: WebSocketContextValue = {
    connection: connectionState,
    subscribe,
    unsubscribe,
    send,
    connect,
    disconnect,
    isConnected: connectionState.status === 'connected',
    latency: connectionState.latency
  }

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (options.autoConnect !== false) {
      connect()
    }

    // Cleanup on unmount
    return () => {
      disconnect()
    }
  }, [connect, disconnect, options.autoConnect])

  // Handle authentication token changes
  useEffect(() => {
    if (connectionState.status === 'connected' && options.authentication?.token) {
      // Reconnect with new authentication
      disconnect()
      setTimeout(() => connect(), 100)
    }
  }, [options.authentication?.token, connectionState.status, connect, disconnect])

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  )
}

export function useWebSocketContext(): WebSocketContextValue {
  const context = useContext(WebSocketContext)
  if (!context) {
    throw new Error('useWebSocketContext must be used within a WebSocketProvider')
  }
  return context
}