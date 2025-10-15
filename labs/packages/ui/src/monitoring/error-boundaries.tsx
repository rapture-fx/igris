/**
 * Advanced Error Boundary Components with Error Tracking and Reporting
 * ===================================================================
 * 
 * Comprehensive error handling system with:
 * - React Error Boundaries with Sentry integration
 * - Async error tracking and reporting
 * - User-friendly error fallback components
 * - Error recovery mechanisms
 * - Integration with monitoring and alerting systems
 */

import React, { 
  Component, 
  ErrorInfo, 
  ReactNode, 
  createContext, 
  useContext, 
  useCallback,
  useState,
  useEffect 
} from 'react';
import { 
  AlertTriangle, 
  RefreshCw, 
  Bug, 
  Mail, 
  Home,
  ArrowLeft,
  ExternalLink,
  Copy,
  CheckCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';
import { ErrorReporter, UserContext, sentryUtilities } from './sentry';

/**
 * Error types for categorization
 */
export enum ErrorType {
  COMPONENT_ERROR = 'component_error',
  ASYNC_ERROR = 'async_error',
  NETWORK_ERROR = 'network_error',
  AUTHENTICATION_ERROR = 'authentication_error',
  PERMISSION_ERROR = 'permission_error',
  VALIDATION_ERROR = 'validation_error',
  ML_OPERATION_ERROR = 'ml_operation_error',
  WEBSOCKET_ERROR = 'websocket_error',
  UNKNOWN_ERROR = 'unknown_error',
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Error context interface
 */
interface ErrorContext {
  reportError: (error: Error, errorInfo?: ErrorInfo, context?: any) => string;
  reportAsyncError: (error: Error, context?: any) => string;
  clearError: () => void;
  errors: ErrorRecord[];
  errorCount: number;
}

interface ErrorRecord {
  id: string;
  error: Error;
  errorInfo?: ErrorInfo;
  timestamp: Date;
  context?: any;
  type: ErrorType;
  severity: ErrorSeverity;
  userId?: string;
  sessionId?: string;
  reported: boolean;
}

/**
 * Error Context Provider
 */
const ErrorTrackingContext = createContext<ErrorContext | null>(null);

export const ErrorTrackingProvider: React.FC<{
  children: ReactNode;
  maxErrorHistory?: number;
  autoReport?: boolean;
  userId?: string;
}> = ({ 
  children, 
  maxErrorHistory = 50, 
  autoReport = true,
  userId 
}) => {
  const [errors, setErrors] = useState<ErrorRecord[]>([]);
  const [sessionId] = useState(() => 
    `error-session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  );

  // Set user context
  useEffect(() => {
    if (userId) {
      UserContext.setUser({ id: userId });
    }
  }, [userId]);

  const reportError = useCallback((
    error: Error, 
    errorInfo?: ErrorInfo, 
    context?: any
  ): string => {
    const errorId = `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const errorRecord: ErrorRecord = {
      id: errorId,
      error,
      errorInfo,
      timestamp: new Date(),
      context,
      type: classifyError(error, context),
      severity: determineSeverity(error, context),
      userId,
      sessionId,
      reported: false,
    };

    // Add to error history
    setErrors(prev => {
      const updated = [errorRecord, ...prev].slice(0, maxErrorHistory);
      return updated;
    });

    // Auto-report if enabled
    if (autoReport) {
      const sentryId = ErrorReporter.reportBusinessError(
        'user_engagement' as any,
        error,
        {
          userId,
          sessionId,
          additionalContext: {
            errorInfo,
            context,
            type: errorRecord.type,
            severity: errorRecord.severity,
            timestamp: errorRecord.timestamp.toISOString(),
          },
        }
      );

      // Mark as reported
      setErrors(prev => 
        prev.map(e => 
          e.id === errorId ? { ...e, reported: true } : e
        )
      );

      return sentryId;
    }

    return errorId;
  }, [maxErrorHistory, autoReport, userId, sessionId]);

  const reportAsyncError = useCallback((
    error: Error,
    context?: any
  ): string => {
    return reportError(error, undefined, {
      ...context,
      async: true,
      url: window.location.href,
      userAgent: navigator.userAgent,
    });
  }, [reportError]);

  const clearError = useCallback(() => {
    setErrors([]);
  }, []);

  return (
    <ErrorTrackingContext.Provider value={{
      reportError,
      reportAsyncError,
      clearError,
      errors,
      errorCount: errors.length,
    }}>
      {children}
    </ErrorTrackingContext.Provider>
  );
};

/**
 * Hook to access error tracking
 */
export function useErrorTracking(): ErrorContext {
  const context = useContext(ErrorTrackingContext);
  if (!context) {
    throw new Error('useErrorTracking must be used within ErrorTrackingProvider');
  }
  return context;
}

/**
 * Advanced Error Boundary Component
 */
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
  retryCount: number;
  showDetails: boolean;
}

