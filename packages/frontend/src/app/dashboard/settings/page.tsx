'use client'

import { useState, useEffect } from 'react'
import { 
  User, 
  Lock, 
  Bell, 
  Link2, 
  Database, 
  Palette, 
  Globe, 
  Shield, 
  Mail, 
  Smartphone,
  Key,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Eye,
  EyeOff,
  Trash2,
  Plus,
  Save,
  CreditCard,
  Users,
  FileText,
  Settings,
  Activity,
  Crown,
  Calendar,
  Download,
  Upload,
  Zap,
  Brain,
  Target,
  BarChart3,
  DollarSign,
  UserPlus,
  KeyRound,
  ShieldCheck,
  LogOut,
  Filter,
  CheckCircle,
  AlertTriangle,
  Clock,
  Search
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/ui/page-header'
import {
  useTeamManagement,
  useSecuritySettings,
  useActiveSessions,
  useSecurityMetrics,
  useSecurityRecommendations,
  useSecurityManagement,
  useAPIKeys,
  useAuditLogs,
  useBilling
} from '@/hooks/useAPIData'
import { SecurityMetricsCard, SecurityRecommendationsCard, SecuritySettingCard, ChangePasswordModal, KeyActionsMenu, CreateKeyModal, NewKeyModal } from '@/components/ui/security'
import { FilterModal } from '@/components/ui/filter-modal'

interface TabConfig {
  id: string
  label: string
  icon: React.ComponentType<any>
  description: string
}

const tabs: TabConfig[] = [
  { id: 'account', label: 'Account', icon: User, description: 'Personal information and preferences' },
  { id: 'security', label: 'Security', icon: Shield, description: 'Security settings and authentication' },
  { id: 'api-keys', label: 'API Keys', icon: KeyRound, description: 'Manage API access tokens' },
  { id: 'billing', label: 'Billing', icon: CreditCard, description: 'Subscription and payment settings' },
  { id: 'team', label: 'Team', icon: Users, description: 'Team members and collaboration' },
  { id: 'usage', label: 'Usage', icon: BarChart3, description: 'Resource usage and analytics' },
  { id: 'audit', label: 'Audit Logs', icon: ShieldCheck, description: 'Activity history and compliance' },
  { id: 'integrations', label: 'Integrations', icon: Link2, description: 'Third-party connections' },
  { id: 'notifications', label: 'Notifications', icon: Bell, description: 'Email and push notifications' }
]

const AccountTab = () => {
  const [userProfile, setUserProfile] = useState({
      name: 'Alex Johnson',
      email: 'alex.johnson@company.com',
      company: 'TechCorp Inc.',
      role: 'Data Engineer',
      timezone: 'America/New_York',
    language: 'en-US',
    avatar: '/avatars/alex.jpg'
  })

  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    setTimeout(() => {
      setSaving(false)
      toast.success('Profile updated successfully!')
    }, 1500)
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Profile Information</h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                      <input
                        type="text"
                        value={userProfile.name}
              onChange={(e) => setUserProfile(prev => ({ ...prev, name: e.target.value }))}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
          
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                      <input
                        type="email"
                        value={userProfile.email}
              onChange={(e) => setUserProfile(prev => ({ ...prev, email: e.target.value }))}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
          
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Company</label>
                      <input
                        type="text"
                        value={userProfile.company}
              onChange={(e) => setUserProfile(prev => ({ ...prev, company: e.target.value }))}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
          
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                      <input
                        type="text"
                        value={userProfile.role}
              onChange={(e) => setUserProfile(prev => ({ ...prev, role: e.target.value }))}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
          
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Timezone</label>
                      <select
                        value={userProfile.timezone}
              onChange={(e) => setUserProfile(prev => ({ ...prev, timezone: e.target.value }))}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="America/New_York">Eastern Time (EST)</option>
              <option value="America/Chicago">Central Time (CST)</option>
              <option value="America/Denver">Mountain Time (MST)</option>
              <option value="America/Los_Angeles">Pacific Time (PST)</option>
                        <option value="UTC">UTC</option>
                      </select>
                    </div>
          
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Language</label>
                      <select
                        value={userProfile.language}
              onChange={(e) => setUserProfile(prev => ({ ...prev, language: e.target.value }))}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="en-US">English (US)</option>
                        <option value="en-GB">English (UK)</option>
                        <option value="es-ES">Spanish</option>
                        <option value="fr-FR">French</option>
                        <option value="de-DE">German</option>
                      </select>
                    </div>
                  </div>

        <div className="flex justify-end mt-6">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

const SecurityTab = () => {
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  
  const { data: securitySettings, loading: settingsLoading, refetch: refetchSettings } = useSecuritySettings()
  const { data: activeSessions, loading: sessionsLoading, refetch: refetchSessions } = useActiveSessions()
  const { data: securityMetrics } = useSecurityMetrics()
  const { data: recommendations } = useSecurityRecommendations()
  
  const { 
    updateMFASettings, 
    revokeSession, 
    updating, 
    revoking 
  } = useSecurityManagement()

  const handleMFAToggle = async (enabled: boolean) => {
    try {
      await updateMFASettings(enabled, 'authenticator')
      refetchSettings()
    } catch (error) {
      console.error('MFA toggle failed:', error)
    }
  }

  const handleSessionRevoke = async (sessionId: string) => {
    try {
      await revokeSession(sessionId)
      refetchSessions()
    } catch (error) {
      console.error('Session revocation failed:', error)
    }
  }

  const formatLastActivity = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 60) return `${diffMins} minutes ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours} hours ago`
    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays} days ago`
  }

  return (
    <div className="space-y-8">
      <SecurityMetricsCard metrics={securityMetrics} />
      <SecurityRecommendationsCard recommendations={recommendations} />
      
      <SecuritySettingCard
        title="Multi-Factor Authentication (MFA)"
        description="Add an extra layer of security to your account with AI-powered authentication."
        loading={settingsLoading || updating}
        action={
          <button 
            onClick={() => handleMFAToggle(!securitySettings?.mfa_enabled)}
            disabled={updating}
            className={cn(
              "inline-flex items-center px-4 py-2 font-medium rounded-lg shadow-sm",
              securitySettings?.mfa_enabled 
                ? "bg-red-600 text-white hover:bg-red-700" 
                : "bg-green-600 text-white hover:bg-green-700"
            )}
          >
            {updating ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Shield className="w-4 h-4 mr-2" />
            )}
            {securitySettings?.mfa_enabled ? 'Disable MFA' : 'Enable MFA'}
                    </button>
        }
      >
        <div className="p-6 text-sm text-gray-700">
          MFA is currently {securitySettings?.mfa_enabled ? <span className="font-semibold text-green-700">ENABLED</span> : <span className="font-semibold text-red-700">DISABLED</span>}.
          When enabled, you'll be asked for a verification code from your authenticator app.
                  </div>
      </SecuritySettingCard>

      <SecuritySettingCard
        title="Active Sessions"
        description="Monitor and manage all devices currently signed into your account."
        loading={sessionsLoading}
        action={
          <button 
            onClick={() => {
              activeSessions?.sessions
                .filter((session: any) => !session.is_current)
                .forEach((session: any) => handleSessionRevoke(session.id))
            }}
            className="inline-flex items-center px-4 py-2 border border-red-300 text-sm font-medium rounded-lg text-red-700 hover:bg-red-50"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Revoke All Other Sessions
          </button>
        }
      >
        <ul className="divide-y divide-gray-200">
          {activeSessions?.sessions.map((session: any) => (
            <li key={session.id} className="p-4 flex justify-between items-center">
              <div className="flex items-center space-x-3">
                <Globe className="w-5 h-5 text-gray-500" />
                <div>
                  <p className="font-medium text-gray-800">{session.ip_address} ({session.location})</p>
                  <p className="text-sm text-gray-600">{session.user_agent}</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-500">Last active: {formatLastActivity(session.last_activity)}</span>
                {session.is_current ? (
                  <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">Current</span>
                ) : (
                  <button 
                    onClick={() => handleSessionRevoke(session.id)}
                    disabled={revoking}
                    className="p-2 text-gray-500 hover:bg-red-100 hover:text-red-600 rounded-full"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </SecuritySettingCard>
      
      <ChangePasswordModal 
        isOpen={showPasswordModal} 
        onClose={() => setShowPasswordModal(false)} 
      />
    </div>
  )
}

const APIKeysTab = () => {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newKeyData, setNewKeyData] = useState<any | null>(null)
  
  const { data: apiKeys, loading, refetch } = useAPIKeys()
  const { revokeAPIKey, testAPIKey } = useSecurityManagement()

  const handleKeyCreated = (keyData: any) => {
    setNewKeyData(keyData)
    refetch()
  }

  const handleRevokeKey = async (keyId: string) => {
    if (window.confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) {
      try {
        await revokeAPIKey(keyId)
        refetch()
      } catch (error) {
        console.error('Failed to revoke API key:', error)
      }
    }
  }

  const handleTestKey = async (keyId: string) => {
    try {
      const result = await testAPIKey(keyId);
      alert(`Test Result: ${result.message}`);
    } catch (error: any) {
      alert(`Test Failed: ${error.message}`);
    }
  }

  const formatLastUsed = (timestamp: string) => {
    if (!timestamp) return 'Never'
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 60) return `${diffMins} minutes ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours} hours ago`
    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays} days ago`
  }

  const getKeyStatusColor = (isActive: boolean, expiresAt?: string) => {
    if (!isActive) return 'bg-red-100 text-red-800'
    if (expiresAt && new Date(expiresAt) < new Date()) return 'bg-yellow-100 text-yellow-800'
    return 'bg-green-100 text-green-800'
  }

  const getKeyStatusText = (isActive: boolean, expiresAt?: string) => {
    if (!isActive) return 'Revoked'
    if (expiresAt && new Date(expiresAt) < new Date()) return 'Expired'
    return 'Active'
  }

  if (loading) return <div>Loading...</div>

  return (
                  <div className="space-y-6">
      <div className="flex justify-between items-center">
                        <div>
          <h2 className="text-xl font-bold text-gray-800">API Keys</h2>
          <p className="text-gray-600 mt-1">Manage and secure your API access for applications and services.</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center bg-blue-600 text-white px-4 py-2 rounded-lg font-medium shadow-sm hover:bg-blue-700"
        >
          <Plus className="w-5 h-5 mr-2" />
          Create API Key
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm">
        <ul className="divide-y divide-gray-200">
          {apiKeys?.keys.map((key: any) => (
            <li key={key.id} className="p-4 sm:p-6 hover:bg-gray-50/50">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-gray-800">{key.name}</h3>
                  <p className="text-sm text-gray-500 mt-1">{key.description}</p>
                  <div className="mt-3 flex items-center space-x-4 text-sm text-gray-600">
                    <span className="flex items-center space-x-1.5">
                      <Shield className="w-4 h-4 text-gray-400" />
                      <span>{key.permissions.length} Permissions</span>
                    </span>
                    <span className="flex items-center space-x-1.5">
                      <Activity className="w-4 h-4 text-gray-400" />
                      <span>Last used: {formatLastUsed(key.last_used)}</span>
                    </span>
                    {key.expires_at && (
                      <span className="flex items-center space-x-1.5">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span>Expires: {new Date(key.expires_at).toLocaleDateString()}</span>
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-4 sm:mt-0 sm:ml-6 flex items-center space-x-4">
                  <span className={cn(
                    "px-2.5 py-1 text-xs font-medium rounded-full",
                    getKeyStatusColor(key.is_active, key.expires_at)
                  )}>
                    {getKeyStatusText(key.is_active, key.expires_at)}
                  </span>
                  <KeyActionsMenu 
                    keyId={key.id} 
                    onRevoke={() => handleRevokeKey(key.id)} 
                    onTest={() => handleTestKey(key.id)}
                  />
                        </div>
                      </div>
            </li>
          ))}
        </ul>
      </div>

      <CreateKeyModal 
        isOpen={showCreateModal} 
        onClose={() => setShowCreateModal(false)}
        onKeyCreated={handleKeyCreated}
      />
      <NewKeyModal
        keyData={newKeyData}
        onClose={() => setNewKeyData(null)}
      />
    </div>
  )
}

const BillingTab = () => {
  const { data: billingInfo, loading } = useBilling()

  if (loading) return <div>Loading billing information...</div>
  if (!billingInfo) return <div>Could not load billing information.</div>

  const { subscription, paymentMethod, billingHistory } = billingInfo

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <div className="flex flex-col md:flex-row justify-between md:items-center">
          <div>
            <h3 className="text-lg font-bold text-gray-800">Current Subscription</h3>
            <p className="text-gray-600 mt-1">You are currently on the <span className="font-semibold text-blue-600">{subscription.plan_name}</span> plan.</p>
          </div>
          <button className="mt-4 md:mt-0 inline-flex items-center bg-blue-600 text-white px-4 py-2 rounded-lg font-medium shadow-sm hover:bg-blue-700">
            <Crown className="w-4 h-4 mr-2" />
            Upgrade Plan
          </button>
        </div>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
          <div>
            <p className="text-3xl font-bold text-gray-800">{subscription.usage.toLocaleString()}</p>
            <p className="text-sm text-gray-500">API Credits Used</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-gray-800">${subscription.cost_mtd.toFixed(2)}</p>
            <p className="text-sm text-gray-500">Cost Month-to-Date</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-gray-800">{new Date(subscription.renews_on).toLocaleDateString()}</p>
            <p className="text-sm text-gray-500">Next Renewal Date</p>
          </div>
        </div>
                    </div>

      <div className="bg-white rounded-2xl shadow-sm p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Payment Method</h3>
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center">
            <CreditCard className="w-8 h-8 text-blue-600" />
            <div className="ml-4">
              <p className="font-medium text-gray-900">{paymentMethod.card_type} **** {paymentMethod.last4}</p>
              <p className="text-sm text-gray-500">Expires {paymentMethod.expiry_date}</p>
                        </div>
                      </div>
          <button className="text-sm font-medium text-blue-600 hover:underline">Update</button>
        </div>
                    </div>

      <div className="bg-white rounded-2xl shadow-sm">
        <h3 className="text-lg font-bold text-gray-800 p-6">Billing History</h3>
        <ul className="divide-y divide-gray-200">
          {billingHistory.map((item: any) => (
            <li key={item.id} className="flex items-center justify-between p-4 hover:bg-gray-50/50">
                          <div>
                <p className="font-medium text-gray-900">Invoice #{item.id}</p>
                <p className="text-sm text-gray-500">Issued on {new Date(item.date).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center space-x-4">
                <p className="font-semibold text-gray-800">${item.amount.toFixed(2)}</p>
                <a href={item.invoice_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-sm font-medium text-blue-600 hover:underline">
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </a>
              </div>
            </li>
          ))}
        </ul>
                          </div>
                        </div>
  )
}

const TeamTab = () => {
  const { data: teamData, loading, addUser, removeUser, updateUserRole } = useTeamManagement()
  
  if (loading) return <div>Loading team members...</div>
  if (!teamData) return <div>Could not load team members.</div>

  const handleRemoveUser = (userId: string) => {
    if (window.confirm('Are you sure you want to remove this user?')) {
      removeUser(userId)
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-gray-900">Team Members</h3>
                        <button
            onClick={() => addUser({ name: 'New User', email: 'new@user.com', role: 'Member' })}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg font-medium shadow-sm hover:bg-blue-700"
                        >
            <UserPlus className="w-4 h-4 mr-2" />
            Invite Member
                        </button>
                      </div>

        <ul className="divide-y divide-gray-200">
          {teamData.members.map((member: any) => (
            <li key={member.id} className="flex flex-col md:flex-row items-start md:items-center justify-between p-4">
              <div className="flex items-center space-x-4">
                <img src={member.avatar} alt={member.name} className="w-10 h-10 rounded-full" />
                <div>
                  <p className="font-medium text-gray-900">{member.name}</p>
                  <p className="text-sm text-gray-500">{member.email}</p>
                </div>
              </div>
              <div className="flex items-center space-x-4 mt-4 md:mt-0">
                <select 
                  value={member.role}
                  onChange={(e) => updateUserRole(member.id, e.target.value)}
                  className="p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="Admin">Admin</option>
                  <option value="Member">Member</option>
                  <option value="Billing">Billing</option>
                </select>
                <button 
                  onClick={() => handleRemoveUser(member.id)}
                  className="p-2 text-gray-500 hover:text-red-600 hover:bg-gray-100 rounded-full"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

const UsageTab = () => {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Usage Overview</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-4 border rounded-lg">
            <div className="text-2xl font-bold text-blue-600">42</div>
            <div className="text-sm text-gray-500">Datasets Processed</div>
          </div>
          <div className="text-center p-4 border rounded-lg">
            <div className="text-2xl font-bold text-green-600">15.2GB</div>
            <div className="text-sm text-gray-500">Data Processed</div>
          </div>
          <div className="text-center p-4 border rounded-lg">
            <div className="text-2xl font-bold text-purple-600">1,245</div>
            <div className="text-sm text-gray-500">API Calls</div>
          </div>
        </div>
      </div>
    </div>
  )
}

const getActionIcon = (action: string) => {
  const iconProps = { className: "w-4 h-4" }
  
  if (action.includes('login')) return <LogIn {...iconProps} className="w-4 h-4 text-green-600" />
  if (action.includes('logout')) return <LogOut {...iconProps} className="w-4 h-4 text-orange-600" />
  if (action.includes('api_key')) return <KeyRound {...iconProps} className="w-4 h-4 text-blue-600" />
  if (action.includes('upload') || action.includes('dataset')) return <Upload {...iconProps} className="w-4 h-4 text-purple-600" />
  if (action.includes('transformation')) return <Zap {...iconProps} className="w-4 h-4 text-yellow-600" />
  if (action.includes('labeling') || action.includes('label')) return <Brain {...iconProps} className="w-4 h-4 text-indigo-600" />
  if (action.includes('user') || action.includes('role')) return <User {...iconProps} className="w-4 h-4 text-cyan-600" />
  if (action.includes('security') || action.includes('mfa')) return <Shield {...iconProps} className="w-4 h-4 text-red-600" />
  if (action.includes('settings') || action.includes('config')) return <Settings {...iconProps} className="w-4 h-4 text-gray-600" />
  if (action.includes('delete') || action.includes('remove')) return <Trash2 {...iconProps} className="w-4 h-4 text-red-600" />
  if (action.includes('create') || action.includes('add')) return <UserPlus {...iconProps} className="w-4 h-4 text-green-600" />
  if (action.includes('update') || action.includes('edit')) return <Edit {...iconProps} className="w-4 h-4 text-blue-600" />
  if (action.includes('view') || action.includes('read')) return <Eye {...iconProps} className="w-4 h-4 text-gray-600" />
  
  return <Activity {...iconProps} className="w-4 h-4 text-gray-600" />
}

const getActionColor = (action: string, success: boolean) => {
  if (!success) return 'bg-red-50 border-red-200'
  
  if (action.includes('login') || action.includes('create')) return 'bg-green-50 border-green-200'
  if (action.includes('delete') || action.includes('remove')) return 'bg-red-50 border-red-200'
  if (action.includes('security') || action.includes('mfa')) return 'bg-orange-50 border-orange-200'
  if (action.includes('api_key')) return 'bg-blue-50 border-blue-200'
  
  return 'bg-gray-50 border-gray-200'
}

const AuditLogsTab = () => {
  const [showFilterModal, setShowFilterModal] = useState(false)
  const [filters, setFilters] = useState<AuditLogFilters>({
    search: '',
    action_type: '',
    user_id: '',
    start_date: '',
    end_date: '',
    limit: 50,
    offset: 0
  })

  const { data: auditData, loading, refetch } = useAuditLogs(filters)

  const handleSearchChange = (search: string) => {
    setFilters(prev => ({ ...prev, search, offset: 0 }))
  }

  const handleExportLogs = async () => {
    try {
      const csvContent = auditData?.logs.map((log: any) => [
        log.timestamp,
        log.user_email,
        log.action,
        log.success ? 'Success' : 'Failed',
        log.ip_address,
        log.details ? JSON.stringify(log.details) : ''
      ].join(',')).join('\n')
      
      const blob = new Blob([`Timestamp,User,Action,Status,IP Address,Details\n${csvContent}`], 
        { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch(err) {
      console.error("Failed to export logs:", err)
      alert("Error exporting logs.")
    }
  }

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    })
  }
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Audit Logs</h2>
          <p className="text-gray-600 mt-1">Track important activities and changes across your workspace.</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleExportLogs}
            className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50"
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
                            </button>
                            <button
            onClick={() => refetch()}
            disabled={loading}
            className="p-2 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                            >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                            </button>
                          </div>
                    </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search logs by keyword, IP, or user..."
            value={filters.search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
          />
                          </div>
        <button 
          onClick={() => setShowFilterModal(true)}
          className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50"
        >
          <Filter className="w-4 h-4 mr-2" />
          Filter
                        </button>
                      </div>
      
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <ul className="divide-y divide-gray-200">
          {auditData?.logs.map((log: any) => (
            <li key={log.id} className={`p-4 ${getActionColor(log.action, log.success)}`}>
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="mt-1">
                    {getActionIcon(log.action)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{log.action_description}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600">
                      <span className="inline-flex items-center gap-1">
                        <User className="w-3 h-3 text-gray-500" />
                        {log.user_email}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3 text-gray-500" />
                        {formatTimestamp(log.timestamp)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Globe className="w-3 h-3 text-gray-500" />
                        {log.ip_address}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-2 sm:mt-1 flex items-center space-x-2">
                  {log.success ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Success
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Failed
                    </span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex justify-between items-center text-sm text-gray-600">
        <p>Showing <strong>{auditData?.logs.length}</strong> of <strong>{auditData?.total}</strong> logs</p>
        <div className="flex items-center gap-2">
          <button 
            disabled={filters.offset === 0}
            onClick={() => setFilters(prev => ({...prev, offset: Math.max(0, prev.offset - prev.limit)}))}
            className="px-3 py-1 border rounded-lg hover:bg-gray-100 disabled:opacity-50"
          >
            Previous
          </button>
          <span>Page {Math.floor(filters.offset / filters.limit) + 1}</span>
          <button
            disabled={!auditData || (filters.offset + filters.limit) >= auditData.total}
            onClick={() => setFilters(prev => ({...prev, offset: prev.offset + prev.limit}))}
            className="px-3 py-1 border rounded-lg hover:bg-gray-100 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>

      <FilterModal
        isOpen={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        filters={filters}
        onFiltersChange={(newFilters) => setFilters(newFilters)}
      />
    </div>
  )
}

const IntegrationsTab = () => {
  const integrations = [
    { id: 1, name: 'AWS S3', type: 'Storage', status: 'Connected', icon: '☁️' },
    { id: 2, name: 'PostgreSQL', type: 'Database', status: 'Connected', icon: '🐘' },
    { id: 3, name: 'OpenAI', type: 'AI Service', status: 'Connected', icon: '🤖' },
    { id: 4, name: 'Slack', type: 'Communication', status: 'Disconnected', icon: '💬' },
  ]
  
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Connected Services</h3>
          <button className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            Add Integration
          </button>
        </div>
        
                      <div className="space-y-3">
          {integrations.map(integration => (
            <div key={integration.id} className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="text-2xl">{integration.icon}</div>
                            <div>
                  <p className="font-medium text-gray-900">{integration.name}</p>
                  <p className="text-sm text-gray-500">{integration.type}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className={cn(
                  "px-2 py-1 text-xs rounded-full",
                  integration.status === 'Connected' 
                    ? "bg-green-100 text-green-800" 
                    : "bg-gray-100 text-gray-700"
                )}>
                  {integration.status}
                </span>
                <button className="p-2 text-gray-500 hover:text-gray-700">
                  <Settings className="w-4 h-4" />
                </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
    </div>
  )
}

const NotificationsTab = () => {
  const [notifications, setNotifications] = useState({
    email: {
      security: true,
      billing: true,
      usage: false,
      system: true,
      marketing: false
    },
    push: {
      realTime: true,
      daily: false,
      weekly: true
    }
  })
  
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Email Notifications</h3>
        
        <div className="space-y-4">
          {Object.entries(notifications.email).map(([key, enabled]) => (
            <div key={key} className="flex items-center justify-between">
                    <div>
                <p className="font-medium text-gray-900 capitalize">{key.replace(/([A-Z])/g, ' $1')}</p>
                              <p className="text-sm text-gray-500">
                  {key === 'security' && 'Security alerts and login notifications'}
                  {key === 'billing' && 'Billing updates and payment reminders'}
                  {key === 'usage' && 'Usage reports and quota alerts'}
                  {key === 'system' && 'System maintenance and updates'}
                  {key === 'marketing' && 'Product updates and newsletters'}
                              </p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                  checked={enabled}
                  onChange={(e) => setNotifications(prev => ({
                    ...prev,
                    email: { ...prev.email, [key]: e.target.checked }
                  }))}
                                className="sr-only peer"
                              />
                              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
  )
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('account')

  const renderTabContent = () => {
    switch (activeTab) {
      case 'account': return <AccountTab />
      case 'security': return <SecurityTab />
      case 'api-keys': return <APIKeysTab />
      case 'billing': return <BillingTab />
      case 'team': return <TeamTab />
      case 'usage': return <UsageTab />
      case 'audit': return <AuditLogsTab />
      case 'integrations': return <IntegrationsTab />
      case 'notifications': return <NotificationsTab />
      default: return <AccountTab />
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings"
        description="Manage your account, security, billing, and team settings in one place."
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar Navigation */}
        <div className="lg:col-span-1">
          <nav className="space-y-2">
            {tabs.map(tab => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-colors",
                    activeTab === tab.id
                      ? "bg-blue-50 text-blue-700 border-l-4 border-blue-600"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  )}
                >
                  <Icon className="w-5 h-5" />
                    <div>
                    <p className="font-medium">{tab.label}</p>
                    <p className="text-xs text-gray-500">{tab.description}</p>
                  </div>
                    </button>
              )
            })}
          </nav>
                  </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          {renderTabContent()}
        </div>
      </div>
    </div>
  )
} 