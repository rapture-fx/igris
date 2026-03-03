'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/apiClient';
import { getRelativeTime, truncateText } from '@/utils/helpers';
import { Bell, AlertTriangle, AlertCircle, Info, CheckCircle, Search, RefreshCw } from 'lucide-react';

interface Alert {
  id: string;
  timestamp: string;
  severity: string;
  message: string;
  status: string;
  source?: string;
}

const SEVERITY_OPTIONS = ['all', 'CRITICAL', 'WARNING', 'INFO'];
const STATUS_OPTIONS = ['all', 'ACTIVE', 'RESOLVED'];

const SEVERITY_ICON: Record<string, any> = {
  CRITICAL: AlertCircle,
  WARNING: AlertTriangle,
  INFO: Info,
};

const SEVERITY_STYLE: Record<string, string> = {
  CRITICAL: 'text-red-700 bg-red-50 border-red-200',
  WARNING: 'text-yellow-700 bg-yellow-50 border-yellow-200',
  INFO: 'text-blue-700 bg-blue-50 border-blue-200',
};

export default function HistoryAlertsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: alerts = [], isLoading, refetch } = useQuery<Alert[]>({
    queryKey: ['history-alerts'],
    queryFn: () => api.get('/v1/history/alerts?limit=200&sort=timestamp:desc'),
    refetchInterval: 30000,
    retry: false,
  });

  const resolveMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/v1/history/alerts/${id}`, { status: 'RESOLVED' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['history-alerts'] }),
  });

  const filtered = useMemo(() =>
    alerts.filter((a) => {
      const matchSearch = !search || a.message.toLowerCase().includes(search.toLowerCase());
      const matchSev = severityFilter === 'all' || a.severity === severityFilter;
      const matchStatus = statusFilter === 'all' || a.status === statusFilter;
      return matchSearch && matchSev && matchStatus;
    }), [alerts, search, severityFilter, statusFilter]);

  const activeCount = alerts.filter((a) => a.status === 'ACTIVE').length;
  const criticalCount = alerts.filter((a) => a.severity === 'CRITICAL' && a.status === 'ACTIVE').length;
  const resolvedCount = alerts.filter((a) => a.status === 'RESOLVED').length;

  const STAT_CARDS = [
    { label: 'Active', value: activeCount, color: 'text-red-600', icon: Bell },
    { label: 'Critical', value: criticalCount, color: 'text-red-700', icon: AlertCircle },
    { label: 'Resolved', value: resolvedCount, color: 'text-green-600', icon: CheckCircle },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Alerts</h1>
          <p className="text-xs text-gray-500 mt-0.5">Active and historical alerts.</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-3">
          {STAT_CARDS.map((c) => (
            <Card key={c.label} className="border border-gray-200">
              <CardHeader className="px-4 pt-3 pb-0">
                <CardTitle className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
                  <c.icon className={`h-3.5 w-3.5 ${c.color}`} />
                  {c.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 pt-1">
                {isLoading ? <Skeleton className="h-6 w-10" /> : (
                  <span className="text-base font-semibold text-gray-900 tabular-nums">{c.value}</span>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Action Bar */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <Input
              placeholder="Search alerts..."
              className="pl-8 h-8 text-xs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              {SEVERITY_OPTIONS.map((s) => (
                <SelectItem key={s} value={s} className="text-xs">{s === 'all' ? 'All severities' : s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-28 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s} className="text-xs">{s === 'all' ? 'All statuses' : s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </div>

        {/* Table */}
        <Card className="border border-gray-200">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-16" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-400 py-12">No alerts found</TableCell>
                </TableRow>
              ) : (
                filtered.map((alert) => {
                  const Icon = SEVERITY_ICON[alert.severity] ?? Info;
                  const style = SEVERITY_STYLE[alert.severity] ?? 'text-gray-700 bg-gray-50 border-gray-200';
                  return (
                    <TableRow key={alert.id}>
                      <TableCell className="text-xs text-gray-500 whitespace-nowrap">
                        {getRelativeTime(alert.timestamp)}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium border ${style}`}>
                          <Icon className="h-3 w-3" />
                          {alert.severity}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-gray-700 max-w-xs">
                        <span title={alert.message}>{truncateText(alert.message, 80)}</span>
                      </TableCell>
                      <TableCell className="text-xs text-gray-500">
                        {alert.source ?? '—'}
                      </TableCell>
                      <TableCell>
                        <span className={`text-xs px-2 py-0.5 rounded-md border font-medium ${
                          alert.status === 'ACTIVE'
                            ? 'text-red-700 bg-red-50 border-red-200'
                            : 'text-gray-600 bg-gray-50 border-gray-200'
                        }`}>
                          {alert.status}
                        </span>
                      </TableCell>
                      <TableCell>
                        {alert.status === 'ACTIVE' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 text-xs px-2"
                            onClick={() => resolveMutation.mutate(alert.id)}
                            disabled={resolveMutation.isPending}
                          >
                            Resolve
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </DashboardLayout>
  );
}
