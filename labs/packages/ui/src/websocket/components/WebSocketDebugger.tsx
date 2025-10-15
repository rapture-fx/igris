import React, { useState, useEffect, useRef } from 'react'
import { Bug, Send, Trash2, Copy, Download, Eye, EyeOff } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import { WebSocketMessage, WebSocketEventType } from '@schlep-engine/types'
import { useWebSocket } from '../hooks'
import { cn } from '../../styles/utils'

export interface WebSocketDebuggerProps {
  maxMessages?: number
  showInProduction?: boolean
}

interface LoggedMessage {
  id: string
  type: 'incoming' | 'outgoing'
  timestamp: string
  message: WebSocketMessage
  rawData?: any
}

export function WebSocketDebugger({ 
  maxMessages = 100,
  showInProduction = false 
}: WebSocketDebuggerProps) {
  const { connection, subscribe, send, isConnected } = useWebSocket()
  const [isVisible, setIsVisible] = useState(false)
  const [messageLog, setMessageLog] = useState<LoggedMessage[]>([])
  const [testMessage, setTestMessage] = useState('')
  const [selectedEventType, setSelectedEventType] = useState<WebSocketEventType>('system_status')
  const [autoScroll, setAutoScroll] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Don't show in production unless explicitly allowed
  if (process.env.NODE_ENV === 'production' && !showInProduction) {
    return null
  }

  // Log incoming messages
  useEffect(() => {
    const eventTypes: WebSocketEventType[] = [
      'training_progress',
      'rl_progress', 
      'prediction_progress',
      'data_upload_progress',
      'quality_assessment_complete',
      'document_processing_progress',
      'pipeline_status',
      'system_status',
      'notification',
      'error'
    ]

    const unsubscribers = eventTypes.map(eventType =>
      subscribe(eventType, (data) => {
        const loggedMessage: LoggedMessage = {
          id: `log_${Date.now()}_${Math.random()}`,
          type: 'incoming',
          timestamp: new Date().toISOString(),
          message: {
            id: `incoming_${Date.now()}`,
            type: eventType,
            timestamp: new Date().toISOString(),
            userId: 'current_user',
            data
          },
          rawData: data
        }

        setMessageLog(prev => {
          const updated = [...prev, loggedMessage]
          return updated.slice(-maxMessages) // Keep only last N messages
        })
      })
    )

    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe())
    }
  }, [subscribe, maxMessages])

  // Auto scroll to bottom
  useEffect(() => {
    if (autoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messageLog, autoScroll])

  const sendTestMessage = () => {
    if (!testMessage.trim()) return

    try {
      const message = {
        type: selectedEventType,
        data: JSON.parse(testMessage)
      }

      // Log outgoing message
      const loggedMessage: LoggedMessage = {
        id: `log_${Date.now()}_${Math.random()}`,
        type: 'outgoing',
        timestamp: new Date().toISOString(),
        message: {
          id: `outgoing_${Date.now()}`,
          type: selectedEventType,
          timestamp: new Date().toISOString(),
          userId: 'current_user',
          data: JSON.parse(testMessage)
        }
      }

      setMessageLog(prev => [...prev, loggedMessage].slice(-maxMessages))
      send(message)
      setTestMessage('')
    } catch (error) {
      console.error('Failed to send test message:', error)
    }
  }

  const clearLog = () => {
    setMessageLog([])
  }

  const exportLog = () => {
    const logData = {
      timestamp: new Date().toISOString(),
      connection: connection,
      messages: messageLog
    }
    
    const dataStr = JSON.stringify(logData, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    
    const link = document.createElement('a')
    link.href = url
    link.download = `websocket-debug-${Date.now()}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const copyMessage = (message: LoggedMessage) => {
    navigator.clipboard.writeText(JSON.stringify(message, null, 2))
  }

  return (
    <>
      {/* Debug Toggle Button */}
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 p-3 bg-gray-800 text-white rounded-full shadow-lg hover:bg-gray-700 transition-colors z-40"
        title="WebSocket Debugger"
      >
        <Bug className="h-5 w-5" />
      </button>

      {/* Debug Dialog */}
      <Dialog.Root open={isVisible} onOpenChange={setIsVisible}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
          <Dialog.Content className="fixed top-4 right-4 bottom-4 w-96 bg-white rounded-lg shadow-xl z-50 flex flex-col">
            {/* Header */}
            <div className="p-4 border-b flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Bug className="h-5 w-5 text-gray-600" />
                <Dialog.Title className="text-lg font-semibold text-gray-900">
                  WebSocket Debugger
                </Dialog.Title>
              </div>
              
              <div className="flex items-center space-x-2">
                <div className={cn(
                  "w-3 h-3 rounded-full",
                  isConnected ? "bg-green-500" : "bg-red-500"
                )} />
                <span className="text-sm text-gray-600">
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            </div>

            {/* Connection Info */}
            <div className="p-4 border-b bg-gray-50">
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span>Status:</span>
                  <span className="font-mono">{connection.status}</span>
                </div>
                {connection.latency && (
                  <div className="flex justify-between">
                    <span>Latency:</span>
                    <span className="font-mono">{connection.latency}ms</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Reconnect Attempts:</span>
                  <span className="font-mono">{connection.reconnectAttempts}</span>
                </div>
                {connection.lastConnectedAt && (
                  <div className="flex justify-between">
                    <span>Last Connected:</span>
                    <span className="font-mono text-xs">
                      {new Date(connection.lastConnectedAt).toLocaleTimeString()}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Message Log */}
            <div className="flex-1 flex flex-col">
              <div className="p-4 border-b flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">
                  Messages ({messageLog.length})
                </span>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setAutoScroll(!autoScroll)}
                    className={cn(
                      "p-1 rounded text-xs",
                      autoScroll ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"
                    )}
                    title="Auto-scroll"
                  >
                    {autoScroll ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                  </button>
                  
                  <button
                    onClick={exportLog}
                    className="p-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200"
                    title="Export log"
                  >
                    <Download className="h-3 w-3" />
                  </button>
                  
                  <button
                    onClick={clearLog}
                    className="p-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200"
                    title="Clear log"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {messageLog.map((logMessage) => (
                  <div
                    key={logMessage.id}
                    className={cn(
                      "p-2 rounded border text-xs",
                      logMessage.type === 'incoming' 
                        ? "bg-blue-50 border-blue-200" 
                        : "bg-green-50 border-green-200"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center space-x-2">
                        <span className={cn(
                          "px-2 py-1 rounded font-medium",
                          logMessage.type === 'incoming' ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"
                        )}>
                          {logMessage.type}
                        </span>
                        <span className="text-gray-600">
                          {logMessage.message.type}
                        </span>
                      </div>
                      
                      <button
                        onClick={() => copyMessage(logMessage)}
                        className="text-gray-400 hover:text-gray-600"
                        title="Copy message"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                    
                    <div className="text-xs text-gray-500 mb-1">
                      {new Date(logMessage.timestamp).toLocaleTimeString()}
                    </div>
                    
                    <pre className="text-xs overflow-x-auto whitespace-pre-wrap break-words">
                      {JSON.stringify(logMessage.rawData || logMessage.message.data, null, 2)}
                    </pre>
                  </div>
                ))}
                
                {messageLog.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Bug className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No messages logged yet</p>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Test Message Sender */}
            <div className="p-4 border-t space-y-2">
              <div className="text-sm font-medium text-gray-700 mb-2">Send Test Message</div>
              
              <select
                value={selectedEventType}
                onChange={(e) => setSelectedEventType(e.target.value as WebSocketEventType)}
                className="w-full px-2 py-1 text-xs border rounded"
              >
                <option value="training_progress">Training Progress</option>
                <option value="rl_progress">RL Progress</option>
                <option value="system_status">System Status</option>
                <option value="notification">Notification</option>
                <option value="error">Error</option>
              </select>

              <textarea
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                placeholder='{"test": "data"}'
                className="w-full px-2 py-1 text-xs border rounded font-mono"
                rows={3}
              />

              <button
                onClick={sendTestMessage}
                disabled={!isConnected || !testMessage.trim()}
                className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded text-sm disabled:opacity-50 hover:bg-blue-700 transition-colors"
              >
                <Send className="h-3 w-3" />
                <span>Send Message</span>
              </button>
            </div>

            {/* Close Button */}
            <div className="p-4 border-t">
              <Dialog.Close asChild>
                <button className="w-full px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                  Close Debugger
                </button>
              </Dialog.Close>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}