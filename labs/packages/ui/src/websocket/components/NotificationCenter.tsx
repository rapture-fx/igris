import React, { useState } from 'react'
import { Bell, X, CheckCircle, AlertTriangle, Info, AlertCircle, ExternalLink, Clock } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { NotificationData } from '@igris-inertial/types'
import { useNotifications, useConnectionStatus } from '../hooks'
import { cn } from '../../styles/utils'

export interface NotificationCenterProps {
  maxVisible?: number
  showBadge?: boolean
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
  className?: string
}

export function NotificationCenter({ 
  maxVisible = 5,
  showBadge = true,
  position = 'top-right',
  className 
}: NotificationCenterProps) {
  const { notifications, unreadCount, dismissNotification, markAsRead, clearAll, isConnected } = useNotifications()
  const { connection } = useConnectionStatus()
  const [showAll, setShowAll] = useState(false)

  const getNotificationIcon = (type: NotificationData['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      default:
        return <Info className="h-4 w-4 text-blue-500" />
    }
  }

  const getNotificationStyles = (type: NotificationData['type']) => {
    switch (type) {
      case 'success':
        return 'border-green-200 bg-green-50'
      case 'warning':
        return 'border-yellow-200 bg-yellow-50'
      case 'error':
        return 'border-red-200 bg-red-50'
      default:
        return 'border-blue-200 bg-blue-50'
    }
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
    
    if (diffInSeconds < 60) return 'Just now'
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
    return date.toLocaleDateString()
  }

  const NotificationItem = ({ notification, compact = false }: { notification: NotificationData; compact?: boolean }) => (
    <div 
      className={cn(
        "border rounded-lg p-4 space-y-2 transition-all hover:shadow-sm",
        getNotificationStyles(notification.type),
        !notification.metadata?.read && "ring-2 ring-blue-200"
      )}
      onClick={() => !notification.metadata?.read && markAsRead(notification.id)}
    >
      <div className="flex items-start space-x-3">
        {getNotificationIcon(notification.type)}
        
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-start justify-between">
            <h4 className="text-sm font-medium text-gray-900">
              {notification.title}
            </h4>
            
            <div className="flex items-center space-x-2">
              <span className="text-xs text-gray-500">
                {formatTimestamp(notification.metadata?.timestamp || new Date().toISOString())}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  dismissNotification(notification.id)
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
          
          {!compact && (
            <>
              <p className="text-sm text-gray-700">{notification.message}</p>
              
              {notification.actionUrl && (
                <button className="flex items-center space-x-1 text-xs text-blue-600 hover:text-blue-700 transition-colors">
                  <ExternalLink className="h-3 w-3" />
                  <span>{notification.actionText || 'View Details'}</span>
                </button>
              )}
              
              <div className="flex items-center space-x-2 text-xs text-gray-500">
                <span className={cn(
                  "px-2 py-1 rounded",
                  notification.category === 'system' && "bg-gray-100 text-gray-700",
                  notification.category === 'training' && "bg-blue-100 text-blue-700",
                  notification.category === 'data' && "bg-green-100 text-green-700",
                  notification.category === 'billing' && "bg-orange-100 text-orange-700",
                  notification.category === 'security' && "bg-red-100 text-red-700"
                )}>
                  {notification.category}
                </span>
                
                {notification.persistent && (
                  <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded">
                    persistent
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <div className={cn("relative", className)}>
      {/* Notification Bell */}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
            <Bell className="h-5 w-5" />
            {showBadge && unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className={cn(
              "w-80 max-h-96 overflow-y-auto bg-white rounded-lg shadow-lg border p-2 z-50",
              position.includes('right') ? 'origin-top-right' : 'origin-top-left'
            )}
            align={position.includes('right') ? 'end' : 'start'}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b">
              <div className="flex items-center space-x-2">
                <Bell className="h-4 w-4 text-gray-500" />
                <span className="font-medium text-gray-900">Notifications</span>
                {!isConnected && (
                  <span className="text-xs text-red-500">(Offline)</span>
                )}
              </div>
              
              <div className="flex items-center space-x-2">
                {notifications.length > 0 && (
                  <button
                    onClick={clearAll}
                    className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    Clear all
                  </button>
                )}
                
                <button
                  onClick={() => setShowAll(true)}
                  className="text-xs text-blue-600 hover:text-blue-700 transition-colors"
                >
                  View all
                </button>
              </div>
            </div>

            {/* Notifications List */}
            <div className="space-y-2 p-2">
              {notifications.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No notifications</p>
                </div>
              ) : (
                <>
                  {notifications.slice(0, maxVisible).map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      compact={true}
                    />
                  ))}
                  
                  {notifications.length > maxVisible && (
                    <button
                      onClick={() => setShowAll(true)}
                      className="w-full p-2 text-sm text-center text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                    >
                      View {notifications.length - maxVisible} more notifications
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Connection Status */}
            <div className="border-t p-3">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2">
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    isConnected ? "bg-green-500" : "bg-red-500"
                  )} />
                  <span className="text-gray-600">
                    {isConnected ? 'Real-time updates' : 'Offline mode'}
                  </span>
                </div>
                
                {connection.latency && (
                  <span className="text-gray-500">
                    {connection.latency}ms latency
                  </span>
                )}
              </div>
            </div>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      {/* Full Notifications Dialog */}
      <Dialog.Root open={showAll} onOpenChange={setShowAll}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
          <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-lg w-full max-w-2xl max-h-[80vh] z-50">
            <div className="p-6 border-b">
              <Dialog.Title className="text-lg font-semibold text-gray-900">
                All Notifications
              </Dialog.Title>
              <div className="flex items-center justify-between mt-2">
                <p className="text-sm text-gray-600">
                  {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
                  {unreadCount > 0 && ` (${unreadCount} unread)`}
                </p>
                
                {notifications.length > 0 && (
                  <button
                    onClick={clearAll}
                    className="text-sm text-red-600 hover:text-red-700 transition-colors"
                  >
                    Clear All
                  </button>
                )}
              </div>
            </div>
            
            <div className="p-6 space-y-4 max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">No Notifications</h3>
                  <p>You're all caught up! New notifications will appear here.</p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    compact={false}
                  />
                ))
              )}
            </div>

            <div className="p-6 border-t">
              <div className="flex justify-end">
                <Dialog.Close asChild>
                  <button className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                    Close
                  </button>
                </Dialog.Close>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}

// Toast notification component for real-time notifications
export interface NotificationToastProps {
  notification: NotificationData
  onDismiss: () => void
  autoHide?: boolean
  hideDelay?: number
}

export function NotificationToast({ 
  notification, 
  onDismiss, 
  autoHide = true, 
  hideDelay = 5000 
}: NotificationToastProps) {
  React.useEffect(() => {
    if (autoHide && !notification.persistent) {
      const timer = setTimeout(onDismiss, hideDelay)
      return () => clearTimeout(timer)
    }
  }, [autoHide, hideDelay, onDismiss, notification.persistent])

  return (
    <div className={cn(
      "max-w-sm w-full bg-white shadow-lg rounded-lg border pointer-events-auto",
      getNotificationStyles(notification.type),
      "animate-in slide-in-from-right-full"
    )}>
      <div className="p-4">
        <div className="flex items-start space-x-3">
          {getNotificationIcon(notification.type)}
          
          <div className="flex-1 space-y-1">
            <div className="flex items-start justify-between">
              <h4 className="text-sm font-medium text-gray-900">
                {notification.title}
              </h4>
              
              <button
                onClick={onDismiss}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <p className="text-sm text-gray-700">{notification.message}</p>
            
            {notification.actionUrl && (
              <button className="flex items-center space-x-1 text-xs text-blue-600 hover:text-blue-700 transition-colors">
                <ExternalLink className="h-3 w-3" />
                <span>{notification.actionText || 'View Details'}</span>
              </button>
            )}
            
            <div className="flex items-center justify-between">
              <span className={cn(
                "text-xs px-2 py-1 rounded",
                notification.category === 'system' && "bg-gray-100 text-gray-700",
                notification.category === 'training' && "bg-blue-100 text-blue-700",
                notification.category === 'data' && "bg-green-100 text-green-700",
                notification.category === 'billing' && "bg-orange-100 text-orange-700",
                notification.category === 'security' && "bg-red-100 text-red-700"
              )}>
                {notification.category}
              </span>
              
              <div className="flex items-center space-x-1 text-xs text-gray-500">
                <Clock className="h-3 w-3" />
                <span>{formatTimestamp(notification.metadata?.timestamp || new Date().toISOString())}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Toast container for positioning notifications
export interface NotificationToastContainerProps {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
  maxToasts?: number
}

export function NotificationToastContainer({ 
  position = 'top-right',
  maxToasts = 3 
}: NotificationToastContainerProps) {
  const { notifications, dismissNotification } = useNotifications()
  const [toastNotifications, setToastNotifications] = useState<NotificationData[]>([])

  // Filter for toast-worthy notifications (recent, high priority)
  React.useEffect(() => {
    const recentNotifications = notifications
      .filter(n => !n.metadata?.toastShown)
      .slice(0, maxToasts)
    
    setToastNotifications(recentNotifications)
    
    // Mark as shown
    recentNotifications.forEach(notification => {
      notification.metadata = { ...notification.metadata, toastShown: true }
    })
  }, [notifications, maxToasts])

  const positionClasses = {
    'top-right': 'fixed top-4 right-4 z-50',
    'top-left': 'fixed top-4 left-4 z-50',
    'bottom-right': 'fixed bottom-4 right-4 z-50',
    'bottom-left': 'fixed bottom-4 left-4 z-50'
  }

  const handleDismiss = (notificationId: string) => {
    setToastNotifications(prev => prev.filter(n => n.id !== notificationId))
    dismissNotification(notificationId)
  }

  if (toastNotifications.length === 0) return null

  return (
    <div className={positionClasses[position]}>
      <div className="space-y-2">
        {toastNotifications.map((notification) => (
          <NotificationToast
            key={notification.id}
            notification={notification}
            onDismiss={() => handleDismiss(notification.id)}
          />
        ))}
      </div>
    </div>
  )
}

function formatTimestamp(timestamp: string) {
  const date = new Date(timestamp)
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  
  if (diffInSeconds < 60) return 'Just now'
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
  return date.toLocaleDateString()
}

function getNotificationIcon(type: NotificationData['type']) {
  switch (type) {
    case 'success':
      return <CheckCircle className="h-4 w-4 text-green-500" />
    case 'warning':
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />
    case 'error':
      return <AlertCircle className="h-4 w-4 text-red-500" />
    default:
      return <Info className="h-4 w-4 text-blue-500" />
  }
}

function getNotificationStyles(type: NotificationData['type']) {
  switch (type) {
    case 'success':
      return 'border-green-200 bg-green-50'
    case 'warning':
      return 'border-yellow-200 bg-yellow-50'
    case 'error':
      return 'border-red-200 bg-red-50'
    default:
      return 'border-blue-200 bg-blue-50'
  }
}