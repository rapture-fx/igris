/**
 * Authentication Flow Monitoring with Performance Tracking
 * ========================================================
 * 
 * Comprehensive authentication monitoring with:
 * - Authentication flow performance tracking
 * - Login/logout timing and success rate monitoring
 * - OAuth flow monitoring and analysis
 * - Session management and security tracking
 * - Integration with business metrics and error tracking
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef
} from 'react';
import {
  Shield,
  Key,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  User,
  Users,
  LogIn,
  LogOut,
  Smartphone,
  Globe,
  Lock,
  Unlock,
  Activity
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { Alert, AlertDescription } from '../components/ui/alert';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useBusinessMetrics } from './business-metrics';
import { ErrorReporter } from './sentry';
import { usePerformanceMonitoring } from './performance-hooks';

/**
 * Authentication flow types
 */
export enum AuthFlow {
  LOGIN = 'login',
  LOGOUT = 'logout',
  OAUTH_LOGIN = 'oauth_login',
  OAUTH_CALLBACK = 'oauth_callback',
  PASSWORD_RESET = 'password_reset',
  TWO_FACTOR = 'two_factor',
  TOKEN_REFRESH = 'token_refresh',
  SESSION_EXTEND = 'session_extend',
}

export enum AuthMethod {
  EMAIL_PASSWORD = 'email_password',
  GOOGLE_OAUTH = 'google_oauth',
  GITHUB_OAUTH = 'github_oauth',
  MICROSOFT_OAUTH = 'microsoft_oauth',
  SSO = 'sso',
  TWO_FACTOR_AUTH = '2fa',
  MAGIC_LINK = 'magic_link',
}

export enum AuthStatus {
  INITIATED = 'initiated',
  IN_PROGRESS = 'in_progress',
  SUCCESS = 'success',
  FAILED = 'failed',
  TIMEOUT = 'timeout',
  CANCELLED = 'cancelled',
}

/**
 * Authentication metrics interfaces
 */
interface AuthFlowMetrics {
  flow: AuthFlow;
  method: AuthMethod;
  status: AuthStatus;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  userId?: string;
  sessionId: string;
  ipAddress?: string;
  userAgent?: string;
  errorCode?: string;
  errorMessage?: string;
  redirectUrl?: string;
  metadata?: Record<string, any>;
}

interface AuthPerformanceMetrics {
  totalAttempts: number;
  successfulAttempts: number;
  failedAttempts: number;
  successRate: number;
  avgDuration: number;
  medianDuration: number;
  p95Duration: number;
  timeoutCount: number;
  byMethod: Record<AuthMethod, {
    attempts: number;
    successes: number;
    failures: number;
    avgDuration: number;
    successRate: number;
  }>;
  byFlow: Record<AuthFlow, {
    attempts: number;
    successes: number;
    failures: number;
    avgDuration: number;
  }>;
  securityMetrics: {
    bruteForceAttempts: number;
    suspiciousLogins: number;
    geoAnomalies: number;
    deviceAnomalies: number;
    failedTwoFactorAttempts: number;
  };
  sessionMetrics: {
    activeSessions: number;
    avgSessionDuration: number;
    maxConcurrentSessions: number;
    sessionExtensions: number;
    forcedLogouts: number;
  };
}

/**
 * Authentication monitoring context
 */
interface AuthMonitoringContext {
  metrics: AuthPerformanceMetrics | null;
  activeFlows: Map<string, AuthFlowMetrics>;
  startAuthFlow: (flow: AuthFlow, method: AuthMethod, metadata?: Record<string, any>) => string;
  completeAuthFlow: (flowId: string, status: AuthStatus, userId?: string, errorCode?: string, errorMessage?: string) => void;
  trackAuthEvent: (event: string, data?: Record<string, any>) => void;
  getFlowDuration: (flowId: string) => number | null;
  getFlowHistory: (limit?: number) => AuthFlowMetrics[];
  refreshMetrics: () => Promise<void>;
}

const AuthMonitoringContext = createContext<AuthMonitoringContext | null>(null);

