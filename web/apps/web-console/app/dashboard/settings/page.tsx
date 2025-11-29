'use client';

export const dynamic = 'force-dynamic';
import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  UserPlus,
  Key,
  Webhook,
  Receipt,
} from 'lucide-react';

export default function SettingsPage() {
  const router = useRouter();
  const { data: tenant, isLoading } = useTenant();
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const [emailNotifications, setEmailNotifications] = useState(true);
  const [usageAlerts, setUsageAlerts] = useState(true);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [slackWebhook, setSlackWebhook] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');

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

        {/* Tabs */}
        <Tabs defaultValue="team">
          <TabsList>
            <TabsTrigger value="team">Team</TabsTrigger>
            <TabsTrigger value="billing">Billing</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
          </TabsList>

          {/* Team Tab */}
          <TabsContent value="team" className="space-y-6">
            {/* Invite Member */}
            <Card className="border-border-light shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-gray-900" />
                  Invite Team Member
                </CardTitle>
                <CardDescription>
                  Add new members to your team
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3">
                  <Input
                    type="email"
                    placeholder="colleague@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="flex-1"
                  />
                  <Button variant="outline" className="shadow-md">
                    Send Invite
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Team Members */}
            <Card className="border-border-light shadow-md">
              <CardHeader>
                <CardTitle>Team Members</CardTitle>
                <CardDescription>Manage your team members and their roles</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 rounded-lg border border-border-light bg-white">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-900 text-white font-semibold text-sm">
                        {tenant ? getInitials(tenant.name) : 'U'}
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900 font-inter">{tenant?.name}</h3>
                        <p className="text-sm text-gray-600">{tenant?.email}</p>
                      </div>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                      Owner
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Billing Tab */}
          <TabsContent value="billing" className="space-y-6">
            {/* Current Plan */}
            <Card className="border-border-light shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-gray-900" />
                  Current Plan
                </CardTitle>
                <CardDescription>
                  Your subscription details
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-2xl font-bold text-gray-900 font-inter">
                        {tenant?.plan || 'Free'} Plan
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Active since {tenant?.created_at ? formatDate(tenant.created_at) : 'N/A'}
                      </p>
                    </div>
                    <Button variant="outline" className="shadow-md">
                      Upgrade Plan
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Payment Method */}
            <Card className="border-border-light shadow-md">
              <CardHeader>
                <CardTitle>Payment Method</CardTitle>
                <CardDescription>Manage your payment methods</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 font-inter mb-4">
                    No payment method added
                  </p>
                  <Button variant="outline" className="shadow-md">
                    Add Payment Method
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Invoices */}
            <Card className="border-border-light shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-gray-900" />
                  Invoices
                </CardTitle>
                <CardDescription>Download your billing history</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <Receipt className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 font-inter">
                    No invoices yet
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-6">
            {/* Two-Factor Authentication */}
            <Card className="border-border-light shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-gray-900" />
                  Two-Factor Authentication
                </CardTitle>
                <CardDescription>
                  Add an extra layer of security to your account
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-3 rounded-lg border border-border-light">
                  <div className="space-y-0.5">
                    <Label htmlFor="twoFactor" className="text-base font-medium">
                      Enable 2FA
                    </Label>
                    <p className="text-sm text-gray-600">
                      Require authentication code in addition to password
                    </p>
                  </div>
                  <Switch
                    id="twoFactor"
                    checked={twoFactorEnabled}
                    onCheckedChange={setTwoFactorEnabled}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Active Sessions */}
            <Card className="border-border-light shadow-md">
              <CardHeader>
                <CardTitle>Active Sessions</CardTitle>
                <CardDescription>Manage your active login sessions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 rounded-lg border border-border-light bg-white">
                    <div>
                      <h3 className="font-medium text-gray-900 font-inter">Current Session</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Started {formatDate(new Date().toISOString())}
                      </p>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                      Active
                    </span>
                  </div>
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
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-6">
            {/* Email Notifications */}
            <Card className="border-border-light shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-gray-900" />
                  Email Notifications
                </CardTitle>
                <CardDescription>
                  Manage your email notification preferences
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

            {/* Slack Integration */}
            <Card className="border-border-light shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Webhook className="h-5 w-5 text-gray-900" />
                  Slack Integration
                </CardTitle>
                <CardDescription>
                  Receive notifications in Slack
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="slackWebhook">Webhook URL</Label>
                    <Input
                      id="slackWebhook"
                      type="url"
                      placeholder="https://hooks.slack.com/services/..."
                      value={slackWebhook}
                      onChange={(e) => setSlackWebhook(e.target.value)}
                    />
                    <p className="text-xs text-gray-600">
                      Enter your Slack webhook URL to receive notifications
                    </p>
                  </div>
                  <Button variant="outline" className="shadow-md">
                    Save Webhook
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
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
