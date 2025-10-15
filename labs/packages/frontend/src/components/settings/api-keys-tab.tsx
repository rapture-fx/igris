'use client'

import { useState } from 'react'
import { 
  KeyRound,
  Shield,
  Activity,
  Calendar,
  Plus,
  Trash2,
  Check,
  ClipboardCopy,
  MoreVertical
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useAPIKeys, useSecurityManagement } from '@/hooks/useAPIData'
import { CreateKeyModal, NewKeyModal } from '@/components/ui/security'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'


const formatLastUsed = (timestamp: string | null) => {
  if (!timestamp) return 'Never'
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins} minutes ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours} hours ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays} days ago`
}

export function APIKeysTab() {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newKeyData, setNewKeyData] = useState<any | null>(null)
  
  const { data: apiKeys, loading, refetch } = useAPIKeys()
  const { revokeAPIKey, revoking, testing, testAPIKey } = useSecurityManagement()

  const handleKeyCreated = (keyData: any) => {
    setNewKeyData(keyData)
    refetch()
    toast.success('API Key created successfully!')
  }

  const handleRevokeKey = async (keyId: string, keyName: string) => {
    toast.warning(`Are you sure you want to revoke the key "${keyName}"?`, {
      action: {
        label: 'Revoke Key',
        onClick: async () => {
          try {
            await revokeAPIKey(keyId)
            toast.success(`API Key "${keyName}" has been revoked.`)
            refetch()
          } catch (error) {
            toast.error('Failed to revoke API key.')
            console.error('Failed to revoke API key:', error)
          }
        },
      },
    })
  }
  
  const handleTestKey = async (keyId: string, keyName: string) => {
    const toastId = toast.loading(`Testing key "${keyName}"...`)
    try {
      const result = await testAPIKey(keyId)
      toast.success(`Test for "${keyName}" successful: ${result.message}`, { id: toastId })
    } catch (error: any) {
      toast.error(`Test for "${keyName}" failed: ${error.message}`, { id: toastId })
    }
  }

  const KeyStatus = ({ isActive, expiresAt }: { isActive: boolean; expiresAt?: string }) => {
    if (!isActive) {
      return <Badge variant="destructive">Revoked</Badge>
    }
    if (expiresAt && new Date(expiresAt) < new Date()) {
      return <Badge variant="secondary">Expired</Badge>
    }
    return <Badge variant="success">Active</Badge>
  }
  
  const renderSkeleton = () => (
    [...Array(3)].map((_, i) => (
      <TableRow key={i}>
        <TableCell><Skeleton className="h-4 w-40" /></TableCell>
        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
        <TableCell><Skeleton className="h-8 w-8" /></TableCell>
      </TableRow>
    ))
  )

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>API Keys</CardTitle>
          <CardDescription>Manage and secure your API access for applications and services.</CardDescription>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create API Key
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name / Description</TableHead>
              <TableHead>Permissions</TableHead>
              <TableHead>Last Used</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? renderSkeleton() : (
              apiKeys?.keys.map((key: any) => (
                <TableRow key={key.id}>
                  <TableCell>
                    <div className="font-medium">{key.name}</div>
                    <div className="text-sm text-gray-500">{key.description}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{key.permissions.length} permissions</Badge>
                  </TableCell>
                  <TableCell>{formatLastUsed(key.last_used)}</TableCell>
                  <TableCell>{key.expires_at ? new Date(key.expires_at).toLocaleDateString() : 'Never'}</TableCell>
                  <TableCell><KeyStatus isActive={key.is_active} expiresAt={key.expires_at} /></TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onSelect={() => handleTestKey(key.id, key.name)} disabled={testing}>
                          Test Key
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => handleRevokeKey(key.id, key.name)} disabled={revoking} className="text-red-600">
                          Revoke Key
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
            {!loading && apiKeys?.keys.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10">
                  <p className="font-semibold">No API keys yet.</p>
                  <p className="text-sm text-gray-500">Click "Create API Key" to get started.</p>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>

      <CreateKeyModal 
        isOpen={showCreateModal} 
        onClose={() => setShowCreateModal(false)}
        onKeyCreated={handleKeyCreated}
      />
      <NewKeyModal
        keyData={newKeyData}
        onClose={() => setNewKeyData(null)}
      />
    </Card>
  )
} 