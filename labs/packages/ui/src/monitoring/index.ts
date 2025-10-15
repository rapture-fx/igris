/**
 * Frontend Monitoring Integration - Main Export
 * =============================================
 * 
 * Complete frontend observability integration with backend monitoring stack
 * 
 * Features:
 * - Sentry error tracking and performance monitoring
 * - Real-time system health and metrics dashboards
 * - Core Web Vitals and performance monitoring hooks
 * - Advanced error boundaries with automatic recovery
 * - WebSocket connection health monitoring
 * - Real-time alerting with notification system
 * - Business metrics tracking for user engagement and ML/RL
 * - Authentication flow monitoring with performance tracking
 */

// Sentry Integration
export {
  initializeSentry,
  ErrorReporter,
  UserContext,
  PerformanceReporter,
  SentryErrorBoundary,
  withSentry,
  sentryUtilities,
  MLOperationError,
  BusinessErrorCategory,
  type SentryConfig,
} from './sentry';

// Monitoring Dashboard Components
export {
  SystemHealthOverview,
  PerformanceMetricsDashboard,
  AlertManagement,
  BusinessMetricsDashboard,
  MonitoringDashboard,
} from './dashboard';

// Performance Monitoring Hooks
export {
  PerformanceProvider,
  useWebVitals,
  useComponentPerformance,
  useAPIPerformance,
  useResourcePerformance,
  usePerformanceSummary,
  withPerformanceTracking,
} from './performance-hooks';

// Error Boundaries
export {
  AdvancedErrorBoundary,
  ErrorTrackingProvider,
  useErrorTracking,
  useAsyncErrorHandler,
  withAsyncErrorHandling,
  PageErrorBoundary,
  FeatureErrorBoundary,
  ComponentErrorBoundary,
  ErrorType,
  ErrorSeverity,
} from './error-boundaries';

// WebSocket Monitoring
export {
  WebSocketMonitoringProvider,
  useWebSocketMonitoring,
  WebSocketStatusDashboard,
  WebSocketStatusIndicator,
  ConnectionState,
} from './websocket-monitoring';

// Alerting System
export {
  AlertingProvider,
  useAlerting,
  AlertManagementDashboard,
  AlertBellIcon,
  AlertSeverity,
  AlertStatus,
  AlertCategory,
} from './alerting-system';

// Business Metrics
export {
  BusinessMetricsProvider,
  useBusinessMetrics,
  BusinessMetricsDashboard,
  useUserEngagementTracking,
  useMLOperationTracking,
  useRLOperationTracking,
  useFeatureTracking,
  useAuthTracking,
} from './business-metrics';

// Authentication Monitoring
export {
  AuthMonitoringProvider,
  useAuthMonitoring,
  AuthPerformanceDashboard,
  useAuthFlowTracker,
  useLoginTracking,
  useOAuthTracking,
  AuthStatusIndicator,
  AuthFlow,
  AuthMethod,
  AuthStatus,
} from './auth-monitoring';

/**
 * Complete Monitoring Setup Component
 * 
 * This component provides a single setup point for all monitoring features.
 * Use this for easy integration with minimal configuration.
 */
import React from 'react';
import { PerformanceProvider } from './performance-hooks';
import { ErrorTrackingProvider } from './error-boundaries';
import { WebSocketMonitoringProvider } from './websocket-monitoring';
import { AlertingProvider } from './alerting-system';
import { BusinessMetricsProvider } from './business-metrics';
import { AuthMonitoringProvider } from './auth-monitoring';
import { initializeSentry } from './sentry';

export interface MonitoringConfig {
  // Sentry Configuration
  sentry?: {
    dsn: string;
    environment: string;
    release?: string;
    sampleRate?: number;
    tracesSampleRate?: number;
    profilesSampleRate?: number;
    enabled?: boolean;
    debug?: boolean;
  };
  
  // Performance Monitoring
  performance?: {
    apiEndpoint?: string;
    sampleRate?: number;
    enableWebVitals?: boolean;
    enableResourceTracking?: boolean;
    enableUserInteractionTracking?: boolean;
  };
  
  // WebSocket Monitoring
  websocket?: {
    enableGlobalErrorTracking?: boolean;
  };
  
  // Alerting System
  alerting?: {
    websocketUrl?: string;
    pollInterval?: number;
    maxAlertHistory?: number;
  };
  