export class AdvancedErrorBoundary extends Component<
  {
    children: ReactNode;
    fallback?: React.ComponentType<{
      error: Error;
      errorInfo: ErrorInfo | null;
      retry: () => void;
      errorId: string | null;
    }>;
    onError?: (error: Error, errorInfo: ErrorInfo, errorId: string) => void;
    maxRetries?: number;
    showReportDialog?: boolean;
    isolateErrors?: boolean;
    level?: 'page' | 'component' | 'feature';
  },
  ErrorBoundaryState
> {
  private retryTimeoutId: NodeJS.Timeout | null = null;

  constructor(props: any) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: 0,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const errorId = `boundary-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    this.setState({
      errorInfo,
      errorId,
    });

    // Report to Sentry with React context
    const sentryId = sentryUtilities.captureException(error, {
      contexts: {
        react: {
          componentStack: errorInfo.componentStack,
          errorBoundary: true,
          level: this.props.level || 'component',
          retryCount: this.state.retryCount,
        },
        errorBoundary: {
          errorId,
          level: this.props.level,
          retryCount: this.state.retryCount,
          isolateErrors: this.props.isolateErrors,
        },
      },
      tags: {
        errorType: 'react_error_boundary',
        level: this.props.level || 'component',
        hasRetried: this.state.retryCount > 0,
      },
    });

    // Custom error handler
    this.props.onError?.(error, errorInfo, sentryId);

    // Show user feedback dialog if enabled
    if (this.props.showReportDialog && this.state.retryCount === 0) {
      setTimeout(() => {
        sentryUtilities.showReportDialog({
          eventId: sentryId,
          user: {
            name: 'User',
            email: '',
          },
        });
      }, 1000);
    }

    // Auto-retry logic for transient errors
    if (this.shouldAutoRetry(error) && this.state.retryCount < (this.props.maxRetries || 3)) {
      this.retryTimeoutId = setTimeout(() => {
        this.retry();
      }, Math.min(1000 * Math.pow(2, this.state.retryCount), 10000)); // Exponential backoff
    }
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  shouldAutoRetry(error: Error): boolean {
    // Auto-retry for network errors or temporary issues
    return (
      error.message.includes('Network Error') ||
      error.message.includes('Loading chunk') ||
      error.message.includes('Loading CSS chunk') ||
      error.name === 'ChunkLoadError'
    );
  }

  retry = () => {
    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: prevState.retryCount + 1,
      showDetails: false,
    }));
  };

  toggleDetails = () => {
    this.setState(prevState => ({
      showDetails: !prevState.showDetails,
    }));
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return React.createElement(this.props.fallback, {
          error: this.state.error!,
          errorInfo: this.state.errorInfo,
          retry: this.retry,
          errorId: this.state.errorId,
        });
      }

      return (
        <ErrorFallbackComponent
          error={this.state.error!}
          errorInfo={this.state.errorInfo}
          errorId={this.state.errorId}
          retry={this.retry}
          retryCount={this.state.retryCount}
          maxRetries={this.props.maxRetries || 3}
          level={this.props.level || 'component'}
          showDetails={this.state.showDetails}
          onToggleDetails={this.toggleDetails}
        />
      );
    }

    return this.props.children;
  }
}

/**
 * Default Error Fallback Component
 */
interface ErrorFallbackProps {
  error: Error;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
  retry: () => void;
  retryCount: number;
  maxRetries: number;
  level: string;
  showDetails: boolean;
  onToggleDetails: () => void;
}

const ErrorFallbackComponent: React.FC<ErrorFallbackProps> = ({
  error,
  errorInfo,
  errorId,
  retry,
  retryCount,
  maxRetries,
  level,
  showDetails,
  onToggleDetails,
}) => {
  const [copied, setCopied] = useState(false);

  const errorDetails = {
    message: error.message,
    stack: error.stack,
    componentStack: errorInfo?.componentStack,
    errorId,
    timestamp: new Date().toISOString(),
    url: window.location.href,
    userAgent: navigator.userAgent,
  };

  const copyErrorDetails = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(errorDetails, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy error details:', err);
    }
  }, [errorDetails]);

  const sendErrorReport = useCallback(() => {
    const subject = encodeURIComponent(`Error Report: ${error.message}`);
    const body = encodeURIComponent(
      `Error Details:\n\n${JSON.stringify(errorDetails, null, 2)}\n\nPlease describe what you were doing when this error occurred:`
    );
    window.open(`mailto:support@example.com?subject=${subject}&body=${body}`);
  }, [error.message, errorDetails]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'border-red-500 bg-red-50 text-red-700';
      case 'high': return 'border-orange-500 bg-orange-50 text-orange-700';
      case 'medium': return 'border-yellow-500 bg-yellow-50 text-yellow-700';
      default: return 'border-blue-500 bg-blue-50 text-blue-700';
    }
  };

  const getErrorSeverity = (error: Error): ErrorSeverity => {
    if (error.name === 'ChunkLoadError' || error.message.includes('Loading')) {
      return ErrorSeverity.MEDIUM;
    }
    if (error.message.includes('Network') || error.message.includes('fetch')) {
      return ErrorSeverity.HIGH;
    }
    return ErrorSeverity.CRITICAL;
  };

  const severity = getErrorSeverity(error);

  return (
    <div className="min-h-96 flex items-center justify-center p-6">
      <Card className={`max-w-2xl w-full border-2 ${getSeverityColor(severity)}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6" />
            <div>
              <h2 className="text-xl font-bold">
                Something went wrong
              </h2>
              <p className="text-sm font-normal text-gray-600">
                {level === 'page' ? 'Page' : level === 'feature' ? 'Feature' : 'Component'} error occurred
              </p>
            </div>
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={getSeverityColor(severity)}>
              {severity.toUpperCase()}
            </Badge>
            {errorId && (
              <Badge variant="outline">
                ID: {errorId.slice(-8)}
              </Badge>
            )}
            {retryCount > 0 && (
              <Badge variant="outline">
                Retry {retryCount}/{maxRetries}
              </Badge>
            )}
          </div>

          <Alert>
            <Bug className="h-4 w-4" />
            <AlertDescription>
              <strong>{error.name}:</strong> {error.message}
            </AlertDescription>
          </Alert>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            {retryCount < maxRetries && (
              <Button onClick={retry} className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Try Again
              </Button>
            )}
            
            <Button 
              variant="outline" 
              onClick={() => window.location.reload()}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Reload Page
            </Button>
            
            <Button 
              variant="outline" 
              onClick={() => window.history.back()}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Go Back
            </Button>
            
            <Button 
              variant="outline" 
              onClick={() => window.location.href = '/'}
              className="flex items-center gap-2"
            >
              <Home className="h-4 w-4" />
              Home
            </Button>
          </div>

          {/* Error Details Toggle */}
          <div className="border-t pt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleDetails}
              className="mb-2"
            >
              {showDetails ? 'Hide' : 'Show'} Technical Details
            </Button>
            
            {showDetails && (
              <div className="bg-gray-50 rounded-lg p-4 text-sm font-mono">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-sans font-medium">Error Details</span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={copyErrorDetails}
                      className="flex items-center gap-1"
                    >
                      {copied ? <CheckCircle className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      {copied ? 'Copied!' : 'Copy'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={sendErrorReport}
                      className="flex items-center gap-1"
                    >
                      <Mail className="h-3 w-3" />
                      Report
                    </Button>
                  </div>
                </div>
                <pre className="whitespace-pre-wrap text-xs overflow-auto max-h-64">
                  {JSON.stringify(errorDetails, null, 2)}
                </pre>
              </div>
            )}
          </div>

          {/* Help Text */}
          <div className="text-sm text-gray-600 border-t pt-4">
            <p className="mb-2">
              This error has been automatically reported to our monitoring system.
              {errorId && ` Reference ID: ${errorId}`}
            </p>
            <p>
              If the problem persists, please{' '}
              <button 
                onClick={sendErrorReport}
                className="text-blue-600 hover:text-blue-800 underline"
              >
                contact support
              </button>{' '}
              with the error details above.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

/**
 * Async Error Handler Hook
 */
export function useAsyncErrorHandler() {
  const { reportAsyncError } = useErrorTracking();

  return useCallback((error: Error, context?: any) => {
    reportAsyncError(error, {
      ...context,
      handledBy: 'useAsyncErrorHandler',
      timestamp: new Date().toISOString(),
    });
  }, [reportAsyncError]);
}

/**
 * Safe Async Component Wrapper
 */
export function withAsyncErrorHandling<P extends object>(
  Component: React.ComponentType<P>
): React.ComponentType<P> {
  return function SafeAsyncComponent(props: P) {
    const handleAsyncError = useAsyncErrorHandler();

    useEffect(() => {
      const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
        handleAsyncError(
          new Error(event.reason?.message || 'Unhandled promise rejection'),
          {
            reason: event.reason,
            component: Component.displayName || Component.name,
          }
        );
      };

      window.addEventListener('unhandledrejection', handleUnhandledRejection);
      
      return () => {
        window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      };
    }, [handleAsyncError]);

    return <Component {...props} />;
  };
}

/**
 * Specialized Error Boundaries
 */

// Page-level Error Boundary
export const PageErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <AdvancedErrorBoundary
    level="page"
    maxRetries={2}
    showReportDialog={true}
    isolateErrors={false}
  >
    {children}
  </AdvancedErrorBoundary>
);

// Feature-level Error Boundary
export const FeatureErrorBoundary: React.FC<{ 
  children: ReactNode;
  feature: string;
}> = ({ children, feature }) => (
  <AdvancedErrorBoundary
    level="feature"
    maxRetries={1}
    onError={(error, errorInfo, errorId) => {
      sentryUtilities.setContext('feature', { name: feature });
    }}
  >
    {children}
  </AdvancedErrorBoundary>
);

// Component-level Error Boundary
export const ComponentErrorBoundary: React.FC<{ 
  children: ReactNode;
  componentName?: string;
}> = ({ children, componentName }) => (
  <AdvancedErrorBoundary
    level="component"
    maxRetries={3}
    isolateErrors={true}
    onError={(error, errorInfo, errorId) => {
      if (componentName) {
        sentryUtilities.setContext('component', { name: componentName });
      }
    }}
  >
    {children}
  </AdvancedErrorBoundary>
);

/**
 * Helper Functions
 */
function classifyError(error: Error, context?: any): ErrorType {
  const message = error.message.toLowerCase();
  const name = error.name.toLowerCase();

  if (message.includes('network') || message.includes('fetch')) {
    return ErrorType.NETWORK_ERROR;
  }
  if (message.includes('unauthorized') || message.includes('auth')) {
    return ErrorType.AUTHENTICATION_ERROR;
  }
  if (message.includes('permission') || message.includes('forbidden')) {
    return ErrorType.PERMISSION_ERROR;
  }
  if (message.includes('validation') || message.includes('invalid')) {
    return ErrorType.VALIDATION_ERROR;
  }
  if (context?.ml || message.includes('model') || message.includes('training')) {
    return ErrorType.ML_OPERATION_ERROR;
  }
  if (message.includes('websocket') || message.includes('socket')) {
    return ErrorType.WEBSOCKET_ERROR;
  }
  if (name.includes('chunkerror') || message.includes('loading')) {
    return ErrorType.ASYNC_ERROR;
  }
  
  return ErrorType.COMPONENT_ERROR;
}

function determineSeverity(error: Error, context?: any): ErrorSeverity {
  const type = classifyError(error, context);
  
  switch (type) {
    case ErrorType.AUTHENTICATION_ERROR:
    case ErrorType.ML_OPERATION_ERROR:
      return ErrorSeverity.CRITICAL;
    case ErrorType.NETWORK_ERROR:
    case ErrorType.WEBSOCKET_ERROR:
      return ErrorSeverity.HIGH;
    case ErrorType.VALIDATION_ERROR:
    case ErrorType.PERMISSION_ERROR:
      return ErrorSeverity.MEDIUM;
    default:
      return ErrorSeverity.LOW;
  }
}