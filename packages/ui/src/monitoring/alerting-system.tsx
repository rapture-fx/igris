/**
 * Frontend Alerting System with Notification Components
 * =====================================================
 * 
 * Comprehensive alerting integration with:
 * - Real-time alert notifications and management
 * - Integration with backend AlertManager system
 * - User-friendly notification components
 * - Alert acknowledgment and escalation workflows
 * - Toast notifications and persistent alert panels
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
  Bell,
  BellOff,
  AlertTriangle,
  AlertCircle,
  Info,
  X,
  Check,
  Clock,
  ExternalLink,
  Volume2,
  VolumeX,
  Settings,
  Eye,
  EyeOff,
  Filter
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Switch } from '../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useWebSocketMonitoring } from './websocket-monitoring';

/**
 * Alert interfaces
 */
export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
  FATAL = 'fatal',
}

export enum AlertStatus {
  ACTIVE = 'active',
  ACKNOWLEDGED = 'acknowledged',
  RESOLVED = 'resolved',
  SILENCED = 'silenced',
}

export enum AlertCategory {
  SYSTEM = 'system',
  PERFORMANCE = 'performance',
  SECURITY = 'security',
  APPLICATION = 'application',
  BUSINESS = 'business',
  NETWORK = 'network',
  DATABASE = 'database',
  ML_OPERATIONS = 'ml_operations',
}

interface AlertData {
  id: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  status: AlertStatus;
  category: AlertCategory;
  source: string;
  timestamp: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  resolvedAt?: Date;
  metadata?: Record<string, any>;
  actionUrl?: string;
  runbookUrl?: string;
}

interface AlertConfig {
  enableToasts: boolean;
  enableSounds: boolean;
  enableDesktopNotifications: boolean;
  autoAcknowledgeTimeoutMs?: number;
  maxToastAlerts: number;
  soundVolume: number;
  severityFilter: AlertSeverity[];
  categoryFilter: AlertCategory[];
}

interface AlertingContext {
  alerts: AlertData[];
  activeAlerts: AlertData[];
  unacknowledgedAlerts: AlertData[];
  config: AlertConfig;
  updateConfig: (config: Partial<AlertConfig>) => void;
  acknowledgeAlert: (alertId: string) => Promise<void>;
  resolveAlert: (alertId: string) => Promise<void>;
  silenceAlert: (alertId: string, durationMs?: number) => Promise<void>;
  dismissToast: (alertId: string) => void;
  clearAllAlerts: () => void;
  testAlert: (severity: AlertSeverity) => void;
}

/**
 * Alerting Context
 */
const AlertingContext = createContext<AlertingContext | null>(null);

/**
 * Alerting Provider Component
 */
