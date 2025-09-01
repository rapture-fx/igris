/**
 * Frontend Performance Monitoring Hooks with Core Web Vitals Integration
 * ====================================================================
 * 
 * Comprehensive React hooks for:
 * - Core Web Vitals monitoring (LCP, FID, CLS, FCP, TTFB, INP)
 * - Real User Monitoring (RUM) with session tracking
 * - Component-level performance measurement
 * - API call performance tracking
 * - Resource loading optimization monitoring
 * - Integration with backend observability stack
 */

import React, { 
  useEffect, 
  useRef, 
  useCallback, 
  useState, 
  useMemo,
  createContext,
  useContext
} from 'react';
import { getCLS, getFID, getFCP, getLCP, getTTFB, Metric } from 'web-vitals';
import { ErrorReporter, PerformanceReporter } from './sentry';

/**
 * Performance metric interfaces
 */
interface WebVitalsMetrics {
  lcp?: number;
  fid?: number;
  cls?: number;
  fcp?: number;
  ttfb?: number;
  inp?: number;
}

interface PerformanceData {
  webVitals: WebVitalsMetrics;
  customMetrics: Record<string, number>;
  resourceMetrics: ResourceTiming[];
  navigationTiming: NavigationTiming | null;
  userSession: UserSession;
}

interface ResourceTiming {
  name: string;
  type: string;
  size: number;
  duration: number;
  transferSize: number;
  cached: boolean;
}

interface NavigationTiming {
  domContentLoaded: number;
  loadComplete: number;
  domInteractive: number;
  firstPaint: number;
  firstContentfulPaint: number;
}

interface UserSession {
  id: string;
  startTime: number;
  pageViews: number;
  interactions: number;
  totalTime: number;
  referrer: string;
}

interface ComponentMetrics {
  renderTime: number;
  updateCount: number;
  memoryUsage?: number;
  errorCount: number;
}

/**
 * Performance Context for global metrics
 */
const PerformanceContext = createContext<{
  metrics: PerformanceData;
  updateMetric: (key: string, value: number) => void;
  reportMetric: (name: string, value: number, context?: any) => void;
} | null>(null);

/**
 * Performance Provider Component
 */
