/**
 * Sentry Integration for Frontend Error Tracking and Performance Monitoring
 * ========================================================================
 * 
 * Comprehensive Sentry setup for:
 * - Error tracking with context and user sessions
 * - Performance monitoring with Core Web Vitals
 * - Integration with backend observability stack
 * - Custom error reporting for ML/RL operations
 */

import * as Sentry from "@sentry/react";
import { BrowserTracing } from "@sentry/tracing";
import React from 'react';

/**
 * Sentry configuration interface
 */
export interface SentryConfig {
  dsn: string;
  environment: string;
  release?: string;
  sampleRate: number;
  tracesSampleRate: number;
  profilesSampleRate: number;
  enabled: boolean;
  debug?: boolean;
  beforeSend?: (event: Sentry.Event) => Sentry.Event | null;
  beforeSendTransaction?: (event: Sentry.Transaction) => Sentry.Transaction | null;
}

/**
 * Custom error types for ML/RL operations
 */
export enum MLOperationError {
  MODEL_LOADING_FAILED = 'model_loading_failed',
  TRAINING_FAILED = 'training_failed',
  INFERENCE_FAILED = 'inference_failed',
  DATA_PREPROCESSING_FAILED = 'data_preprocessing_failed',
  REINFORCEMENT_LEARNING_FAILED = 'rl_failed',
}

/**
 * Business metrics for error categorization
 */
export enum BusinessErrorCategory {
  AUTHENTICATION = 'authentication',
  DOCUMENT_PROCESSING = 'document_processing',
  USER_ENGAGEMENT = 'user_engagement',
  API_INTEGRATION = 'api_integration',
  WEBSOCKET_CONNECTION = 'websocket_connection',
}

/**
 * Initialize Sentry with comprehensive configuration
 */
export function initializeSentry(config: SentryConfig): void {
  if (!config.enabled || !config.dsn) {
    console.warn('Sentry is disabled or missing DSN');
    return;
  }

  Sentry.init({
    dsn: config.dsn,
    environment: config.environment,
    release: config.release,
    debug: config.debug || false,
    
    // Sampling configuration
    sampleRate: config.sampleRate,
    tracesSampleRate: config.tracesSampleRate,
    profilesSampleRate: config.profilesSampleRate,
    
    // Performance monitoring
    integrations: [
      new BrowserTracing({
        // Set up automatic route change tracking for SPA
        routingInstrumentation: Sentry.reactRouterV6Instrumentation(
          React.useEffect,
          // Assuming React Router usage - adjust as needed
        ),
        // Track Core Web Vitals
        enableLongTask: true,
        enableInp: true,
      }),
      
      // Custom integration for backend correlation
      new Sentry.Integrations.Http({
        tracing: true,
        breadcrumbs: true,
      }),
    ],
    
    // Enhanced error filtering and processing
    beforeSend: (event, hint) => {
      // Apply custom filtering
      if (config.beforeSend) {
        event = config.beforeSend(event);
      }
      
      // Filter out development errors
      if (config.environment === 'development' && event.exception) {
        const error = hint.originalException;
        if (error instanceof Error && error.message.includes('Non-Error promise rejection')) {
          return null;
        }
      }
      
      // Enhance error context
      if (event.extra) {
        event.extra = {
          ...event.extra,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href,
          buildInfo: {
            version: config.release,
            environment: config.environment,
          },
        };
      }
      
      return event;
    },
    
    beforeSendTransaction: (transaction) => {
      // Apply custom transaction filtering
      if (config.beforeSendTransaction) {
        transaction = config.beforeSendTransaction(transaction);
      }
      
      // Filter out noisy transactions
      const transactionName = transaction.transaction;
      if (transactionName && (
        transactionName.includes('/_next/static/') ||
        transactionName.includes('/favicon.ico') ||
        transactionName.includes('/robots.txt')
      )) {
        return null;
      }
      
      return transaction;
    },
    
    // Set initial scope
    beforeBreadcrumb: (breadcrumb, hint) => {
      // Enhance breadcrumbs with additional context
      if (breadcrumb.category === 'console' && breadcrumb.level === 'error') {
        breadcrumb.data = {
          ...breadcrumb.data,
          timestamp: new Date().toISOString(),
        };
      }
      
      return breadcrumb;
    },
  });
  
  // Set up global error handlers
  window.addEventListener('unhandledrejection', (event) => {
    Sentry.captureException(event.reason, {
      contexts: {
        unhandledRejection: {
          promise: event.promise.toString(),
          reason: event.reason,
        },
      },
    });
  });
}

