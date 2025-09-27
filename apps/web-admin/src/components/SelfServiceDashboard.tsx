'use client'

import React, { useState, useEffect } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '@/components/ui/tabs'
import {
  Alert,
  AlertDescription,
  AlertTitle
} from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import {
  Settings,
  Key,
  Users,
  CreditCard,
  FileText,
  MessageSquare,
  AlertTriangle,
  CheckCircle,
  Download,
  Copy,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  RefreshCw
} from 'lucide-react'

interface SelfServiceDashboardProps {
  customerId: string
  apiKey: string
}

interface ApiKey {
  id: string
  name: string
  key: string
  permissions: string[]
  created_at: string
  last_used: string | null
  is_active: boolean
}

interface TeamMember {
  id: string
  email: string
  role: string
  status: 'active' | 'pending' | 'suspended'
  invited_at: string
  last_login: string | null
}

interface SupportTicket {
  id: string
  subject: string
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  priority: 'low' | 'medium' | 'high' | 'critical'
  created_at: string
  updated_at: string
  messages_count: number
}

interface BillingInfo {
  plan_tier: string
  billing_cycle: string
  current_usage: {
    api_calls: number
    data_processed_gb: number
    ml_jobs: number
  }
  limits: {
    api_calls: number
    data_processed_gb: number
    ml_jobs: number
  }
  next_billing_date: string
  current_cost: number
}

