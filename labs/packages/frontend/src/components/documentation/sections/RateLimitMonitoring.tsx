import React from 'react';
import { BarChart3, TrendingUp, Bell, Code, Activity, AlertTriangle } from 'lucide-react';

interface RateLimitMonitoringProps {
  monitoringTools: Array<{
    tool: string;
    description: string;
    color: string;
    icon: string;
    headers?: Array<{
      header: string;
      description: string;
      example: string;
    }>;
    metrics?: Array<{
      metric: string;
      description: string;
      action: string;
    }>;
    alerts?: Array<{
      alert: string;
      description: string;
      action: string;
    }>;
  }>;
}

const iconMap = {
  BarChart3,
  TrendingUp,
  Bell,
  Code,
  Activity,
  AlertTriangle,
};

export default function RateLimitMonitoring({ monitoringTools }: RateLimitMonitoringProps) {
  const getColorClasses = (color: string) => {
    const colorMap = {
      blue: {
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        text: 'text-blue-900',
        badge: 'bg-blue-100 text-blue-800',
        icon: 'text-blue-600',
        accent: 'bg-blue-500'
      },
      green: {
        bg: 'bg-green-50',
        border: 'border-green-200',
        text: 'text-green-900',
        badge: 'bg-green-100 text-green-800',
        icon: 'text-green-600',
        accent: 'bg-green-500'
      },
      orange: {
        bg: 'bg-orange-50',
        border: 'border-orange-200',
        text: 'text-orange-900',
        badge: 'bg-orange-100 text-orange-800',
        icon: 'text-orange-600',
        accent: 'bg-orange-500'
      }
    };
    return colorMap[color as keyof typeof colorMap] || colorMap.blue;
  };

  return (
    <div className="space-y-8">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-3">Rate Limit Monitoring</h2>
        <p className="text-gray-600">
          Monitor rate limit usage and implement proactive strategies to optimize performance
        </p>
      </div>

      <div className="space-y-6">
        {monitoringTools.map((tool, index) => {
          const colors = getColorClasses(tool.color);
          const IconComponent = iconMap[tool.icon as keyof typeof iconMap];

          return (
            <div
              key={index}
              className={`${colors.bg} ${colors.border} border rounded-xl p-6`}
            >
              {/* Tool Header */}
              <div className="flex items-center space-x-4 mb-6">
                <div className={`${colors.badge} p-3 rounded-lg`}>
                  <IconComponent className={`w-6 h-6 ${colors.icon}`} />
                </div>
                <div>
                  <h3 className={`text-xl font-bold ${colors.text} mb-1`}>
                    {tool.tool}
                  </h3>
                  <p className="text-gray-600">
                    {tool.description}
                  </p>
                </div>
              </div>

              {/* Headers Section */}
              {tool.headers && (
                <div className="mb-6">
                  <h4 className={`text-lg font-semibold ${colors.text} mb-4`}>
                    Response Headers to Monitor
                  </h4>
                  <div className="grid gap-4">
                    {tool.headers.map((header, headerIndex) => (
                      <div
                        key={headerIndex}
                        className="bg-white/70 border border-white/50 rounded-lg p-4"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <code className={`text-sm font-mono ${colors.text} bg-white px-2 py-1 rounded`}>
                            {header.header}
                          </code>
                          <span className="text-sm text-gray-500 font-mono">
                            {header.example}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">
                          {header.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Metrics Section */}
              {tool.metrics && (
                <div className="mb-6">
                  <h4 className={`text-lg font-semibold ${colors.text} mb-4`}>
                    Key Metrics to Track
                  </h4>
                  <div className="grid md:grid-cols-2 gap-4">
                    {tool.metrics.map((metric, metricIndex) => (
                      <div
                        key={metricIndex}
                        className="bg-white/70 border border-white/50 rounded-lg p-4"
                      >
                        <h5 className={`font-semibold ${colors.text} mb-2`}>
                          {metric.metric}
                        </h5>
                        <p className="text-sm text-gray-600 mb-3">
                          {metric.description}
                        </p>
                        <div className="flex items-start space-x-2">
                          <Activity className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-gray-500">
                            <strong>Action:</strong> {metric.action}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Alerts Section */}
              {tool.alerts && (
                <div>
                  <h4 className={`text-lg font-semibold ${colors.text} mb-4`}>
                    Automated Alerts
                  </h4>
                  <div className="space-y-3">
                    {tool.alerts.map((alert, alertIndex) => (
                      <div
                        key={alertIndex}
                        className="bg-white/70 border border-white/50 rounded-lg p-4"
                      >
                        <div className="flex items-start space-x-3">
                          <AlertTriangle className={`w-5 h-5 ${colors.icon} mt-0.5 flex-shrink-0`} />
                          <div className="flex-1">
                            <h5 className={`font-semibold ${colors.text} mb-1`}>
                              {alert.alert}
                            </h5>
                            <p className="text-sm text-gray-600 mb-2">
                              {alert.description}
                            </p>
                            <div className="bg-gray-50 rounded px-3 py-2">
                              <p className="text-xs text-gray-600">
                                <strong>Recommended Action:</strong> {alert.action}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Monitoring Best Practices */}
      <div className="mt-8 p-6 bg-white border border-gray-200 rounded-xl">
        <h3 className="text-lg font-bold text-gray-900 mb-4">
          Monitoring Best Practices
        </h3>
        <div className="grid md:grid-cols-3 gap-6">
          <div>
            <h4 className="font-semibold text-blue-900 mb-3 flex items-center">
              <BarChart3 className="w-4 h-4 mr-2 text-blue-600" />
              Real-time Monitoring
            </h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• Parse rate limit headers on every response</li>
              <li>• Track requests per minute in sliding windows</li>
              <li>• Monitor response times for performance impact</li>
              <li>• Set up dashboard alerts for 80% threshold</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-green-900 mb-3 flex items-center">
              <TrendingUp className="w-4 h-4 mr-2 text-green-600" />
              Historical Analysis
            </h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• Store usage patterns for trend analysis</li>
              <li>• Identify peak usage times and patterns</li>
              <li>• Calculate error rates and success metrics</li>
              <li>• Generate monthly usage reports</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-orange-900 mb-3 flex items-center">
              <Bell className="w-4 h-4 mr-2 text-orange-600" />
              Proactive Alerts
            </h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• Configure multi-level alert thresholds</li>
              <li>• Set up Slack/email notifications</li>
              <li>• Create incident response playbooks</li>
              <li>• Monitor competitor usage if applicable</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Sample Monitoring Code */}
      <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
          <Code className="w-4 h-4 mr-2" />
          Quick Implementation Example
        </h4>
        <div className="bg-white p-3 rounded border overflow-x-auto text-xs">
          <div className="ml-4"># Check remaining requests</div>
          <div className="ml-4">response = requests.get(url, headers=headers)</div>
          <div className="ml-4">limit = response.headers.get('X-RateLimit-Limit')</div>
          <div className="ml-4">remaining = response.headers.get('X-RateLimit-Remaining')</div>
          <div className="ml-4">{'if remaining and int(remaining) < 10:'}</div>
          <div className="ml-8">{'alert_team(f"Low rate limit: {remaining}/{limit}")'}</div>
        </div>
      </div>
    </div>
  );
} 