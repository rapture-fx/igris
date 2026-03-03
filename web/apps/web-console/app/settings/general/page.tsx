'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { useTenant } from '@/hooks/useTenant';
import { api } from '@/lib/apiClient';
import { formatDate } from '@/utils/helpers';
import { Save, RefreshCw, CheckCircle, Building2, Bell, AlertCircle } from 'lucide-react';

interface NotificationPrefs {
  email_violations: boolean;
  email_alerts: boolean;
  email_weekly_report: boolean;
  webhook_violations: boolean;
  webhook_alerts: boolean;
}

export default function SettingsGeneralPage() {
  const qc = useQueryClient();
  const { data: tenant, isLoading } = useTenant();
  const [orgName, setOrgName] = useState('');
  const [saved, setSaved] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>({
    email_violations: true,
    email_alerts: true,
    email_weekly_report: false,
    webhook_violations: false,
    webhook_alerts: false,
  });

  useEffect(() => {
    if (tenant) setOrgName(tenant.name);
  }, [tenant]);

  const { data: notifData } = useQuery<NotificationPrefs>({
    queryKey: ['notification-prefs'],
    queryFn: () => api.get('/v1/settings/notifications'),
    retry: false,
  });

  useEffect(() => {
    if (notifData) setNotifPrefs(notifData);
  }, [notifData]);

  const orgMutation = useMutation({
    mutationFn: (name: string) => api.patch('/v1/tenant', { name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenant'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const notifMutation = useMutation({
    mutationFn: (prefs: NotificationPrefs) => api.put('/v1/settings/notifications', prefs),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notification-prefs'] }),
  });

  const toggleNotif = (key: keyof NotificationPrefs, val: boolean) => {
    const updated = { ...notifPrefs, [key]: val };
    setNotifPrefs(updated);
    notifMutation.mutate(updated);
  };

  const NOTIF_CONTROLS: Array<{ key: keyof NotificationPrefs; label: string; sub: string }> = [
    { key: 'email_violations', label: 'Email: Policy violations', sub: 'Send email when a violation is recorded' },
    { key: 'email_alerts', label: 'Email: Active alerts', sub: 'Send email when a new alert fires' },
    { key: 'email_weekly_report', label: 'Email: Weekly digest', sub: 'Summary of executions, violations, and spend' },
    { key: 'webhook_violations', label: 'Webhook: Violations', sub: 'POST to configured webhook on violation' },
    { key: 'webhook_alerts', label: 'Webhook: Alerts', sub: 'POST to configured webhook on alert' },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-5 max-w-2xl">
        <div>
          <h1 className="text-base font-semibold text-gray-900">General</h1>
          <p className="text-xs text-gray-500 mt-0.5">Organization profile and notification preferences.</p>
        </div>

        {/* Organization Profile */}
        <Card className="border border-gray-200">
          <CardHeader className="px-5 pt-4 pb-3">
            <CardTitle className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
              <Building2 className="h-4 w-4 text-gray-400" /> Organization
            </CardTitle>
          </CardHeader>
          <Separator />
          <CardContent className="px-5 py-5 space-y-4">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-9 w-full" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4 text-xs text-gray-500">
                  <div>
                    <span className="block text-gray-400 mb-0.5">Tenant ID</span>
                    <span className="font-mono text-gray-600">{tenant?.id ?? '—'}</span>
                  </div>
                  <div>
                    <span className="block text-gray-400 mb-0.5">Status</span>
                    <StatusBadge status={(tenant?.status ?? 'active').toUpperCase()} />
                  </div>
                  <div>
                    <span className="block text-gray-400 mb-0.5">Plan</span>
                    <span className="text-gray-700 font-medium">{tenant?.plan ?? '—'}</span>
                  </div>
                  <div>
                    <span className="block text-gray-400 mb-0.5">Created</span>
                    <span className="text-gray-700">{tenant?.created_at ? formatDate(tenant.created_at) : '—'}</span>
                  </div>
                </div>

                <Separator />

                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-700 font-medium">Organization Name</Label>
                  <div className="flex gap-2">
                    <Input
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      className="h-8 text-sm"
                      placeholder="Organization name"
                    />
                    <Button
                      size="sm"
                      className="h-8 text-xs gap-1.5 flex-shrink-0"
                      onClick={() => orgMutation.mutate(orgName)}
                      disabled={orgMutation.isPending || orgName === tenant?.name}
                    >
                      {saved ? (
                        <><CheckCircle className="h-3.5 w-3.5" /> Saved</>
                      ) : orgMutation.isPending ? (
                        <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Saving...</>
                      ) : (
                        <><Save className="h-3.5 w-3.5" /> Save</>
                      )}
                    </Button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-700 font-medium">Contact Email</Label>
                  <Input
                    value={tenant?.email ?? ''}
                    readOnly
                    disabled
                    className="h-8 text-sm opacity-60"
                  />
                  <p className="text-[11px] text-gray-400">Contact support to change the account email.</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card className="border border-gray-200">
          <CardHeader className="px-5 pt-4 pb-3">
            <CardTitle className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
              <Bell className="h-4 w-4 text-gray-400" /> Notifications
            </CardTitle>
          </CardHeader>
          <Separator />
          <CardContent className="px-5 py-0 divide-y divide-gray-100">
            {NOTIF_CONTROLS.map((ctrl) => (
              <div key={ctrl.key} className="flex items-center justify-between py-3.5">
                <div>
                  <p className="text-xs font-medium text-gray-800">{ctrl.label}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{ctrl.sub}</p>
                </div>
                <Switch
                  checked={notifPrefs[ctrl.key]}
                  onCheckedChange={(val) => toggleNotif(ctrl.key, val)}
                  disabled={notifMutation.isPending}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border border-red-100">
          <CardHeader className="px-5 pt-4 pb-3">
            <CardTitle className="text-sm font-medium text-red-700 flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4" /> Danger Zone
            </CardTitle>
          </CardHeader>
          <Separator />
          <CardContent className="px-5 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-800">Delete organization</p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Permanently remove this organization and all associated data.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
              >
                Delete
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
