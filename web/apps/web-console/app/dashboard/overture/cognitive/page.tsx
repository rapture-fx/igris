'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useChartTheme } from '@/utils/chartTheme';
import {
  useCognitiveStatus,
  useCognitiveConfig,
  useCognitiveObservations,
  useCognitiveRecommendations,
  useCognitiveHistory,
  useUpdateCognitiveConfig,
  useApplyRecommendation,
  useDismissRecommendation,
} from '@/hooks/useCognitive';
import {
  Brain,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Zap,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  ThumbsUp,
  ThumbsDown,
  Calendar,
  Trash2,
  Play,
  Pause,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { CHART_COLORS } from '@/utils/constants';

const sliderStyles = `
  input[type="range"].dark-blue-slider {
    accent-color: #114dcd;
  }
  input[type="range"].dark-blue-slider:hover,
  input[type="range"].dark-blue-slider:active,
  input[type="range"].dark-blue-slider:focus {
    accent-color: #114dcd;
    outline: none;
  }
  .hide-scrollbar {
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  .hide-scrollbar::-webkit-scrollbar {
    display: none;
  }
`;

export default function CognitiveAdvisorPage() {
  const chartTheme = useChartTheme();
  const { data: status } = useCognitiveStatus();
  const { data: config } = useCognitiveConfig();
  const { data: observationsData } = useCognitiveObservations();
  const { data: recommendationsData } = useCognitiveRecommendations();
  const { data: historyData } = useCognitiveHistory(20);

  // Ensure data is always an array
  const observations = Array.isArray(observationsData) ? observationsData : [];
  const recommendations = Array.isArray(recommendationsData) ? recommendationsData : [];
  const history = Array.isArray(historyData) ? historyData : [];

  const updateConfigMutation = useUpdateCognitiveConfig();
  const applyRecommendationMutation = useApplyRecommendation();
  const dismissRecommendationMutation = useDismissRecommendation();

  const [editableConfig, setEditableConfig] = useState({
    enabled: config?.enabled ?? true,
    aggressiveness: config?.aggressiveness ?? 50,
    min_confidence_threshold: config?.min_confidence_threshold ?? 75,
    auto_apply_threshold: config?.auto_apply_threshold ?? 90,
    observation_window_hours: config?.observation_window_hours ?? 6,
    learning_mode: config?.learning_mode ?? false,
  });

  const [configChanged, setConfigChanged] = useState(false);

  const handleConfigChange = (field: string, value: any) => {
    setEditableConfig(prev => ({ ...prev, [field]: value }));
    setConfigChanged(true);
  };

  const handleSaveConfig = async () => {
    try {
      await updateConfigMutation.mutateAsync(editableConfig as any);
      alert('Configuration saved successfully');
      setConfigChanged(false);
    } catch (error) {
      alert('Error saving configuration');
    }
  };

  const handleApplyRecommendation = async (id: string) => {
    if (!confirm('Apply this recommendation? This will modify your routing configuration.')) return;
    try {
      await applyRecommendationMutation.mutateAsync(id);
      alert('Recommendation applied successfully');
    } catch (error) {
      alert('Error applying recommendation');
    }
  };

  const handleDismissRecommendation = async (id: string) => {
    try {
      await dismissRecommendationMutation.mutateAsync(id);
    } catch (error) {
      alert('Error dismissing recommendation');
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-3 w-3 mr-1" />;
      case 'paused':
        return <Pause className="h-3 w-3 mr-1" />;
      case 'learning':
        return <Brain className="h-3 w-3 mr-1" />;
      default:
        return <XCircle className="h-3 w-3 mr-1" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-900';
      case 'high':
        return 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-400 dark:border-orange-900';
      case 'medium':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-400 dark:border-yellow-900';
      case 'low':
        return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-900';
      default:
        return 'bg-gray-50 text-gray-700 border dark:bg-card dark:text-[#a8a898] dark:border-[#f6f6f4]/5';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-900';
      case 'medium':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-400 dark:border-yellow-900';
      case 'low':
        return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-900';
      default:
        return 'bg-gray-50 text-gray-700 border dark:bg-card dark:text-[#a8a898] dark:border-[#f6f6f4]/5';
    }
  };

  return (
    <DashboardLayout>
      <style>{sliderStyles}</style>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="pb-4 border-b border-border">
          <h1 className="text-base font-medium text-foreground font-inter">Cognitive Advisor</h1>
          <p className="text-muted-foreground mt-1 font-inter text-xs">
            AI-powered observability and automated optimization recommendations
          </p>
        </div>

        {/* Overview Cards */}
        <div className="bg-card">
          <div className="grid grid-cols-2 divide-x divide-gray-200/20 dark:divide-[#f6f6f4]/5">
            <div className="p-4">
              <div className="text-xs font-medium text-muted-foreground mb-1">Status</div>
              <div className="pb-2">
                <Badge className="bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400 border-green-200 dark:border-green-900">
                  {getStatusIcon(status?.status)}
                  {status?.status === 'active' ? 'Active' : status?.status === 'paused' ? 'Paused' : 'Learning'}
                </Badge>
              </div>
            </div>
            <div className="p-4">
              <div className="text-xs font-medium text-muted-foreground mb-1">Confidence Score</div>
              <div className="text-lg font-bold text-foreground">{status?.confidence_score.toFixed(1)}%</div>
              <p className="text-[0.65rem] text-muted-foreground mt-1">current confidence</p>
            </div>
          </div>
          <div className="grid grid-cols-2 divide-x divide-gray-200/20 dark:divide-[#f6f6f4]/5 border-t border-border">
            <div className="p-4">
              <div className="text-xs font-medium text-muted-foreground mb-1">Potential Savings</div>
              <div className="text-lg font-bold text-foreground">
                ${status?.potential_savings_low}-${status?.potential_savings_high}
              </div>
              <p className="text-[0.65rem] text-muted-foreground mt-1">estimated monthly</p>
            </div>
            <div className="p-4">
              <div className="text-xs font-medium text-muted-foreground mb-1">Acceptance Rate</div>
              <div className="text-lg font-bold text-foreground">{status?.acceptance_rate.toFixed(1)}%</div>
              <p className="text-[0.65rem] text-muted-foreground mt-1">recommendations applied</p>
            </div>
          </div>
        </div>

        {/* Current Observations */}
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm">Current Observations</CardTitle>
            <CardDescription className="text-xs">Detected issues and anomalies ({status?.observations_count || 0})</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 overflow-auto max-h-96 hide-scrollbar">
              {observations?.map((obs) => (
                <div key={obs.id} className="flex items-start gap-3 p-3 bg-card rounded-lg border border-border">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={getSeverityColor(obs.severity)}>
                        {obs.severity}
                      </Badge>
                      <Badge className="bg-gray-50 text-gray-700 border dark:bg-card dark:text-[#a8a898] dark:border-[#f6f6f4]/5">
                        {obs.type}
                      </Badge>
                      {obs.provider && (
                        <span className="text-xs text-muted-foreground">{obs.provider}</span>
                      )}
                      {obs.model && (
                        <span className="text-xs text-muted-foreground">{obs.model}</span>
                      )}
                    </div>
                    <p className="text-xs text-foreground font-medium">{obs.description}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {obs.trend === 'up' ? (
                        <TrendingUp className="h-3 w-3 text-red-600" />
                      ) : (
                        <TrendingDown className="h-3 w-3 text-green-600" />
                      )}
                      <span className={`text-xs font-medium ${obs.trend === 'up' ? 'text-red-600' : 'text-green-600'}`}>
                        {obs.metric_change}% {obs.metric_unit}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(obs.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              {(!observations || observations.length === 0) && (
                <div className="text-center py-8 text-xs text-muted-foreground">
                  No observations detected
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recommended Actions */}
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm">Recommended Actions</CardTitle>
            <CardDescription className="text-xs">AI-generated optimization suggestions ({status?.recommendations_count || 0})</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 overflow-auto max-h-96 hide-scrollbar">
              {recommendations?.map((rec) => (
                <div key={rec.id} className="p-4 bg-card rounded-lg border border-border">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge className={getPriorityColor(rec.priority)}>
                        {rec.priority} priority
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {rec.confidence.toFixed(1)}% confidence
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs px-2 py-1"
                        onClick={() => handleApplyRecommendation(rec.id)}
                        disabled={applyRecommendationMutation.isPending}
                      >
                        <Play className="h-3 w-3 mr-1" />
                        Apply
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs px-2 py-1"
                        onClick={() => handleDismissRecommendation(rec.id)}
                        disabled={dismissRecommendationMutation.isPending}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs font-medium text-foreground mb-2">{rec.action}</p>
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div>
                      <span className="text-muted-foreground">Quality:</span>
                      <span className={`ml-1 font-medium ${rec.predicted_impact.quality_change >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {rec.predicted_impact.quality_change >= 0 ? '+' : ''}{rec.predicted_impact.quality_change.toFixed(1)}%
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Cost:</span>
                      <span className={`ml-1 font-medium ${rec.predicted_impact.cost_change <= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {rec.predicted_impact.cost_change >= 0 ? '+' : ''}{rec.predicted_impact.cost_change.toFixed(1)}%
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Latency:</span>
                      <span className={`ml-1 font-medium ${rec.predicted_impact.latency_change <= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {rec.predicted_impact.latency_change >= 0 ? '+' : ''}{rec.predicted_impact.latency_change.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">{rec.reason}</p>
                </div>
              ))}
              {(!recommendations || recommendations.length === 0) && (
                <div className="text-center py-8 text-xs text-muted-foreground">
                  No recommendations available
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* History & Performance */}
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm">History & Performance</CardTitle>
            <CardDescription className="text-xs">Past recommendations and their impact</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto max-h-96 hide-scrollbar">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Date</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Action</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Predicted Impact</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Actual Impact</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {history?.map((entry) => (
                    <tr key={entry.id} className="border-b border-border hover:bg-muted">
                      <td className="py-2 px-3 text-foreground">
                        {new Date(entry.date).toLocaleDateString()}
                      </td>
                      <td className="py-2 px-3 text-foreground">{entry.action}</td>
                      <td className="py-2 px-3">
                        <Badge className={entry.accepted ? 'bg-green-50 text-green-700 border border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-900' : 'bg-gray-50 text-gray-700 border dark:bg-card dark:text-[#a8a898] dark:border-[#f6f6f4]/5'}>
                          {entry.accepted ? <ThumbsUp className="h-3 w-3 mr-1" /> : <ThumbsDown className="h-3 w-3 mr-1" />}
                          {entry.accepted ? 'Applied' : 'Rejected'}
                        </Badge>
                      </td>
                      <td className="py-2 px-3 text-foreground">
                        Q: {entry.predicted_impact.quality.toFixed(1)}%,
                        C: {entry.predicted_impact.cost.toFixed(1)}%,
                        L: {entry.predicted_impact.latency.toFixed(1)}%
                      </td>
                      <td className="py-2 px-3 text-foreground">
                        {entry.actual_impact ? (
                          <>
                            Q: {entry.actual_impact.quality.toFixed(1)}%,
                            C: {entry.actual_impact.cost.toFixed(1)}%,
                            L: {entry.actual_impact.latency.toFixed(1)}%
                          </>
                        ) : (
                          <span className="text-muted-foreground">N/A</span>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        {entry.variance !== undefined ? (
                          <span className={`font-medium ${Math.abs(entry.variance) < 10 ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                            ±{entry.variance.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Configuration */}
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-xs">Configuration</CardTitle>
            <CardDescription className="text-xs">Cognitive Advisor settings and thresholds</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="enabled" className="text-xs font-medium text-foreground">Enable Cognitive Advisor</Label>
                    <Switch
                      id="enabled"
                      checked={editableConfig.enabled}
                      onCheckedChange={(checked) => handleConfigChange('enabled', checked)}
                      className="scale-50"
                    />
                  </div>
                  <p className="text-[0.6rem] text-muted-foreground">Activate AI-powered recommendations</p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="learning_mode" className="text-xs font-medium text-foreground">Learning Mode</Label>
                    <Switch
                      id="learning_mode"
                      checked={editableConfig.learning_mode}
                      onCheckedChange={(checked) => handleConfigChange('learning_mode', checked)}
                      className="scale-50"
                    />
                  </div>
                  <p className="text-[0.6rem] text-muted-foreground">Observe without applying changes</p>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="aggressiveness" className="text-xs font-medium text-foreground">
                    Aggressiveness ({editableConfig.aggressiveness}%)
                  </Label>
                  <Input
                    id="aggressiveness"
                    type="range"
                    min="0"
                    max="100"
                    value={editableConfig.aggressiveness}
                    onChange={(e) => handleConfigChange('aggressiveness', parseInt(e.target.value))}
                    className="scale-[0.6] origin-left dark-blue-slider h-1 focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none focus:border-border"
                  />
                  <p className="text-[0.6rem] text-muted-foreground">How aggressive optimization should be</p>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="min_confidence" className="text-xs font-medium text-foreground">
                    Min Confidence ({editableConfig.min_confidence_threshold}%)
                  </Label>
<Input
                    id="min_confidence"
                    type="range"
                    min="50"
                    max="99"
                    value={editableConfig.min_confidence_threshold}
                    onChange={(e) => handleConfigChange('min_confidence', parseInt(e.target.value))}
                    className="scale-[0.6] origin-left dark-blue-slider h-1 focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none focus:border-border"
                  />
                  <p className="text-[0.6rem] text-muted-foreground">Minimum confidence to show recommendation</p>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="auto_apply" className="text-xs font-medium text-foreground">
                    Auto-Apply Threshold ({editableConfig.auto_apply_threshold}%)
                  </Label>
                  <Input
                    id="auto_apply"
                    type="range"
                    min="80"
                    max="99"
                    value={editableConfig.auto_apply_threshold}
                    onChange={(e) => handleConfigChange('auto_apply_threshold', parseInt(e.target.value))}
                    className="scale-[0.6] origin-left dark-blue-slider h-1 focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none focus:border-border"
                  />
                  <p className="text-[0.6rem] text-muted-foreground">Auto-apply recommendations above this confidence</p>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="observation_window" className="text-xs font-medium text-foreground">Observation Window (hours)</Label>
                  <Input
                    id="observation_window"
                    type="number"
                    value={editableConfig.observation_window_hours}
                    onChange={(e) => handleConfigChange('observation_window_hours', parseInt(e.target.value))}
                    className="text-xs h-7"
                    min="1"
                    max="24"
                  />
                  <p className="text-[0.6rem] text-muted-foreground">Time window for detecting trends</p>
                </div>
              </div>

              {configChanged && (
                <Button
                  onClick={handleSaveConfig}
                  disabled={updateConfigMutation.isPending}
                  variant="outline"
                  className="text-xs shadow-sm h-7 px-3"
                  size="sm"
                >
                  {updateConfigMutation.isPending ? 'Saving...' : 'Save Configuration'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* How Cognitive Advisor Works */}
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm">How Cognitive Advisor Works</CardTitle>
            <CardDescription className="text-xs">AI-powered observability and optimization</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-card border border-border rounded-lg p-4">
              <ul className="text-xs text-foreground space-y-1 list-disc list-inside">
                <li>Continuously monitors provider performance, latency, cost, and quality metrics</li>
                <li>Detects anomalies, degradations, and opportunities using machine learning</li>
                <li>Generates actionable recommendations with predicted impact and confidence scores</li>
                <li>Learns from applied recommendations to improve accuracy over time</li>
                <li>Auto-applies high-confidence recommendations (configurable threshold)</li>
                <li>Tracks actual vs predicted impact to refine future suggestions</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