/**
 * Authentication Monitoring Provider
 */
export const AuthMonitoringProvider: React.FC<{
  children: React.ReactNode;
  apiEndpoint?: string;
  enableSecurityTracking?: boolean;
  enablePerformanceTracking?: boolean;
}> = ({
  children,
  apiEndpoint = '/api/v1/auth/monitoring',
  enableSecurityTracking = true,
  enablePerformanceTracking = true
}) => {
  const { trackAuthentication } = useBusinessMetrics();
  const { reportMetric } = usePerformanceMonitoring();
  
  const [metrics, setMetrics] = useState<AuthPerformanceMetrics | null>(null);
  const [activeFlows] = useState<Map<string, AuthFlowMetrics>>(new Map());
  const [flowHistory, setFlowHistory] = useState<AuthFlowMetrics[]>([]);
  
  const sessionId = useRef<string>(`auth-session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  
  // Start authentication flow tracking
  const startAuthFlow = useCallback((
    flow: AuthFlow,
    method: AuthMethod,
    metadata?: Record<string, any>
  ): string => {
    const flowId = `${flow}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const authFlow: AuthFlowMetrics = {
      flow,
      method,
      status: AuthStatus.INITIATED,
      startTime: new Date(),
      sessionId: sessionId.current,
      ipAddress: undefined, // Would be populated by backend
      userAgent: navigator.userAgent,
      metadata,
    };

    activeFlows.set(flowId, authFlow);

    // Track initiation
    trackAuthEvent(`${flow}_initiated`, {
      method,
      flowId,
      ...metadata,
    });

    // Report performance metric
    if (enablePerformanceTracking) {
      reportMetric(`auth_flow_${flow}_started`, 1, {
        method,
        flowId,
        timestamp: Date.now(),
      });
    }

    return flowId;
  }, [trackAuthEvent, enablePerformanceTracking, reportMetric]);

  // Complete authentication flow
  const completeAuthFlow = useCallback((
    flowId: string,
    status: AuthStatus,
    userId?: string,
    errorCode?: string,
    errorMessage?: string
  ) => {
    const authFlow = activeFlows.get(flowId);
    if (!authFlow) {
      console.warn(`Auth flow ${flowId} not found`);
      return;
    }

    const endTime = new Date();
    const duration = endTime.getTime() - authFlow.startTime.getTime();

    const completedFlow: AuthFlowMetrics = {
      ...authFlow,
      status,
      endTime,
      duration,
      userId,
      errorCode,
      errorMessage,
    };

    // Update active flows
    activeFlows.delete(flowId);
    
    // Add to history
    setFlowHistory(prev => [completedFlow, ...prev].slice(0, 100));

    // Track completion
    trackAuthEvent(`${authFlow.flow}_completed`, {
      method: authFlow.method,
      status,
      duration,
      userId,
      errorCode,
      errorMessage,
      flowId,
    });

    // Track with business metrics
    trackAuthentication(
      authFlow.flow,
      status === AuthStatus.SUCCESS,
      authFlow.method,
      {
        duration,
        errorCode,
        errorMessage,
        flowId,
      }
    );

    // Report performance metrics
    if (enablePerformanceTracking) {
      reportMetric(`auth_flow_${authFlow.flow}_duration`, duration, {
        method: authFlow.method,
        status,
        flowId,
      });

      reportMetric(`auth_flow_${authFlow.flow}_${status}`, 1, {
        method: authFlow.method,
        duration,
        flowId,
      });
    }

    // Report errors to Sentry
    if (status === AuthStatus.FAILED && errorMessage) {
      ErrorReporter.reportBusinessError(
        'authentication' as any,
        new Error(`Auth flow failed: ${errorMessage}`),
        {
          additionalContext: {
            flow: authFlow.flow,
            method: authFlow.method,
            duration,
            errorCode,
            flowId,
          },
        }
      );
    }

    // Security tracking
    if (enableSecurityTracking) {
      trackSecurityEvents(completedFlow);
    }
  }, [
    trackAuthEvent,
    trackAuthentication,
    enablePerformanceTracking,
    enableSecurityTracking,
    reportMetric
  ]);

  // Track security-related events
  const trackSecurityEvents = useCallback((flow: AuthFlowMetrics) => {
    // Track failed attempts for brute force detection
    if (flow.status === AuthStatus.FAILED) {
      trackAuthEvent('failed_auth_attempt', {
        method: flow.method,
        errorCode: flow.errorCode,
        userAgent: flow.userAgent,
        ipAddress: flow.ipAddress,
      });
    }

    // Track suspicious patterns
    if (flow.duration && flow.duration < 500) { // Very fast attempts might be automated
      trackAuthEvent('suspicious_fast_auth', {
        method: flow.method,
        duration: flow.duration,
        status: flow.status,
      });
    }

    // Track OAuth redirects
    if (flow.flow === AuthFlow.OAUTH_CALLBACK && flow.redirectUrl) {
      trackAuthEvent('oauth_redirect', {
        method: flow.method,
        redirectUrl: flow.redirectUrl,
        status: flow.status,
      });
    }
  }, [trackAuthEvent]);

  // Generic auth event tracking
  const trackAuthEvent = useCallback((event: string, data?: Record<string, any>) => {
    const eventData = {
      event,
      timestamp: new Date().toISOString(),
      sessionId: sessionId.current,
      userAgent: navigator.userAgent,
      url: window.location.href,
      ...data,
    };

    // Send to backend
    fetch(`${apiEndpoint}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventData),
    }).catch(error => {
      console.debug('Failed to send auth event:', error);
    });
  }, [apiEndpoint]);

  // Get flow duration
  const getFlowDuration = useCallback((flowId: string): number | null => {
    const flow = activeFlows.get(flowId);
    return flow ? Date.now() - flow.startTime.getTime() : null;
  }, []);

  // Get flow history
  const getFlowHistory = useCallback((limit: number = 50): AuthFlowMetrics[] => {
    return flowHistory.slice(0, limit);
  }, [flowHistory]);

  // Refresh metrics from backend
  const refreshMetrics = useCallback(async () => {
    try {
      const response = await fetch(`${apiEndpoint}/metrics`);
      const data = await response.json();
      
      if (data.success) {
        setMetrics(data.data);
      }
    } catch (error) {
      console.debug('Failed to fetch auth metrics:', error);
    }
  }, [apiEndpoint]);

  // Auto-refresh metrics
  useEffect(() => {
    refreshMetrics();
    const interval = setInterval(refreshMetrics, 30000); // Every 30 seconds
    return () => clearInterval(interval);
  }, [refreshMetrics]);

  // Cleanup stale flows
  useEffect(() => {
    const cleanup = setInterval(() => {
      const staleThreshold = 5 * 60 * 1000; // 5 minutes
      const now = Date.now();
      
      for (const [flowId, flow] of activeFlows.entries()) {
        if (now - flow.startTime.getTime() > staleThreshold) {
          completeAuthFlow(flowId, AuthStatus.TIMEOUT);
        }
      }
    }, 60000); // Check every minute

    return () => clearInterval(cleanup);
  }, [completeAuthFlow]);

  const contextValue: AuthMonitoringContext = {
    metrics,
    activeFlows,
    startAuthFlow,
    completeAuthFlow,
    trackAuthEvent,
    getFlowDuration,
    getFlowHistory,
    refreshMetrics,
  };

  return (
    <AuthMonitoringContext.Provider value={contextValue}>
      {children}
    </AuthMonitoringContext.Provider>
  );
};

/**
 * Hook to use authentication monitoring
 */
export function useAuthMonitoring(): AuthMonitoringContext {
  const context = useContext(AuthMonitoringContext);
  if (!context) {
    throw new Error('useAuthMonitoring must be used within AuthMonitoringProvider');
  }
  return context;
}

/**
 * Authentication Performance Dashboard
 */
export const AuthPerformanceDashboard: React.FC = () => {
  const { metrics, refreshMetrics, getFlowHistory } = useAuthMonitoring();
  const [selectedTimeframe, setSelectedTimeframe] = useState<'1h' | '24h' | '7d'>('24h');

  const flowHistory = getFlowHistory(20);

  if (!metrics) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Activity className="h-12 w-12 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-600">Loading authentication metrics...</p>
        </CardContent>
      </Card>
    );
  }

  const getStatusColor = (status: AuthStatus) => {
    switch (status) {
      case AuthStatus.SUCCESS:
        return 'text-green-600 bg-green-50';
      case AuthStatus.FAILED:
        return 'text-red-600 bg-red-50';
      case AuthStatus.TIMEOUT:
        return 'text-orange-600 bg-orange-50';
      case AuthStatus.IN_PROGRESS:
        return 'text-blue-600 bg-blue-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Success Rate</p>
                <p className="text-2xl font-bold text-green-600">
                  {(metrics.successRate * 100).toFixed(1)}%
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {metrics.successfulAttempts}/{metrics.totalAttempts} attempts
                </p>
              </div>
              <Shield className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Duration</p>
                <p className="text-2xl font-bold">
                  {formatDuration(metrics.avgDuration)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  P95: {formatDuration(metrics.p95Duration)}
                </p>
              </div>
              <Clock className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Sessions</p>
                <p className="text-2xl font-bold">{metrics.sessionMetrics.activeSessions}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Max: {metrics.sessionMetrics.maxConcurrentSessions}
                </p>
              </div>
              <Users className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Security Alerts</p>
                <p className="text-2xl font-bold text-orange-600">
                  {metrics.securityMetrics.bruteForceAttempts + 
                   metrics.securityMetrics.suspiciousLogins}
                </p>
                <p className="text-xs text-gray-500 mt-1">Last 24h</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Authentication Methods Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Authentication Methods Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(metrics.byMethod).map(([method, data]) => (
              <div key={method} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium capitalize">
                    {method.replace('_', ' ')}
                  </h4>
                  <Badge className={data.successRate > 0.9 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                    {(data.successRate * 100).toFixed(1)}% success
                  </Badge>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Attempts</span>
                    <p className="font-bold">{data.attempts}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Successes</span>
                    <p className="font-bold text-green-600">{data.successes}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Failures</span>
                    <p className="font-bold text-red-600">{data.failures}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Avg Duration</span>
                    <p className="font-bold">{formatDuration(data.avgDuration)}</p>
                  </div>
                </div>
                <div className="mt-2">
                  <Progress value={data.successRate * 100} className="h-2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Security Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Security Metrics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 border rounded-lg">
                <p className="text-sm text-gray-600">Brute Force</p>
                <p className="text-xl font-bold text-red-600">
                  {metrics.securityMetrics.bruteForceAttempts}
                </p>
              </div>
              <div className="text-center p-3 border rounded-lg">
                <p className="text-sm text-gray-600">Suspicious</p>
                <p className="text-xl font-bold text-orange-600">
                  {metrics.securityMetrics.suspiciousLogins}
                </p>
              </div>
              <div className="text-center p-3 border rounded-lg">
                <p className="text-sm text-gray-600">Geo Anomalies</p>
                <p className="text-xl font-bold text-yellow-600">
                  {metrics.securityMetrics.geoAnomalies}
                </p>
              </div>
              <div className="text-center p-3 border rounded-lg">
                <p className="text-sm text-gray-600">Failed 2FA</p>
                <p className="text-xl font-bold text-purple-600">
                  {metrics.securityMetrics.failedTwoFactorAttempts}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Session Metrics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Avg Session Duration</span>
              <span className="font-bold">
                {formatDuration(metrics.sessionMetrics.avgSessionDuration)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Session Extensions</span>
              <span className="font-bold">{metrics.sessionMetrics.sessionExtensions}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Forced Logouts</span>
              <span className="font-bold text-red-600">
                {metrics.sessionMetrics.forcedLogouts}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Timeout Count</span>
              <span className="font-bold text-orange-600">{metrics.timeoutCount}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Authentication Flows */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Recent Authentication Flows
          </CardTitle>
        </CardHeader>
        <CardContent>
          {flowHistory.length === 0 ? (
            <p className="text-center text-gray-600 py-4">No recent authentication flows</p>
          ) : (
            <div className="space-y-2">
              {flowHistory.map((flow, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {flow.flow === AuthFlow.LOGIN ? (
                      <LogIn className="h-4 w-4 text-blue-600" />
                    ) : flow.flow === AuthFlow.LOGOUT ? (
                      <LogOut className="h-4 w-4 text-gray-600" />
                    ) : (
                      <Key className="h-4 w-4 text-purple-600" />
                    )}
                    <div>
                      <p className="text-sm font-medium">
                        {flow.flow.replace('_', ' ')} via {flow.method.replace('_', ' ')}
                      </p>
                      <p className="text-xs text-gray-500">
                        {flow.startTime.toLocaleString()}
                        {flow.userId && ` • User: ${flow.userId.slice(-8)}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusColor(flow.status)}>
                      {flow.status}
                    </Badge>
                    {flow.duration && (
                      <span className="text-sm text-gray-600">
                        {formatDuration(flow.duration)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

/**
 * Authentication Flow Tracker Hook
 */
export function useAuthFlowTracker() {
  const { startAuthFlow, completeAuthFlow, getFlowDuration } = useAuthMonitoring();

  return {
    startFlow: startAuthFlow,
    completeFlow: completeAuthFlow,
    getDuration: getFlowDuration,
  };
}

/**
 * Login Flow Tracking Hook
 */
export function useLoginTracking() {
  const { startFlow, completeFlow } = useAuthFlowTracker();

  const trackLoginStart = useCallback((method: AuthMethod, metadata?: Record<string, any>) => {
    return startFlow(AuthFlow.LOGIN, method, metadata);
  }, [startFlow]);

  const trackLoginComplete = useCallback((
    flowId: string,
    success: boolean,
    userId?: string,
    errorCode?: string,
    errorMessage?: string
  ) => {
    completeFlow(
      flowId,
      success ? AuthStatus.SUCCESS : AuthStatus.FAILED,
      userId,
      errorCode,
      errorMessage
    );
  }, [completeFlow]);

  return { trackLoginStart, trackLoginComplete };
}

/**
 * OAuth Flow Tracking Hook
 */
export function useOAuthTracking() {
  const { startFlow, completeFlow } = useAuthFlowTracker();

  const trackOAuthStart = useCallback((method: AuthMethod, metadata?: Record<string, any>) => {
    return startFlow(AuthFlow.OAUTH_LOGIN, method, metadata);
  }, [startFlow]);

  const trackOAuthCallback = useCallback((
    flowId: string,
    success: boolean,
    userId?: string,
    redirectUrl?: string,
    errorCode?: string,
    errorMessage?: string
  ) => {
    completeFlow(
      flowId,
      success ? AuthStatus.SUCCESS : AuthStatus.FAILED,
      userId,
      errorCode,
      errorMessage
    );
  }, [completeFlow]);

  return { trackOAuthStart, trackOAuthCallback };
}

/**
 * Authentication Status Indicator
 */
export const AuthStatusIndicator: React.FC<{
  showDetails?: boolean;
}> = ({ showDetails = false }) => {
  const { metrics, activeFlows } = useAuthMonitoring();

  if (!metrics) return null;

  const activeFlowCount = activeFlows.size;
  const isHealthy = metrics.successRate > 0.95;

  return (
    <div className="flex items-center gap-2">
      {isHealthy ? (
        <Shield className="h-4 w-4 text-green-500" />
      ) : (
        <AlertTriangle className="h-4 w-4 text-orange-500" />
      )}
      
      {showDetails && (
        <div className="text-xs">
          <span className={isHealthy ? 'text-green-600' : 'text-orange-600'}>
            {(metrics.successRate * 100).toFixed(0)}%
          </span>
          {activeFlowCount > 0 && (
            <span className="text-blue-600 ml-2">
              {activeFlowCount} active
            </span>
          )}
        </div>
      )}
    </div>
  );
};