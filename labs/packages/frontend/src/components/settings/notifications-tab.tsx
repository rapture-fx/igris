'use client'

import { useState } from 'react'
import { Bell, Mail, MessageSquare, Save, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

const Section = ({ title, description, children }: { title: string, description: string, children: React.ReactNode }) => (
  <div className="p-6 border-b border-gray-200">
    <h4 className="text-md font-semibold text-gray-800">{title}</h4>
    <p className="text-sm text-gray-600 mt-1">{description}</p>
    <div className="mt-4 space-y-4">
      {children}
    </div>
  </div>
);

const Toggle = ({ label, enabled, onChange }: { label: string, enabled: boolean, onChange: (enabled: boolean) => void }) => (
  <div className="flex items-center justify-between">
    <span className="text-sm font-medium text-gray-700">{label}</span>
    <button
      type="button"
      className={`${
        enabled ? 'bg-blue-600' : 'bg-gray-200'
      } relative inline-flex items-center h-6 rounded-full w-11 transition-colors`}
      onClick={() => onChange(!enabled)}
    >
      <span
        className={`${
          enabled ? 'translate-x-6' : 'translate-x-1'
        } inline-block w-4 h-4 transform bg-white rounded-full transition-transform`}
      />
    </button>
  </div>
);

export const NotificationsTab = () => {
  const [settings, setSettings] = useState({
    email: {
      pipelineStatus: true,
      securityAlerts: true,
      newTeamMember: false,
      productUpdates: true,
    },
    push: {
      pipelineStatus: false,
      securityAlerts: true,
    }
  })
  const [saving, setSaving] = useState(false)

  const handleSave = () => {
    setSaving(true)
    setTimeout(() => {
      setSaving(false)
      toast.success('Notification settings saved!')
    }, 1500)
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
        <p className="mt-1 text-sm text-gray-600">Manage how you receive notifications from our platform.</p>
      </div>
      
      <Section title="Email Notifications" description="Receive updates and alerts directly in your inbox.">
        <Toggle 
          label="Pipeline Status Changes"
          enabled={settings.email.pipelineStatus}
          onChange={(val) => setSettings(p => ({...p, email: {...p.email, pipelineStatus: val}}))}
        />
        <Toggle 
          label="Critical Security Alerts"
          enabled={settings.email.securityAlerts}
          onChange={(val) => setSettings(p => ({...p, email: {...p.email, securityAlerts: val}}))}
        />
        <Toggle 
          label="New Team Member Joined"
          enabled={settings.email.newTeamMember}
          onChange={(val) => setSettings(p => ({...p, email: {...p.email, newTeamMember: val}}))}
        />
        <Toggle 
          label="Product Updates & News"
          enabled={settings.email.productUpdates}
          onChange={(val) => setSettings(p => ({...p, email: {...p.email, productUpdates: val}}))}
        />
      </Section>
      
      <Section title="Push Notifications" description="Get real-time alerts on your devices (coming soon).">
        <div className="opacity-50">
          <Toggle 
            label="Pipeline Status Changes"
            enabled={settings.push.pipelineStatus}
            onChange={(val) => {}}
          />
          <Toggle 
            label="Critical Security Alerts"
            enabled={settings.push.securityAlerts}
            onChange={(val) => {}}
          />
        </div>
      </Section>

      <div className="p-6 bg-gray-50 flex justify-end">
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
  )
} 