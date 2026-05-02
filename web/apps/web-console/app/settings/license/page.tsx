'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { StatusBadge } from '@/components/ui/status-badge';
import { useTenant } from '@/hooks/useTenant';
import { api } from '@/lib/apiClient';
import { formatDate } from '@/utils/helpers';
import { FileKey, TrendingUp, RefreshCw, CheckCircle, AlertCircle, Zap } from 'lucide-react';

interface LicenseInfo {
  license_key: string;
  masked_key: string;
  plan: string;
  status: string;
  valid_until?: string;
  quota_requests: number;
  quota_used: number;
  quota_devices: number;
  quota_devices_used: number;
  features: string[];
}

// Maps every API-returned plan key (current + legacy) to a display name.
const PLAN_DISPLAY_NAMES: Record<string, string> = {
  // Current keys
  free: 'Seed', Free: 'Seed',
  seed: 'Seed', Seed: 'Seed',
  horizon: 'Horizon', Horizon: 'Horizon',
  infinite: 'Infinite', Infinite: 'Infinite',
  enterprise: 'Enterprise', Enterprise: 'Enterprise',
  // Legacy keys (Trial → Seed, Develop/Growth → Horizon, Scale → Infinite)
  trial: 'Seed', Trial: 'Seed',
  develop: 'Horizon', Develop: 'Horizon',
  growth: 'Horizon', Growth: 'Horizon',
  scale: 'Infinite', Scale: 'Infinite',
};

const PLAN_FEATURES: Record<string, string[]> = {
  Seed:       ['Core deterministic runtime', 'Local + cloud routing', 'Offline survival', 'Cryptographic signing', '7-day retention', 'Community support'],
  Horizon:    ['Up to 50 instances', 'Fleet dashboard', 'OTA verified updates', '30-day retention', 'Email support (24h)'],
  Infinite:   ['Up to 500 instances', 'On-premise deployment', 'SLO enforcement', '90-day retention', 'Priority support (8h)'],
  Enterprise: ['Unlimited instances', 'Dedicated infrastructure', 'Custom SLOs', 'Unlimited retention', 'Dedicated support'],
};

