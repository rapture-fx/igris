/**
 * Frontend Performance Monitoring Utilities
 * ========================================
 * 
 * Comprehensive frontend performance monitoring including:
 * - Core Web Vitals measurement (LCP, FID, CLS)
 * - Time to Interactive (TTI) and First Contentful Paint (FCP)
 * - Bundle size analysis
 * - Component rendering performance
 * - Authentication flow performance
 * - Network request optimization tracking
 */

interface PerformanceMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  timestamp: number;
  url: string;
  userAgent: string;
}

interface NavigationMetric extends PerformanceMetric {
  type: 'navigation';
  entries: PerformanceNavigationTiming;
}

interface CoreWebVital extends PerformanceMetric {
  type: 'core-web-vital';
  id: string;
  delta: number;
}

interface CustomMetric extends PerformanceMetric {
  type: 'custom';
  category: string;
  metadata?: Record<string, any>;
}

type AllMetrics = NavigationMetric | CoreWebVital | CustomMetric;

class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: AllMetrics[] = [];
  private observers: PerformanceObserver[] = [];
  private isMonitoring = false;
  private apiEndpoint = '/api/v1/performance/metrics';

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  private constructor() {
    this.initializeMonitoring();
  }

  /**
   * Initialize performance monitoring
   */
  private initializeMonitoring(): void {
    if (typeof window === 'undefined') return;

    try {
      // Monitor Core Web Vitals
      this.initializeCoreWebVitals();
      
      // Monitor navigation timing
      this.initializeNavigationTiming();
      
      // Monitor resource timing
      this.initializeResourceTiming();
      
      // Monitor long tasks
      this.initializeLongTaskMonitoring();
      
      this.isMonitoring = true;
    } catch (error) {
      console.error('Failed to initialize performance monitoring:', error);
    }
  }

  /**
   * Initialize Core Web Vitals monitoring
   */
  private initializeCoreWebVitals(): void {
    // Check if web-vitals library is available
    if (typeof window !== 'undefined') {
      // We'll implement Core Web Vitals manually since web-vitals may not be available
      this.measureLCP();
      this.measureFID();
      this.measureCLS();
      this.measureFCP();
      this.measureTTFB();
    }
  }

  /**
   * Measure Largest Contentful Paint (LCP)
   */
  private measureLCP(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1] as PerformanceEntry;
        
        if (lastEntry) {
          const lcpValue = lastEntry.startTime;
          this.recordCoreWebVital('LCP', lcpValue, this.getLCPRating(lcpValue));
        }
      });

      observer.observe({ type: 'largest-contentful-paint', buffered: true });
      this.observers.push(observer);
    } catch (error) {
      console.warn('LCP measurement not supported:', error);
    }
  }

  /**
   * Measure First Input Delay (FID)
   */
  private measureFID(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          const fidValue = entry.processingStart - entry.startTime;
          this.recordCoreWebVital('FID', fidValue, this.getFIDRating(fidValue));
        });
      });

      observer.observe({ type: 'first-input', buffered: true });
      this.observers.push(observer);
    } catch (error) {
      console.warn('FID measurement not supported:', error);
    }
  }

  /**
   * Measure Cumulative Layout Shift (CLS)
   */
  private measureCLS(): void {
    try {
      let clsValue = 0;
      let sessionValue = 0;
      let sessionEntries: any[] = [];

      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        
        entries.forEach((entry: any) => {
          // Only count layout shifts that aren't user-initiated
          if (!entry.hadRecentInput) {
            const firstSessionEntry = sessionEntries[0];
            const lastSessionEntry = sessionEntries[sessionEntries.length - 1];

            // If the entry occurred less than 1 second after the previous entry
            // and less than 5 seconds after the first entry in the session,
            // include it in the current session. Otherwise, start a new session.
            if (sessionValue &&
                entry.startTime - lastSessionEntry.startTime < 1000 &&
                entry.startTime - firstSessionEntry.startTime < 5000) {
              sessionValue += entry.value;
              sessionEntries.push(entry);
            } else {
              sessionValue = entry.value;
              sessionEntries = [entry];
            }

            // If the current session value is larger than the current CLS value,
            // update CLS and the entries contributing to it.
            if (sessionValue > clsValue) {
              clsValue = sessionValue;
              this.recordCoreWebVital('CLS', clsValue, this.getCLSRating(clsValue));
            }
          }
        });
      });

      observer.observe({ type: 'layout-shift', buffered: true });
      this.observers.push(observer);
    } catch (error) {
      console.warn('CLS measurement not supported:', error);
    }
  }

  /**
   * Measure First Contentful Paint (FCP)
   */
  private measureFCP(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.name === 'first-contentful-paint') {
            const fcpValue = entry.startTime;
            this.recordCoreWebVital('FCP', fcpValue, this.getFCPRating(fcpValue));
          }
        });
      });

      observer.observe({ type: 'paint', buffered: true });
      this.observers.push(observer);
    } catch (error) {
      console.warn('FCP measurement not supported:', error);
    }
  }

  /**
   * Measure Time to First Byte (TTFB)
   */
  private measureTTFB(): void {
    try {
      const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (navigationEntry) {
        const ttfbValue = navigationEntry.responseStart - navigationEntry.requestStart;
        this.recordCoreWebVital('TTFB', ttfbValue, this.getTTFBRating(ttfbValue));
      }
    } catch (error) {
      console.warn('TTFB measurement failed:', error);
    }
  }

  /**
   * Initialize navigation timing monitoring
   */
  private initializeNavigationTiming(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('load', () => {
      setTimeout(() => {
        const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        if (navigationEntry) {
          this.recordNavigationMetrics(navigationEntry);
        }
      }, 0);
    });
  }

  /**
   * Initialize resource timing monitoring
   */
  private initializeResourceTiming(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          this.analyzeResourceTiming(entry as PerformanceResourceTiming);
        });
      });

      observer.observe({ type: 'resource', buffered: true });
      this.observers.push(observer);
    } catch (error) {
      console.warn('Resource timing monitoring not supported:', error);
    }
  }

  /**
   * Initialize long task monitoring
   */
  private initializeLongTaskMonitoring(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          this.recordLongTask(entry);
        });
      });

      observer.observe({ type: 'longtask', buffered: true });
      this.observers.push(observer);
    } catch (error) {
      console.warn('Long task monitoring not supported:', error);
    }
  }

  /**
   * Record Core Web Vital metric
   */
  private recordCoreWebVital(name: string, value: number, rating: 'good' | 'needs-improvement' | 'poor'): void {
    const metric: CoreWebVital = {
      type: 'core-web-vital',
      name,
      value,
      rating,
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      id: `${name}-${Date.now()}`,
      delta: value
    };

    this.metrics.push(metric);
    this.sendMetricToAPI(metric);
  }

  /**
   * Record navigation metrics
   */
  private recordNavigationMetrics(entry: PerformanceNavigationTiming): void {
    const metrics = [
      {
        name: 'DNS Lookup',
        value: entry.domainLookupEnd - entry.domainLookupStart,
        category: 'network'
      },
      {
        name: 'TCP Connection',
        value: entry.connectEnd - entry.connectStart,
        category: 'network'
      },
      {
        name: 'TLS Negotiation',
        value: entry.secureConnectionStart ? entry.connectEnd - entry.secureConnectionStart : 0,
        category: 'network'
      },
      {
        name: 'Request',
        value: entry.responseStart - entry.requestStart,
        category: 'network'
      },
      {
        name: 'Response',
        value: entry.responseEnd - entry.responseStart,
        category: 'network'
      },
      {
        name: 'DOM Processing',
        value: entry.domComplete - entry.domLoading,
        category: 'parsing'
      },
      {
        name: 'DOM Interactive',
        value: entry.domInteractive - entry.navigationStart,
        category: 'parsing'
      },
      {
        name: 'DOM Content Loaded',
        value: entry.domContentLoadedEventEnd - entry.domContentLoadedEventStart,
        category: 'parsing'
      },
      {
        name: 'Load Event',
        value: entry.loadEventEnd - entry.loadEventStart,
        category: 'loading'
      }
    ];

    metrics.forEach(({ name, value, category }) => {
      if (value >= 0) {
        const customMetric: CustomMetric = {
          type: 'custom',
          name,
          value,
          rating: this.getNavigationRating(name, value),
          timestamp: Date.now(),
          url: window.location.href,
          userAgent: navigator.userAgent,
          category,
          metadata: { navigationEntry: entry }
        };

        this.metrics.push(customMetric);
      }
    });

    // Record overall navigation metric
    const navigationMetric: NavigationMetric = {
      type: 'navigation',
      name: 'Page Load',
      value: entry.loadEventEnd - entry.navigationStart,
      rating: this.getPageLoadRating(entry.loadEventEnd - entry.navigationStart),
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      entries: entry
    };

    this.metrics.push(navigationMetric);
    this.sendMetricToAPI(navigationMetric);
  }

  /**
   * Analyze resource timing
   */
  private analyzeResourceTiming(entry: PerformanceResourceTiming): void {
    const duration = entry.responseEnd - entry.startTime;
    const size = entry.transferSize || 0;

    // Focus on critical resources
    if (this.isCriticalResource(entry.name)) {
      const customMetric: CustomMetric = {
        type: 'custom',
        name: `Resource Load: ${this.getResourceType(entry)}`,
        value: duration,
        rating: this.getResourceLoadRating(duration),
        timestamp: Date.now(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        category: 'resource',
        metadata: {
          resourceUrl: entry.name,
          size,
          type: this.getResourceType(entry),
          cached: entry.transferSize === 0 && entry.decodedBodySize > 0
        }
      };

      this.metrics.push(customMetric);
    }
  }

  /**
   * Record long task
   */
  private recordLongTask(entry: PerformanceEntry): void {
    const customMetric: CustomMetric = {
      type: 'custom',
      name: 'Long Task',
      value: entry.duration,
      rating: 'poor',
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      category: 'performance',
      metadata: {
        startTime: entry.startTime,
        duration: entry.duration
      }
    };

    this.metrics.push(customMetric);
    this.sendMetricToAPI(customMetric);
  }

  /**
   * Measure authentication flow performance
   */
  public measureAuthFlow(flowType: 'login' | 'oauth' | 'logout', startTime: number): void {
    const duration = performance.now() - startTime;
    
    const authMetric: CustomMetric = {
      type: 'custom',
      name: `Auth Flow: ${flowType}`,
      value: duration,
      rating: this.getAuthFlowRating(duration),
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      category: 'auth',
      metadata: {
        flowType,
        startTime
      }
    };

    this.metrics.push(authMetric);
    this.sendMetricToAPI(authMetric);
  }

  /**
   * Measure component rendering performance
   */
  public measureComponentRender(componentName: string, startTime: number): void {
    const duration = performance.now() - startTime;
    
    const renderMetric: CustomMetric = {
      type: 'custom',
      name: `Component Render: ${componentName}`,
      value: duration,
      rating: this.getComponentRenderRating(duration),
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      category: 'component',
      metadata: {
        componentName,
        startTime
      }
    };

    this.metrics.push(renderMetric);
  }

  /**
   * Measure API call performance
   */
  public measureAPICall(endpoint: string, method: string, startTime: number, success: boolean): void {
    const duration = performance.now() - startTime;
    
    const apiMetric: CustomMetric = {
      type: 'custom',
      name: `API Call: ${method} ${endpoint}`,
      value: duration,
      rating: this.getAPICallRating(duration),
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      category: 'api',
      metadata: {
        endpoint,
        method,
        success,
        startTime
      }
    };

    this.metrics.push(apiMetric);
  }

  /**
   * Get bundle size information
   */
  public async getBundleAnalysis(): Promise<{
    totalSize: number;
    gzippedSize: number;
    chunks: Array<{
      name: string;
      size: number;
      type: 'js' | 'css' | 'other';
    }>;
    recommendations: string[];
  }> {
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    
    let totalSize = 0;
    let gzippedSize = 0;
    const chunks: Array<{ name: string; size: number; type: 'js' | 'css' | 'other' }> = [];
    const recommendations: string[] = [];

    resources.forEach((resource) => {
      if (this.isBundleResource(resource.name)) {
        const size = resource.transferSize || 0;
        const decodedSize = resource.decodedBodySize || 0;
        
        totalSize += decodedSize;
        gzippedSize += size;
        
        chunks.push({
          name: this.getResourceName(resource.name),
          size: decodedSize,
          type: this.getResourceType(resource) as 'js' | 'css' | 'other'
        });
      }
    });

    // Generate recommendations
    if (totalSize > 500 * 1024) { // 500KB threshold
      recommendations.push('Bundle size exceeds 500KB - consider code splitting');
    }

    const largeChunks = chunks.filter(chunk => chunk.size > 100 * 1024); // 100KB threshold
    if (largeChunks.length > 0) {
      recommendations.push(`${largeChunks.length} large chunks detected - consider optimization`);
    }

    const compressionRatio = gzippedSize / totalSize;
    if (compressionRatio > 0.7) { // Poor compression
      recommendations.push('Poor compression ratio - check gzip configuration');
    }

    return {
      totalSize,
      gzippedSize,
      chunks,
      recommendations
    };
  }

  /**
   * Send metric to API
   */
  private async sendMetricToAPI(metric: AllMetrics): Promise<void> {
    try {
      // Only send critical metrics to avoid overwhelming the API
      if (this.isCriticalMetric(metric)) {
        await fetch(this.apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(metric)
        });
      }
    } catch (error) {
      // Fail silently to avoid impacting user experience
      console.debug('Failed to send performance metric:', error);
    }
  }

  /**
   * Helper methods for rating calculations
   */
  private getLCPRating(value: number): 'good' | 'needs-improvement' | 'poor' {
    if (value <= 2500) return 'good';
    if (value <= 4000) return 'needs-improvement';
    return 'poor';
  }

  private getFIDRating(value: number): 'good' | 'needs-improvement' | 'poor' {
    if (value <= 100) return 'good';
    if (value <= 300) return 'needs-improvement';
    return 'poor';
  }

  private getCLSRating(value: number): 'good' | 'needs-improvement' | 'poor' {
    if (value <= 0.1) return 'good';
    if (value <= 0.25) return 'needs-improvement';
    return 'poor';
  }

  private getFCPRating(value: number): 'good' | 'needs-improvement' | 'poor' {
    if (value <= 1800) return 'good';
    if (value <= 3000) return 'needs-improvement';
    return 'poor';
  }

  private getTTFBRating(value: number): 'good' | 'needs-improvement' | 'poor' {
    if (value <= 800) return 'good';
    if (value <= 1800) return 'needs-improvement';
    return 'poor';
  }

  private getNavigationRating(name: string, value: number): 'good' | 'needs-improvement' | 'poor' {
    const thresholds: Record<string, [number, number]> = {
      'DNS Lookup': [50, 200],
      'TCP Connection': [100, 300],
      'TLS Negotiation': [200, 500],
      'Request': [100, 500],
      'Response': [200, 1000],
      'DOM Processing': [800, 2000],
      'DOM Interactive': [1500, 3000],
      'DOM Content Loaded': [100, 300],
      'Load Event': [100, 500]
    };

    const [good, poor] = thresholds[name] || [1000, 3000];
    if (value <= good) return 'good';
    if (value <= poor) return 'needs-improvement';
    return 'poor';
  }

  private getPageLoadRating(value: number): 'good' | 'needs-improvement' | 'poor' {
    if (value <= 2000) return 'good';
    if (value <= 5000) return 'needs-improvement';
    return 'poor';
  }

  private getResourceLoadRating(value: number): 'good' | 'needs-improvement' | 'poor' {
    if (value <= 500) return 'good';
    if (value <= 1500) return 'needs-improvement';
    return 'poor';
  }

  private getAuthFlowRating(value: number): 'good' | 'needs-improvement' | 'poor' {
    if (value <= 1000) return 'good';
    if (value <= 2000) return 'needs-improvement';
    return 'poor';
  }

  private getComponentRenderRating(value: number): 'good' | 'needs-improvement' | 'poor' {
    if (value <= 16) return 'good'; // 60fps = 16.67ms per frame
    if (value <= 50) return 'needs-improvement';
    return 'poor';
  }

  private getAPICallRating(value: number): 'good' | 'needs-improvement' | 'poor' {
    if (value <= 200) return 'good';
    if (value <= 1000) return 'needs-improvement';
    return 'poor';
  }

  /**
   * Helper methods for resource analysis
   */
  private isCriticalResource(url: string): boolean {
    return url.includes('/static/') || 
           url.includes('/_next/') || 
           url.endsWith('.js') || 
           url.endsWith('.css') ||
           url.includes('/api/');
  }

  private isBundleResource(url: string): boolean {
    return url.includes('/_next/static/') || 
           url.includes('/static/js/') || 
           url.includes('/static/css/');
  }

  private getResourceType(entry: PerformanceResourceTiming): string {
    const url = entry.name;
    if (url.endsWith('.js')) return 'js';
    if (url.endsWith('.css')) return 'css';
    if (url.match(/\.(png|jpg|jpeg|gif|svg|webp)$/)) return 'image';
    if (url.match(/\.(woff|woff2|ttf|eot)$/)) return 'font';
    if (url.includes('/api/')) return 'api';
    return 'other';
  }

  private getResourceName(url: string): string {
    const parts = url.split('/');
    return parts[parts.length - 1] || url;
  }

  private isCriticalMetric(metric: AllMetrics): boolean {
    return metric.type === 'core-web-vital' || 
           metric.rating === 'poor' ||
           (metric.type === 'custom' && ['auth', 'api', 'component'].includes(metric.category));
  }

  /**
   * Get current performance summary
   */
  public getPerformanceSummary(): {
    coreWebVitals: Record<string, { value: number; rating: string }>;
    customMetrics: Record<string, { value: number; rating: string }>;
    recommendations: string[];
  } {
    const coreWebVitals: Record<string, { value: number; rating: string }> = {};
    const customMetrics: Record<string, { value: number; rating: string }> = {};
    const recommendations: string[] = [];

    // Get latest core web vitals
    ['LCP', 'FID', 'CLS', 'FCP', 'TTFB'].forEach(vital => {
      const latestMetric = this.metrics
        .filter(m => m.type === 'core-web-vital' && m.name === vital)
        .sort((a, b) => b.timestamp - a.timestamp)[0];

      if (latestMetric) {
        coreWebVitals[vital] = {
          value: latestMetric.value,
          rating: latestMetric.rating
        };

        if (latestMetric.rating === 'poor') {
          recommendations.push(`${vital} needs improvement: ${latestMetric.value.toFixed(2)}ms`);
        }
      }
    });

    // Get recent custom metrics
    const recentCustomMetrics = this.metrics
      .filter(m => m.type === 'custom')
      .filter(m => Date.now() - m.timestamp < 30000) // Last 30 seconds
      .reduce((acc, metric) => {
        if (!acc[metric.name] || acc[metric.name].timestamp < metric.timestamp) {
          acc[metric.name] = metric;
        }
        return acc;
      }, {} as Record<string, CustomMetric>);

    Object.entries(recentCustomMetrics).forEach(([name, metric]) => {
      customMetrics[name] = {
        value: metric.value,
        rating: metric.rating
      };

      if (metric.rating === 'poor') {
        recommendations.push(`${name} performance issue detected`);
      }
    });

    return {
      coreWebVitals,
      customMetrics,
      recommendations
    };
  }

  /**
   * Export metrics for analysis
   */
  public exportMetrics(): AllMetrics[] {
    return [...this.metrics];
  }

  /**
   * Clean up observers
   */
  public cleanup(): void {
    this.observers.forEach(observer => {
      try {
        observer.disconnect();
      } catch (error) {
        console.warn('Error disconnecting performance observer:', error);
      }
    });
    this.observers = [];
    this.isMonitoring = false;
  }
}

