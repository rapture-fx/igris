'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/apiClient';
import { getRelativeTime, truncateText } from '@/utils/helpers';
import { FileCheck, FileX, AlertTriangle, Search, RefreshCw, Hash, Shield, Copy } from 'lucide-react';

interface Receipt {
  id: string;
  execution_id: string;
  timestamp: string;
  signature: string;
  hash: string;
  prev_hash: string;
  has_violation: boolean;
  signed: boolean;
  metadata?: Record<string, any>;
}

export default function ProofReceiptsPage() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Receipt | null>(null);
  const [copied, setCopied] = useState('');

  const { data: receipts = [], isLoading, refetch } = useQuery<Receipt[]>({
    queryKey: ['proof-receipts'],
    queryFn: () => api.get('/v1/proof/receipts?limit=100&sort=timestamp:desc'),
    retry: false,
  });

  const filtered = useMemo(() =>
    receipts.filter((r) =>
      !search ||
      r.execution_id.toLowerCase().includes(search.toLowerCase()) ||
      r.hash.toLowerCase().includes(search.toLowerCase())
    ), [receipts, search]);

  const counts = useMemo(() => ({
    signed: receipts.filter((r) => r.signed).length,
    unsigned: receipts.filter((r) => !r.signed).length,
    violations: receipts.filter((r) => r.has_violation).length,
  }), [receipts]);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 1500);
  };

  const STAT_CARDS = [
    { label: 'Signed', value: counts.signed, icon: FileCheck, color: 'text-green-600' },
    { label: 'Unsigned', value: counts.unsigned, icon: FileX, color: 'text-gray-500' },
    { label: 'Violations', value: counts.violations, icon: AlertTriangle, color: 'text-orange-600' },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Execution Receipts</h1>
          <p className="text-xs text-gray-500 mt-0.5">Signed proof of execution.</p>
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
              placeholder="Search by execution ID or hash..."
              className="pl-8 h-8 text-xs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </div>

        {/* Table */}
        <Card className="border border-gray-200">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Execution ID</TableHead>
                <TableHead>Timestamp</TableHead>
                <TableHead>Signature</TableHead>
                <TableHead>Hash</TableHead>
                <TableHead>Prev Hash</TableHead>
                <TableHead>Signed</TableHead>
                <TableHead>Violation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-16" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-gray-400 py-12">No receipts found</TableCell>
                </TableRow>
              ) : (
                filtered.map((receipt) => (
                  <TableRow
                    key={receipt.id}
                    className="cursor-pointer"
                    onClick={() => setSelected(receipt)}
                  >
                    <TableCell className="text-xs text-gray-600">{truncateText(receipt.execution_id, 12)}</TableCell>
                    <TableCell className="text-xs text-gray-500">{getRelativeTime(receipt.timestamp)}</TableCell>
                    <TableCell className="text-xs text-gray-500">{truncateText(receipt.signature, 12)}</TableCell>
                    <TableCell className="text-xs text-gray-500">{truncateText(receipt.hash, 10)}</TableCell>
                    <TableCell className="text-xs text-gray-400">{truncateText(receipt.prev_hash, 10)}</TableCell>
                    <TableCell>
                      <StatusBadge status={receipt.signed ? 'ACTIVE' : 'INACTIVE'} showDot />
                    </TableCell>
                    <TableCell>
                      {receipt.has_violation ? <StatusBadge status="VIOLATION" /> : <span className="text-xs text-gray-300">—</span>}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Receipt Viewer Modal */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="text-sm font-semibold flex items-center gap-1.5">
                  <Shield className="h-4 w-4 text-gray-400" /> Receipt Viewer
                </DialogTitle>
              </DialogHeader>
              <Separator />
              <div className="space-y-4 mt-2">
                {/* Fields */}
                {[
                  { label: 'Execution ID', value: selected.execution_id, mono: true },
                  { label: 'Timestamp', value: selected.timestamp, mono: false },
                  { label: 'Signed', value: selected.signed ? 'Yes' : 'No', mono: false },
                  { label: 'Has Violation', value: selected.has_violation ? 'Yes' : 'No', mono: false },
                ].map(({ label, value, mono }) => (
                  <div key={label} className="flex items-start gap-4">
                    <span className="text-xs text-gray-500 w-28 flex-shrink-0">{label}</span>
                    <span className={`text-xs text-gray-800 break-all ${mono ? '' : ''}`}>{value}</span>
                  </div>
                ))}

                {/* Hash fields with copy */}
                {[
                  { label: 'Hash', key: 'hash', value: selected.hash },
                  { label: 'Prev Hash', key: 'prev_hash', value: selected.prev_hash },
                  { label: 'Signature', key: 'signature', value: selected.signature },
                ].map(({ label, key, value }) => (
                  <div key={key} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">{label}</span>
                      <button
                        onClick={() => copyToClipboard(value, key)}
                        className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                      >
                        <Copy className="h-3 w-3" />
                        {copied === key ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    <div className="bg-gray-50 border border-gray-100 rounded-md px-3 py-2">
                      <p className="text-xs text-gray-600 break-all">{value ?? '—'}</p>
                    </div>
                  </div>
                ))}

                {/* Metadata */}
                {selected.metadata && (
                  <div className="space-y-1">
                    <span className="text-xs text-gray-500">Metadata</span>
                    <pre className="text-xs text-gray-600 bg-gray-50 border border-gray-100 rounded-md p-3 overflow-auto max-h-32">
                      {JSON.stringify(selected.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
