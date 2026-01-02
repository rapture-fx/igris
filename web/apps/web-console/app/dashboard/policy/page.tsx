'use client';

export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Shield, Lock, Zap, Users, TrendingUp, Settings, List, Filter, AlertCircle, GitBranch, FileText, Clock } from 'lucide-react';

// Policy types
interface RoutingConstraint {
  type: 'cost' | 'latency' | 'quality';
  operator: '<' | '>' | '<=' | '>=' | '=';
  value: number;
  unit: string;
  priority: number;
}

interface ModelList {
  provider: string;
  allowed_models: string[];
  denied_models: string[];
}

interface EscalationRule {
  condition: string;
  action: string;
  priority: number;
}

interface ActivePolicy {
  name: string;
  mode: 'cost' | 'balanced' | 'quality' | 'custom';
  constraints: RoutingConstraint[];
  model_lists: ModelList[];
  escalation_rules: EscalationRule[];
  evaluation_order: string[];
}

interface PolicyHistory {
  id: string;
  timestamp: string;
  version: number;
  policy: ActivePolicy;
  changed_by: string;
  change_summary: string;
}

interface PolicyDiff {
  field: string;
  old_value: any;
  new_value: any;
  change_type: 'added' | 'removed' | 'modified';
}

export default function PolicyPage() {
  const [selectedPolicy, setSelectedPolicy] = useState<string>('balanced');
  const [activePolicy, setActivePolicy] = useState<ActivePolicy>({
    name: 'Default Balanced Policy',
    mode: 'balanced',
    constraints: [
      { type: 'cost', operator: '<', value: 0.05, unit: '$ per 1K tokens', priority: 1 },
      { type: 'latency', operator: '<', value: 500, unit: 'ms (p99)', priority: 2 },
      { type: 'quality', operator: '>=', value: 85, unit: '% quality score', priority: 3 },
    ],
    model_lists: [
      {
        provider: 'OpenAI',
        allowed_models: ['gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'],
        denied_models: ['gpt-4-32k'],
      },
      {
        provider: 'Anthropic',
        allowed_models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
        denied_models: [],
      },
      {
        provider: 'Google',
        allowed_models: ['gemini-pro', 'gemini-pro-vision'],
        denied_models: ['gemini-ultra'],
      },
    ],
    escalation_rules: [
      { condition: 'error.rate > 10%', action: 'Switch to backup provider', priority: 1 },
      { condition: 'latency.p99 > 2000ms', action: 'Route to faster model tier', priority: 2 },
      { condition: 'provider.status == "down"', action: 'Activate EscapeVector cache', priority: 3 },
      { condition: 'retry.count > 3', action: 'Escalate to premium provider', priority: 4 },
    ],
    evaluation_order: ['Cost Filter', 'Latency Check', 'Quality Score', 'Model Availability', 'Load Balancing'],
  });

  // Policy diffing state
  const [policyHistory, setPolicyHistory] = useState<PolicyHistory[]>([]);
  const [selectedPolicyVersion, setSelectedPolicyVersion] = useState<string>('');
  const [policyDiff, setPolicyDiff] = useState<PolicyDiff[]>([]);
  const [showDiffDialog, setShowDiffDialog] = useState(false);

  // Fetch active policy configuration
  useEffect(() => {
    const fetchPolicy = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081';
        const response = await fetch(`${apiUrl}/v1/policy/active`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setActivePolicy(data);
          setSelectedPolicy(data.mode);
        }
      } catch (error) {
        // Silently fail - UI will use default/mock policy data
      }
    };

    fetchPolicy();
  }, []);

  // Fetch policy history and generate mock data
  useEffect(() => {
    const mockHistory: PolicyHistory[] = [
      {
        id: '1',
        timestamp: new Date(Date.now() - 86400000 * 7).toISOString(), // 7 days ago
        version: 5,
        policy: {
          name: 'Default Balanced Policy',
          mode: 'balanced',
          constraints: [
            { type: 'cost', operator: '<', value: 0.05, unit: '$/request', priority: 1 },
            { type: 'latency', operator: '<', value: 3000, unit: 'ms', priority: 2 },
          ],
          model_lists: [],
          escalation_rules: [],
          evaluation_order: ['cost_constraint', 'latency_constraint', 'model_selection'],
        },
        changed_by: 'ops@example.com',
        change_summary: 'Added cost constraint for high-value requests',
      },
      {
        id: '2',
        timestamp: new Date(Date.now() - 86400000 * 3).toISOString(), // 3 days ago
        version: 4,
        policy: {
          name: 'Default Balanced Policy',
          mode: 'balanced',
          constraints: [
            { type: 'cost', operator: '<', value: 0.03, unit: '$/request', priority: 1 },
            { type: 'latency', operator: '<', value: 3000, unit: 'ms', priority: 2 },
          ],
          model_lists: [
            {
              provider: 'OpenAI',
              allowed_models: ['gpt-4', 'gpt-4-turbo'],
              denied_models: ['gpt-3.5-turbo'],
            },
          ],
          escalation_rules: [],
          evaluation_order: ['cost_constraint', 'latency_constraint', 'model_selection'],
        },
        changed_by: 'admin@example.com',
        change_summary: 'Restricted OpenAI model access and lowered cost threshold',
      },
    ];
    setPolicyHistory(mockHistory);
  }, []);

  // Calculate policy diff
  const calculatePolicyDiff = (oldPolicy: ActivePolicy, newPolicy: ActivePolicy): PolicyDiff[] => {
    const diffs: PolicyDiff[] = [];

    // Compare constraints
    const oldConstraints = JSON.stringify(oldPolicy.constraints.sort((a, b) => a.priority - b.priority));
    const newConstraints = JSON.stringify(newPolicy.constraints.sort((a, b) => a.priority - b.priority));
    if (oldConstraints !== newConstraints) {
      diffs.push({
        field: 'constraints',
        old_value: oldPolicy.constraints,
        new_value: newPolicy.constraints,
        change_type: 'modified',
      });
    }

    // Compare model lists
    const oldModelLists = JSON.stringify(oldPolicy.model_lists);
    const newModelLists = JSON.stringify(newPolicy.model_lists);
    if (oldModelLists !== newModelLists) {
      diffs.push({
        field: 'model_lists',
        old_value: oldPolicy.model_lists,
        new_value: newPolicy.model_lists,
        change_type: 'modified',
      });
    }

    // Compare evaluation order
    const oldEvalOrder = JSON.stringify(oldPolicy.evaluation_order);
    const newEvalOrder = JSON.stringify(newPolicy.evaluation_order);
    if (oldEvalOrder !== newEvalOrder) {
      diffs.push({
        field: 'evaluation_order',
        old_value: oldPolicy.evaluation_order,
        new_value: newPolicy.evaluation_order,
        change_type: 'modified',
      });
    }

    return diffs;
  };

  // Handle policy diff comparison
  const handleCompareWithVersion = (versionId: string) => {
    const version = policyHistory.find(h => h.id === versionId);
    if (!version) return;

    setSelectedPolicyVersion(versionId);
    const diffs = calculatePolicyDiff(version.policy, activePolicy);
    setPolicyDiff(diffs);
    setShowDiffDialog(true);
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="pb-4 border-b border-border-light">
          <h1 className="text-base font-medium text-gray-900 font-inter">
            Your Global Routing Policy
          </h1>
          <p className="text-gray-600 mt-1 font-inter text-xs">
            EscapeVector Mode Active. Even if our control plane is down for 72+ hours, EscapeVector Mode keeps this exact policy running offline.
          </p>
        </div>

        {/* Routing Mode Selection */}
        <Card className="border-border-light shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-medium text-sm">
              <Shield className="h-5 w-5 text-gray-900" />
              Routing Strategy
            </CardTitle>
            <CardDescription className="text-xs">
              Choose how Overture optimizes your requests
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Cost Mode */}
            <div
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                selectedPolicy === 'cost'
                  ? 'bg-beige-primary shadow-sm border-border-light'
                  : 'border-border-light hover:bg-beige-primary'
              }`}
              onClick={() => setSelectedPolicy('cost')}
            >
              <input
                type="radio"
                name="policy"
                value="cost"
                checked={selectedPolicy === 'cost'}
                onChange={(e) => setSelectedPolicy(e.target.value)}
                className="w-3 h-3 accent-gray-900 self-center"
              />
              <div className="flex-1">
                <Label className="text-xs font-medium text-gray-900 cursor-pointer">
                  Cost
                </Label>
                <p className="text-[0.65rem] text-gray-600 mt-0.5">
                  Minimize spend while maintaining acceptable quality
                </p>
              </div>
            </div>

            {/* Balanced Mode (Default) */}
            <div
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                selectedPolicy === 'balanced'
                  ? 'bg-beige-primary shadow-sm border-border-light'
                  : 'border-border-light hover:bg-beige-primary'
              }`}
              onClick={() => setSelectedPolicy('balanced')}
            >
              <input
                type="radio"
                name="policy"
                value="balanced"
                checked={selectedPolicy === 'balanced'}
                onChange={(e) => setSelectedPolicy(e.target.value)}
                className="w-3 h-3 accent-gray-900 self-center"
              />
              <div className="flex-1">
                <Label className="text-xs font-medium text-gray-900 cursor-pointer">
                  Balanced <span className="text-[0.65rem] text-gray-600">(recommended)</span>
                </Label>
                <p className="text-[0.65rem] text-gray-600 mt-0.5">
                  Optimal mix of cost efficiency and response quality
                </p>
              </div>
            </div>

            {/* Quality Mode */}
            <div
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                selectedPolicy === 'quality'
                  ? 'bg-beige-primary shadow-sm border-border-light'
                  : 'border-border-light hover:bg-beige-primary'
              }`}
              onClick={() => setSelectedPolicy('quality')}
            >
              <input
                type="radio"
                name="policy"
                value="quality"
                checked={selectedPolicy === 'quality'}
                onChange={(e) => setSelectedPolicy(e.target.value)}
                className="w-3 h-3 accent-gray-900 self-center"
              />
              <div className="flex-1">
                <Label className="text-xs font-medium text-gray-900 cursor-pointer">
                  Quality
                </Label>
                <p className="text-[0.65rem] text-gray-600 mt-0.5">
                  Prioritize best possible output, cost is secondary
                </p>
              </div>
            </div>

            {/* Custom Mode (Coming Soon) */}
            <div
              className="flex items-start gap-3 p-3 rounded-lg border border-border-light bg-beige-primary opacity-60 cursor-not-allowed"
            >
              <input
                type="radio"
                name="policy"
                value="custom"
                disabled
                className="w-3 h-3 self-center"
              />
              <div className="flex-1">
                <Label className="text-xs font-medium text-gray-600 cursor-not-allowed">
                  Custom <span className="text-[0.65rem]">(coming soon)</span>
                </Label>
                <p className="text-[0.65rem] text-gray-500 mt-0.5">
                  Fine-tune parameters for your specific use case
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Advanced Features */}
        <Card className="border-border-light shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-medium text-sm">
              <Zap className="h-5 w-5 text-gray-900" />
              Advanced Features
            </CardTitle>
            <CardDescription className="text-xs">
              Unlock premium capabilities
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Speculative Execution */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-border-light bg-beige-primary">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Label className="text-xs font-medium text-gray-900">
                    Speculative Execution
                  </Label>
                </div>
                <p className="text-[0.65rem] text-gray-600 mt-0.5">
                  -60% time-to-first-token through parallel execution
                </p>
              </div>
              <Switch className="scale-50" />
            </div>

            {/* Council Mode */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-border-light bg-beige-primary">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Label className="text-xs font-medium text-gray-900">
                    Council Mode
                  </Label>
                </div>
                <p className="text-[0.65rem] text-gray-600 mt-0.5">
                  +15-20% answer quality through multi-model consensus
                </p>
              </div>
              <Switch className="scale-50" />
            </div>

            {/* Cognitive Advisor */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-border-light bg-beige-primary">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Label className="text-xs font-medium text-gray-900">
                    Cognitive Advisor
                  </Label>
                </div>
                <p className="text-[0.65rem] text-gray-600 mt-0.5">
                  Auto-tuning ML layer for continuous optimization
                </p>
              </div>
              <Switch className="scale-50" />
            </div>

            {/* Advanced Routing Rules */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-border-light bg-beige-primary opacity-60">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Label className="text-xs font-medium text-gray-600 cursor-not-allowed">
                    Advanced routing rules <span className="text-[0.65rem]">(coming soon)</span>
                  </Label>
                </div>
                <p className="text-[0.65rem] text-gray-500 mt-0.5">
                  Custom routing logic and conditional forwarding
                </p>
              </div>
              <Switch disabled className="cursor-not-allowed scale-50" />
            </div>
          </CardContent>
        </Card>

        {/* Active Routing Rules & Constraints */}
        <Card className="border-border-light shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-medium text-sm">
              <List className="h-5 w-5 text-gray-900" />
              Active Routing Rules
            </CardTitle>
            <CardDescription className="text-xs">
              Current constraints and evaluation logic
            </CardDescription>
          </CardHeader>
          <CardContent>
            {activePolicy.constraints.length === 0 ? (
              <div className="text-center py-6 text-gray-600 text-xs">
                No explicit constraints configured. Using default {selectedPolicy} mode heuristics.
              </div>
            ) : (
              <div className="space-y-3">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border-light">
                        <th className="text-left py-2 px-3 font-medium text-xs text-gray-600">Priority</th>
                        <th className="text-left py-2 px-3 font-medium text-xs text-gray-600">Type</th>
                        <th className="text-left py-2 px-3 font-medium text-xs text-gray-600">Constraint</th>
                        <th className="text-left py-2 px-3 font-medium text-xs text-gray-600">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activePolicy.constraints
                        .sort((a, b) => a.priority - b.priority)
                        .map((constraint, index) => (
                          <tr key={index} className="border-b border-border-light hover:bg-beige-primary">
                            <td className="py-2 px-3 text-xs text-gray-900">{constraint.priority}</td>
                            <td className="py-2 px-3">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                constraint.type === 'cost' ? 'bg-green-100 text-green-700' :
                                constraint.type === 'latency' ? 'bg-blue-100 text-blue-700' :
                                'bg-purple-100 text-purple-700'
                              }`}>
                                {constraint.type}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-xs text-gray-900">
                              {constraint.type} {constraint.operator} {constraint.value}
                            </td>
                            <td className="py-2 px-3 text-xs text-gray-600">{constraint.unit}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activePolicy.evaluation_order.length > 0 && (
              <div className="mt-4 p-4 bg-beige-primary rounded-lg border border-border-light">
                <h4 className="text-xs font-medium text-gray-900 mb-2">Policy Evaluation Order</h4>
                <div className="flex items-center gap-2 flex-wrap">
                  {activePolicy.evaluation_order.map((step, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <span className="px-3 py-1 bg-beige-secondary rounded border border-border-light text-xs text-gray-900">
                        {index + 1}. {step}
                      </span>
                      {index < activePolicy.evaluation_order.length - 1 && (
                        <span className="text-gray-400">→</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Model Allow/Deny Lists */}
        <Card className="border-border-light shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-medium text-sm">
              <Filter className="h-5 w-5 text-gray-900" />
              Model Access Control
            </CardTitle>
            <CardDescription className="text-xs">
              Allowed and denied models per provider
            </CardDescription>
          </CardHeader>
          <CardContent>
            {activePolicy.model_lists.length === 0 ? (
              <div className="text-center py-6 text-gray-600 text-xs">
                No model restrictions configured. All provider models are available.
              </div>
            ) : (
              <div className="space-y-4">
                {activePolicy.model_lists.map((modelList, index) => (
                  <div key={index} className="border border-border-light rounded-lg p-4 bg-beige-primary">
                    <h4 className="font-medium text-gray-900 mb-3">{modelList.provider}</h4>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs font-medium text-gray-600 mb-2 flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-green-500" />
                          Allowed Models ({modelList.allowed_models.length})
                        </div>
                        <div className="space-y-1">
                          {modelList.allowed_models.length === 0 ? (
                            <div className="text-xs text-gray-500 italic">All models allowed</div>
                          ) : (
                            modelList.allowed_models.map((model, idx) => (
                              <div key={idx} className="text-xs text-gray-900 bg-beige-secondary rounded px-3 py-2 border border-border-light">
                                {model}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-medium text-gray-600 mb-2 flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-red-500" />
                          Denied Models ({modelList.denied_models.length})
                        </div>
                        <div className="space-y-1">
                          {modelList.denied_models.length === 0 ? (
                            <div className="text-xs text-gray-500 italic">No models denied</div>
                          ) : (
                            modelList.denied_models.map((model, idx) => (
                              <div key={idx} className="text-xs text-gray-900 bg-beige-secondary rounded px-3 py-2 border border-border-light line-through opacity-60">
                                {model}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Escalation Logic */}
        <Card className="border-border-light shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-medium text-sm">
              <AlertCircle className="h-5 w-5 text-gray-900" />
              Escalation & Fallback Logic
            </CardTitle>
            <CardDescription className="text-xs">
              Automated responses to failure conditions
            </CardDescription>
          </CardHeader>
          <CardContent>
            {activePolicy.escalation_rules.length === 0 ? (
              <div className="text-center py-6 text-gray-600 text-xs">
                Using default escalation: retry with exponential backoff, then fallback to alternative providers.
              </div>
            ) : (
              <div className="space-y-3">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border-light">
                        <th className="text-left py-2 px-3 font-medium text-xs text-gray-600">Priority</th>
                        <th className="text-left py-2 px-3 font-medium text-xs text-gray-600">Condition</th>
                        <th className="text-left py-2 px-3 font-medium text-xs text-gray-600">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activePolicy.escalation_rules
                        .sort((a, b) => a.priority - b.priority)
                        .map((rule, index) => (
                          <tr key={index} className="border-b border-border-light hover:bg-beige-primary">
                            <td className="py-2 px-3 text-xs text-gray-900">{rule.priority}</td>
                            <td className="py-2 px-3 text-xs text-gray-900 font-mono text-xs">{rule.condition}</td>
                            <td className="py-2 px-3 text-xs text-gray-900">{rule.action}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Policy Diffing */}
        <Card className="border-border-light shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-medium text-sm">
              <GitBranch className="h-5 w-5 text-gray-900" />
              Policy History & Diffing
            </CardTitle>
            <CardDescription className="text-xs">
              Compare current policy with previous versions
            </CardDescription>
          </CardHeader>
          <CardContent>
            {policyHistory.length === 0 ? (
              <div className="text-center py-6 text-gray-600 text-xs">
                No policy history available yet
              </div>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border-light">
                        <th className="text-left py-2 px-3 font-medium text-xs text-gray-600">Version</th>
                        <th className="text-left py-2 px-3 font-medium text-xs text-gray-600">Changed</th>
                        <th className="text-left py-2 px-3 font-medium text-xs text-gray-600">Changed By</th>
                        <th className="text-left py-2 px-3 font-medium text-xs text-gray-600">Summary</th>
                        <th className="text-left py-2 px-3 font-medium text-xs text-gray-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {policyHistory.map((history) => (
                        <tr key={history.id} className="border-b border-border-light hover:bg-beige-primary">
                          <td className="py-2 px-3">
                            <span className="px-2 py-1 bg-beige-primary rounded text-xs font-medium text-gray-900">
                              v{history.version}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-xs text-gray-600 text-xs">
                            <div className="flex items-center gap-2">
                              <Clock className="h-3 w-3" />
                              {new Date(history.timestamp).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="py-2 px-3 text-xs text-gray-900 text">{history.changed_by}</td>
                          <td className="py-2 px-3 text-xs text-gray-600 text-xs">
                            {history.change_summary}
                          </td>
                          <td className="py-2 px-3">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCompareWithVersion(history.id)}
                              className="text-xs flex items-center gap-2"
                            >
                              <GitBranch className="h-3 w-3" />
                              Compare
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button variant="outline" size="sm" className="shadow-sm text-xs">
            Save Policy
          </Button>
        </div>
      </div>

      {/* Policy Diff Dialog */}
      {showDiffDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-5 max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">
                Policy Comparison: Current vs Version {policyHistory.find(h => h.id === selectedPolicyVersion)?.version}
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDiffDialog(false)}
              >
                ×
              </Button>
            </div>

          <div className="space-y-3">
            {policyDiff.length === 0 ? (
              <div className="text-center py-6 text-gray-600">
                <GitBranch className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                <p className="text-xs">No differences found between these versions</p>
              </div>
            ) : (
              <>
                {policyDiff.map((diff, index) => (
                  <div key={index} className="border border-border-light rounded-lg p-3 bg-beige-primary">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`px-1.5 py-0.5 rounded text-[0.65rem] font-medium ${
                        diff.change_type === 'added' ? 'bg-green-100 text-green-700' :
                        diff.change_type === 'removed' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {diff.change_type === 'added' && '+'}
                        {diff.change_type === 'removed' && '-'}
                        {diff.change_type === 'modified' && '~'}
                        {diff.change_type}
                      </div>
                      <span className="font-medium text-xs text-gray-900 capitalize">{diff.field}</span>
                    </div>

                    <div className="grid md:grid-cols-2 gap-3">
                      <div>
                        <h4 className="text-[0.65rem] font-medium text-red-700 mb-1.5">Previous Version</h4>
                        <div className="bg-red-50 border border-red-200 rounded p-2">
                          <pre className="text-[0.65rem] text-red-800 whitespace-pre-wrap">
                            {JSON.stringify(diff.old_value, null, 2)}
                          </pre>
                        </div>
                      </div>
                      <div>
                        <h4 className="text-[0.65rem] font-medium text-green-700 mb-1.5">Current Version</h4>
                        <div className="bg-green-50 border border-green-200 rounded p-2">
                          <pre className="text-[0.65rem] text-green-800 whitespace-pre-wrap">
                            {JSON.stringify(diff.new_value, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}

            <div className="flex pt-3 border-t border-border-light">
              <Button
                variant="outline"
                size="sm"
                className="ml-auto text-xs"
                onClick={() => setShowDiffDialog(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      </div>
    )}
    </DashboardLayout>
  );
}