// Export singleton instance
export const performanceMonitor = PerformanceMonitor.getInstance();

// React hook for performance monitoring
export function usePerformanceMonitor() {
  const [summary, setSummary] = React.useState(() => 
    performanceMonitor.getPerformanceSummary()
  );

  React.useEffect(() => {
    const interval = setInterval(() => {
      setSummary(performanceMonitor.getPerformanceSummary());
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, []);

  return summary;
}

// Performance measurement decorators/helpers
export function measureComponentRender(componentName: string) {
  return function <T extends React.ComponentType<any>>(Component: T): T {
    const MeasuredComponent = React.forwardRef((props: any, ref: any) => {
      const renderStart = performance.now();
      
      React.useLayoutEffect(() => {
        performanceMonitor.measureComponentRender(componentName, renderStart);
      });

      return React.createElement(Component, { ...props, ref });
    });

    MeasuredComponent.displayName = `Measured(${Component.displayName || Component.name})`;
    return MeasuredComponent as T;
  };
}

export function measureAsyncOperation<T extends (...args: any[]) => Promise<any>>(
  operationName: string,
  operation: T
): T {
  return (async (...args: any[]) => {
    const start = performance.now();
    try {
      const result = await operation(...args);
      const duration = performance.now() - start;
      
      performanceMonitor.measureAPICall(operationName, 'async', start, true);
      return result;
    } catch (error) {
      performanceMonitor.measureAPICall(operationName, 'async', start, false);
      throw error;
    }
  }) as T;
}

// Authentication flow measurement helper
export const measureAuthFlow = (flowType: 'login' | 'oauth' | 'logout') => {
  const startTime = performance.now();
  return () => performanceMonitor.measureAuthFlow(flowType, startTime);
};