/**
 * Enhanced error reporting with business context
 */
export class ErrorReporter {
  /**
   * Report ML/RL operation errors
   */
  static reportMLError(
    operation: MLOperationError,
    error: Error,
    context: {
      modelId?: string;
      datasetId?: string;
      operationId?: string;
      userId?: string;
      additionalContext?: Record<string, any>;
    }
  ): string {
    return Sentry.captureException(error, {
      tags: {
        errorType: 'ml_operation',
        operation,
        component: 'ml_engine',
      },
      contexts: {
        mlOperation: {
          operation,
          modelId: context.modelId,
          datasetId: context.datasetId,
          operationId: context.operationId,
          timestamp: new Date().toISOString(),
        },
        additional: context.additionalContext,
      },
      user: context.userId ? { id: context.userId } : undefined,
      level: 'error',
    });
  }
  
  /**
   * Report business operation errors
   */
  static reportBusinessError(
    category: BusinessErrorCategory,
    error: Error,
    context: {
      userId?: string;
      sessionId?: string;
      feature?: string;
      action?: string;
      additionalContext?: Record<string, any>;
    }
  ): string {
    return Sentry.captureException(error, {
      tags: {
        errorType: 'business_operation',
        category,
        feature: context.feature,
        action: context.action,
      },
      contexts: {
        businessOperation: {
          category,
          feature: context.feature,
          action: context.action,
          sessionId: context.sessionId,
          timestamp: new Date().toISOString(),
        },
        additional: context.additionalContext,
      },
      user: context.userId ? { id: context.userId } : undefined,
      level: 'error',
    });
  }
  
  /**
   * Report performance issues
   */
  static reportPerformanceIssue(
    metricName: string,
    value: number,
    threshold: number,
    context: {
      component?: string;
      route?: string;
      userId?: string;
      additionalContext?: Record<string, any>;
    }
  ): void {
    Sentry.addBreadcrumb({
      category: 'performance',
      message: `Performance issue detected: ${metricName}`,
      level: 'warning',
      data: {
        metric: metricName,
        value,
        threshold,
        component: context.component,
        route: context.route,
        timestamp: new Date().toISOString(),
      },
    });
    
    if (value > threshold * 2) { // Critical performance issue
      Sentry.captureMessage(`Critical performance issue: ${metricName}`, {
        level: 'error',
        tags: {
          errorType: 'performance',
          metric: metricName,
          component: context.component,
        },
        contexts: {
          performance: {
            metric: metricName,
            value,
            threshold,
            severity: 'critical',
            timestamp: new Date().toISOString(),
          },
          additional: context.additionalContext,
        },
        user: context.userId ? { id: context.userId } : undefined,
      });
    }
  }
  
  /**
   * Report API errors with correlation
   */
  static reportAPIError(
    endpoint: string,
    method: string,
    statusCode: number,
    error: Error,
    context: {
      requestId?: string;
      userId?: string;
      duration?: number;
      additionalContext?: Record<string, any>;
    }
  ): string {
    return Sentry.captureException(error, {
      tags: {
        errorType: 'api_error',
        endpoint,
        method,
        statusCode: statusCode.toString(),
      },
      contexts: {
        request: {
          url: endpoint,
          method,
          status_code: statusCode,
          request_id: context.requestId,
          duration: context.duration,
          timestamp: new Date().toISOString(),
        },
        additional: context.additionalContext,
      },
      user: context.userId ? { id: context.userId } : undefined,
      level: statusCode >= 500 ? 'error' : 'warning',
    });
  }
  
