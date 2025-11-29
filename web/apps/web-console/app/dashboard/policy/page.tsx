'use client';

export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { usePolicy, useUpdatePolicy } from '@/hooks/usePolicy';
import { Shield, Save, AlertCircle, Loader2, CheckCircle } from 'lucide-react';
import { PROVIDERS } from '@/utils/constants';

export default function PolicyPage() {
  const { data: policy, isLoading } = usePolicy();
  const updatePolicyMutation = useUpdatePolicy();

  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [formData, setFormData] = useState({
    max_monthly_cost: 0,
    max_tokens_per_request: 0,
    enable_auto_fallback: false,
    allowed_providers: [] as string[],
    rate_limit_per_minute: 0,
    enable_caching: false,
  });

  useEffect(() => {
    if (policy) {
      setFormData({
        max_monthly_cost: policy.max_monthly_cost,
        max_tokens_per_request: policy.max_tokens_per_request,
        enable_auto_fallback: policy.enable_auto_fallback,
        allowed_providers: policy.allowed_providers,
        rate_limit_per_minute: policy.rate_limit_per_minute || 0,
        enable_caching: policy.enable_caching || false,
      });
    }
  }, [policy]);

  const handleProviderToggle = (providerId: string) => {
    setFormData((prev) => ({
      ...prev,
      allowed_providers: prev.allowed_providers.includes(providerId)
        ? prev.allowed_providers.filter((p) => p !== providerId)
        : [...prev.allowed_providers, providerId],
    }));
  };

  const handleSave = async () => {
    await updatePolicyMutation.mutateAsync(formData);
    setShowSaveDialog(false);
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-12 w-12 animate-spin text-schlep-blue" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 font-inter">
              Routing Policies
            </h1>
            <p className="text-gray-600 mt-1 font-inter">
              Manage your usage limits and safety policies
            </p>
          </div>
          <Button onClick={() => setShowSaveDialog(true)}>
            <Save className="mr-2 h-4 w-4" />
            Save Changes
          </Button>
        </div>

        {/* Budget Limits */}
        <Card className="border-border-light shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-schlep-blue" />
              Budget Limits
            </CardTitle>
            <CardDescription>
              Set spending limits to control costs
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="maxMonthlyCost">Max Monthly Cost (USD)</Label>
                <Input
                  id="maxMonthlyCost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.max_monthly_cost}
                  onChange={(e) =>
                    setFormData({ ...formData, max_monthly_cost: parseFloat(e.target.value) })
                  }
                  placeholder="500.00"
                  className="bg-beige-primary"
                />
                <p className="text-xs text-gray-600">
                  Requests will be rejected when this limit is reached
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxTokens">Max Tokens Per Request</Label>
                <Input
                  id="maxTokens"
                  type="number"
                  min="0"
                  value={formData.max_tokens_per_request}
                  onChange={(e) =>
                    setFormData({ ...formData, max_tokens_per_request: parseInt(e.target.value) })
                  }
                  placeholder="4096"
                  className="bg-beige-primary"
                />
                <p className="text-xs text-gray-600">
                  Maximum tokens allowed per inference request
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Rate Limiting */}
        <Card className="border-border-light shadow-md">
          <CardHeader>
            <CardTitle>Rate Limiting</CardTitle>
            <CardDescription>
              Control request throughput
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="rateLimit">Requests Per Minute</Label>
              <Input
                id="rateLimit"
                type="number"
                min="0"
                value={formData.rate_limit_per_minute}
                onChange={(e) =>
                  setFormData({ ...formData, rate_limit_per_minute: parseInt(e.target.value) })
                }
                placeholder="60"
                className="bg-beige-primary"
              />
              <p className="text-xs text-gray-600">
                Maximum requests allowed per minute (0 = unlimited)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Provider Configuration */}
        <Card className="border-border-light shadow-md">
          <CardHeader>
            <CardTitle>Allowed Providers</CardTitle>
            <CardDescription>
              Select which LLM providers can be used
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {PROVIDERS.map((provider) => (
                <div
                  key={provider.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border-light hover:bg-beige-secondary transition-colors"
                >
                  <div>
                    <h3 className="font-medium text-gray-900 font-inter">
                      {provider.name}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {provider.id}
                    </p>
                  </div>
                  <Switch
                    checked={formData.allowed_providers.includes(provider.id)}
                    onCheckedChange={() => handleProviderToggle(provider.id)}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Advanced Options */}
        <Card className="border-border-light shadow-md">
          <CardHeader>
            <CardTitle>Advanced Options</CardTitle>
            <CardDescription>
              Configure advanced features
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-3 rounded-lg border border-border-light">
              <div className="space-y-0.5">
                <Label htmlFor="autoFallback" className="text-base font-medium">
                  Auto-Fallback
                </Label>
                <p className="text-sm text-gray-600">
                  Automatically switch to backup provider on failure
                </p>
              </div>
              <Switch
                id="autoFallback"
                checked={formData.enable_auto_fallback}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, enable_auto_fallback: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border border-border-light">
              <div className="space-y-0.5">
                <Label htmlFor="caching" className="text-base font-medium">
                  Response Caching
                </Label>
                <p className="text-sm text-gray-600">
                  Cache similar requests to reduce costs
                </p>
              </div>
              <Switch
                id="caching"
                checked={formData.enable_caching}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, enable_caching: checked })
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Warning Notice */}
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <div className="flex-shrink-0">
                <AlertCircle className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <h3 className="font-medium text-yellow-900 font-inter mb-1">
                  Policy Changes Take Effect Immediately
                </h3>
                <p className="text-sm text-yellow-700 font-inter">
                  Changes to your policy configuration will be applied to all new requests immediately.
                  Ongoing requests will continue with the previous policy.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Save Confirmation Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Policy Changes</DialogTitle>
            <DialogDescription>
              Are you sure you want to update your policy configuration? Changes will take effect immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span>Max Monthly Cost: ${formData.max_monthly_cost}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span>Max Tokens: {formData.max_tokens_per_request}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span>Auto-Fallback: {formData.enable_auto_fallback ? 'Enabled' : 'Disabled'}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span>Allowed Providers: {formData.allowed_providers.length}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={updatePolicyMutation.isPending}>
              {updatePolicyMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save Policy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