export const PerformanceProvider: React.FC<{
  children: React.ReactNode;
  apiEndpoint?: string;
  sampleRate?: number;
  enableWebVitals?: boolean;
  enableResourceTracking?: boolean;
  enableUserInteractionTracking?: boolean;
}> = ({
  children,
  apiEndpoint = '/api/v1/performance/metrics',
  sampleRate = 1.0,
  enableWebVitals = true,
  enableResourceTracking = true,
  enableUserInteractionTracking = true,
}) => {
  const [metrics, setMetrics] = useState<PerformanceData>({
    webVitals: {},
    customMetrics: {},
    resourceMetrics: [],
    navigationTiming: null,
    userSession: {
      id: generateSessionId(),
      startTime: Date.now(),
      pageViews: 1,
      interactions: 0,
      totalTime: 0,
      referrer: document.referrer,
    },
  });

  const reportingQueue = useRef<any[]>([]);
  const lastReportTime = useRef(Date.now());

  // Generate session ID
  function generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Update metric function
  const updateMetric = useCallback((key: string, value: number) => {
    setMetrics(prev => ({
      ...prev,
      customMetrics: {
        ...prev.customMetrics,
        [key]: value,
      },
    }));
  }, []);

  // Report metric to backend
  const reportMetric = useCallback(async (name: string, value: number, context?: any) => {
    if (Math.random() > sampleRate) return;

    const metric = {
      name,
      value,
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      sessionId: metrics.userSession.id,
      context: context || {},
    };

    reportingQueue.current.push(metric);

    // Batch reporting every 5 seconds or when queue reaches 10 items
    if (reportingQueue.current.length >= 10 || Date.now() - lastReportTime.current > 5000) {
      try {
        await fetch(apiEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            metrics: reportingQueue.current,
            session: metrics.userSession,
          }),
        });
        reportingQueue.current = [];
        lastReportTime.current = Date.now();
      } catch (error) {
        console.debug('Failed to report performance metrics:', error);
      }
    }
  }, [sampleRate, apiEndpoint, metrics.userSession]);

  // Initialize Web Vitals monitoring
  useEffect(() => {
    if (!enableWebVitals) return;

    const handleWebVital = (metric: Metric) => {
      const value = metric.value;
      const name = metric.name;

      setMetrics(prev => ({
        ...prev,
        webVitals: {
          ...prev.webVitals,
          [name.toLowerCase()]: value,
        },
      }));

      // Report to backend
      reportMetric(`web_vital_${name.toLowerCase()}`, value, {
        id: metric.id,
        delta: metric.delta,
        rating: getWebVitalRating(name, value),
      });

      // Report to Sentry
      PerformanceReporter.reportWebVital({
        name,
        value,
        rating: getWebVitalRating(name, value),
        id: metric.id,
        delta: metric.delta,
      });
    };

    // Collect all Web Vitals
    getCLS(handleWebVital);
    getFID(handleWebVital);
    getFCP(handleWebVital);
    getLCP(handleWebVital);
    getTTFB(handleWebVital);

    // Collect INP (Interaction to Next Paint) if available
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry: any) => {
            if (entry.name === 'first-input') {
              const inpValue = entry.processingStart - entry.startTime;
              handleWebVital({
                name: 'INP',
                value: inpValue,
                delta: inpValue,
                id: `inp-${Date.now()}`,
              } as Metric);
            }
          });
        });
        observer.observe({ type: 'first-input', buffered: true });
      } catch (error) {
        console.debug('INP monitoring not supported:', error);
      }
    }
  }, [enableWebVitals, reportMetric]);

  // Initialize Navigation Timing
  useEffect(() => {
    const collectNavigationTiming = () => {
      if (!window.performance?.getEntriesByType) return;

      const [navigationEntry] = window.performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
      if (!navigationEntry) return;

      const timing: NavigationTiming = {
        domContentLoaded: navigationEntry.domContentLoadedEventEnd - navigationEntry.domContentLoadedEventStart,
        loadComplete: navigationEntry.loadEventEnd - navigationEntry.loadEventStart,
        domInteractive: navigationEntry.domInteractive - navigationEntry.navigationStart,
        firstPaint: 0,
        firstContentfulPaint: 0,
      };

      // Get paint timings
      const paintEntries = window.performance.getEntriesByType('paint');
      paintEntries.forEach((entry) => {
        if (entry.name === 'first-paint') {
          timing.firstPaint = entry.startTime;
        } else if (entry.name === 'first-contentful-paint') {
          timing.firstContentfulPaint = entry.startTime;
        }
      });

      setMetrics(prev => ({ ...prev, navigationTiming: timing }));

      // Report key navigation metrics
      Object.entries(timing).forEach(([key, value]) => {
        if (value > 0) {
          reportMetric(`navigation_${key}`, value);
        }
      });
    };

    if (document.readyState === 'complete') {
      collectNavigationTiming();
    } else {
      window.addEventListener('load', collectNavigationTiming);
      return () => window.removeEventListener('load', collectNavigationTiming);
    }
  }, [reportMetric]);

  // Initialize Resource Timing
  useEffect(() => {
    if (!enableResourceTracking) return;

    const collectResourceMetrics = () => {
      if (!window.performance?.getEntriesByType) return;

      const resources = window.performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      const resourceMetrics: ResourceTiming[] = resources
        .filter(resource => 
          resource.initiatorType === 'script' || 
          resource.initiatorType === 'link' || 
          resource.initiatorType === 'img'
        )
        .map(resource => ({
          name: resource.name,
          type: resource.initiatorType,
          size: resource.decodedBodySize || 0,
          duration: resource.responseEnd - resource.startTime,
          transferSize: resource.transferSize || 0,
          cached: resource.transferSize === 0 && resource.decodedBodySize > 0,
        }));

      setMetrics(prev => ({ ...prev, resourceMetrics }));

      // Report large or slow resources
      resourceMetrics.forEach(resource => {
        if (resource.duration > 1000 || resource.size > 100000) {
          reportMetric('slow_resource', resource.duration, {
            name: resource.name,
            type: resource.type,
            size: resource.size,
            cached: resource.cached,
          });
        }
      });
    };

    // Collect immediately and on load
    collectResourceMetrics();
    window.addEventListener('load', collectResourceMetrics);

    return () => window.removeEventListener('load', collectResourceMetrics);
  }, [enableResourceTracking, reportMetric]);

  // Initialize User Interaction Tracking
  useEffect(() => {
    if (!enableUserInteractionTracking) return;

    let interactionCount = 0;
    const startTime = Date.now();

    const handleUserInteraction = () => {
      interactionCount++;
      setMetrics(prev => ({
        ...prev,
        userSession: {
          ...prev.userSession,
          interactions: interactionCount,
          totalTime: Date.now() - startTime,
        },
      }));
    };

    // Track various user interactions
    const events = ['click', 'keydown', 'scroll', 'touchstart'];
    events.forEach(event => {
      document.addEventListener(event, handleUserInteraction, { passive: true });
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleUserInteraction);
      });
    };
  }, [enableUserInteractionTracking]);

  return (
    <PerformanceContext.Provider value={{ metrics, updateMetric, reportMetric }}>
      {children}
    </PerformanceContext.Provider>
  );
};