  /**
   * Report WebSocket connection issues
   */
  static reportWebSocketError(
    error: Error,
    context: {
      connectionState: string;
      url?: string;
      userId?: string;
      reconnectAttempts?: number;
      additionalContext?: Record<string, any>;
    }
  ): string {
    return Sentry.captureException(error, {
      tags: {
        errorType: 'websocket_error',
        connectionState: context.connectionState,
      },
      contexts: {
        websocket: {
          url: context.url,
          connectionState: context.connectionState,
          reconnectAttempts: context.reconnectAttempts,
          timestamp: new Date().toISOString(),
        },
        additional: context.additionalContext,
      },
      user: context.userId ? { id: context.userId } : undefined,
      level: 'error',
    });
  }
}

/**
 * User context management for enhanced tracking
 */
export class UserContext {
  /**
   * Set user context for error tracking
   */
  static setUser(user: {
    id: string;
    email?: string;
    username?: string;
    subscription?: string;
    role?: string;
    additionalData?: Record<string, any>;
  }): void {
    Sentry.setUser({
      id: user.id,
      email: user.email,
      username: user.username,
      subscription: user.subscription,
      role: user.role,
      ...user.additionalData,
    });
  }
  
  /**
   * Clear user context on logout
   */
  static clearUser(): void {
    Sentry.setUser(null);
  }
  
  /**
   * Set business context
   */
  static setBusinessContext(context: {
    feature?: string;
    experiment?: string;
    cohort?: string;
    subscription?: string;
    additionalContext?: Record<string, any>;
  }): void {
    Sentry.setContext('business', {
      feature: context.feature,
      experiment: context.experiment,
      cohort: context.cohort,
      subscription: context.subscription,
      timestamp: new Date().toISOString(),
      ...context.additionalContext,
    });
  }
  
  /**
   * Set session context
   */
  static setSessionContext(session: {
    id: string;
    startTime: Date;
    referrer?: string;
    landingPage?: string;
    userAgent?: string;
  }): void {
    Sentry.setContext('session', {
      id: session.id,
      startTime: session.startTime.toISOString(),
      referrer: session.referrer,
      landingPage: session.landingPage,
      userAgent: session.userAgent || navigator.userAgent,
      duration: Date.now() - session.startTime.getTime(),
    });
  }
}

/**
 * Performance monitoring integration
 */
export class PerformanceReporter {
  /**
   * Start a performance transaction
   */
  static startTransaction(name: string, description?: string): Sentry.Transaction {
    return Sentry.startTransaction({
      name,
      description,
      tags: {
        component: 'frontend',
        type: 'performance',
      },
    });
  }
  
  /**
   * Report Core Web Vitals to Sentry
   */
  static reportWebVital(metric: {
    name: string;
    value: number;
    rating: 'good' | 'needs-improvement' | 'poor';
    id: string;
    delta: number;
  }): void {
    Sentry.addBreadcrumb({
      category: 'web-vitals',
      message: `${metric.name}: ${metric.value}`,
      level: metric.rating === 'poor' ? 'warning' : 'info',
      data: {
        name: metric.name,
        value: metric.value,
        rating: metric.rating,
        id: metric.id,
        delta: metric.delta,
        timestamp: new Date().toISOString(),
      },
    });
    
    // Report poor web vitals as performance issues
    if (metric.rating === 'poor') {
      Sentry.captureMessage(`Poor Web Vital: ${metric.name}`, {
        level: 'warning',
        tags: {
          errorType: 'web_vital',
          metric: metric.name,
          rating: metric.rating,
        },
        contexts: {
          webVital: {
            name: metric.name,
            value: metric.value,
            rating: metric.rating,
            id: metric.id,
            delta: metric.delta,
            timestamp: new Date().toISOString(),
          },
        },
      });
    }
  }
  