const SelfServiceDashboard: React.FC<SelfServiceDashboardProps> = ({ customerId, apiKey }) => {
  const [activeTab, setActiveTab] = useState('overview')
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([])
  const [billingInfo, setBillingInfo] = useState<BillingInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Form states
  const [newApiKeyName, setNewApiKeyName] = useState('')
  const [newMemberEmail, setNewMemberEmail] = useState('')
  const [newMemberRole, setNewMemberRole] = useState('member')
  const [supportTicketSubject, setSupportTicketSubject] = useState('')
  const [supportTicketMessage, setSupportTicketMessage] = useState('')
  const [supportTicketPriority, setSupportTicketPriority] = useState('medium')
  const [showApiKey, setShowApiKey] = useState<Record<string, boolean>>({})

  useEffect(() => {
    fetchDashboardData()
  }, [customerId])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)

      // Fetch all dashboard data in parallel
      const [apiKeysRes, teamRes, ticketsRes, billingRes] = await Promise.all([
        fetch(`/api/v1/self-service/api-keys/${customerId}`, {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        }),
        fetch(`/api/v1/self-service/team/${customerId}`, {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        }),
        fetch(`/api/v1/self-service/support/${customerId}`, {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        }),
        fetch(`/api/v1/self-service/billing/${customerId}`, {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        })
      ])

      if (apiKeysRes.ok) {
        const data = await apiKeysRes.json()
        setApiKeys(data.api_keys || [])
      }

      if (teamRes.ok) {
        const data = await teamRes.json()
        setTeamMembers(data.team_members || [])
      }

      if (ticketsRes.ok) {
        const data = await ticketsRes.json()
        setSupportTickets(data.tickets || [])
      }

      if (billingRes.ok) {
        const data = await billingRes.json()
        setBillingInfo(data)
      }

      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch dashboard data')
    } finally {
      setLoading(false)
    }
  }

  const createApiKey = async () => {
    if (!newApiKeyName.trim()) {
      setError('API key name is required')
      return
    }

    try {
      const response = await fetch(`/api/v1/self-service/api-keys/${customerId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newApiKeyName,
          permissions: ['read', 'write']
        })
      })

      if (response.ok) {
        const newKey = await response.json()
        setApiKeys([...apiKeys, newKey])
        setNewApiKeyName('')
      } else {
        throw new Error('Failed to create API key')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create API key')
    }
  }

  const revokeApiKey = async (keyId: string) => {
    try {
      const response = await fetch(`/api/v1/self-service/api-keys/${customerId}/${keyId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${apiKey}` }
      })

      if (response.ok) {
        setApiKeys(apiKeys.filter(key => key.id !== keyId))
      } else {
        throw new Error('Failed to revoke API key')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke API key')
    }
  }

  const inviteTeamMember = async () => {
    if (!newMemberEmail.trim()) {
      setError('Email is required')
      return
    }

    try {
      const response = await fetch(`/api/v1/self-service/team/${customerId}/invite`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: newMemberEmail,
          role: newMemberRole
        })
      })

      if (response.ok) {
        const newMember = await response.json()
        setTeamMembers([...teamMembers, newMember])
        setNewMemberEmail('')
        setNewMemberRole('member')
      } else {
        throw new Error('Failed to invite team member')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to invite team member')
    }
  }

  const createSupportTicket = async () => {
    if (!supportTicketSubject.trim() || !supportTicketMessage.trim()) {
      setError('Subject and message are required')
      return
    }

    try {
      const response = await fetch(`/api/v1/self-service/support/${customerId}/tickets`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          subject: supportTicketSubject,
          message: supportTicketMessage,
          priority: supportTicketPriority
        })
      })

      if (response.ok) {
        const newTicket = await response.json()
        setSupportTickets([newTicket, ...supportTickets])
        setSupportTicketSubject('')
        setSupportTicketMessage('')
        setSupportTicketPriority('medium')
      } else {
        throw new Error('Failed to create support ticket')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create support ticket')
    }
  }

  const downloadApiDocs = async () => {
    try {
      const response = await fetch(`/api/v1/self-service/docs/${customerId}/download`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'schlep-engine-api-docs.pdf'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download documentation')
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const toggleApiKeyVisibility = (keyId: string) => {
    setShowApiKey(prev => ({ ...prev, [keyId]: !prev[keyId] }))
  }

  const getBadgeColor = (status: string) => {
    switch (status) {
      case 'active':
      case 'resolved':
        return 'bg-green-500'
      case 'pending':
      case 'in_progress':
        return 'bg-yellow-500'
      case 'suspended':
      case 'open':
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-600'
      case 'high':
        return 'bg-red-400'
      case 'medium':
        return 'bg-yellow-500'
      case 'low':
        return 'bg-green-500'
      default:
        return 'bg-gray-500'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading dashboard...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Self-Service Dashboard</h1>
          <p className="text-gray-600">
            Manage your Schlep-engine account, API keys, team, and support tickets
          </p>
        </div>
        <Button variant="outline" onClick={fetchDashboardData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="api-keys">API Keys</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="support">Support</TabsTrigger>
          <TabsTrigger value="docs">Documentation</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Key className="h-4 w-4 mr-2" />
                  API Keys
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{apiKeys.length}</div>
                <div className="text-sm text-gray-600">
                  {apiKeys.filter(k => k.is_active).length} active
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="h-4 w-4 mr-2" />
                  Team Members
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{teamMembers.length}</div>
                <div className="text-sm text-gray-600">
                  {teamMembers.filter(m => m.status === 'active').length} active
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Support Tickets
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{supportTickets.length}</div>
                <div className="text-sm text-gray-600">
                  {supportTickets.filter(t => t.status === 'open').length} open
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CreditCard className="h-4 w-4 mr-2" />
                  Current Plan
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold capitalize">
                  {billingInfo?.plan_tier || 'Unknown'}
                </div>
                <div className="text-sm text-gray-600">
                  ${billingInfo?.current_cost || 0}/month
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Usage Overview */}
          {billingInfo && (
            <Card>
              <CardHeader>
                <CardTitle>Usage Overview</CardTitle>
                <CardDescription>Current month usage vs limits</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm">
                      <span>API Calls</span>
                      <span>{billingInfo.current_usage.api_calls.toLocaleString()} / {billingInfo.limits.api_calls.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{
                          width: `${Math.min(100, (billingInfo.current_usage.api_calls / billingInfo.limits.api_calls) * 100)}%`
                        }}
                      ></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm">
                      <span>Data Processed</span>
                      <span>{billingInfo.current_usage.data_processed_gb}GB / {billingInfo.limits.data_processed_gb}GB</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-600 h-2 rounded-full"
                        style={{
                          width: `${Math.min(100, (billingInfo.current_usage.data_processed_gb / billingInfo.limits.data_processed_gb) * 100)}%`
                        }}
                      ></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm">
                      <span>ML Jobs</span>
                      <span>{billingInfo.current_usage.ml_jobs} / {billingInfo.limits.ml_jobs}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-purple-600 h-2 rounded-full"
                        style={{
                          width: `${Math.min(100, (billingInfo.current_usage.ml_jobs / billingInfo.limits.ml_jobs) * 100)}%`
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* API Keys Tab */}
        <TabsContent value="api-keys" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Create New API Key</CardTitle>
              <CardDescription>Generate a new API key for your applications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex space-x-2">
                <Input
                  placeholder="API key name"
                  value={newApiKeyName}
                  onChange={(e) => setNewApiKeyName(e.target.value)}
                />
                <Button onClick={createApiKey}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>API Keys</CardTitle>
              <CardDescription>Manage your API keys</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Key</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Last Used</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {apiKeys.map((key) => (
                    <TableRow key={key.id}>
                      <TableCell>{key.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <code className="text-sm">
                            {showApiKey[key.id] ? key.key : '••••••••••••••••'}
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleApiKeyVisibility(key.id)}
                          >
                            {showApiKey[key.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(key.key)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getBadgeColor(key.is_active ? 'active' : 'inactive')}>
                          {key.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(key.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        {key.last_used ? new Date(key.last_used).toLocaleDateString() : 'Never'}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => revokeApiKey(key.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Team Tab */}
        <TabsContent value="team" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Invite Team Member</CardTitle>
              <CardDescription>Add new team members to your organization</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex space-x-2">
                <Input
                  placeholder="Email address"
                  type="email"
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                />
                <Select value={newMemberRole} onValueChange={setNewMemberRole}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={inviteTeamMember}>
                  <Plus className="h-4 w-4 mr-2" />
                  Invite
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Team Members</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Invited</TableHead>
                    <TableHead>Last Login</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamMembers.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell>{member.email}</TableCell>
                      <TableCell className="capitalize">{member.role}</TableCell>
                      <TableCell>
                        <Badge className={getBadgeColor(member.status)}>
                          {member.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(member.invited_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        {member.last_login ? new Date(member.last_login).toLocaleDateString() : 'Never'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Billing Tab */}
        <TabsContent value="billing" className="space-y-6">
          {billingInfo && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Billing Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label>Current Plan</Label>
                      <div className="text-2xl font-bold capitalize">{billingInfo.plan_tier}</div>
                    </div>
                    <div>
                      <Label>Billing Cycle</Label>
                      <div className="text-2xl font-bold capitalize">{billingInfo.billing_cycle}</div>
                    </div>
                    <div>
                      <Label>Current Cost</Label>
                      <div className="text-2xl font-bold">${billingInfo.current_cost}/month</div>
                    </div>
                    <div>
                      <Label>Next Billing Date</Label>
                      <div className="text-2xl font-bold">
                        {new Date(billingInfo.next_billing_date).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Usage Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {Object.entries(billingInfo.current_usage).map(([key, value]) => (
                      <div key={key}>
                        <div className="flex justify-between">
                          <span className="capitalize">{key.replace(/_/g, ' ')}</span>
                          <span>{typeof value === 'number' ? value.toLocaleString() : value}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Support Tab */}
        <TabsContent value="support" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Create Support Ticket</CardTitle>
              <CardDescription>Get help from our support team</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  placeholder="Brief description of your issue"
                  value={supportTicketSubject}
                  onChange={(e) => setSupportTicketSubject(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  placeholder="Detailed description of your issue"
                  value={supportTicketMessage}
                  onChange={(e) => setSupportTicketMessage(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="priority">Priority</Label>
                <Select value={supportTicketPriority} onValueChange={setSupportTicketPriority}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={createSupportTicket}>
                <MessageSquare className="h-4 w-4 mr-2" />
                Create Ticket
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Support Tickets</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Messages</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supportTickets.map((ticket) => (
                    <TableRow key={ticket.id}>
                      <TableCell>{ticket.subject}</TableCell>
                      <TableCell>
                        <Badge className={getBadgeColor(ticket.status)}>
                          {ticket.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getPriorityColor(ticket.priority)}>
                          {ticket.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(ticket.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>{ticket.messages_count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documentation Tab */}
        <TabsContent value="docs" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Documentation & Resources</CardTitle>
              <CardDescription>Access API documentation and helpful resources</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">API Documentation</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 mb-4">
                      Complete API reference with examples and code samples
                    </p>
                    <div className="space-y-2">
                      <Button variant="outline" className="w-full" onClick={() => window.open('http://localhost:3005', '_blank')}>
                        <FileText className="h-4 w-4 mr-2" />
                        View Online Docs
                      </Button>
                      <Button variant="outline" className="w-full" onClick={downloadApiDocs}>
                        <Download className="h-4 w-4 mr-2" />
                        Download PDF
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Getting Started</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 mb-4">
                      Quick start guides and tutorials
                    </p>
                    <div className="space-y-2">
                      <Button variant="outline" className="w-full" onClick={() => window.open('http://localhost:3005/getting-started', '_blank')}>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Getting Started Guide
                      </Button>
                      <Button variant="outline" className="w-full" onClick={() => window.open('http://localhost:3005/tutorials', '_blank')}>
                        <FileText className="h-4 w-4 mr-2" />
                        Tutorials
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Code Examples</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 mb-4">
                      Sample code in various programming languages
                    </p>
                    <div className="space-y-2">
                      <Button variant="outline" className="w-full" onClick={() => window.open('https://github.com/schlep-engine/examples', '_blank')}>
                        <FileText className="h-4 w-4 mr-2" />
                        View on GitHub
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Status Page</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 mb-4">
                      Real-time service status and incident reports
                    </p>
                    <div className="space-y-2">
                      <Button variant="outline" className="w-full" onClick={() => window.open('/status', '_blank')}>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Service Status
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default SelfServiceDashboard