/**
 * Core Web Vitals Hook
 */
export function useWebVitals(): {
  webVitals: WebVitalsMetrics;
  isGood: boolean;
  needsImprovement: string[];
  poor: string[];
} {
  const context = useContext(PerformanceContext);
  if (!context) {
    throw new Error('useWebVitals must be used within a PerformanceProvider');
  }

  const { webVitals } = context.metrics;

  const analysis = useMemo(() => {
    const needsImprovement: string[] = [];
    const poor: string[] = [];
    let isGood = true;

    Object.entries(webVitals).forEach(([metric, value]) => {
      const rating = getWebVitalRating(metric.toUpperCase(), value);
      if (rating === 'needs-improvement') {
        needsImprovement.push(metric);
        isGood = false;
      } else if (rating === 'poor') {
        poor.push(metric);
        isGood = false;
      }
    });

    return { isGood, needsImprovement, poor };
  }, [webVitals]);

  return {
    webVitals,
    ...analysis,
  };
}

/**
 * Component Performance Hook
 */
export function useComponentPerformance(componentName: string): {
  metrics: ComponentMetrics;
  measureRender: () => void;
  measureUpdate: () => void;
  reportError: (error: Error) => void;
} {
  const context = useContext(PerformanceContext);
  const [metrics, setMetrics] = useState<ComponentMetrics>({
    renderTime: 0,
    updateCount: 0,
    errorCount: 0,
  });

  const renderStartTime = useRef<number>(0);
  const mountTime = useRef<number>(Date.now());

  const measureRender = useCallback(() => {
    renderStartTime.current = performance.now();
  }, []);

  const measureUpdate = useCallback(() => {
    if (renderStartTime.current > 0) {
      const renderTime = performance.now() - renderStartTime.current;
      setMetrics(prev => ({
        ...prev,
        renderTime,
        updateCount: prev.updateCount + 1,
      }));

      context?.reportMetric(`component_render_${componentName}`, renderTime, {
        updateCount: metrics.updateCount + 1,
        componentAge: Date.now() - mountTime.current,
      });

      // Report slow renders
      if (renderTime > 16) { // > 60fps threshold
        PerformanceReporter.reportPerformanceIssue(
          `Slow component render: ${componentName}`,
          renderTime,
          16,
          { component: componentName }
        );
      }

      renderStartTime.current = 0;
    }
  }, [componentName, context, metrics.updateCount]);

  const reportError = useCallback((error: Error) => {
    setMetrics(prev => ({
      ...prev,
      errorCount: prev.errorCount + 1,
    }));

    ErrorReporter.reportBusinessError(
      'component' as any,
      error,
      { 
        feature: componentName,
        action: 'component_error',
        additionalContext: {
          renderTime: metrics.renderTime,
          updateCount: metrics.updateCount,
        }
      }
    );
  }, [componentName, metrics]);

  // Memory usage monitoring (if available)
  useEffect(() => {
    if ('memory' in performance) {
      const memoryInfo = (performance as any).memory;
      setMetrics(prev => ({
        ...prev,
        memoryUsage: memoryInfo.usedJSHeapSize,
      }));
    }
  }, [metrics.updateCount]);

  return { metrics, measureRender, measureUpdate, reportError };
}

