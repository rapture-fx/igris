'use client';

export const dynamic = 'force-dynamic';
import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { useTenant } from '@/hooks/useTenant';
import { logout } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { formatDate, getInitials } from '@/utils/helpers';
import {
  Settings as SettingsIcon,
  User,
  Building2,
  Calendar,
  CreditCard,
  Bell,
  Shield,
  LogOut,
  Trash2,
  Loader2,
} from 'lucide-react';

export default function SettingsPage() {
  const router = useRouter();
  const { data: tenant, isLoading } = useTenant();
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const [testMode, setTestMode] = useState(false);
  const [benchmarkMode, setBenchmarkMode] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [usageAlerts, setUsageAlerts] = useState(true);

  const handleLogout = async () => {
    await logout();
    router.push('/auth/login');
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-12 w-12 animate-spin text-gray-900" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl font-medium text-gray-900 font-inter">
            Settings
          </h1>
          <p className="text-gray-600 mt-1 font-inter">
            Manage your account and preferences
          </p>
        </div>

        {/* Account Information */}
        <Card className="border-border-light shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-gray-900" />
              Account Information
            </CardTitle>
            <CardDescription>
              Your tenant account details
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Tenant Avatar and Name */}
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-16 h-16 rounded-full bg-gray-900 text-white font-bold text-xl">
                  {tenant ? getInitials(tenant.name) : 'U'}
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 font-inter">
                    {tenant?.name}
                  </h3>
                  <p className="text-sm text-gray-600">{tenant?.email}</p>
                </div>
              </div>

              {/* Account Details Grid */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="p-4 rounded-lg border border-border-light bg-beige-secondary">
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 className="h-4 w-4 text-gray-600" />
                    <span className="text-sm font-medium text-gray-600">Tenant ID</span>
                  </div>
                  <p className="text-sm font-mono text-gray-900">{tenant?.id}</p>
                </div>

                <div className="p-4 rounded-lg border border-border-light bg-beige-secondary">
                  <div className="flex items-center gap-2 mb-2">
                    <CreditCard className="h-4 w-4 text-gray-600" />
                    <span className="text-sm font-medium text-gray-600">Plan</span>
                  </div>
                  <p className="text-sm font-semibold text-gray-900">
                    {tenant?.plan || 'Free'} Plan
                  </p>
                </div>

                <div className="p-4 rounded-lg border border-border-light bg-beige-secondary">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="h-4 w-4 text-gray-600" />
                    <span className="text-sm font-medium text-gray-600">Created</span>
                  </div>
                  <p className="text-sm text-gray-900">
                    {tenant?.created_at ? formatDate(tenant.created_at) : 'N/A'}
                  </p>
                </div>

                <div className="p-4 rounded-lg border border-border-light bg-beige-secondary">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="h-4 w-4 text-gray-600" />
                    <span className="text-sm font-medium text-gray-600">Status</span>
                  </div>
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      tenant?.status === 'active'
                        ? 'bg-green-100 text-green-700'
                        : tenant?.status === 'disabled'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}
                  >
                    {tenant?.status}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Operational Settings */}
        <Card className="border-border-light shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SettingsIcon className="h-5 w-5 text-gray-900" />
              Operational Settings
            </CardTitle>
            <CardDescription>
              Configure operational modes and toggles
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg border border-border-light">
              <div className="space-y-0.5">
                <Label htmlFor="testMode" className="text-base font-medium">
                  Test Mode
                </Label>
                <p className="text-sm text-gray-600">
                  Use test credentials and sandbox environment
                </p>
              </div>
              <Switch
                id="testMode"
                checked={testMode}
                onCheckedChange={setTestMode}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border border-border-light">
              <div className="space-y-0.5">
                <Label htmlFor="benchmarkMode" className="text-base font-medium">
                  Benchmark Mode
                </Label>
                <p className="text-sm text-gray-600">
                  Enable detailed performance metrics collection
                </p>
              </div>
              <Switch
                id="benchmarkMode"
                checked={benchmarkMode}
                onCheckedChange={setBenchmarkMode}
              />
            </div>
          </CardContent>
        </Card>

        {/* Notification Preferences */}
        <Card className="border-border-light shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-gray-900" />
              Notifications
            </CardTitle>
            <CardDescription>
              Manage your notification preferences
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg border border-border-light">
              <div className="space-y-0.5">
                <Label htmlFor="emailNotifications" className="text-base font-medium">
                  Email Notifications
                </Label>
                <p className="text-sm text-gray-600">
                  Receive updates via email
                </p>
              </div>
              <Switch
                id="emailNotifications"
                checked={emailNotifications}
                onCheckedChange={setEmailNotifications}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border border-border-light">
              <div className="space-y-0.5">
                <Label htmlFor="usageAlerts" className="text-base font-medium">
                  Usage Alerts
                </Label>
                <p className="text-sm text-gray-600">
                  Get notified when approaching budget limits
                </p>
              </div>
              <Switch
                id="usageAlerts"
                checked={usageAlerts}
                onCheckedChange={setUsageAlerts}
              />
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-red-200 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700">
              <Shield className="h-5 w-5" />
              Danger Zone
            </CardTitle>
            <CardDescription>
              Irreversible and destructive actions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg border border-red-200 bg-red-50">
              <div>
                <h3 className="font-medium text-red-900 font-inter">
                  Sign Out All Sessions
                </h3>
                <p className="text-sm text-red-700 mt-1">
                  Sign out from all devices and revoke all active sessions
                </p>
              </div>
              <Button
                variant="destructive"
                onClick={() => setShowLogoutDialog(true)}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out All
              </Button>
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg border border-red-200 bg-red-50">
              <div>
                <h3 className="font-medium text-red-900 font-inter">
                  Delete Account
                </h3>
                <p className="text-sm text-red-700 mt-1">
                  Permanently delete your account and all associated data
                </p>
              </div>
              <Button
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Account
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Logout Confirmation Dialog */}
      <Dialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign Out All Sessions</DialogTitle>
            <DialogDescription>
              This will sign you out from all devices and revoke all active sessions.
              You'll need to sign in again on all devices.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLogoutDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Account Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Account</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete your account,
              all API keys, usage data, and remove all configurations.
            </DialogDescription>
          </DialogHeader>
          <div className="p-4 rounded-lg bg-red-50 border border-red-200">
            <p className="text-sm text-red-900 font-medium">
              Are you absolutely sure? This action is irreversible.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
