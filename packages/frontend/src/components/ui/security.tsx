'use client'

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Shield, 
  Key, 
  AlertTriangle, 
  CheckCircle, 
  X, 
  Eye, 
  EyeOff,
  Copy,
  Settings,
  Lock
} from 'lucide-react';
import { cn } from '@/lib/utils'
import { useSecurityManagement } from '@/hooks/useAPIData'

// Create Key Modal
interface CreateKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateKey: (name: string, permissions: string[]) => void;
}

export function CreateKeyModal({ isOpen, onClose, onCreateKey }: CreateKeyModalProps) {
  const [keyName, setKeyName] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  const permissions = [
    { id: 'read', label: 'Read Data', description: 'View and query data' },
    { id: 'write', label: 'Write Data', description: 'Create and modify data' },
    { id: 'delete', label: 'Delete Data', description: 'Remove data' },
    { id: 'admin', label: 'Admin Access', description: 'Full administrative access' },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (keyName.trim()) {
      onCreateKey(keyName, selectedPermissions);
      setKeyName('');
      setSelectedPermissions([]);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Create API Key</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Key Name</label>
            <Input
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              placeholder="Enter key name"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Permissions</label>
            <div className="space-y-2">
              {permissions.map((permission) => (
                <label key={permission.id} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={selectedPermissions.includes(permission.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedPermissions([...selectedPermissions, permission.id]);
                      } else {
                        setSelectedPermissions(selectedPermissions.filter(p => p !== permission.id));
                      }
                    }}
                    className="rounded border-gray-300"
                  />
                  <div>
                    <div className="font-medium">{permission.label}</div>
                    <div className="text-sm text-gray-500">{permission.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Create Key</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// New Key Modal (shows generated key)
interface NewKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
  keyName: string;
}

export function NewKeyModal({ isOpen, onClose, apiKey, keyName }: NewKeyModalProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">API Key Created</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
              <span className="font-medium text-yellow-800">Important!</span>
            </div>
            <p className="text-sm text-yellow-700">
              This is the only time you'll be able to see this key. Make sure to copy it now.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Key Name</label>
            <p className="text-sm text-gray-600">{keyName}</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">API Key</label>
            <div className="flex items-center space-x-2">
              <Input value={apiKey} readOnly className="font-mono text-sm" />
              <Button onClick={copyToClipboard} size="sm">
                {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={onClose}>Done</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Security Metrics Card
interface SecurityMetricsCardProps {
  title: string;
  metrics: Array<{
    label: string;
    value: string | number;
    status: 'good' | 'warning' | 'danger';
  }>;
}

export function SecurityMetricsCard({ title, metrics }: SecurityMetricsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {metrics.map((metric, index) => (
            <div key={index} className="flex justify-between items-center">
              <span className="text-sm text-gray-600">{metric.label}</span>
              <Badge variant={metric.status === 'good' ? 'default' : 
                            metric.status === 'warning' ? 'secondary' : 'destructive'}>
                {metric.value}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Security Recommendations Card
interface SecurityRecommendationsCardProps {
  recommendations: Array<{
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    completed: boolean;
  }>;
}

export function SecurityRecommendationsCard({ recommendations }: SecurityRecommendationsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          Security Recommendations
        </CardTitle>
        <CardDescription>
          Improve your security posture with these recommendations
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {recommendations.map((rec, index) => (
            <div key={index} className="flex items-start space-x-3">
              {rec.completed ? (
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
              ) : (
                <AlertTriangle className={`w-5 h-5 mt-0.5 ${
                  rec.priority === 'high' ? 'text-red-500' :
                  rec.priority === 'medium' ? 'text-yellow-500' : 'text-blue-500'
                }`} />
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium">{rec.title}</h4>
                  <Badge variant={rec.priority === 'high' ? 'destructive' : 
                               rec.priority === 'medium' ? 'secondary' : 'default'}>
                    {rec.priority}
                  </Badge>
                </div>
                <p className="text-sm text-gray-600 mt-1">{rec.description}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Security Setting Card
interface SecuritySettingCardProps {
  title: string;
  description: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  icon?: React.ReactNode;
}

export function SecuritySettingCard({ 
  title, 
  description, 
  enabled, 
  onToggle, 
  icon = <Settings className="w-5 h-5" />
}: SecuritySettingCardProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-start space-x-3">
            {icon}
            <div>
              <h3 className="font-medium">{title}</h3>
              <p className="text-sm text-gray-600 mt-1">{description}</p>
            </div>
          </div>
          <Button
            variant={enabled ? 'default' : 'outline'}
            size="sm"
            onClick={() => onToggle(!enabled)}
          >
            {enabled ? 'Enabled' : 'Disabled'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Change Password Modal
interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChangePassword: (currentPassword: string, newPassword: string) => void;
}

export function ChangePasswordModal({ isOpen, onClose, onChangePassword }: ChangePasswordModalProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      alert('Password must be at least 8 characters long');
      return;
    }
    onChangePassword(currentPassword, newPassword);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Lock className="w-5 h-5" />
            Change Password
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Current Password</label>
            <div className="relative">
              <Input
                type={showPasswords ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 transform -translate-y-1/2"
                onClick={() => setShowPasswords(!showPasswords)}
              >
                {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">New Password</label>
            <Input
              type={showPasswords ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Confirm New Password</label>
            <Input
              type={showPasswords ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Change Password</Button>
          </div>
        </form>
      </div>
    </div>
  );
} 