/**
 * API Performance Hook
 */
export function useAPIPerformance(): {
  measureAPICall: <T>(
    endpoint: string,
    method: string,
    apiCall: () => Promise<T>
  ) => Promise<T>;
  getAPIMetrics: () => Record<string, { count: number; averageTime: number; errorRate: number }>;
} {
  const context = useContext(PerformanceContext);
  const [apiMetrics, setAPIMetrics] = useState<Record<string, any>>({});

  const measureAPICall = useCallback(async <T>(
    endpoint: string,
    method: string,
    apiCall: () => Promise<T>
  ): Promise<T> => {
    const startTime = performance.now();
    const requestId = `${method}-${endpoint}-${Date.now()}`;

    try {
      const result = await apiCall();
      const duration = performance.now() - startTime;

      // Update local metrics
      const key = `${method} ${endpoint}`;
      setAPIMetrics(prev => {
        const existing = prev[key] || { count: 0, totalTime: 0, errors: 0 };
        return {
          ...prev,
          [key]: {
            count: existing.count + 1,
            totalTime: existing.totalTime + duration,
            errors: existing.errors,
            averageTime: (existing.totalTime + duration) / (existing.count + 1),
            errorRate: existing.errors / (existing.count + 1),
          },
        };
      });

      // Report to backend
      context?.reportMetric('api_call_success', duration, {
        endpoint,
        method,
        requestId,
        success: true,
      });

      // Report slow API calls
      if (duration > 1000) {
        PerformanceReporter.reportPerformanceIssue(
          `Slow API call: ${method} ${endpoint}`,
          duration,
          1000,
          { endpoint, method, requestId }
        );
      }

      return result;
    } catch (error) {
      const duration = performance.now() - startTime;

      // Update error metrics
      const key = `${method} ${endpoint}`;
      setAPIMetrics(prev => {
        const existing = prev[key] || { count: 0, totalTime: 0, errors: 0 };
        return {
          ...prev,
          [key]: {
            count: existing.count + 1,
            totalTime: existing.totalTime + duration,
            errors: existing.errors + 1,
            averageTime: (existing.totalTime + duration) / (existing.count + 1),
            errorRate: (existing.errors + 1) / (existing.count + 1),
          },
        };
      });

      // Report API error
      ErrorReporter.reportAPIError(
        endpoint,
        method,
        500,
        error as Error,
        { requestId, duration }
      );

      context?.reportMetric('api_call_error', duration, {
        endpoint,
        method,
        requestId,
        success: false,
        error: (error as Error).message,
      });

      throw error;
    }
  }, [context]);

  const getAPIMetrics = useCallback(() => {
    return Object.entries(apiMetrics).reduce((acc, [key, metrics]) => {
      acc[key] = {
        count: metrics.count,
        averageTime: Math.round(metrics.averageTime),
        errorRate: Math.round(metrics.errorRate * 100) / 100,
      };
      return acc;
    }, {} as Record<string, { count: number; averageTime: number; errorRate: number }>);
  }, [apiMetrics]);

  return { measureAPICall, getAPIMetrics };
}

/**
 * Resource Loading Hook
 */
