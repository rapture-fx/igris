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
  AlertCircle,
  CloudCog,
  Server,
} from 'lucide-react';

export default function SettingsPage() {
  const router = useRouter();
  const { data: tenant, isLoading } = useTenant();
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Get tab from URL query parameter
  const [activeTab, setActiveTab] = useState('notifications');

  // Read tab from URL on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab) {
        setActiveTab(tab);
      }
    }
  }, []);

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
    // TODO: Uncomment when backend API is available
    // const fetch2FAStatus = async () => {
    //   try {
    //     const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081';
    //     const response = await fetch(`${apiUrl}/v1/auth/2fa/status`, {
    //       headers: {
    //         'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
    //       },
    //     });

    //     if (response.ok) {
    //       const data = await response.json();
    //       setTwoFactorEnabled(data.enabled || false);
    //     }
    //   } catch (error) {
    //     console.error('Error fetching 2FA status:', error);
    //   }
    // };

    // if (tenant?.id) {
    //   fetch2FAStatus();
    // }
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
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="pb-4 border-b border-border-light">
          <h1 className="text-base font-medium text-gray-900 font-inter">
            Settings
          </h1>
          <p className="text-gray-600 mt-1 font-inter text-xs">
            Manage your account and preferences
          </p>
        </div>

        {/* Tabs */}
        <style jsx>{`
          [data-state="active"],
          [data-state="active"]:hover,
          [data-radix-tabs-trigger][data-state="active"],
          [data-radix-tabs-trigger][data-state="active"]:hover {
            background: transparent !important;
            box-shadow: none !important;
            border: none !important;
            outline: none !important;
          }
          
          button[data-radix-tabs-trigger][data-state="active"],
          button[data-radix-tabs-trigger][data-state="active"]:hover {
            background: transparent !important;
            box-shadow: none !important;
            border: none !important;
            outline: none !important;
          }
        `}</style>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4 text-xs">
            <TabsTrigger value="notifications" className="text-xs">Notifications</TabsTrigger>
            <TabsTrigger value="security" className="text-xs">Security</TabsTrigger>
            <TabsTrigger value="billing" className="text-xs">Billing</TabsTrigger>
            <TabsTrigger value="team" className="text-xs">Team</TabsTrigger>
            <TabsTrigger value="tenants" className="text-xs">Clients & Tenants</TabsTrigger>
            <TabsTrigger value="vault" className="text-xs">Vault (BYOK/BYOM)</TabsTrigger>
            <TabsTrigger value="authority" className="text-xs">Authority & Limits</TabsTrigger>
          </TabsList>

          {/* Team Tab */}
          <TabsContent value="team" className="space-y-6">
            {/* Invite Member */}
            <div className="space-y-4">
              <div className="pb-4 border-b border-border-light">
                <div className="flex items-center gap-2 text-xs font-semibold text-gray-900 font-inter">
                  <UserPlus className="h-4 w-4 text-gray-900" />
                  Invite Team Member
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Add new members to your team
                </p>
              </div>
              <div className="flex gap-3">
                <Input
                  type="email"
                  placeholder="colleague@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="flex-1 h-7"
                />
                <Button variant="outline" size="sm" className="h-7 px-3 text-xs">
                  Send Invite
                </Button>
              </div>
            </div>

            {/* Team Members */}
            <div className="space-y-4">
              <div className="pb-4 border-b border-border-light">
                <div className="flex items-center gap-2 text-xs font-semibold text-gray-900 font-inter">
                  <Users className="h-4 w-4 text-gray-900" />
                  Team Members
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Manage your team members and their roles
                </p>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-900 text-white font-semibold text-sm">
                      {tenant ? getInitials(tenant.name) : 'U'}
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900 font-inter text-xs">{tenant?.name}</h3>
                      <p className="text-xs text-gray-600">{tenant?.email}</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                    Owner
                  </span>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Tenants Tab */}
          <TabsContent value="tenants" className="space-y-6">
            <div className="space-y-4">
              <div className="pb-4 border-b border-border-light">
                <div className="flex items-center gap-2 text-xs font-semibold text-gray-900 font-inter">
                  <Building2 className="h-4 w-4 text-gray-900" />
                  Clients & Tenants
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Create isolated tenants for customers, environments, or teams
                </p>
              </div>
              <div className="space-y-4">
                <div className="p-6 rounded-lg bg-gradient-to-br from-beige-primary to-beige-primary">
                  <div className="flex-1">
                    <div className="grid gap-2 text-xs text-gray-600 mb-4">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-gray-600" />
                        <span>AES-256 encrypted key storage per tenant</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-gray-600" />
                        <span>Database-level data isolation (RLS)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-gray-600" />
                        <span>Independent budget caps & enforcement</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-gray-600" />
                        <span>Separate observability & audit logs</span>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-3 text-xs"
                      onClick={() => router.push('/dashboard/settings/tenants')}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Manage Tenants
                    </Button>
                  </div>
                </div>

                
              </div>
            </div>
          </TabsContent>

          {/* Billing Tab */}
          <TabsContent value="billing" className="space-y-6">
            {/* Current Plan */}
            <div className="space-y-4">
              <div className="pb-4 border-b border-border-light">
                <div className="flex items-center gap-2 text-xs font-semibold text-gray-900 font-inter">
                  <CreditCard className="h-4 w-4 text-gray-900" />
                  Current Plan
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Your subscription details
                </p>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-base font-bold text-gray-900 font-inter">
                        {tenant?.plan || 'Develop'} Plan
                      </h3>
                      {tenant?.metadata?.trial_active && (
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          Trial Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-900 font-medium mt-2">
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
                  <Button variant="outline" size="sm" className="h-7 px-3 text-xs" onClick={handlePlanUpgrade}>
                    {tenant?.metadata?.trial_active ? 'Upgrade Now' : 'Change Plan'}
                  </Button>
                </div>

                {tenant?.metadata?.trial_active && (
                  <div className="mt-4 p-4 rounded-lg bg-beige-primary border border-border-light">
                    <p className="text-sm text-gray-900 font-medium mb-2">
                      Your trial includes full {tenant?.plan || 'Develop'} tier access
                    </p>
                    <p className="text-xs text-gray-800">
                      After your trial ends, you'll be automatically downgraded to Develop tier unless you add a payment method.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Global Monthly Budget */}
            <div className="space-y-4">
              <div className="pb-4 border-b border-border-light">
                <div className="flex items-center gap-2 text-xs font-semibold text-gray-900 font-inter">
                  <Receipt className="h-4 w-4 text-gray-900" />
                  Global Monthly Budget
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Set a spending limit across all requests
                </p>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="globalBudget" className="text-xs">
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

                <div className="flex items-center justify-between p-3">
                  <div className="space-y-0.5">
                    <Label htmlFor="hardCap" className="text-xs font-medium">
                      Hard cap — block all requests at 100%
                    </Label>
                    <p className="text-xs text-gray-600">
                      When enabled, all requests will be blocked once the budget is exhausted
                    </p>
                  </div>
                  <Switch
                    id="hardCap"
                    checked={hardCapEnabled}
                    onCheckedChange={setHardCapEnabled}
                    className="scale-50"
                  />
                </div>

                {/* Current Usage Bar */}
                <div className="space-y-3 p-4 rounded-lg bg-beige-primary border border-border-light">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-gray-900">Current Month Usage</span>
                    <span className="font-medium text-gray-900">
                      {formatCurrency(currentSpend)} / {formatCurrency(budgetNumber)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full transition-all bg-gray-900"
                      style={{
                        width: `${Math.min(budgetPercentage, 100)}%`
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <span>{budgetPercentage.toFixed(1)}% used</span>
                    <span>{formatCurrency(budgetNumber - currentSpend)} remaining</span>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button variant="outline" size="sm" className="h-7 px-3 text-xs" onClick={() => {
                    console.log('Budget settings saved');
                  }}>
                    Save Budget Settings
                  </Button>
                </div>
              </div>
            </div>

            {/* Payment Method */}
            <div className="space-y-4">
              <div className="pb-4 border-b border-border-light">
                <div className="flex items-center gap-2 text-xs font-semibold text-gray-900 font-inter">
                  <CreditCard className="h-4 w-4 text-gray-900" />
                  Payment Method
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Manage your payment methods
                </p>
              </div>
              <div className="text-center py-8">
                <CreditCard className="h-6 w-6 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 font-inter mb-4 text-xs">
                  No payment method added
                </p>
                <Button variant="outline" size="sm" className="h-7 px-3 text-xs">
                  Add Payment Method
                </Button>
              </div>
            </div>

            {/* Invoices */}
            <div className="space-y-4">
              <div className="pb-4 border-b border-border-light">
                <div className="flex items-center gap-2 text-xs font-semibold text-gray-900 font-inter">
                  <Receipt className="h-4 w-4 text-gray-900" />
                  Invoices
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Download your billing history
                </p>
              </div>
              <div className="text-center py-8">
                <Receipt className="h-6 w-6 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 font-inter text-xs">
                  No invoices yet
                </p>
              </div>
            </div>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-6">
            {/* Two-Factor Authentication */}
            <div className="space-y-4">
              <div className="pb-4 border-b border-border-light">
                <div className="flex items-center gap-2 text-xs font-semibold text-gray-900 font-inter">
                  <Shield className="h-4 w-4 text-gray-900" />
                  Two-Factor Authentication
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Add an extra layer of security to your account
                </p>
              </div>
              <div className="flex items-center justify-between p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="twoFactor" className="text-xs font-medium">
                    Enable 2FA
                  </Label>
                  <p className="text-xs text-gray-600">
                    Require authentication code in addition to password
                  </p>
                </div>
                <Switch
                  id="twoFactor"
                  checked={twoFactorEnabled}
                  onCheckedChange={handle2FAToggle}
                  disabled={is2FALoading}
                  className="scale-50"
                />
              </div>
            </div>

            {/* Active Sessions */}
            <div className="space-y-4">
              <div className="pb-4 border-b border-border-light">
                <div className="flex items-center gap-2 text-xs font-semibold text-gray-900 font-inter">
                  <User className="h-4 w-4 text-gray-900" />
                  Active Sessions
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Manage your active login sessions
                </p>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4">
                  <div>
                    <h3 className="font-medium text-gray-900 font-inter text-xs">Current Session</h3>
                    <p className="text-xs text-gray-600 mt-1">
                      Started {formatDate(new Date().toISOString())}
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-50 text-gray-700">
                    Active
                  </span>
                </div>
              </div>
            </div>

            {/* Danger Zone */}
            <div className="space-y-4">
              <div className="pb-4 border-b border-red-200">
                <div className="flex items-center gap-2 text-xs font-semibold text-red-700 font-inter">
                  <Shield className="h-4 w-4 text-red-700" />
                  Danger Zone
                </div>
                <p className="text-xs text-red-600 mt-1">
                  Irreversible and destructive actions
                </p>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4">
                  <div>
                    <h3 className="font-medium text-red-900 font-inter text-xs">
Sign Out All Sessions
                    </h3>
                    <p className="text-xs text-red-700 mt-1">
Sign out from all devices and revoke all active sessions
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="bg-red-800 hover:bg-red-900 h-7 px-2 text-xs"
                    onClick={() => setShowLogoutDialog(true)}
                  >
                    <LogOut className="mr-1 h-3 w-3" />
Sign Out All
                  </Button>
                </div>

                <div className="flex items-center justify-between p-4">
                  <div>
                    <h3 className="font-medium text-red-900 font-inter text-xs">
Delete Account
                    </h3>
                    <p className="text-xs text-red-700 mt-1">
Permanently delete your account and all associated data
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="bg-red-800 hover:bg-red-900 h-7 px-2 text-xs"
                    onClick={() => setShowDeleteDialog(true)}
                  >
                    <Trash2 className="mr-1 h-3 w-3" />
Delete Account
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-6">
            {/* Email Notifications */}
            <div className="space-y-4">
              <div className="pb-4 border-b border-border-light">
                <div className="flex items-center gap-2 text-xs font-semibold text-gray-900 font-inter">
                  <Bell className="h-4 w-4 text-gray-900" />
                  Email Notifications
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Manage your email notification preferences
                </p>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="emailNotifications" className="text-xs font-medium">
                      Email Notifications
                    </Label>
                    <p className="text-xs text-gray-600">
                      Receive updates via email
                    </p>
                  </div>
                  <Switch
                    id="emailNotifications"
                    checked={emailNotifications}
                    onCheckedChange={setEmailNotifications}
                    className="scale-50"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="usageAlerts" className="text-xs font-medium">
                      Usage Alerts
                    </Label>
                    <p className="text-xs text-gray-600">
                      Get notified when approaching budget limits
                    </p>
                  </div>
                  <Switch
                    id="usageAlerts"
                    checked={usageAlerts}
                    onCheckedChange={setUsageAlerts}
                    className="scale-50"
                  />
                </div>
              </div>
            </div>

            {/* Webhook Alerts */}
            <div className="space-y-4">
              <div className="pb-4 border-b border-border-light">
                <div className="flex items-center gap-2 text-xs font-semibold text-gray-900 font-inter">
                  <Webhook className="h-4 w-4 text-gray-900" />
                  Webhook Alerts
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Get real-time alerts via webhook when critical events occur
                </p>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="webhookUrl" className="text-xs">Webhook URL</Label>
                  <div className="flex gap-2">
                    <Input
                      id="webhookUrl"
                      type="url"
                      placeholder="https://hooks.slack.com/services/..."
                      value={slackWebhook}
                      onChange={(e) => setSlackWebhook(e.target.value)}
                      className="flex-1 text-xs h-7 px-2"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-7 px-3"
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
                  <Label className="text-xs font-medium">Alert Events</Label>

                  <div className="space-y-3">
                    {/* Error Rate Alert */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <Label htmlFor="errorRateAlert" className="text-xs font-medium">
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
                          className="w-20 text-xs h-7 px-2"
                          min="1"
                          max="100"
                        />
                        <Switch id="errorRateAlert" defaultChecked className="scale-50" />
                      </div>
                    </div>

                    {/* Budget Alert */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <Label htmlFor="budgetAlert" className="text-xs font-medium">
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
                          className="w-20 text-xs h-7 px-2"
                          min="1"
                          max="100"
                        />
                        <Switch id="budgetAlert" defaultChecked className="scale-50" />
                      </div>
                    </div>

                    {/* Provider Downtime Alert */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <Label htmlFor="downtimeAlert" className="text-xs font-medium">
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
                          className="w-20 text-xs h-7 px-2"
                          min="1"
                          max="50"
                        />
                        <Switch id="downtimeAlert" defaultChecked className="scale-50" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button variant="outline" size="sm" className="text-xs h-7 px-3" onClick={() => {
                    console.log('Alert settings saved');
                    alert('Alert settings saved successfully!');
                  }}>
                    Save Alert Settings
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Vault (BYOK/BYOM) Tab */}
          <TabsContent value="vault" className="space-y-6">
            {/* Overview Card */}
            <div className="space-y-4">
              <div className="pb-4 border-b border-border-light">
                <div className="flex items-center gap-2 text-xs font-semibold text-gray-900 font-inter">
                  <Key className="h-4 w-4 text-gray-900" />
                  Vault Overview
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Unified key and model management for cloud and edge
                </p>
              </div>
              <div className="grid grid-cols-4 gap-4">
                <div className="p-4">
                  <div className="text-xs text-gray-600 mb-1">Total Cloud Keys</div>
                  <div className="text-base font-bold text-gray-900">12</div>
                  <div className="text-xs text-gray-600 mt-1">Active: 10</div>
                </div>
                <div className="p-4">
                  <div className="text-xs text-gray-600 mb-1">Edge Models</div>
                  <div className="text-base font-bold text-gray-900">5</div>
                  <div className="text-xs text-gray-600 mt-1">Loaded: 3</div>
                </div>
                <div className="p-4">
                  <div className="text-xs text-gray-600 mb-1">Last Rotation</div>
                  <div className="text-base font-bold text-gray-900">7d</div>
                  <div className="text-xs text-gray-600 mt-1">Next: 23 days</div>
                </div>
                <div className="p-4">
                  <div className="text-xs text-gray-600 mb-1">Security Status</div>
                  <div className="text-base font-bold text-green-700">Healthy</div>
                  <div className="text-xs text-gray-600 mt-1">AES-256-GCM</div>
                </div>
              </div>
            </div>

            {/* Cloud Keys Section (Overture BYOK) */}
            <div className="space-y-4">
              <div className="pb-4 border-b border-border-light">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-gray-900 font-inter">
                      <CloudCog className="h-4 w-4 text-gray-900" />
                      Cloud Keys (Overture BYOK)
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      Provider API keys for cloud routing
                    </p>
                  </div>
                  <Button variant="outline" size="sm" className="text-xs h-7 px-3">
                    <Plus className="h-3 w-3 mr-1" />
                    Add Key
                  </Button>
                </div>
              </div>
              <div>
                <div className="border border-border-light rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-beige-secondary">
                      <tr className="border-b border-border-light">
                        <th className="text-left py-2 px-3 font-medium text-gray-600">Provider</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-600">Alias</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-600">Last Used</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-600">Rotation</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-600">Status</th>
                        <th className="text-right py-2 px-3 font-medium text-gray-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-gray-100 hover:bg-beige-secondary">
                        <td className="py-2 px-3 text-gray-900 font-medium">OpenAI</td>
                        <td className="py-2 px-3 text-gray-900">prod-primary</td>
                        <td className="py-2 px-3 text-gray-600">2 mins ago</td>
                        <td className="py-2 px-3 text-gray-600">Auto (30d)</td>
                        <td className="py-2 px-3">
                          <span className="px-2 py-0.5 rounded-full text-xs bg-green-50 text-green-700 border border-green-200">Active</span>
                        </td>
                        <td className="py-2 px-3 text-right">
                          <div className="flex gap-1 justify-end">
                            <Button variant="outline" size="sm" className="text-xs h-6 px-2">Rotate</Button>
                            <Button variant="outline" size="sm" className="text-xs h-6 px-2">Test</Button>
                          </div>
                        </td>
                      </tr>
                      <tr className="border-b border-gray-100 hover:bg-beige-secondary">
                        <td className="py-2 px-3 text-gray-900 font-medium">Anthropic</td>
                        <td className="py-2 px-3 text-gray-900">prod-primary</td>
                        <td className="py-2 px-3 text-gray-600">5 mins ago</td>
                        <td className="py-2 px-3 text-gray-600">Auto (30d)</td>
                        <td className="py-2 px-3">
                          <span className="px-2 py-0.5 rounded-full text-xs bg-green-50 text-green-700 border border-green-200">Active</span>
                        </td>
                        <td className="py-2 px-3 text-right">
                          <div className="flex gap-1 justify-end">
                            <Button variant="outline" size="sm" className="text-xs h-6 px-2">Rotate</Button>
                            <Button variant="outline" size="sm" className="text-xs h-6 px-2">Test</Button>
                          </div>
                        </td>
                      </tr>
                      <tr className="border-b border-gray-100 hover:bg-beige-secondary">
                        <td className="py-2 px-3 text-gray-900 font-medium">Google</td>
                        <td className="py-2 px-3 text-gray-900">backup</td>
                        <td className="py-2 px-3 text-gray-600">1 hour ago</td>
                        <td className="py-2 px-3 text-gray-600">Manual</td>
                        <td className="py-2 px-3">
                          <span className="px-2 py-0.5 rounded-full text-xs bg-gray-50 text-gray-700 border border-gray-200">Standby</span>
                        </td>
                        <td className="py-2 px-3 text-right">
                          <div className="flex gap-1 justify-end">
                            <Button variant="outline" size="sm" className="text-xs h-6 px-2">Rotate</Button>
                            <Button variant="outline" size="sm" className="text-xs h-6 px-2">Test</Button>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Edge Models Section (Runtime BYOM) */}
            <div className="space-y-4">
              <div className="pb-4 border-b border-border-light">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-gray-900 font-inter">
                      <Server className="h-4 w-4 text-gray-900" />
                      Edge Models (Runtime BYOM)
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      GGUF models for edge inference
                    </p>
                  </div>
                  <Button variant="outline" size="sm" className="text-xs h-7 px-3">
                    <Plus className="h-3 w-3 mr-1" />
                    Upload Model
                  </Button>
                </div>
              </div>
              <div>
                <div className="border border-border-light rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-beige-secondary">
                      <tr className="border-b border-border-light">
                        <th className="text-left py-2 px-3 font-medium text-gray-600">Model Name</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-600">Path</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-600">Size</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-600">Quantization</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-600">Last Loaded</th>
                        <th className="text-right py-2 px-3 font-medium text-gray-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-gray-100 hover:bg-beige-secondary">
                        <td className="py-2 px-3 text-gray-900 font-medium">llama-3.1-8b-instruct</td>
                        <td className="py-2 px-3 text-gray-600 font-mono text-[0.65rem]">/models/llama3.1-8b-q4.gguf</td>
                        <td className="py-2 px-3 text-gray-600">4.7 GB</td>
                        <td className="py-2 px-3 text-gray-600">Q4_K_M</td>
                        <td className="py-2 px-3 text-gray-600">Active</td>
                        <td className="py-2 px-3 text-right">
                          <div className="flex gap-1 justify-end">
                            <Button variant="outline" size="sm" className="text-xs h-6 px-2">Test</Button>
                            <Button variant="outline" size="sm" className="text-xs h-6 px-2">Delete</Button>
                          </div>
                        </td>
                      </tr>
                      <tr className="border-b border-gray-100 hover:bg-beige-secondary">
                        <td className="py-2 px-3 text-gray-900 font-medium">mistral-7b-instruct</td>
                        <td className="py-2 px-3 text-gray-600 font-mono text-[0.65rem]">/models/mistral-7b-q5.gguf</td>
                        <td className="py-2 px-3 text-gray-600">5.2 GB</td>
                        <td className="py-2 px-3 text-gray-600">Q5_K_M</td>
                        <td className="py-2 px-3 text-gray-600">12 mins ago</td>
                        <td className="py-2 px-3 text-right">
                          <div className="flex gap-1 justify-end">
                            <Button variant="outline" size="sm" className="text-xs h-6 px-2">Test</Button>
                            <Button variant="outline" size="sm" className="text-xs h-6 px-2">Delete</Button>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Security & Compliance */}
            <div className="space-y-4">
              <div className="pb-4 border-b border-border-light">
                <div className="flex items-center gap-2 text-xs font-semibold text-gray-900 font-inter">
                  <Shield className="h-4 w-4 text-gray-900" />
                  Security & Compliance
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Encryption and audit information
                </p>
              </div>
              <div>
                <div className="grid gap-4">
                  <div className="p-4">
                    <div>
                      <div className="flex-1">
                        <h4 className="text-xs font-medium text-gray-900 font-inter mb-1">
                          Encryption Details
                        </h4>
                        <p className="text-xs text-gray-800 mb-2">
                          All keys and models are encrypted at rest using AES-256-GCM. Cloud keys are encrypted in PostgreSQL, edge models use filesystem encryption.
                        </p>
                        <div className="space-y-2 text-xs">
                          <div>
                            <span className="text-gray-600">Algorithm:</span>
                            <span className="ml-2 font-medium text-gray-900">AES-256-GCM</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Key Derivation:</span>
                            <span className="ml-2 font-medium text-gray-900">PBKDF2</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4">
                    <div>
                      <div className="flex-1">
                        <h4 className="text-xs font-medium text-gray-900 font-inter mb-1">
                          Rotation Policy
                        </h4>
                        <p className="text-xs text-gray-800 mb-2">
                          Cloud keys auto-rotate every 30 days. Manual rotation available anytime. Edge models do not auto-rotate.
                        </p>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" className="text-xs h-7 px-3">
                            View Audit Log
                          </Button>
                          <Button variant="outline" size="sm" className="text-xs h-7 px-3">
                            Download Compliance Report
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Configuration */}
            <div className="space-y-4">
              <div className="pb-4 border-b border-border-light">
                <div className="flex items-center gap-2 text-xs font-semibold text-gray-900 font-inter">
                  <Calendar className="h-4 w-4 text-gray-900" />
                  Vault Configuration
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Global settings for key and model management
                </p>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4">
                  <div className="flex-1">
                    <h4 className="text-xs font-medium text-gray-900 font-inter mb-1">
                      Auto-Rotate Cloud Keys
                    </h4>
                    <p className="text-xs text-gray-600">
                      Automatically rotate provider keys every 30 days
                    </p>
                  </div>
                  <Switch defaultChecked className="scale-50" />
                </div>

                <div className="p-4">
                  <h4 className="text-xs font-medium text-gray-900 font-inter mb-3">
                    Notification Settings
                  </h4>
                  <div className="space-y-2 text-xs text-gray-600">
                    <div className="flex justify-between">
                      <span>Rotation warnings:</span>
                      <span className="font-medium text-gray-900">7 days before</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Key expiration alerts:</span>
                      <span className="font-medium text-gray-900">Email + Webhook</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Failed rotation attempts:</span>
                      <span className="font-medium text-gray-900">Immediate</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" className="text-xs h-7 px-3">
                    Reset to Defaults
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs h-7 px-3">
                    Save Configuration
                  </Button>
                </div>
              </div>
            </div>

            {/* Help Text */}
            <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-xs font-medium text-blue-900 font-inter mb-1">
                    Unified Key & Model Management
                  </h4>
                  <p className="text-xs text-blue-800">
                    Manage all cloud provider keys (BYOK) and edge inference models (BYOM) here. Changes apply globally across Overture cloud routing and Runtime edge devices. For security, keys are encrypted at rest and auto-rotated by default.
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Authority & Limits Tab */}
          <TabsContent value="authority" className="space-y-6">
            {/* Forbidden Actions */}
            <div className="space-y-4">
              <div className="pb-4 border-b border-border-light">
                <div className="flex items-center gap-2 text-xs font-semibold text-gray-900 font-inter">
                  <XCircle className="h-4 w-4 text-gray-900" />
                  Forbidden Actions
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Operations explicitly prohibited by system policy
                </p>
              </div>
              <div>
                <div className="space-y-3">
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <XCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="text-xs font-medium text-red-900 font-inter mb-1">
                          Direct API Key Exposure
                        </h4>
                        <p className="text-xs text-red-800">
                          System will never expose full API keys in responses, logs, or traces. All keys are masked after creation.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <XCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="text-xs font-medium text-red-900 font-inter mb-1">
                          Automatic Data Deletion
                        </h4>
                        <p className="text-xs text-red-800">
                          System cannot autonomously delete user data, API keys, or tenants without explicit confirmation.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <XCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="text-xs font-medium text-red-900 font-inter mb-1">
                          Policy Override Without Audit
                        </h4>
                        <p className="text-xs text-red-800">
                          Routing policies cannot be modified without creating an audit trail. All changes are logged with timestamp and operator.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <XCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="text-xs font-medium text-red-900 font-inter mb-1">
                          Cross-Tenant Data Access
                        </h4>
                        <p className="text-xs text-red-800">
                          Database-level row-level security prevents any cross-tenant data leakage. Tenants cannot access each other's keys, traces, or configurations.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Decision Authority Modes */}
            <div className="space-y-4">
              <div className="pb-4 border-b border-border-light">
                <div className="flex items-center gap-2 text-xs font-semibold text-gray-900 font-inter">
                  <SettingsIcon className="h-4 w-4 text-gray-900" />
                  Decision Authority Modes
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Configure system autonomy and operator control
                </p>
              </div>
              <div className="space-y-4">
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="text-xs font-medium text-gray-900 font-inter mb-1">
                        Automatic Failover
                      </h4>
                      <p className="text-xs text-gray-600">
                        System can autonomously switch providers when primary fails (recommended)
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-1 rounded text-xs font-medium bg-gray-50 text-gray-700">
                        Decision Mode
                      </span>
                      <Switch defaultChecked className="scale-50" />
                    </div>
                  </div>
                </div>

                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="text-xs font-medium text-gray-900 font-inter mb-1">
                        Cost Optimization
                      </h4>
                      <p className="text-xs text-gray-600">
                        System can automatically adjust routing to reduce costs within quality constraints
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-1 rounded text-xs font-medium bg-gray-50 text-gray-700">
                        Decision Mode
                      </span>
                      <Switch defaultChecked className="scale-50" />
                    </div>
                  </div>
                </div>

                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="text-xs font-medium text-gray-900 font-inter mb-1">
                        Provider Key Rotation
                      </h4>
                      <p className="text-xs text-gray-600">
                        Requires operator approval before rotating API keys (advisory-only mode)
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-gray-700">
                        Advisory Only
                      </span>
                      <Switch className="scale-50" />
                    </div>
                  </div>
                </div>

                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="text-xs font-medium text-gray-900 font-inter mb-1">
                        Model Selection
                      </h4>
                      <p className="text-xs text-gray-600">
                        System can choose models based on request characteristics and policy constraints
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-1 rounded text-xs font-medium bg-gray-50 text-gray-700">
                        Decision Mode
                      </span>
                      <Switch defaultChecked className="scale-50" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Kill Switches */}
            <div className="space-y-4">
              <div className="pb-4 border-b border-red-200">
                <div className="flex items-center gap-2 text-xs font-semibold text-red-700 font-inter">
                  <AlertCircle className="h-4 w-4 text-red-700" />
                  Emergency Kill Switches
                </div>
                <p className="text-xs text-red-600 mt-1">
                  Immediate system-wide control actions
                </p>
              </div>
              <div className="space-y-4">
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="text-xs font-medium text-red-900 font-inter mb-1">
                        Emergency Stop All Requests
                      </h4>
                      <p className="text-xs text-red-800">
                        Immediately halt all outgoing provider requests. Existing in-flight requests will complete.
                      </p>
                    </div>
                    <Button variant="destructive" size="sm" className="bg-red-800 hover:bg-red-900 h-7 px-3 text-xs">
                      Activate
                    </Button>
                  </div>
                </div>

                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="text-xs font-medium text-gray-900 font-inter mb-1">
                        Disable Specific Provider
                      </h4>
                      <p className="text-xs text-gray-800">
                        Temporarily block requests to a specific provider. Routes to alternatives.
                      </p>
                    </div>
                    <Button variant="outline" size="sm">
                      Configure
                    </Button>
                  </div>
                </div>

                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="text-xs font-medium text-gray-900 font-inter mb-1">
                        Force Manual Approval Mode
                      </h4>
                      <p className="text-xs text-gray-800">
                        Require operator confirmation for all policy decisions. Disables autonomous optimization.
                      </p>
                    </div>
                    <Switch className="scale-50" />
                  </div>
                </div>
              </div>
            </div>

            {/* System Capabilities */}
            <div className="space-y-4">
              <div className="pb-4 border-b border-border-light">
                <div className="flex items-center gap-2 text-xs font-semibold text-gray-900 font-inter">
                  <Shield className="h-4 w-4 text-gray-900" />
                  What This System Cannot Do
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Architectural limitations and boundaries
                </p>
              </div>
              <div>
                <div className="space-y-2 text-xs text-gray-900">
                  <div className="flex items-start gap-2">
                    <span className="text-gray-600 mt-1">•</span>
                    <span>Cannot read or modify data outside assigned tenant boundaries</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-gray-600 mt-1">•</span>
                    <span>Cannot bypass authentication or authorization checks</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-gray-600 mt-1">•</span>
                    <span>Cannot disable audit logging or tamper with historical records</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-gray-600 mt-1">•</span>
                    <span>Cannot make billing changes or payment method modifications without confirmation</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-gray-600 mt-1">•</span>
                    <span>Cannot share provider API keys between tenants</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-gray-600 mt-1">•</span>
                    <span>Cannot execute arbitrary code or shell commands on infrastructure</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-gray-600 mt-1">•</span>
                    <span>Cannot modify EscapeVector offline policy runtime without redeployment</span>
                  </div>
                </div>
              </div>
            </div>
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
