/**
 * Business Metrics Tracking Components for User Engagement and ML/RL Operations
 * ============================================================================
 * 
 * Comprehensive business metrics tracking with:
 * - User engagement and behavioral analytics
 * - ML/RL operation success/failure tracking
 * - Custom KPI monitoring and reporting
 * - Real-time business dashboard components
 * - Integration with backend analytics systems
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo
} from 'react';
import {
  TrendingUp,
  TrendingDown,
  Users,
  Activity,
  Zap,
  Target,
  BarChart3,
  PieChart,
  Calendar,
  Clock,
  MousePointer,
  Eye,
  PlayCircle,
  StopCircle,
  CheckCircle,
  XCircle,
  AlertCircle,
  Cpu,
  Brain,
  Database
} from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

/**
 * Business metrics interfaces
 */
interface UserEngagementMetrics {
  activeUsers: number;
  newUsers: number;
  returningUsers: number;
  avgSessionDuration: number;
  pageViews: number;
  uniquePageViews: number;
  bounceRate: number;
  conversionRate: number;
  retentionRate: {
    day1: number;
    day7: number;
    day30: number;
  };
}

interface MLOperationMetrics {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  successRate: number;
  avgProcessingTime: number;
  modelsDeployed: number;
  predictionsMade: number;
  modelsRetrained: number;
  dataProcessedGB: number;
  computeHoursUsed: number;
}

interface RLOperationMetrics {
  activeAgents: number;
  trainingEpisodes: number;
  averageReward: number;
  convergenceRate: number;
  explorationRate: number;
  policyUpdates: number;
  environmentInteractions: number;
  stateSpaceCoverage: number;
}

interface FeatureUsageMetrics {
  [featureName: string]: {
    usageCount: number;
    uniqueUsers: number;
    avgUsageTime: number;
    completionRate: number;
    errorRate: number;
  };
}

interface AuthenticationMetrics {
  totalLogins: number;
  successfulLogins: number;
  failedLogins: number;
  successRate: number;
  oauthLogins: number;
  twoFactorUsage: number;
  passwordResets: number;
  avgLoginTime: number;
}

interface BusinessKPIs {
  revenue: number;
  customerAcquisitionCost: number;
  customerLifetimeValue: number;
  monthlyRecurringRevenue: number;
  churnRate: number;
  netPromoterScore: number;
  customerSatisfactionScore: number;
}

interface BusinessMetricsData {
  userEngagement: UserEngagementMetrics;
  mlOperations: MLOperationMetrics;
  rlOperations: RLOperationMetrics;
  featureUsage: FeatureUsageMetrics;
  authentication: AuthenticationMetrics;
  businessKPIs: BusinessKPIs;
  timestamp: Date;
}

/**
 * Event tracking interface
 */
interface BusinessEvent {
  type: string;
  category: 'user_engagement' | 'ml_operation' | 'rl_operation' | 'feature_usage' | 'authentication' | 'business';
  data: Record<string, any>;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
}

/**
 * Business metrics context
 */
interface BusinessMetricsContext {
  metrics: BusinessMetricsData | null;
  trackEvent: (event: BusinessEvent) => void;
  trackUserEngagement: (action: string, data?: Record<string, any>) => void;
  trackMLOperation: (operation: string, success: boolean, duration: number, data?: Record<string, any>) => void;
  trackRLOperation: (operation: string, reward: number, data?: Record<string, any>) => void;
  trackFeatureUsage: (feature: string, action: string, data?: Record<string, any>) => void;
  trackAuthentication: (action: string, success: boolean, method?: string, data?: Record<string, any>) => void;
  getMetricsTrend: (metric: string, period: '1h' | '24h' | '7d' | '30d') => Promise<Array<{ timestamp: Date; value: number }>>;
  refreshMetrics: () => Promise<void>;
}

const BusinessMetricsContext = createContext<BusinessMetricsContext | null>(null);