export function useResourcePerformance(): {
  resourceMetrics: ResourceTiming[];
  getBundleAnalysis: () => {
    totalSize: number;
    jsSize: number;
    cssSize: number;
    imageSize: number;
    cachedPercentage: number;
    recommendations: string[];
  };
} {
  const context = useContext(PerformanceContext);
  if (!context) {
    throw new Error('useResourcePerformance must be used within a PerformanceProvider');
  }

  const { resourceMetrics } = context.metrics;

  const getBundleAnalysis = useCallback(() => {
    let totalSize = 0;
    let jsSize = 0;
    let cssSize = 0;
    let imageSize = 0;
    let cachedCount = 0;

    resourceMetrics.forEach(resource => {
      totalSize += resource.size;
      if (resource.cached) cachedCount++;

      switch (resource.type) {
        case 'script':
          jsSize += resource.size;
          break;
        case 'link':
          cssSize += resource.size;
          break;
        case 'img':
          imageSize += resource.size;
          break;
      }
    });

    const cachedPercentage = resourceMetrics.length > 0 ? (cachedCount / resourceMetrics.length) * 100 : 0;
    const recommendations: string[] = [];

    if (totalSize > 1024 * 1024) { // 1MB
      recommendations.push('Consider optimizing bundle size (>1MB total)');
    }
    if (jsSize > 512 * 1024) { // 512KB
      recommendations.push('JavaScript bundle is large, consider code splitting');
    }
    if (cachedPercentage < 50) {
      recommendations.push('Low cache hit rate, review caching strategy');
    }

    const slowResources = resourceMetrics.filter(r => r.duration > 1000);
    if (slowResources.length > 0) {
      recommendations.push(`${slowResources.length} slow-loading resources detected`);
    }

    return {
      totalSize,
      jsSize,
      cssSize,
      imageSize,
      cachedPercentage,
      recommendations,
    };
  }, [resourceMetrics]);

  return { resourceMetrics, getBundleAnalysis };
}

/**
 * Performance Summary Hook
 */
export function usePerformanceSummary(): {
  summary: {
    webVitals: WebVitalsMetrics;
    overallScore: number;
    recommendations: string[];
    criticalIssues: string[];
  };
  refreshMetrics: () => void;
} {
  const context = useContext(PerformanceContext);
  if (!context) {
    throw new Error('usePerformanceSummary must be used within a PerformanceProvider');
  }

  const { metrics } = context;
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const summary = useMemo(() => {
    const { webVitals } = metrics;
    const recommendations: string[] = [];
    const criticalIssues: string[] = [];
    let scoreSum = 0;
    let scoreCount = 0;

    // Analyze Web Vitals
    Object.entries(webVitals).forEach(([metric, value]) => {
      const rating = getWebVitalRating(metric.toUpperCase(), value);
      let score = 0;

      switch (rating) {
        case 'good':
          score = 100;
          break;
        case 'needs-improvement':
          score = 50;
          recommendations.push(`Improve ${metric.toUpperCase()}: ${value}ms`);
          break;
        case 'poor':
          score = 0;
          criticalIssues.push(`Critical ${metric.toUpperCase()} issue: ${value}ms`);
          break;
      }

      scoreSum += score;
      scoreCount++;
    });

    const overallScore = scoreCount > 0 ? Math.round(scoreSum / scoreCount) : 0;

    // Add general recommendations
    if (overallScore < 70) {
      recommendations.push('Overall performance needs improvement');
    }
    if (criticalIssues.length > 0) {
      recommendations.push('Address critical performance issues immediately');
    }

    return {
      webVitals,
      overallScore,
      recommendations,
      criticalIssues,
    };
  }, [metrics, refreshTrigger]);

  const refreshMetrics = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  return { summary, refreshMetrics };
}

/**
 * Helper Functions
 */
function getWebVitalRating(name: string, value: number): 'good' | 'needs-improvement' | 'poor' {
  const thresholds = {
    LCP: { good: 2500, poor: 4000 },
    FID: { good: 100, poor: 300 },
    CLS: { good: 0.1, poor: 0.25 },
    FCP: { good: 1800, poor: 3000 },
    TTFB: { good: 800, poor: 1800 },
    INP: { good: 200, poor: 500 },
  };

  const threshold = thresholds[name as keyof typeof thresholds];
  if (!threshold) return 'good';

  if (value <= threshold.good) return 'good';
  if (value <= threshold.poor) return 'needs-improvement';
  return 'poor';
}

/**
 * Higher Order Component for automatic performance measurement
 */
export function withPerformanceTracking<P extends object>(
  Component: React.ComponentType<P>,
  componentName?: string
) {
  const name = componentName || Component.displayName || Component.name || 'UnknownComponent';
  
  return React.forwardRef<any, P>((props, ref) => {
    const { measureRender, measureUpdate } = useComponentPerformance(name);

    React.useLayoutEffect(() => {
      measureRender();
    });

    React.useEffect(() => {
      measureUpdate();
    });

    return <Component {...props} ref={ref} />;
  });
}