  // Business Metrics
  businessMetrics?: {
    apiEndpoint?: string;
    batchSize?: number;
    batchIntervalMs?: number;
    enableAutoTracking?: boolean;
    userId?: string;
  };
  
  // Authentication Monitoring
  authentication?: {
    apiEndpoint?: string;
    enableSecurityTracking?: boolean;
    enablePerformanceTracking?: boolean;
  };
}

export const MonitoringProvider: React.FC<{
  children: React.ReactNode;
  config: MonitoringConfig;
}> = ({ children, config }) => {
  // Initialize Sentry if configured
  React.useEffect(() => {
    if (config.sentry?.enabled !== false && config.sentry?.dsn) {
      initializeSentry({
        dsn: config.sentry.dsn,
        environment: config.sentry.environment,
        release: config.sentry.release,
        sampleRate: config.sentry.sampleRate ?? 1.0,
        tracesSampleRate: config.sentry.tracesSampleRate ?? 0.1,
        profilesSampleRate: config.sentry.profilesSampleRate ?? 0.1,
        enabled: config.sentry.enabled ?? true,
        debug: config.sentry.debug ?? false,
      });
    }
  }, [config.sentry]);

  return (
    <ErrorTrackingProvider maxErrorHistory={100} autoReport={true}>
      <PerformanceProvider {...config.performance}>
        <WebSocketMonitoringProvider {...config.websocket}>
          <AlertingProvider {...config.alerting}>
            <BusinessMetricsProvider {...config.businessMetrics}>
              <AuthMonitoringProvider {...config.authentication}>
                {children}
              </AuthMonitoringProvider>
            </BusinessMetricsProvider>
          </AlertingProvider>
        </WebSocketMonitoringProvider>
      </PerformanceProvider>
    </ErrorTrackingProvider>
  );
};

/**
 * Monitoring Dashboard Collection
 * 
 * A single component that provides all monitoring dashboards in a tabbed interface.
 */
export const ComprehensiveMonitoringDashboard: React.FC = () => {
  return (
    <div className="space-y-6">
      <MonitoringDashboard />
    </div>
  );
};

/**
 * Monitoring Status Bar
 * 
 * A compact status bar showing key monitoring metrics.
 */
import { useWebVitals } from './performance-hooks';
import { useAlerting } from './alerting-system';
import { useWebSocketMonitoring } from './websocket-monitoring';
import { useAuthMonitoring } from './auth-monitoring';

export const MonitoringStatusBar: React.FC<{
  showLabels?: boolean;
  className?: string;
}> = ({ showLabels = false, className = '' }) => {
  const { webVitals, isGood } = useWebVitals();
  const { unacknowledgedAlerts } = useAlerting();
  const { isConnected } = useWebSocketMonitoring();
  const { metrics: authMetrics } = useAuthMonitoring();

  return (
    <div className={`flex items-center gap-4 ${className}`}>
      {/* Performance Status */}
      <div className="flex items-center gap-1">
        <div className={`h-2 w-2 rounded-full ${isGood ? 'bg-green-500' : 'bg-orange-500'}`} />
        {showLabels && <span className="text-xs text-gray-600">Performance</span>}
      </div>

      {/* Alert Status */}
      <div className="flex items-center gap-1">
        <div className={`h-2 w-2 rounded-full ${
          unacknowledgedAlerts.length === 0 ? 'bg-green-500' : 'bg-red-500'
        }`} />
        {showLabels && <span className="text-xs text-gray-600">Alerts</span>}
        {unacknowledgedAlerts.length > 0 && (
          <span className="text-xs text-red-600">({unacknowledgedAlerts.length})</span>
        )}
      </div>

      {/* WebSocket Status */}
      <div className="flex items-center gap-1">
        <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-400'}`} />
        {showLabels && <span className="text-xs text-gray-600">Connection</span>}
      </div>

      {/* Auth Status */}
      {authMetrics && (
        <div className="flex items-center gap-1">
          <div className={`h-2 w-2 rounded-full ${
            authMetrics.successRate > 0.95 ? 'bg-green-500' : 'bg-orange-500'
          }`} />
          {showLabels && <span className="text-xs text-gray-600">Auth</span>}
        </div>
      )}
    </div>
  );
};

/**
 * Default export for easy integration
 */
export default {
  MonitoringProvider,
  ComprehensiveMonitoringDashboard,
  MonitoringStatusBar,
};