'use client'

import { useState } from 'react'
import { 
  Shield,
  Key,
  Lock,
  Eye,
  EyeOff,
  AlertTriangle,
  CheckCircle,
  Clock,
  Smartphone,
  Monitor,
  LogOut,
  Settings,
  Save
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

interface SecurityTabProps {
  onUnsavedChanges: (hasChanges: boolean) => void
}

export function SecurityTab({ onUnsavedChanges }: SecurityTabProps) {
  const [mfaEnabled, setMfaEnabled] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [passwordChangeRequired, setPasswordChangeRequired] = useState(false)

  const securityMetrics = {
    risk_level: 'Low',
    login_attempts: 12,
    last_password_change: '30 days ago',
    active_sessions: 3
  }

  const activeSessions = [
    {
      id: '1',
      device: 'MacBook Pro',
      location: 'San Francisco, CA',
      ip: '192.168.1.100',
      lastActive: '2 minutes ago',
      current: true
    },
    {
      id: '2', 
      device: 'iPhone 14',
      location: 'San Francisco, CA',
      ip: '192.168.1.101',
      lastActive: '1 hour ago',
      current: false
    }
  ]

  const handleMFAToggle = () => {
    setMfaEnabled(!mfaEnabled)
    onUnsavedChanges(true)
  }

  return (
    <div className="space-y-6">
      {/* Security Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-green-600" />
            Security Overview
          </CardTitle>
          <CardDescription>
            Your account security status and recommendations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
              </div>
              <div className="text-sm font-medium text-green-900">Risk Level</div>
              <div className="text-xs text-green-700">{securityMetrics.risk_level}</div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <Key className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-sm font-medium text-blue-900">Login Attempts</div>
              <div className="text-xs text-blue-700">{securityMetrics.login_attempts} this month</div>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <Clock className="w-4 h-4 text-yellow-600" />
              </div>
              <div className="text-sm font-medium text-yellow-900">Password</div>
              <div className="text-xs text-yellow-700">Changed {securityMetrics.last_password_change}</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <Monitor className="w-4 h-4 text-purple-600" />
              </div>
              <div className="text-sm font-medium text-purple-900">Active Sessions</div>
              <div className="text-xs text-purple-700">{securityMetrics.active_sessions} devices</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Authentication Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-blue-600" />
            Authentication & Access
          </CardTitle>
          <CardDescription>
            Manage your login credentials and multi-factor authentication
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Password Section */}
          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center">
                <Key className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h4 className="font-medium">Password</h4>
                <p className="text-sm text-gray-600">Last changed {securityMetrics.last_password_change}</p>
              </div>
            </div>
            <Button variant="outline" size="sm">
              Change Password
            </Button>
          </div>

          {/* MFA Section */}
          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center">
                <Smartphone className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h4 className="font-medium">Two-Factor Authentication</h4>
                <p className="text-sm text-gray-600">
                  {mfaEnabled ? 'Enabled via authenticator app' : 'Add an extra layer of security'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={mfaEnabled ? 'default' : 'secondary'}>
                {mfaEnabled ? 'Enabled' : 'Disabled'}
              </Badge>
              <Button 
                variant={mfaEnabled ? 'destructive' : 'default'} 
                size="sm"
                onClick={handleMFAToggle}
              >
                {mfaEnabled ? 'Disable' : 'Enable'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active Sessions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="w-5 h-5 text-gray-600" />
                Active Sessions
              </CardTitle>
              <CardDescription>
                Devices currently signed into your account
              </CardDescription>
            </div>
            <Button variant="outline" size="sm">
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out All Others
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {activeSessions.map((session) => (
              <div key={session.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center">
                    <Monitor className="w-5 h-5 text-gray-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{session.device}</h4>
                      {session.current && (
                        <Badge variant="default" className="text-xs">Current</Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">{session.location} • {session.ip}</p>
                    <p className="text-xs text-gray-500">Last active: {session.lastActive}</p>
                  </div>
                </div>
                {!session.current && (
                  <Button variant="outline" size="sm">
                    <LogOut className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Security Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
            Security Recommendations
          </CardTitle>
          <CardDescription>
            Suggestions to improve your account security
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {!mfaEnabled && (
              <div className="flex items-center gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-yellow-900">Enable Two-Factor Authentication</p>
                  <p className="text-xs text-yellow-700">Protect your account with an extra layer of security</p>
                </div>
                <Button size="sm" onClick={handleMFAToggle}>
                  Enable
                </Button>
              </div>
            )}
            <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div className="flex-1">
                <p className="text-sm font-medium text-green-900">Strong Password</p>
                <p className="text-xs text-green-700">Your password meets security requirements</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 