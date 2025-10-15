'use client'

import { useState } from 'react'
import { 
  ShieldCheck, 
  Search, 
  Filter, 
  User, 
  Activity, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  Download,
  Terminal,
  Database,
  KeyRound,
  FileText
} from 'lucide-react'
import { useAuditLogs } from '@/hooks/useAPIData'
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
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const formatTimestamp = (timestamp: string) => {
  return new Date(timestamp).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

const getActionIcon = (action: string) => {
  const props = { className: 'w-4 h-4' }
  if (action.includes('login')) return <KeyRound {...props} />
  if (action.includes('data')) return <Database {...props} />
  if (action.includes('file')) return <FileText {...props} />
  if (action.includes('job')) return <Terminal {...props} />
  return <Activity {...props} />
}

const getActionColor = (action: string, success: boolean) => {
  if (!success) return 'bg-red-100 text-red-800'
  if (action.includes('delete') || action.includes('revoke')) return 'bg-yellow-100 text-yellow-800'
  if (action.includes('create') || action.includes('login')) return 'bg-blue-100 text-blue-800'
  return 'bg-green-100 text-green-800'
}

export function AuditLogsTab() {
  const [filters, setFilters] = useState({ search: '', action_type: '', user_id: '' })
  const { data: auditLogs, loading } = useAuditLogs({
    search: filters.search,
    action_type: filters.action_type,
    user_id: filters.user_id,
  })

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters(prev => ({ ...prev, search: e.target.value }))
  }
  
  const renderSkeleton = () => (
    [...Array(5)].map((_, i) => (
      <TableRow key={i}>
        <TableCell className="w-2/5"><Skeleton className="h-4 w-full" /></TableCell>
        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
        <TableCell><Skeleton className="h-4 w-40" /></TableCell>
      </TableRow>
    ))
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit Logs</CardTitle>
        <CardDescription>Review all system and user activity for security and compliance.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between mb-4 gap-4">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <Input 
              placeholder="Search by action, user, or IP..." 
              value={filters.search}
              onChange={handleSearchChange}
              className="pl-10" 
            />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline">
              <Filter className="w-4 h-4 mr-2" />
              Filter
            </Button>
            <Button variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Action</TableHead>
              <TableHead>User</TableHead>
              <TableHead>IP Address</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Timestamp</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? renderSkeleton() : (
              auditLogs?.logs.map((log: any) => (
                <TableRow key={log.id}>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <span className={cn('p-1.5 rounded-full', getActionColor(log.action, log.success))}>
                        {getActionIcon(log.action)}
                      </span>
                      <span className="font-medium">{log.action}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 ml-8">{log.details}</p>
                  </TableCell>
                  <TableCell>{log.user_id || 'System'}</TableCell>
                  <TableCell>{log.ip_address}</TableCell>
                  <TableCell>
                    {log.success ? (
                      <Badge variant="success" className="flex items-center w-fit">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Success
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="flex items-center w-fit">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        Failed
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{formatTimestamp(log.timestamp)}</TableCell>
                </TableRow>
              ))
            )}
            {!loading && auditLogs?.logs.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10">
                  <p className="font-semibold">No audit logs found.</p>
                  <p className="text-sm text-gray-500">Try adjusting your filters.</p>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
} 