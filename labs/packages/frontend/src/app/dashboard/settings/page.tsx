'use client'

import { useState } from 'react'
import { PageHeader, PageHeaderActions } from '@/components/ui/page-header'
import { 
  User,
  Shield,
  KeyRound,
  CreditCard,
  Users,
  BarChart3,
  ShieldCheck,
  Link2,
  Bell,
  Settings,
  Save,
  RefreshCw,
  Eye,
  EyeOff,
  Check,
  X
} from 'lucide-react'
import { AccountTab } from '@/components/settings/account-tab'
import { APIKeysTab } from '@/components/settings/api-keys-tab'
import { AuditLogsTab } from '@/components/settings/audit-logs-tab'
import { BillingTab } from '@/components/settings/billing-tab'
import { NotificationsTab } from '@/components/settings/notifications-tab'
import { SecurityTab } from '@/components/settings/security-tab'
import { UsageTab } from '@/components/settings/usage-tab'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

interface TabConfig {
  id: string
  label: string
  icon: React.ComponentType<any>
  description: string
  component: React.ComponentType<any>
  badge?: string
  category: 'account' | 'security' | 'billing' | 'system'
}

const tabs: TabConfig[] = [
  {
    id: 'account',
    label: 'Account',
    icon: User,
    description: 'Manage your profile and preferences',
    component: AccountTab,
    category: 'account'
  },
  {
    id: 'security',
    label: 'Security',
    icon: Shield,
    description: 'Security settings and authentication',
    component: SecurityTab,
    category: 'security'
  },
  {
    id: 'api-keys',
    label: 'API Keys',
    icon: KeyRound,
    description: 'Manage API keys and access tokens',
    component: APIKeysTab,
    category: 'security'
  },
  {
    id: 'billing',
    label: 'Billing',
    icon: CreditCard,
    description: 'Billing information and subscription',
    component: BillingTab,
    category: 'billing'
  },
  {
    id: 'usage',
    label: 'Usage',
    icon: BarChart3,
    description: 'Monitor usage and quotas',
    component: UsageTab,
    category: 'billing'
  },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: Bell,
    description: 'Email and push notification settings',
    component: NotificationsTab,
    category: 'system'
  },
  {
    id: 'audit-logs',
    label: 'Audit Logs',
    icon: ShieldCheck,
    description: 'Security and activity logs',
    component: AuditLogsTab,
    badge: 'Pro',
    category: 'security'
  }
]

const categoryLabels = {
  account: 'Account',
  security: 'Security & Access',
  billing: 'Billing & Usage',
  system: 'System & Integrations'
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('account')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component || AccountTab
  const activeTabConfig = tabs.find(tab => tab.id === activeTab)

  const handleSave = async () => {
    setIsSaving(true)
    await new Promise(resolve => setTimeout(resolve, 1000))
    setIsSaving(false)
    setHasUnsavedChanges(false)
  }

  const groupedTabs = tabs.reduce((acc, tab) => {
    if (!acc[tab.category]) {
      acc[tab.category] = []
    }
    acc[tab.category].push(tab)
    return acc
  }, {} as Record<string, TabConfig[]>)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage your account, security, billing, and system preferences."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Settings' }
        ]}
        badge={
          hasUnsavedChanges ? {
            text: 'Unsaved Changes',
            variant: 'destructive'
          } : undefined
        }
        actions={
          hasUnsavedChanges && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setHasUnsavedChanges(false)}
                className="border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                <X className="w-4 h-4 mr-2" />
                Discard
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isSaving ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save Changes
              </Button>
            </div>
          )
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Settings Navigation */}
        <aside className="lg:col-span-3">
          <Card className="border-gray-200/60">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Settings className="w-5 h-5 text-gray-600" />
                Settings
              </CardTitle>
              <CardDescription>
                Configure your workspace
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {Object.entries(groupedTabs).map(([category, categoryTabs]) => (
                <div key={category} className="space-y-2">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-3">
                    {categoryLabels[category as keyof typeof categoryLabels]}
                  </h4>
                  <nav className="space-y-1">
                    {categoryTabs.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group",
                          activeTab === tab.id
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                        )}
                      >
                        <tab.icon className={cn(
                          'w-4 h-4 transition-colors',
                          activeTab === tab.id ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'
                        )} />
                        <span className="flex-1 text-left">{tab.label}</span>
                        {tab.badge && (
                          <Badge variant="secondary" className="text-xs">
                            {tab.badge}
                          </Badge>
                        )}
                      </button>
                    ))}
                  </nav>
                </div>
              ))}
            </CardContent>
          </Card>
        </aside>

        {/* Settings Content */}
        <main className="lg:col-span-9">
          <Card className="border-gray-200/60">
            <CardHeader className="pb-6">
              <div className="flex items-center gap-3">
                {activeTabConfig && (
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                    <activeTabConfig.icon className="w-5 h-5 text-blue-600" />
                  </div>
                )}
                <div>
                  <CardTitle className="text-xl font-semibold">
                    {activeTabConfig?.label}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {activeTabConfig?.description}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="pt-6">
              <ActiveComponent onUnsavedChanges={setHasUnsavedChanges} />
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  )
} 