/**
 * Business Metrics Provider
 */
export const BusinessMetricsProvider: React.FC<{
  children: React.ReactNode;
  apiEndpoint?: string;
  batchSize?: number;
  batchIntervalMs?: number;
  enableAutoTracking?: boolean;
  userId?: string;
}> = ({
  children,
  apiEndpoint = '/api/v1/analytics/metrics',
  batchSize = 10,
  batchIntervalMs = 5000,
  enableAutoTracking = true,
  userId
}) => {
  const [metrics, setMetrics] = useState<BusinessMetricsData | null>(null);
  const eventQueue = useRef<BusinessEvent[]>([]);
  const batchTimeout = useRef<NodeJS.Timeout | null>(null);
  const sessionId = useRef<string>(`session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  const pageLoadTime = useRef<Date>(new Date());

  // Track page views automatically
  useEffect(() => {
    if (enableAutoTracking) {
      trackUserEngagement('page_view', {
        url: window.location.href,
        referrer: document.referrer,
        timestamp: pageLoadTime.current,
      });

      // Track session duration on page unload
      const handleBeforeUnload = () => {
        const sessionDuration = Date.now() - pageLoadTime.current.getTime();
        trackUserEngagement('session_end', {
          duration: sessionDuration,
          url: window.location.href,
        });
        
        // Force send remaining events
        sendEventBatch(true);
      };

      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }
  }, [enableAutoTracking]);

  // Track user interactions automatically
  useEffect(() => {
    if (!enableAutoTracking) return;

    let clickCount = 0;
    let interactionStartTime = Date.now();

    const handleClick = (event: MouseEvent) => {
      clickCount++;
      const target = event.target as HTMLElement;
      
      trackUserEngagement('click', {
        element: target.tagName.toLowerCase(),
        className: target.className,
        id: target.id,
        text: target.textContent?.slice(0, 50),
        x: event.clientX,
        y: event.clientY,
      });
    };

    const handleScroll = () => {
      trackUserEngagement('scroll', {
        scrollY: window.scrollY,
        scrollPercentage: Math.round((window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100),
      });
    };

    const handleVisibilityChange = () => {
      const now = Date.now();
      
      if (document.hidden) {
        trackUserEngagement('page_blur', {
          activeTime: now - interactionStartTime,
          clickCount,
        });
      } else {
        trackUserEngagement('page_focus', {
          timestamp: now,
        });
        interactionStartTime = now;
        clickCount = 0;
      }
    };

    // Throttle scroll events
    let scrollTimeout: NodeJS.Timeout;
    const throttledScroll = () => {
      if (scrollTimeout) return;
      scrollTimeout = setTimeout(() => {
        handleScroll();
        clearTimeout(scrollTimeout);
      }, 1000);
    };

    document.addEventListener('click', handleClick);
    document.addEventListener('scroll', throttledScroll);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('scroll', throttledScroll);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enableAutoTracking]);

  // Send event batch to server
  const sendEventBatch = useCallback(async (force: boolean = false) => {
    if (eventQueue.current.length === 0) return;
    if (!force && eventQueue.current.length < batchSize) return;

    const events = [...eventQueue.current];
    eventQueue.current = [];

    try {
      await fetch(`${apiEndpoint}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          events,
          userId,
          sessionId: sessionId.current,
        }),
      });
    } catch (error) {
      // Re-queue events on failure
      eventQueue.current.unshift(...events);
      console.debug('Failed to send business metrics events:', error);
    }
  }, [apiEndpoint, batchSize, userId]);

  // Batch timer
  useEffect(() => {
    batchTimeout.current = setInterval(() => {
      sendEventBatch(false);
    }, batchIntervalMs);

    return () => {
      if (batchTimeout.current) {
        clearInterval(batchTimeout.current);
      }
    };
  }, [sendEventBatch, batchIntervalMs]);

  // Track generic event
  const trackEvent = useCallback((event: BusinessEvent) => {
    const enhancedEvent: BusinessEvent = {
      ...event,
      userId: userId || event.userId,
      sessionId: sessionId.current,
      timestamp: new Date(),
      metadata: {
        ...event.metadata,
        url: window.location.href,
        userAgent: navigator.userAgent,
      },
    };

    eventQueue.current.push(enhancedEvent);

    // Send immediately for critical events
    if (event.category === 'ml_operation' || event.category === 'authentication') {
      sendEventBatch(true);
    }
  }, [userId, sendEventBatch]);

  // Specific tracking functions
  const trackUserEngagement = useCallback((action: string, data?: Record<string, any>) => {
    trackEvent({
      type: action,
      category: 'user_engagement',
      data: data || {},
      timestamp: new Date(),
    });
  }, [trackEvent]);

  const trackMLOperation = useCallback((
    operation: string,
    success: boolean,
    duration: number,
    data?: Record<string, any>
  ) => {
    trackEvent({
      type: operation,
      category: 'ml_operation',
      data: {
        success,
        duration,
        ...data,
      },
      timestamp: new Date(),
    });
  }, [trackEvent]);

  const trackRLOperation = useCallback((
    operation: string,
    reward: number,
    data?: Record<string, any>
  ) => {
    trackEvent({
      type: operation,
      category: 'rl_operation',
      data: {
        reward,
        ...data,
      },
      timestamp: new Date(),
    });
  }, [trackEvent]);

  const trackFeatureUsage = useCallback((
    feature: string,
    action: string,
    data?: Record<string, any>
  ) => {
    trackEvent({
      type: `${feature}_${action}`,
      category: 'feature_usage',
      data: {
        feature,
        action,
        ...data,
      },
      timestamp: new Date(),
    });
  }, [trackEvent]);

  const trackAuthentication = useCallback((
    action: string,
    success: boolean,
    method?: string,
    data?: Record<string, any>
  ) => {
    trackEvent({
      type: action,
      category: 'authentication',
      data: {
        success,
        method,
        ...data,
      },
      timestamp: new Date(),
    });
  }, [trackEvent]);

  // Fetch current metrics
  const refreshMetrics = useCallback(async () => {
    try {
      const response = await fetch(`${apiEndpoint}/current`);
      const data = await response.json();
      
      if (data.success) {
        setMetrics({
          ...data.data,
          timestamp: new Date(data.data.timestamp),
        });
      }
    } catch (error) {
      console.debug('Failed to fetch business metrics:', error);
    }
  }, [apiEndpoint]);

  // Get metrics trend
  const getMetricsTrend = useCallback(async (
    metric: string,
    period: '1h' | '24h' | '7d' | '30d'
  ) => {
    try {
      const response = await fetch(`${apiEndpoint}/trends?metric=${metric}&period=${period}`);
      const data = await response.json();
      
      if (data.success) {
        return data.data.map((point: any) => ({
          timestamp: new Date(point.timestamp),
          value: point.value,
        }));
      }
    } catch (error) {
      console.debug('Failed to fetch metrics trend:', error);
    }
    return [];
  }, [apiEndpoint]);

  // Initial metrics fetch
  useEffect(() => {
    refreshMetrics();
    
    // Refresh metrics periodically
    const interval = setInterval(refreshMetrics, 60000); // Every minute
    return () => clearInterval(interval);
  }, [refreshMetrics]);

  const contextValue: BusinessMetricsContext = {
    metrics,
    trackEvent,
    trackUserEngagement,
    trackMLOperation,
    trackRLOperation,
    trackFeatureUsage,
    trackAuthentication,
    getMetricsTrend,
    refreshMetrics,
  };

  return (
    <BusinessMetricsContext.Provider value={contextValue}>
      {children}
    </BusinessMetricsContext.Provider>
  );
};

