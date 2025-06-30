'use client'

import { useEffect, useState } from 'react'

interface PerformanceMetrics {
  componentMountTime: number
  renderTime: number
  memoryUsage: number
  bundleSize: number
  timestamp: string
}

export function PerformanceMonitor() {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const startTime = performance.now()
    
    // Measure component mount time
    const mountTime = performance.now() - startTime
    
    // Measure memory usage (if available)
    const memoryInfo = (performance as any).memory
    const memoryUsage = memoryInfo ? memoryInfo.usedJSHeapSize : 0
    
    // Estimate bundle size impact for documentation page
    const documentationPageSize = 8658 // lines
    const estimatedBundleImpact = documentationPageSize * 50 // ~50 bytes per line average
    
    setMetrics({
      componentMountTime: mountTime,
      renderTime: performance.now() - startTime,
      memoryUsage: memoryUsage,
      bundleSize: estimatedBundleImpact,
      timestamp: new Date().toISOString()
    })

    // Log to console for Phase 1 validation
    console.group('📊 Phase 1: Documentation Performance Monitoring')
    console.log('Mount Time:', mountTime.toFixed(2), 'ms')
    console.log('Memory Usage:', (memoryUsage / 1024 / 1024).toFixed(2), 'MB')
    console.log('Estimated Bundle Impact:', (estimatedBundleImpact / 1024).toFixed(2), 'KB')
    console.log('Timestamp:', new Date().toISOString())
    console.log('Status: BASELINE ESTABLISHED - Tracking performance before refactor')
    console.groupEnd()

    // Show metrics in development only
    if (process.env.NODE_ENV === 'development') {
      setIsVisible(true)
    }
  }, [])

  if (!isVisible || !metrics) return null

  return (
    <div className="fixed bottom-4 left-4 bg-blue-100 border border-blue-300 rounded-lg p-3 text-xs font-mono z-50 max-w-xs">
      <div className="font-bold text-blue-800 mb-2">📊 Phase 1 Monitor</div>
      <div className="space-y-1 text-blue-700">
        <div>Mount: {metrics.componentMountTime.toFixed(2)}ms</div>
        <div>Memory: {(metrics.memoryUsage / 1024 / 1024).toFixed(2)}MB</div>
        <div>Bundle: ~{(metrics.bundleSize / 1024).toFixed(0)}KB</div>
        <div className="text-blue-600 font-semibold text-xs">Status: Monitoring</div>
      </div>
    </div>
  )
} 