export default function SettingsLicensePage() {
  const { data: tenant, isLoading: tenantLoading } = useTenant();
  const [licenseInput, setLicenseInput] = useState('');
  const [activateResult, setActivateResult] = useState<'success' | 'error' | null>(null);

  const { data: license, isLoading: licenseLoading } = useQuery<LicenseInfo>({
    queryKey: ['license-info'],
    queryFn: () => api.get('/v1/license'),
    retry: false,
  });

  const activateMutation = useMutation({
    mutationFn: (key: string) => api.post('/v1/license/activate', { license_key: key }),
    onSuccess: () => {
      setActivateResult('success');
      setLicenseInput('');
      setTimeout(() => setActivateResult(null), 3000);
    },
    onError: () => {
      setActivateResult('error');
      setTimeout(() => setActivateResult(null), 3000);
    },
  });

  const isLoading = tenantLoading || licenseLoading;
  const planKey = tenant?.plan ?? license?.plan ?? 'seed';
  const plan = PLAN_DISPLAY_NAMES[planKey] ?? PLAN_DISPLAY_NAMES[planKey?.toLowerCase()] ?? planKey;
  const quotaPercent = license
    ? Math.round((license.quota_used / Math.max(license.quota_requests, 1)) * 100)
    : 0;
  const devicesPercent = license
    ? Math.round((license.quota_devices_used / Math.max(license.quota_devices, 1)) * 100)
    : 0;

  return (
    <DashboardLayout>
      <div className="space-y-5 max-w-2xl">
        <div>
          <h1 className="text-base font-semibold text-gray-900">License</h1>
          <p className="text-xs text-gray-500 mt-0.5">Plan, license key, and quota usage.</p>
        </div>

        {/* Current Plan */}
        <Card className="border border-gray-200">
          <CardHeader className="px-5 pt-4 pb-3">
            <CardTitle className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
              <Zap className="h-4 w-4 text-gray-400" /> Current Plan
            </CardTitle>
          </CardHeader>
          <Separator />
          <CardContent className="px-5 py-4">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-4 w-48" />
              </div>
            ) : !license && !tenant ? (
              <div className="py-4 space-y-2">
                <p className="text-sm text-gray-600">No active license. Activate a license key to unlock verified execution controls.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-base font-semibold text-gray-900">{plan}</span>
                  <StatusBadge status={(tenant?.status ?? 'active').toUpperCase()} />
                </div>

                {license?.valid_until && (
                  <p className="text-xs text-gray-500">
                    Valid until <span className="text-gray-700 font-medium">{formatDate(license.valid_until)}</span>
                  </p>
                )}

                {/* Features list */}
                <div className="grid grid-cols-2 gap-1.5">
                  {(PLAN_FEATURES[plan] ?? PLAN_FEATURES['Seed']).map((feat) => (
                    <div key={feat} className="flex items-center gap-1.5 text-xs text-gray-600">
                      <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />
                      {feat}
                    </div>
                  ))}
                </div>

                <Separator />

                {/* Quota Usage */}
                <div className="space-y-3">
                  <p className="text-xs font-medium text-gray-700">Quota Usage</p>
                  <div className="space-y-2">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-500">Requests</span>
                        <span className="text-gray-700 tabular-nums">
                          {license ? `${license.quota_used.toLocaleString()} / ${license.quota_requests.toLocaleString()}` : '—'}
                        </span>
                      </div>
                      <Progress value={quotaPercent} className={quotaPercent > 90 ? '[&>div]:bg-red-500' : ''} />
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-500">Devices</span>
                        <span className="text-gray-700 tabular-nums">
                          {license ? `${license.quota_devices_used} / ${license.quota_devices}` : '—'}
                        </span>
                      </div>
                      <Progress value={devicesPercent} className={devicesPercent > 90 ? '[&>div]:bg-red-500' : ''} />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* License Key */}
        <Card className="border border-gray-200">
          <CardHeader className="px-5 pt-4 pb-3">
            <CardTitle className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
              <FileKey className="h-4 w-4 text-gray-400" /> License Key
            </CardTitle>
          </CardHeader>
          <Separator />
          <CardContent className="px-5 py-4 space-y-4">
            {/* Current key */}
            {license?.masked_key && (
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-500">Active Key</Label>
                <div className="bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
                  <p className="text-xs text-gray-600">{license.masked_key}</p>
                </div>
              </div>
            )}

            {/* Activate new key */}
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-700 font-medium">Activate New Key</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="igris-lic-xxxxxxxx..."
                  value={licenseInput}
                  onChange={(e) => setLicenseInput(e.target.value)}
                  className="h-8 text-xs flex-1"
                  onKeyDown={(e) => e.key === 'Enter' && licenseInput.trim() && activateMutation.mutate(licenseInput.trim())}
                />
                <Button
                  size="sm"
                  className="h-8 text-xs gap-1.5 flex-shrink-0"
                  onClick={() => licenseInput.trim() && activateMutation.mutate(licenseInput.trim())}
                  disabled={!licenseInput.trim() || activateMutation.isPending}
                >
                  {activateMutation.isPending ? (
                    <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Activating...</>
                  ) : (
                    'Activate'
                  )}
                </Button>
              </div>

              {activateResult === 'success' && (
                <div className="flex items-center gap-1.5 text-xs text-green-600">
                  <CheckCircle className="h-3.5 w-3.5" /> License activated successfully.
                </div>
              )}
              {activateResult === 'error' && (
                <div className="flex items-center gap-1.5 text-xs text-red-600">
                  <AlertCircle className="h-3.5 w-3.5" /> Invalid or expired license key.
                </div>
              )}
            </div>

            <p className="text-xs text-gray-400">
              License keys are issued through your billing account.{' '}
              <a
                href="https://igrisinertial.com/pricing"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:text-blue-600"
              >
                View plans →
              </a>
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