/**
 * Hook to use business metrics
 */
export function useBusinessMetrics(): BusinessMetricsContext {
  const context = useContext(BusinessMetricsContext);
  if (!context) {
    throw new Error('useBusinessMetrics must be used within BusinessMetricsProvider');
  }
  return context;
}

/**
 * Business Metrics Dashboard Component
 */
export const BusinessMetricsDashboard: React.FC = () => {
  const { metrics, refreshMetrics } = useBusinessMetrics();
  const [selectedPeriod, setSelectedPeriod] = useState<'1h' | '24h' | '7d' | '30d'>('24h');

  if (!metrics) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-1/2"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const formatNumber = (num: number) => {
    if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
    return num.toLocaleString();
  };

  const formatPercentage = (num: number) => `${(num * 100).toFixed(1)}%`;

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Business Metrics</h2>
        <div className="flex items-center gap-4">
          <Select value={selectedPeriod} onValueChange={(value: any) => setSelectedPeriod(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last Hour</SelectItem>
              <SelectItem value="24h">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" onClick={refreshMetrics}>
            Refresh
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="engagement">User Engagement</TabsTrigger>
          <TabsTrigger value="ml-operations">ML Operations</TabsTrigger>
          <TabsTrigger value="rl-operations">RL Operations</TabsTrigger>
          <TabsTrigger value="features">Feature Usage</TabsTrigger>
          <TabsTrigger value="auth">Authentication</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <OverviewDashboard metrics={metrics} />
        </TabsContent>

        <TabsContent value="engagement" className="space-y-4">
          <UserEngagementDashboard metrics={metrics.userEngagement} />
        </TabsContent>

        <TabsContent value="ml-operations" className="space-y-4">
          <MLOperationsDashboard metrics={metrics.mlOperations} />
        </TabsContent>

        <TabsContent value="rl-operations" className="space-y-4">
          <RLOperationsDashboard metrics={metrics.rlOperations} />
        </TabsContent>

        <TabsContent value="features" className="space-y-4">
          <FeatureUsageDashboard metrics={metrics.featureUsage} />
        </TabsContent>

        <TabsContent value="auth" className="space-y-4">
          <AuthenticationDashboard metrics={metrics.authentication} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

/**
 * Overview Dashboard
 */
const OverviewDashboard: React.FC<{ metrics: BusinessMetricsData }> = ({ metrics }) => {
  const kpis = [
    {
      title: 'Active Users',
      value: metrics.userEngagement.activeUsers,
      icon: Users,
      color: 'text-blue-600 bg-blue-50',
      trend: '+12.5%',
    },
    {
      title: 'ML Success Rate',
      value: `${(metrics.mlOperations.successRate * 100).toFixed(1)}%`,
      icon: Brain,
      color: 'text-green-600 bg-green-50',
      trend: '+3.2%',
    },
    {
      title: 'RL Avg Reward',
      value: metrics.rlOperations.averageReward.toFixed(2),
      icon: Target,
      color: 'text-purple-600 bg-purple-50',
      trend: '+8.7%',
    },
    {
      title: 'Session Duration',
      value: `${Math.round(metrics.userEngagement.avgSessionDuration / 60)}min`,
      icon: Clock,
      color: 'text-orange-600 bg-orange-50',
      trend: '-2.1%',
    },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, index) => (
          <Card key={index}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{kpi.title}</p>
                  <p className="text-2xl font-bold">{kpi.value}</p>
                  <div className="flex items-center gap-1 mt-1">
                    {kpi.trend.startsWith('+') ? (
                      <TrendingUp className="h-3 w-3 text-green-500" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-red-500" />
                    )}
                    <span className={`text-xs ${kpi.trend.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                      {kpi.trend}
                    </span>
                  </div>
                </div>
                <div className={`p-3 rounded-lg ${kpi.color}`}>
                  <kpi.icon className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Business Health Score */}
      <Card>
        <CardHeader>
          <CardTitle>Business Health Score</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Overall Score</span>
              <span className="text-2xl font-bold text-green-600">87/100</span>
            </div>
            <Progress value={87} className="h-2" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="flex justify-between">
                <span>User Engagement</span>
                <Badge className="bg-green-100 text-green-800">Excellent</Badge>
              </div>
              <div className="flex justify-between">
                <span>ML Performance</span>
                <Badge className="bg-blue-100 text-blue-800">Good</Badge>
              </div>
              <div className="flex justify-between">
                <span>System Reliability</span>
                <Badge className="bg-green-100 text-green-800">Excellent</Badge>
              </div>
              <div className="flex justify-between">
                <span>Auth Security</span>
                <Badge className="bg-yellow-100 text-yellow-800">Fair</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

/**
 * User Engagement Dashboard
 */
const UserEngagementDashboard: React.FC<{ metrics: UserEngagementMetrics }> = ({ metrics }) => {
  const retentionData = [
    { name: 'Day 1', retention: metrics.retentionRate.day1 * 100 },
    { name: 'Day 7', retention: metrics.retentionRate.day7 * 100 },
    { name: 'Day 30', retention: metrics.retentionRate.day30 * 100 },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-xs text-gray-600">Active Users</p>
                <p className="text-lg font-bold">{metrics.activeUsers.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-xs text-gray-600">Page Views</p>
                <p className="text-lg font-bold">{metrics.pageViews.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-xs text-gray-600">Avg Session</p>
                <p className="text-lg font-bold">
                  {Math.round(metrics.avgSessionDuration / 60)}min
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-orange-600" />
              <div>
                <p className="text-xs text-gray-600">Bounce Rate</p>
                <p className="text-lg font-bold">
                  {(metrics.bounceRate * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Retention Chart */}
      <Card>
        <CardHeader>
          <CardTitle>User Retention</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={retentionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => `${value}%`} />
                <Bar dataKey="retention" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

/**
 * ML Operations Dashboard
 */
const MLOperationsDashboard: React.FC<{ metrics: MLOperationMetrics }> = ({ metrics }) => {
  const operationData = [
    { name: 'Successful', value: metrics.successfulOperations, color: '#10B981' },
    { name: 'Failed', value: metrics.failedOperations, color: '#EF4444' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-xs text-gray-600">Total Operations</p>
                <p className="text-lg font-bold">{metrics.totalOperations.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-xs text-gray-600">Success Rate</p>
                <p className="text-lg font-bold text-green-600">
                  {(metrics.successRate * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-xs text-gray-600">Avg Processing Time</p>
                <p className="text-lg font-bold">
                  {metrics.avgProcessingTime.toFixed(1)}ms
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-orange-600" />
              <div>
                <p className="text-xs text-gray-600">Data Processed</p>
                <p className="text-lg font-bold">
                  {metrics.dataProcessedGB.toFixed(1)}GB
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Operations Success Chart */}
      <Card>
        <CardHeader>
          <CardTitle>ML Operations Success vs Failures</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPieChart>
                <Pie
                  data={operationData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {operationData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </RechartsPieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Additional ML Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-gray-600">Models Deployed</p>
            <p className="text-2xl font-bold text-blue-600">{metrics.modelsDeployed}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-gray-600">Predictions Made</p>
            <p className="text-2xl font-bold text-green-600">
              {metrics.predictionsMade.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-gray-600">Compute Hours</p>
            <p className="text-2xl font-bold text-purple-600">
              {metrics.computeHoursUsed.toFixed(1)}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

/**
 * RL Operations Dashboard
 */
const RLOperationsDashboard: React.FC<{ metrics: RLOperationMetrics }> = ({ metrics }) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-xs text-gray-600">Active Agents</p>
                <p className="text-lg font-bold">{metrics.activeAgents}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-xs text-gray-600">Avg Reward</p>
                <p className="text-lg font-bold text-green-600">
                  {metrics.averageReward.toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-xs text-gray-600">Convergence Rate</p>
                <p className="text-lg font-bold">
                  {(metrics.convergenceRate * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <MousePointer className="h-5 w-5 text-orange-600" />
              <div>
                <p className="text-xs text-gray-600">Exploration Rate</p>
                <p className="text-lg font-bold">
                  {(metrics.explorationRate * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* RL Progress Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Training Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-sm">Training Episodes</span>
              <span className="font-bold">{metrics.trainingEpisodes.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Policy Updates</span>
              <span className="font-bold">{metrics.policyUpdates.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Environment Interactions</span>
              <span className="font-bold">{metrics.environmentInteractions.toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>State Space Coverage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm">Coverage</span>
                <span className="font-bold">{(metrics.stateSpaceCoverage * 100).toFixed(1)}%</span>
              </div>
              <Progress value={metrics.stateSpaceCoverage * 100} className="h-2" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

/**
 * Feature Usage Dashboard
 */
const FeatureUsageDashboard: React.FC<{ metrics: FeatureUsageMetrics }> = ({ metrics }) => {
  const featureData = Object.entries(metrics).map(([feature, data]) => ({
    name: feature,
    usage: data.usageCount,
    users: data.uniqueUsers,
    completionRate: data.completionRate * 100,
    errorRate: data.errorRate * 100,
  }));

  return (
    <div className="space-y-6">
      {/* Feature Usage Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Feature Usage Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={featureData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="usage" fill="#8884d8" name="Total Usage" />
                <Bar dataKey="users" fill="#82ca9d" name="Unique Users" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Feature Details */}
      <div className="grid grid-cols-1 gap-4">
        {featureData.map((feature) => (
          <Card key={feature.name}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium">{feature.name}</h4>
                <Badge variant="outline">
                  {feature.users} users
                </Badge>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Usage Count</span>
                  <p className="font-bold">{feature.usage}</p>
                </div>
                <div>
                  <span className="text-gray-600">Completion Rate</span>
                  <p className="font-bold text-green-600">{feature.completionRate.toFixed(1)}%</p>
                </div>
                <div>
                  <span className="text-gray-600">Error Rate</span>
                  <p className="font-bold text-red-600">{feature.errorRate.toFixed(1)}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

/**
 * Authentication Dashboard
 */
const AuthenticationDashboard: React.FC<{ metrics: AuthenticationMetrics }> = ({ metrics }) => {
  const authData = [
    { name: 'Successful', value: metrics.successfulLogins, color: '#10B981' },
    { name: 'Failed', value: metrics.failedLogins, color: '#EF4444' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-xs text-gray-600">Total Logins</p>
                <p className="text-lg font-bold">{metrics.totalLogins.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-xs text-gray-600">Success Rate</p>
                <p className="text-lg font-bold text-green-600">
                  {(metrics.successRate * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-xs text-gray-600">Avg Login Time</p>
                <p className="text-lg font-bold">
                  {metrics.avgLoginTime.toFixed(0)}ms
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-orange-600" />
              <div>
                <p className="text-xs text-gray-600">2FA Usage</p>
                <p className="text-lg font-bold">{metrics.twoFactorUsage}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Login Success Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Login Success vs Failures</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPieChart>
                <Pie
                  data={authData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {authData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </RechartsPieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

/**
 * Custom tracking hooks for easy integration
 */
export function useUserEngagementTracking() {
  const { trackUserEngagement } = useBusinessMetrics();
  return trackUserEngagement;
}

export function useMLOperationTracking() {
  const { trackMLOperation } = useBusinessMetrics();
  return trackMLOperation;
}

export function useRLOperationTracking() {
  const { trackRLOperation } = useBusinessMetrics();
  return trackRLOperation;
}

export function useFeatureTracking() {
  const { trackFeatureUsage } = useBusinessMetrics();
  return trackFeatureUsage;
}

export function useAuthTracking() {
  const { trackAuthentication } = useBusinessMetrics();
  return trackAuthentication;
}