export const AlertingProvider: React.FC<{
  children: React.ReactNode;
  websocketUrl?: string;
  pollInterval?: number;
  maxAlertHistory?: number;
}> = ({ 
  children, 
  websocketUrl, 
  pollInterval = 30000,
  maxAlertHistory = 100 
}) => {
  const { sendMessage, isConnected } = useWebSocketMonitoring();
  
  const [alerts, setAlerts] = useState<AlertData[]>([]);
  const [toastAlerts, setToastAlerts] = useState<Set<string>>(new Set());
  const [config, setConfig] = useState<AlertConfig>({
    enableToasts: true,
    enableSounds: true,
    enableDesktopNotifications: true,
    autoAcknowledgeTimeoutMs: 300000, // 5 minutes
    maxToastAlerts: 5,
    soundVolume: 0.5,
    severityFilter: [AlertSeverity.INFO, AlertSeverity.WARNING, AlertSeverity.CRITICAL, AlertSeverity.FATAL],
    categoryFilter: Object.values(AlertCategory),
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize audio for alert sounds
  useEffect(() => {
    audioRef.current = new Audio('/sounds/alert.mp3'); // You'll need to provide this sound file
    audioRef.current.volume = config.soundVolume;
  }, [config.soundVolume]);

  // Request desktop notification permission
  useEffect(() => {
    if (config.enableDesktopNotifications && 'Notification' in window) {
      Notification.requestPermission();
    }
  }, [config.enableDesktopNotifications]);

  // Filter alerts based on config
  const filteredAlerts = React.useMemo(() => {
    return alerts.filter(alert => 
      config.severityFilter.includes(alert.severity) &&
      config.categoryFilter.includes(alert.category)
    );
  }, [alerts, config.severityFilter, config.categoryFilter]);

  const activeAlerts = React.useMemo(() => 
    filteredAlerts.filter(alert => alert.status === AlertStatus.ACTIVE),
    [filteredAlerts]
  );

  const unacknowledgedAlerts = React.useMemo(() => 
    filteredAlerts.filter(alert => 
      alert.status === AlertStatus.ACTIVE && !alert.acknowledgedAt
    ),
    [filteredAlerts]
  );

  // Play alert sound
  const playAlertSound = useCallback((severity: AlertSeverity) => {
    if (!config.enableSounds || !audioRef.current) return;

    try {
      audioRef.current.currentTime = 0;
      
      // Different sound patterns for different severities
      const playCount = severity === AlertSeverity.CRITICAL || severity === AlertSeverity.FATAL ? 3 : 1;
      let playedCount = 0;

      const playNext = () => {
        if (playedCount < playCount) {
          audioRef.current?.play().catch(console.debug);
          playedCount++;
          if (playedCount < playCount) {
            setTimeout(playNext, 500);
          }
        }
      };

      playNext();
    } catch (error) {
      console.debug('Failed to play alert sound:', error);
    }
  }, [config.enableSounds]);

  // Show desktop notification
  const showDesktopNotification = useCallback((alert: AlertData) => {
    if (!config.enableDesktopNotifications || 
        !('Notification' in window) || 
        Notification.permission !== 'granted') {
      return;
    }

    const notification = new Notification(alert.title, {
      body: alert.message,
      icon: '/icons/alert.png', // You'll need to provide this icon
      tag: alert.id,
      requireInteraction: alert.severity === AlertSeverity.CRITICAL || alert.severity === AlertSeverity.FATAL,
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
      
      // Navigate to alert details or action URL if available
      if (alert.actionUrl) {
        window.open(alert.actionUrl, '_blank');
      }
    };

    // Auto-close after 10 seconds for non-critical alerts
    if (alert.severity !== AlertSeverity.CRITICAL && alert.severity !== AlertSeverity.FATAL) {
      setTimeout(() => notification.close(), 10000);
    }
  }, [config.enableDesktopNotifications]);

  // Process new alert
  const processNewAlert = useCallback((alert: AlertData) => {
    // Add toast notification
    if (config.enableToasts && toastAlerts.size < config.maxToastAlerts) {
      setToastAlerts(prev => new Set(prev.add(alert.id)));
      
      // Auto-dismiss toast after delay
      setTimeout(() => {
        setToastAlerts(prev => {
          const newSet = new Set(prev);
          newSet.delete(alert.id);
          return newSet;
        });
      }, getSeverityToastDuration(alert.severity));
    }

    // Play sound
    playAlertSound(alert.severity);

    // Show desktop notification
    showDesktopNotification(alert);

    // Auto-acknowledge after timeout if configured
    if (config.autoAcknowledgeTimeoutMs && 
        (alert.severity === AlertSeverity.INFO || alert.severity === AlertSeverity.WARNING)) {
      setTimeout(() => {
        acknowledgeAlert(alert.id);
      }, config.autoAcknowledgeTimeoutMs);
    }
  }, [config, toastAlerts, playAlertSound, showDesktopNotification]);

  // Add new alert to state
  const addAlert = useCallback((alert: AlertData) => {
    setAlerts(prev => {
      // Check if alert already exists
      const existingIndex = prev.findIndex(a => a.id === alert.id);
      
      if (existingIndex >= 0) {
        // Update existing alert
        const updated = [...prev];
        updated[existingIndex] = alert;
        return updated;
      } else {
        // Add new alert and process notifications
        processNewAlert(alert);
        return [alert, ...prev].slice(0, maxAlertHistory);
      }
    });
  }, [processNewAlert, maxAlertHistory]);

  // Fetch alerts from API
  const fetchAlerts = useCallback(async () => {
    try {
      const response = await fetch('/api/v1/monitoring/alerts/active');
      const data = await response.json();
      
      if (data.success && Array.isArray(data.data)) {
        const alertsData: AlertData[] = data.data.map((alert: any) => ({
          ...alert,
          timestamp: new Date(alert.timestamp),
          acknowledgedAt: alert.acknowledgedAt ? new Date(alert.acknowledgedAt) : undefined,
          resolvedAt: alert.resolvedAt ? new Date(alert.resolvedAt) : undefined,
        }));

        // Process new alerts
        alertsData.forEach(alert => {
          const existing = alerts.find(a => a.id === alert.id);
          if (!existing || existing.status !== alert.status) {
            addAlert(alert);
          }
        });
      }
    } catch (error) {
      console.debug('Failed to fetch alerts:', error);
    }
  }, [addAlert, alerts]);

  // WebSocket message handler
  useEffect(() => {
    if (!isConnected) return;

    // Send subscription message for alerts
    sendMessage({
      type: 'subscribe_alerts',
      data: {
        severityFilter: config.severityFilter,
        categoryFilter: config.categoryFilter,
      },
      timestamp: Date.now(),
    });
  }, [isConnected, sendMessage, config.severityFilter, config.categoryFilter]);

  // Polling fallback
  useEffect(() => {
    if (!websocketUrl) {
      fetchAlerts(); // Initial fetch
      
      pollTimeoutRef.current = setInterval(fetchAlerts, pollInterval);
      
      return () => {
        if (pollTimeoutRef.current) {
          clearInterval(pollTimeoutRef.current);
        }
      };
    }
  }, [fetchAlerts, pollInterval, websocketUrl]);

  // API functions
  const acknowledgeAlert = useCallback(async (alertId: string) => {
    try {
      const response = await fetch(`/api/v1/monitoring/alerts/${alertId}/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        setAlerts(prev =>
          prev.map(alert =>
            alert.id === alertId
              ? {
                  ...alert,
                  status: AlertStatus.ACKNOWLEDGED,
                  acknowledgedAt: new Date(),
                  acknowledgedBy: 'current_user', // Should come from user context
                }
              : alert
          )
        );
      }
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
    }
  }, []);

  const resolveAlert = useCallback(async (alertId: string) => {
    try {
      const response = await fetch(`/api/v1/monitoring/alerts/${alertId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        setAlerts(prev =>
          prev.map(alert =>
            alert.id === alertId
              ? {
                  ...alert,
                  status: AlertStatus.RESOLVED,
                  resolvedAt: new Date(),
                }
              : alert
          )
        );
      }
    } catch (error) {
      console.error('Failed to resolve alert:', error);
    }
  }, []);

  const silenceAlert = useCallback(async (alertId: string, durationMs?: number) => {
    try {
      const response = await fetch(`/api/v1/monitoring/alerts/${alertId}/silence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duration: durationMs }),
      });

      if (response.ok) {
        setAlerts(prev =>
          prev.map(alert =>
            alert.id === alertId
              ? { ...alert, status: AlertStatus.SILENCED }
              : alert
          )
        );
      }
    } catch (error) {
      console.error('Failed to silence alert:', error);
    }
  }, []);

  const dismissToast = useCallback((alertId: string) => {
    setToastAlerts(prev => {
      const newSet = new Set(prev);
      newSet.delete(alertId);
      return newSet;
    });
  }, []);

  const clearAllAlerts = useCallback(() => {
    setAlerts([]);
    setToastAlerts(new Set());
  }, []);

  const testAlert = useCallback((severity: AlertSeverity) => {
    const testAlert: AlertData = {
      id: `test-${Date.now()}`,
      title: 'Test Alert',
      message: `This is a test ${severity} alert to verify notification system`,
      severity,
      status: AlertStatus.ACTIVE,
      category: AlertCategory.SYSTEM,
      source: 'test',
      timestamp: new Date(),
    };

    addAlert(testAlert);
  }, [addAlert]);

  const updateConfig = useCallback((newConfig: Partial<AlertConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
  }, []);

  const contextValue: AlertingContext = {
    alerts: filteredAlerts,
    activeAlerts,
    unacknowledgedAlerts,
    config,
    updateConfig,
    acknowledgeAlert,
    resolveAlert,
    silenceAlert,
    dismissToast,
    clearAllAlerts,
    testAlert,
  };

  return (
    <AlertingContext.Provider value={contextValue}>
      {children}
      <AlertToastContainer toastAlerts={Array.from(toastAlerts)} />
    </AlertingContext.Provider>
  );
};

/**
 * Hook to use alerting system
 */
export function useAlerting(): AlertingContext {
  const context = useContext(AlertingContext);
  if (!context) {
    throw new Error('useAlerting must be used within AlertingProvider');
  }
  return context;
}

/**
 * Alert Toast Container
 */
const AlertToastContainer: React.FC<{
  toastAlerts: string[];
}> = ({ toastAlerts }) => {
  const { alerts, acknowledgeAlert, dismissToast } = useAlerting();

  const toastAlertsData = alerts.filter(alert => toastAlerts.includes(alert.id));

  if (toastAlertsData.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md">
      {toastAlertsData.map(alert => (
        <AlertToast
          key={alert.id}
          alert={alert}
          onAcknowledge={() => acknowledgeAlert(alert.id)}
          onDismiss={() => dismissToast(alert.id)}
        />
      ))}
    </div>
  );
};

/**
 * Individual Alert Toast Component
 */
const AlertToast: React.FC<{
  alert: AlertData;
  onAcknowledge: () => void;
  onDismiss: () => void;
}> = ({ alert, onAcknowledge, onDismiss }) => {
  const getSeverityColor = (severity: AlertSeverity) => {
    switch (severity) {
      case AlertSeverity.CRITICAL:
      case AlertSeverity.FATAL:
        return 'border-red-500 bg-red-50 text-red-700';
      case AlertSeverity.WARNING:
        return 'border-yellow-500 bg-yellow-50 text-yellow-700';
      case AlertSeverity.INFO:
        return 'border-blue-500 bg-blue-50 text-blue-700';
      default:
        return 'border-gray-500 bg-gray-50 text-gray-700';
    }
  };

  const getSeverityIcon = (severity: AlertSeverity) => {
    switch (severity) {
      case AlertSeverity.CRITICAL:
      case AlertSeverity.FATAL:
        return <AlertTriangle className="h-4 w-4" />;
      case AlertSeverity.WARNING:
        return <AlertCircle className="h-4 w-4" />;
      case AlertSeverity.INFO:
        return <Info className="h-4 w-4" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  return (
    <Card className={`shadow-lg border-2 animate-in slide-in-from-right ${getSeverityColor(alert.severity)}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 flex-1">
            {getSeverityIcon(alert.severity)}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-medium text-sm">{alert.title}</h4>
                <Badge variant="outline" className="text-xs">
                  {alert.severity.toUpperCase()}
                </Badge>
              </div>
              <p className="text-xs">{alert.message}</p>
              <p className="text-xs text-gray-500 mt-1">
                {alert.source} • {alert.timestamp.toLocaleTimeString()}
              </p>
            </div>
          </div>
          <div className="flex gap-1">
            {alert.actionUrl && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => window.open(alert.actionUrl, '_blank')}
                className="h-6 w-6 p-0"
              >
                <ExternalLink className="h-3 w-3" />
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={onAcknowledge}
              className="h-6 w-6 p-0"
            >
              <Check className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onDismiss}
              className="h-6 w-6 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

/**
 * Alert Management Dashboard
 */
export const AlertManagementDashboard: React.FC = () => {
  const {
    alerts,
    activeAlerts,
    unacknowledgedAlerts,
    config,
    updateConfig,
    acknowledgeAlert,
    resolveAlert,
    silenceAlert,
    clearAllAlerts,
    testAlert,
  } = useAlerting();

  const [selectedTab, setSelectedTab] = useState('active');

  const getSeverityColor = (severity: AlertSeverity) => {
    switch (severity) {
      case AlertSeverity.CRITICAL:
      case AlertSeverity.FATAL:
        return 'border-red-500 bg-red-50 text-red-700';
      case AlertSeverity.WARNING:
        return 'border-yellow-500 bg-yellow-50 text-yellow-700';
      case AlertSeverity.INFO:
        return 'border-blue-500 bg-blue-50 text-blue-700';
      default:
        return 'border-gray-500 bg-gray-50 text-gray-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Alerts</p>
                <p className="text-2xl font-bold">{activeAlerts.length}</p>
              </div>
              <Bell className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Unacknowledged</p>
                <p className="text-2xl font-bold">{unacknowledgedAlerts.length}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Alerts</p>
                <p className="text-2xl font-bold">{alerts.length}</p>
              </div>
              <Info className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alert Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Alert Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex items-center justify-between">
              <span className="text-sm">Toast Notifications</span>
              <Switch
                checked={config.enableToasts}
                onCheckedChange={(checked) => updateConfig({ enableToasts: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Sound Alerts</span>
              <Switch
                checked={config.enableSounds}
                onCheckedChange={(checked) => updateConfig({ enableSounds: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Desktop Notifications</span>
              <Switch
                checked={config.enableDesktopNotifications}
                onCheckedChange={(checked) => updateConfig({ enableDesktopNotifications: checked })}
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => testAlert(AlertSeverity.WARNING)}
              >
                Test Alert
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alert Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="active">Active ({activeAlerts.length})</TabsTrigger>
            <TabsTrigger value="all">All Alerts ({alerts.length})</TabsTrigger>
            <TabsTrigger value="unacknowledged">Unacknowledged ({unacknowledgedAlerts.length})</TabsTrigger>
          </TabsList>
          <Button size="sm" variant="outline" onClick={clearAllAlerts}>
            Clear All
          </Button>
        </div>

        <TabsContent value="active" className="space-y-2">
          {activeAlerts.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Bell className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600">No active alerts</p>
              </CardContent>
            </Card>
          ) : (
            activeAlerts.map(alert => (
              <AlertCard
                key={alert.id}
                alert={alert}
                onAcknowledge={() => acknowledgeAlert(alert.id)}
                onResolve={() => resolveAlert(alert.id)}
                onSilence={() => silenceAlert(alert.id)}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="all" className="space-y-2">
          {alerts.map(alert => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onAcknowledge={() => acknowledgeAlert(alert.id)}
              onResolve={() => resolveAlert(alert.id)}
              onSilence={() => silenceAlert(alert.id)}
            />
          ))}
        </TabsContent>

        <TabsContent value="unacknowledged" className="space-y-2">
          {unacknowledgedAlerts.map(alert => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onAcknowledge={() => acknowledgeAlert(alert.id)}
              onResolve={() => resolveAlert(alert.id)}
              onSilence={() => silenceAlert(alert.id)}
            />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
};

/**
 * Individual Alert Card Component
 */
const AlertCard: React.FC<{
  alert: AlertData;
  onAcknowledge: () => void;
  onResolve: () => void;
  onSilence: () => void;
}> = ({ alert, onAcknowledge, onResolve, onSilence }) => {
  const getSeverityColor = (severity: AlertSeverity) => {
    switch (severity) {
      case AlertSeverity.CRITICAL:
      case AlertSeverity.FATAL:
        return 'border-red-500 bg-red-50 text-red-700';
      case AlertSeverity.WARNING:
        return 'border-yellow-500 bg-yellow-50 text-yellow-700';
      case AlertSeverity.INFO:
        return 'border-blue-500 bg-blue-50 text-blue-700';
      default:
        return 'border-gray-500 bg-gray-50 text-gray-700';
    }
  };

  const getStatusColor = (status: AlertStatus) => {
    switch (status) {
      case AlertStatus.ACTIVE:
        return 'text-red-600 bg-red-50';
      case AlertStatus.ACKNOWLEDGED:
        return 'text-yellow-600 bg-yellow-50';
      case AlertStatus.RESOLVED:
        return 'text-green-600 bg-green-50';
      case AlertStatus.SILENCED:
        return 'text-gray-600 bg-gray-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <Card className={`border-l-4 ${getSeverityColor(alert.severity)}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h4 className="font-medium">{alert.title}</h4>
              <Badge className={getStatusColor(alert.status)}>
                {alert.status.toUpperCase()}
              </Badge>
              <Badge variant="outline">
                {alert.severity.toUpperCase()}
              </Badge>
              <Badge variant="outline">
                {alert.category.replace('_', ' ').toUpperCase()}
              </Badge>
            </div>
            <p className="text-sm text-gray-600 mb-2">{alert.message}</p>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span>Source: {alert.source}</span>
              <span>Time: {alert.timestamp.toLocaleString()}</span>
              {alert.acknowledgedAt && (
                <span>Acknowledged: {alert.acknowledgedAt.toLocaleString()}</span>
              )}
            </div>
          </div>
          <div className="flex gap-2 ml-4">
            {alert.actionUrl && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.open(alert.actionUrl, '_blank')}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            )}
            {alert.status === AlertStatus.ACTIVE && (
              <>
                <Button size="sm" variant="outline" onClick={onAcknowledge}>
                  Acknowledge
                </Button>
                <Button size="sm" variant="outline" onClick={onSilence}>
                  <VolumeX className="h-4 w-4" />
                </Button>
                <Button size="sm" onClick={onResolve}>
                  Resolve
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

/**
 * Helper function to get toast duration based on severity
 */
function getSeverityToastDuration(severity: AlertSeverity): number {
  switch (severity) {
    case AlertSeverity.CRITICAL:
    case AlertSeverity.FATAL:
      return 0; // Don't auto-dismiss
    case AlertSeverity.WARNING:
      return 15000; // 15 seconds
    case AlertSeverity.INFO:
      return 8000; // 8 seconds
    default:
      return 10000; // 10 seconds
  }
}

/**
 * Alert Bell Icon Component (for navigation/header)
 */
export const AlertBellIcon: React.FC<{
  size?: 'sm' | 'md' | 'lg';
  showCount?: boolean;
}> = ({ size = 'md', showCount = true }) => {
  const { unacknowledgedAlerts } = useAlerting();
  
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  };

  const hasAlerts = unacknowledgedAlerts.length > 0;

  return (
    <div className="relative">
      {hasAlerts ? (
        <Bell className={`${sizeClasses[size]} text-orange-600`} />
      ) : (
        <BellOff className={`${sizeClasses[size]} text-gray-400`} />
      )}
      {showCount && hasAlerts && (
        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
          {unacknowledgedAlerts.length > 99 ? '99+' : unacknowledgedAlerts.length}
        </span>
      )}
    </div>
  );
};