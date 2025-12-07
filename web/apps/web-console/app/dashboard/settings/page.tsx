'use client';

export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
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
import { formatDate, getInitials, formatCurrency } from '@/utils/helpers';
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
  Users,
  Plus,
  CheckCircle,
  XCircle,
  Edit,
} from 'lucide-react';

export default function SettingsPage() {
  const router = useRouter();
  const { data: tenant, isLoading } = useTenant();
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const [emailNotifications, setEmailNotifications] = useState(true);
  const [usageAlerts, setUsageAlerts] = useState(true);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [is2FALoading, setIs2FALoading] = useState(false);
  const [slackWebhook, setSlackWebhook] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [globalBudget, setGlobalBudget] = useState('50000');
  const [hardCapEnabled, setHardCapEnabled] = useState(false);

  // Mock current usage
  const currentSpend = 18427;
  const budgetNumber = parseFloat(globalBudget) || 0;
  const budgetPercentage = budgetNumber > 0 ? (currentSpend / budgetNumber) * 100 : 0;

  // Fetch 2FA status on mount
  useEffect(() => {
    const fetch2FAStatus = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081';
        const response = await fetch(`${apiUrl}/v1/auth/2fa/status`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setTwoFactorEnabled(data.enabled || false);
        }
      } catch (error) {
        console.error('Error fetching 2FA status:', error);
      }
    };

    if (tenant?.id) {
      fetch2FAStatus();
    }
  }, [tenant?.id]);

  // Handle 2FA toggle
  const handle2FAToggle = async (enabled: boolean) => {
    setIs2FALoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081';

      if (enabled) {
        // Generate secret first
        const generateResponse = await fetch(`${apiUrl}/v1/auth/2fa/generate`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          },
        });

        if (!generateResponse.ok) throw new Error('Failed to generate 2FA secret');

        const { secret, qr_code_url } = await generateResponse.json();

        // Prompt user for verification code
        const code = prompt('Enter the 6-digit code from your authenticator app:');
        if (!code) {
          setIs2FALoading(false);
          return;
        }

        // Enable 2FA
        const enableResponse = await fetch(`${apiUrl}/v1/auth/2fa/enable`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ secret, code }),
        });

        if (!enableResponse.ok) {
          throw new Error('Invalid verification code');
        }

        setTwoFactorEnabled(true);
        alert('2FA enabled successfully');
      } else {
        // Disable 2FA
        const code = prompt('Enter your 6-digit 2FA code to disable:');
        if (!code) {
          setIs2FALoading(false);
          return;
        }

        const response = await fetch(`${apiUrl}/v1/auth/2fa/disable`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code }),
        });

        if (!response.ok) {
          throw new Error('Invalid 2FA code');
        }

        setTwoFactorEnabled(false);
        alert('2FA disabled successfully');
      }
    } catch (error) {
      console.error('Error toggling 2FA:', error);
      alert('Failed to update 2FA: ' + (error as Error).message);
      setTwoFactorEnabled(!enabled);
    } finally {
      setIs2FALoading(false);
    }
  };

  // Handle plan upgrade
  const handlePlanUpgrade = async () => {
    if (!confirm('Redirect to billing portal to change your plan?')) {
      return;
    }

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081';
      const response = await fetch(`${apiUrl}/v1/billing/portal`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) throw new Error('Failed to create billing portal session');

      const { url } = await response.json();
      window.location.href = url;
    } catch (error) {
      console.error('Error creating billing portal:', error);
      alert('Failed to open billing portal. Please contact support.');
    }
  };

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
        <Tabs defaultValue="notifications">
          <TabsList className="shadow-md border border-border-light mb-6">
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="billing">Billing</TabsTrigger>
            <TabsTrigger value="team">Team</TabsTrigger>
            <TabsTrigger value="tenants">Clients & Tenants</TabsTrigger>
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
                  <div className="flex items-center justify-between p-4 rounded-lg border border-border-light bg-beige-secondary">
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

          {/* Tenants Tab */}
          <TabsContent value="tenants" className="space-y-6">
            <Card className="border-border-light shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-gray-900" />
                  Clients & Tenants
                </CardTitle>
                <CardDescription>
                  Create isolated tenants for customers, environments, or teams
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-6 rounded-lg bg-gradient-to-br from-beige-primary to-beige-secondary border border-border-light">
                    <div className="flex items-start gap-4">
                      <Building2 className="h-8 w-8 text-gray-900 flex-shrink-0" />
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 font-inter mb-2">
                          Enterprise Multi-Tenancy
                        </h3>
                        <p className="text-sm text-gray-700 mb-4">
                          Create isolated tenant environments with complete data separation, independent budgets, and dedicated observability.
                        </p>
                        <div className="grid gap-2 text-sm text-gray-600 mb-4">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <span>AES-256 encrypted key storage per tenant</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <span>Database-level data isolation (RLS)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <span>Independent budget caps & enforcement</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <span>Separate observability & audit logs</span>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          className="shadow-md"
                          onClick={() => router.push('/dashboard/settings/tenants')}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Manage Tenants
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                    <p className="text-sm text-blue-900 font-medium mb-1">
                      Available on Scale plan
                    </p>
                    <p className="text-xs text-blue-800">
                      Unlimited multi-tenancy with full data isolation, per-tenant budgets, and 90-day trace retention.
                    </p>
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
                      <div className="flex items-center gap-3">
                        <h3 className="text-2xl font-bold text-gray-900 font-inter">
                          {tenant?.plan || 'Develop'} Plan
                        </h3>
                        {tenant?.metadata?.trial_active && (
                          <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                            Trial Active
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-900 font-medium mt-2">
                        {tenant?.metadata?.trial_active ? (
                          <>
                            14-day {tenant?.plan || 'Develop'} trial · Ends in {tenant?.metadata?.trial_days_left || 'N/A'} days
                          </>
                        ) : (
                          <>
                            {tenant?.plan === 'Develop' && '$149/month'}
                            {tenant?.plan === 'Growth' && '$899/month'}
                            {tenant?.plan === 'Scale' && '$2,999/month'}
                          </>
                        )}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        Active since {tenant?.created_at ? formatDate(tenant.created_at) : 'N/A'}
                      </p>
                    </div>
                    <Button variant="outline" className="shadow-md" onClick={handlePlanUpgrade}>
                      {tenant?.metadata?.trial_active ? 'Upgrade Now' : 'Change Plan'}
                    </Button>
                  </div>

                  {tenant?.metadata?.trial_active && (
                    <div className="mt-4 p-4 rounded-lg bg-blue-50 border border-blue-200">
                      <p className="text-sm text-blue-900 font-medium mb-2">
                        Your trial includes full {tenant?.plan || 'Develop'} tier access
                      </p>
                      <p className="text-xs text-blue-800">
                        After your trial ends, you'll be automatically downgraded to Develop tier unless you add a payment method.
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Global Monthly Budget */}
            <Card className="border-border-light shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-gray-900" />
                  Global Monthly Budget
                </CardTitle>
                <CardDescription>
                  Set a spending limit across all requests
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="globalBudget">
                    Monthly Budget Limit (USD)
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600">$</span>
                    <Input
                      id="globalBudget"
                      type="number"
                      value={globalBudget}
                      onChange={(e) => setGlobalBudget(e.target.value)}
                      className="pl-7"
                      placeholder="50000"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border border-border-light">
                  <div className="space-y-0.5">
                    <Label htmlFor="hardCap" className="text-base font-medium">
                      Hard cap — block all requests at 100%
                    </Label>
                    <p className="text-sm text-gray-600">
                      When enabled, all requests will be blocked once the budget is exhausted
                    </p>
                  </div>
                  <Switch
                    id="hardCap"
                    checked={hardCapEnabled}
                    onCheckedChange={setHardCapEnabled}
                  />
                </div>

                {/* Current Usage Bar */}
                <div className="space-y-3 p-4 rounded-lg bg-beige-secondary border border-border-light">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-900">Current Month Usage</span>
                    <span className="font-medium text-gray-900">
                      {formatCurrency(currentSpend)} / {formatCurrency(budgetNumber)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        budgetPercentage >= 90
                          ? 'bg-red-600'
                          : budgetPercentage >= 70
                          ? 'bg-yellow-500'
                          : ''
                      }`}
                      style={{
                        width: `${Math.min(budgetPercentage, 100)}%`,
                        backgroundColor: budgetPercentage < 70 ? '#299a93' : undefined
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <span>{budgetPercentage.toFixed(1)}% used</span>
                    <span>{formatCurrency(budgetNumber - currentSpend)} remaining</span>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button variant="outline" className="shadow-md">
                    Save Budget Settings
                  </Button>
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
                    onCheckedChange={handle2FAToggle}
                    disabled={is2FALoading}
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
                  <div className="flex items-center justify-between p-4 rounded-lg border border-border-light bg-beige-secondary">
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

            {/* Webhook Alerts */}
            <Card className="border-border-light shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Webhook className="h-5 w-5 text-gray-900" />
                  Webhook Alerts
                </CardTitle>
                <CardDescription>
                  Get real-time alerts via webhook when critical events occur
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="webhookUrl">Webhook URL</Label>
                  <div className="flex gap-2">
                    <Input
                      id="webhookUrl"
                      type="url"
                      placeholder="https://hooks.slack.com/services/..."
                      value={slackWebhook}
                      onChange={(e) => setSlackWebhook(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      className="shadow-md"
                      onClick={() => {
                        if (slackWebhook) {
                          alert('Test payload sent to webhook');
                        }
                      }}
                    >
                      Test
                    </Button>
                  </div>
                  <p className="text-xs text-gray-600">
                    Supports Slack, Discord, Microsoft Teams, and custom webhooks
                  </p>
                </div>

                {/* Alert Events */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Alert Events</Label>

                  <div className="space-y-3 p-4 rounded-lg border border-border-light bg-beige-secondary">
                    {/* Error Rate Alert */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <Label htmlFor="errorRateAlert" className="text-sm font-medium">
                          Error rate threshold (%)
                        </Label>
                        <p className="text-xs text-gray-600 mt-1">
                          Alert when error rate exceeds threshold
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <Input
                          type="number"
                          placeholder="10"
                          defaultValue="10"
                          className="w-20"
                          min="1"
                          max="100"
                        />
                        <Switch id="errorRateAlert" defaultChecked />
                      </div>
                    </div>

                    {/* Budget Alert */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <Label htmlFor="budgetAlert" className="text-sm font-medium">
                          Budget threshold (%)
                        </Label>
                        <p className="text-xs text-gray-600 mt-1">
                          Alert when budget usage exceeds threshold
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <Input
                          type="number"
                          placeholder="80"
                          defaultValue="80"
                          className="w-20"
                          min="1"
                          max="100"
                        />
                        <Switch id="budgetAlert" defaultChecked />
                      </div>
                    </div>

                    {/* Provider Downtime Alert */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <Label htmlFor="downtimeAlert" className="text-sm font-medium">
                          Provider downtime (failures)
                        </Label>
                        <p className="text-xs text-gray-600 mt-1">
                          Alert when provider fails consecutively
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <Input
                          type="number"
                          placeholder="5"
                          defaultValue="5"
                          className="w-20"
                          min="1"
                          max="50"
                        />
                        <Switch id="downtimeAlert" defaultChecked />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button variant="outline" className="shadow-md">
                    Save Alert Settings
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
