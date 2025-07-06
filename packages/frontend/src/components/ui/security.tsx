'use client'

import { useState } from 'react'
import { 
  Shield, Smartphone, KeyRound, LogOut, Plus, Trash2, MoreVertical, 
  AlertTriangle, CheckCircle, RefreshCw, Eye, EyeOff, Settings, Lock, 
  Globe, Clock, User, Activity, TrendingUp, X, Save, Copy, Calendar,
  Zap, TestTube
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSecurityManagement } from '@/hooks/useAPIData'

export const SecurityMetricsCard = ({ metrics }: { metrics: any }) => {
  if (!metrics) return null

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Security Overview</h2>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">{metrics.total_users}</div>
          <div className="text-sm text-gray-500">Total Users</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">{metrics.active_sessions}</div>
          <div className="text-sm text-gray-500">Active Sessions</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-orange-600">{metrics.failed_logins_24h}</div>
          <div className="text-sm text-gray-500">Failed Logins (24h)</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-purple-600">{metrics.api_requests_24h}</div>
          <div className="text-sm text-gray-500">API Requests (24h)</div>
        </div>
      </div>

      <div className="border-t border-gray-200 pt-4">
        <h3 className="font-semibold text-gray-800 mb-3">Compliance Status</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(metrics.compliance_status).map(([key, status]) => (
            <div key={key} className="flex items-center space-x-2">
              {status ? (
                <CheckCircle className="w-4 h-4 text-green-600" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-600" />
              )}
              <span className="text-sm text-gray-700 capitalize">
                {key.replace(/_/g, ' ')}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export const SecurityRecommendationsCard = ({ recommendations }: { recommendations: any }) => {
  if (!recommendations) return null

  const getRecommendationIcon = (type: string) => {
    switch (type) {
      case 'critical': return <AlertTriangle className="w-5 h-5 text-red-600" />
      case 'warning': return <AlertTriangle className="w-5 h-5 text-orange-600" />
      default: return <Shield className="w-5 h-5 text-blue-600" />
    }
  }

  const getRecommendationColor = (type: string) => {
    switch (type) {
      case 'critical': return 'bg-red-50 border-red-200'
      case 'warning': return 'bg-orange-50 border-orange-200'
      default: return 'bg-blue-50 border-blue-200'
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-800">Security Recommendations</h2>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-500">Security Score:</span>
          <span className={`font-bold ${recommendations.security_score >= 80 ? 'text-green-600' : recommendations.security_score >= 60 ? 'text-orange-600' : 'text-red-600'}`}>
            {recommendations.security_score}/100
          </span>
        </div>
      </div>
      
      <div className="space-y-3">
        {recommendations.recommendations.slice(0, 5).map((rec: any) => (
          <div key={rec.id} className={`p-4 rounded-lg border ${getRecommendationColor(rec.type)}`}>
            <div className="flex items-start space-x-3">
              {getRecommendationIcon(rec.type)}
              <div className="flex-1">
                <h4 className="font-semibold text-gray-800">{rec.title}</h4>
                <p className="text-sm text-gray-600 mt-1">{rec.description}</p>
                {rec.action_required && (
                  <button className="mt-2 text-sm font-medium text-blue-600 hover:text-blue-700">
                    Take Action →
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export const ChangePasswordModal = ({ 
  isOpen, 
  onClose 
}: { 
  isOpen: boolean, 
  onClose: () => void 
}) => {
  const [formData, setFormData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  })
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  })
  
  const { changePassword, updating } = useSecurityManagement()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (formData.new_password !== formData.confirm_password) {
      alert('New passwords do not match')
      return
    }
    
    try {
      await changePassword(formData)
      onClose()
      setFormData({ current_password: '', new_password: '', confirm_password: '' })
    } catch (error) {
      console.error('Password change failed:', error)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 m-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-800">Change Password</h2>
          <button onClick={onClose} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Current Password</label>
            <div className="relative">
              <input
                type={showPasswords.current ? 'text' : 'password'}
                value={formData.current_password}
                onChange={(e) => setFormData(prev => ({ ...prev, current_password: e.target.value }))}
                className="w-full p-2 pr-10 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                required
              />
              <button
                type="button"
                onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                {showPasswords.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
            <div className="relative">
              <input
                type={showPasswords.new ? 'text' : 'password'}
                value={formData.new_password}
                onChange={(e) => setFormData(prev => ({ ...prev, new_password: e.target.value }))}
                className="w-full p-2 pr-10 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                required
              />
              <button
                type="button"
                onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Confirm New Password</label>
            <div className="relative">
              <input
                type={showPasswords.confirm ? 'text' : 'password'}
                value={formData.confirm_password}
                onChange={(e) => setFormData(prev => ({ ...prev, confirm_password: e.target.value }))}
                className="w-full p-2 pr-10 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                required
              />
              <button
                type="button"
                onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                className="absolute right-3 top-1/2 -translatey-1/2"
              >
                {showPasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updating}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {updating ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export const SecuritySettingCard = ({ 
  title, 
  description, 
  children, 
  action,
  loading = false 
}: { 
  title: string, 
  description: string, 
  children: React.ReactNode, 
  action?: React.ReactNode,
  loading?: boolean
}) => (
  <div className="bg-white rounded-2xl shadow-sm">
    <div className="p-6">
      <div className="flex flex-col md:flex-row justify-between md:items-center">
        <div className="flex-1 mb-4 md:mb-0">
          <h3 className="text-lg font-bold text-gray-800">{title}</h3>
          <p className="text-sm text-gray-600 mt-1">{description}</p>
        </div>
        {action}
      </div>
    </div>
    {loading ? (
      <div className="p-6 border-t border-gray-200 text-center text-gray-500">
        Loading...
      </div>
    ) : (
      <div className="border-t border-gray-200">
        {children}
      </div>
    )}
  </div>
)

interface CreateKeyModalProps {
  isOpen: boolean
  onClose: () => void
  onKeyCreated: (keyData: any) => void
}

export const CreateKeyModal = ({ isOpen, onClose, onKeyCreated }: CreateKeyModalProps) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permissions: [] as string[],
    expires_at: ''
  })
  
  const { createAPIKey, creating } = useSecurityManagement()

  const availablePermissions = [
    { id: 'read:data', name: 'Read Data', description: 'Access to read data and datasets' },
    { id: 'write:data', name: 'Write Data', description: 'Upload and modify data' },
    { id: 'read:transformations', name: 'Read Transformations', description: 'View transformation pipelines' },
    { id: 'write:transformations', name: 'Write Transformations', description: 'Create and execute transformations' },
    { id: 'read:labeling', name: 'Read Labeling', description: 'Access labeling projects and results' },
    { id: 'write:labeling', name: 'Write Labeling', description: 'Create and manage labeling projects' },
    { id: 'read:analytics', name: 'Read Analytics', description: 'Access analytics and metrics' },
    { id: 'admin', name: 'Admin Access', description: 'Full administrative access' }
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const result = await createAPIKey({
        ...formData,
        expires_at: formData.expires_at || undefined
      })
      onKeyCreated(result)
      onClose()
      setFormData({ name: '', description: '', permissions: [], expires_at: '' })
    } catch (error) {
      console.error('API key creation failed:', error)
    }
  }

  const togglePermission = (permission: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter(p => p !== permission)
        : [...prev.permissions, permission]
    }))
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 m-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-800">Create API Key</h2>
          <button onClick={onClose} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Key Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., Production API, Data Pipeline"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description (Optional)</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              rows={3}
              placeholder="Describe what this key will be used for..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Expiration Date (Optional)</label>
            <input
              type="date"
              value={formData.expires_at}
              onChange={(e) => setFormData(prev => ({ ...prev, expires_at: e.target.value }))}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              min={new Date().toISOString().split('T')[0]}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Permissions</label>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {availablePermissions.map(permission => (
                <div key={permission.id} className="flex items-start space-x-3">
                  <input
                    type="checkbox"
                    id={permission.id}
                    checked={formData.permissions.includes(permission.id)}
                    onChange={() => togglePermission(permission.id)}
                    className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <label htmlFor={permission.id} className="font-medium text-gray-800 cursor-pointer">
                      {permission.name}
                    </label>
                    <p className="text-sm text-gray-600">{permission.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating || formData.permissions.length === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create API Key'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export const NewKeyModal = ({ 
  keyData, 
  onClose 
}: { 
  keyData: any | null, 
  onClose: () => void 
}) => {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    if (keyData?.api_key) {
      navigator.clipboard.writeText(keyData.api_key)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (!keyData) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 m-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">API Key Generated</h2>
          <button onClick={onClose} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg flex items-start space-x-3">
          <AlertTriangle className="w-5 h-5 mt-0.5 text-yellow-500" />
          <div>
            <p className="text-sm font-medium">Security Warning</p>
            <p className="text-sm mt-1">
              {keyData.warning || 'Please copy this key and store it securely. For your security, we will not show it to you again.'}
            </p>
          </div>
        </div>
        
        <div className="mb-6 relative bg-gray-100 p-3 rounded-lg flex items-center">
          <code className="text-sm text-gray-700 font-mono flex-grow pr-10 break-all">
            {keyData.api_key}
          </code>
          <button 
            onClick={handleCopy} 
            className={cn(
              "absolute right-3 p-2 rounded-md transition-colors",
              copied ? "bg-green-100 text-green-600" : "text-gray-500 hover:bg-gray-200"
            )}
          >
            {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
        
        <button 
          onClick={onClose}
          className="w-full inline-flex justify-center items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg shadow-sm hover:bg-blue-700"
        >
          Done
        </button>
      </div>
    </div>
  )
}

export const KeyActionsMenu = ({ 
  keyId, 
  onRevoke, 
  onTest 
}: { 
  keyId: string, 
  onRevoke: (keyId: string) => void,
  onTest: (keyId: string) => void
}) => {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-gray-500 hover:bg-gray-100 rounded-full"
      >
        <MoreVertical className="w-4 h-4" />
      </button>
      {isOpen && (
        <div 
          className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl z-10"
          onMouseLeave={() => setIsOpen(false)}
        >
          <button 
            onClick={() => { onTest(keyId); setIsOpen(false); }}
            className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
          >
            <TestTube className="w-4 h-4 mr-2" />
            Test Key
          </button>
          <button 
            onClick={() => { onRevoke(keyId); setIsOpen(false); }}
            className="w-full text-left flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Revoke Key
          </button>
        </div>
      )}
    </div>
  )
} 