  /**
   * Measure and report component render performance
   */
  static measureComponentRender<T extends React.ComponentType<any>>(
    Component: T,
    componentName: string
  ): T {
    const MeasuredComponent = React.forwardRef((props: any, ref: any) => {
      const transaction = React.useRef<Sentry.Transaction | null>(null);
      
      React.useLayoutEffect(() => {
        transaction.current = PerformanceReporter.startTransaction(
          `Component Render: ${componentName}`,
          `Measuring render performance for ${componentName}`
        );
        
        return () => {
          if (transaction.current) {
            transaction.current.finish();
          }
        };
      }, []);
      
      return React.createElement(Component, { ...props, ref });
    });
    
    MeasuredComponent.displayName = `SentryMeasured(${Component.displayName || Component.name})`;
    return MeasuredComponent as T;
  }
}

/**
 * React Error Boundary with Sentry integration
 */
export class SentryErrorBoundary extends React.Component<
  {
    children: React.ReactNode;
    fallback?: React.ComponentType<{ error: Error; resetError: () => void }>;
    onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
    showDialog?: boolean;
  },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Report to Sentry with React context
    Sentry.captureException(error, {
      contexts: {
        react: {
          componentStack: errorInfo.componentStack,
          errorBoundary: true,
        },
      },
      tags: {
        errorType: 'react_error_boundary',
      },
    });
    
    // Custom error handler
    this.props.onError?.(error, errorInfo);
    
    // Show Sentry user feedback dialog if enabled
    if (this.props.showDialog) {
      Sentry.showReportDialog();
    }
  }
  
  resetError = () => {
    this.setState({ hasError: false, error: null });
  };
  
  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return React.createElement(this.props.fallback, {
          error: this.state.error!,
          resetError: this.resetError,
        });
      }
      
      return (
        <div className="error-boundary">
          <h2>Something went wrong</h2>
          <p>We've been notified of this error and are working to fix it.</p>
          <button onClick={this.resetError}>Try again</button>
        </div>
      );
    }
    
    return this.props.children;
  }
}

/**
 * Sentry provider HOC for React applications
 */
export function withSentry<P extends object>(
  Component: React.ComponentType<P>,
  config?: {
    componentName?: string;
    measurePerformance?: boolean;
    errorBoundary?: boolean;
  }
): React.ComponentType<P> {
  const {
    componentName = Component.displayName || Component.name || 'UnknownComponent',
    measurePerformance = false,
    errorBoundary = true,
  } = config || {};
  
  let WrappedComponent = Component;
  
  // Add performance measurement
  if (measurePerformance) {
    WrappedComponent = PerformanceReporter.measureComponentRender(WrappedComponent, componentName);
  }
  
  // Add error boundary
  if (errorBoundary) {
    const ComponentWithErrorBoundary: React.ComponentType<P> = (props) => (
      <SentryErrorBoundary>
        <WrappedComponent {...props} />
      </SentryErrorBoundary>
    );
    
    ComponentWithErrorBoundary.displayName = `withSentry(${componentName})`;
    return ComponentWithErrorBoundary;
  }
  
  return WrappedComponent;
}

// Export Sentry utilities for direct usage
export const sentryUtilities = {
  captureException: Sentry.captureException,
  captureMessage: Sentry.captureMessage,
  addBreadcrumb: Sentry.addBreadcrumb,
  setContext: Sentry.setContext,
  setTag: Sentry.setTag,
  setUser: Sentry.setUser,
  startTransaction: Sentry.startTransaction,
  getCurrentHub: Sentry.getCurrentHub,
  showReportDialog: Sentry.showReportDialog,
};