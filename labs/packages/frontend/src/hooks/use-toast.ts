import { useState, useCallback } from 'react'

interface ToastProps {
  title: string
  description?: string
  variant?: 'default' | 'destructive'
  duration?: number
}

interface Toast extends ToastProps {
  id: string
  visible: boolean
}

let toastId = 0

const toasts: Toast[] = []
const listeners: Array<(toasts: Toast[]) => void> = []

const dispatch = (toast: Toast) => {
  toasts.push(toast)
  listeners.forEach((listener) => listener([...toasts]))
  
  // Auto-remove toast after duration
  setTimeout(() => {
    const index = toasts.findIndex(t => t.id === toast.id)
    if (index > -1) {
      toasts.splice(index, 1)
      listeners.forEach((listener) => listener([...toasts]))
    }
  }, toast.duration || 5000)
}

const dismiss = (id: string) => {
  const index = toasts.findIndex(t => t.id === id)
  if (index > -1) {
    toasts.splice(index, 1)
    listeners.forEach((listener) => listener([...toasts]))
  }
}

export function useToast() {
  const [toastList, setToastList] = useState<Toast[]>([])
  
  const toast = useCallback((props: ToastProps) => {
    const id = (++toastId).toString()
    dispatch({
      ...props,
      id,
      visible: true
    })
  }, [])
  
  // Subscribe to toast changes
  useState(() => {
    listeners.push(setToastList)
    return () => {
      const index = listeners.indexOf(setToastList)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  })
  
  return {
    toast,
    toasts: toastList,
    dismiss
  }
}

// Export a standalone toast function
export const toast = (props: ToastProps) => {
  const id = (++toastId).toString()
  dispatch({
    ...props,
    id,
    visible: true
  })
} 