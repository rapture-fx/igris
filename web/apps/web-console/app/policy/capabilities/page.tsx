'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/apiClient';
import {
  Globe, Terminal, HardDrive, Plus, Trash2, Save, RefreshCw, CheckCircle,
} from 'lucide-react';

interface Capabilities {
  http_access: boolean;
  shell_access: boolean;
  filesystem_access: boolean;
  allowed_domains: string[];
  filesystem_write_limits: FilesystemLimit[];
}

interface FilesystemLimit {
  path: string;
  max_size_mb: number;
  read_only: boolean;
}

const TOGGLE_CONTROLS = [
  { key: 'http_access' as const, label: 'HTTP Access', description: 'Allow agents to make outbound HTTP requests', icon: Globe, color: 'text-blue-600' },
  { key: 'shell_access' as const, label: 'Shell Access', description: 'Allow agents to execute shell commands', icon: Terminal, color: 'text-orange-600' },
  { key: 'filesystem_access' as const, label: 'Filesystem Access', description: 'Allow agents to read and write files', icon: HardDrive, color: 'text-violet-600' },
];

export default function PolicyCapabilitiesPage() {
  const qc = useQueryClient();
  const [caps, setCaps] = useState<Capabilities>({
    http_access: false,
    shell_access: false,
    filesystem_access: false,
    allowed_domains: [],
    filesystem_write_limits: [],
  });
  const [newDomain, setNewDomain] = useState('');
  const [newPath, setNewPath] = useState('');
  const [newSizeMb, setNewSizeMb] = useState(100);
  const [saved, setSaved] = useState(false);

  const { data, isLoading } = useQuery<Capabilities>({
    queryKey: ['policy-capabilities'],
    queryFn: () => api.get('/v1/policy/capabilities'),
    retry: false,
  });

  useEffect(() => {
    if (data) setCaps(data);
  }, [data]);

  const mutation = useMutation({
    mutationFn: (updated: Capabilities) => api.put('/v1/policy/capabilities', updated),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['policy-capabilities'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const toggleCap = (key: 'http_access' | 'shell_access' | 'filesystem_access', val: boolean) => {
    const updated = { ...caps, [key]: val };
    setCaps(updated);
    mutation.mutate(updated);
  };

  const addDomain = () => {
    if (!newDomain.trim()) return;
    const updated = { ...caps, allowed_domains: [...caps.allowed_domains, newDomain.trim()] };
    setCaps(updated);
    mutation.mutate(updated);
    setNewDomain('');
  };

  const removeDomain = (domain: string) => {
    const updated = { ...caps, allowed_domains: caps.allowed_domains.filter((d) => d !== domain) };
    setCaps(updated);
    mutation.mutate(updated);
  };

  const addFsLimit = () => {
    if (!newPath.trim()) return;
    const limit: FilesystemLimit = { path: newPath.trim(), max_size_mb: newSizeMb, read_only: false };
    const updated = { ...caps, filesystem_write_limits: [...caps.filesystem_write_limits, limit] };
    setCaps(updated);
    mutation.mutate(updated);
    setNewPath('');
    setNewSizeMb(100);
  };

  const removeFsLimit = (path: string) => {
    const updated = { ...caps, filesystem_write_limits: caps.filesystem_write_limits.filter((l) => l.path !== path) };
    setCaps(updated);
    mutation.mutate(updated);
  };

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Capabilities</h1>
          <p className="text-xs text-gray-500 mt-0.5">Allowed operations for agents.</p>
        </div>

        {/* Toggle Controls */}
        <Card className="border border-gray-200">
          <CardHeader className="px-4 pt-4 pb-3">
            <CardTitle className="text-sm font-medium text-gray-900">Access Controls</CardTitle>
          </CardHeader>
          <Separator />
          <CardContent className="px-4 py-0 divide-y divide-gray-100">
            {TOGGLE_CONTROLS.map((ctrl) => (
              <div key={ctrl.key} className="flex items-center justify-between py-4">
                <div className="flex items-center gap-3">
                  <ctrl.icon className={`h-4 w-4 ${ctrl.color}`} />
                  <div>
                    <Label className="text-sm font-medium text-gray-800">{ctrl.label}</Label>
                    <p className="text-xs text-gray-400 mt-0.5">{ctrl.description}</p>
                  </div>
                </div>
                {isLoading ? (
                  <Skeleton className="h-5 w-10 rounded-full" />
                ) : (
                  <Switch
                    checked={caps[ctrl.key]}
                    onCheckedChange={(val) => toggleCap(ctrl.key, val)}
                    disabled={mutation.isPending}
                  />
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* Allowed Domains */}
          <Card className="border border-gray-200">
            <CardHeader className="px-4 pt-4 pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
                <Globe className="h-4 w-4 text-gray-400" /> Allowed Domains
              </CardTitle>
              <span className="text-xs text-gray-400">{caps.allowed_domains.length} configured</span>
            </CardHeader>
            <Separator />
            <div className="px-4 py-3">
              <div className="flex gap-2">
                <Input
                  placeholder="example.com"
                  className="h-8 text-xs flex-1"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addDomain()}
                />
                <Button onClick={addDomain} size="sm" className="h-8 text-xs gap-1">
                  <Plus className="h-3.5 w-3.5" /> Add
                </Button>
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Domain</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell />
                    </TableRow>
                  ))
                ) : caps.allowed_domains.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center text-gray-400 py-6 text-xs">
                      No domains allowed
                    </TableCell>
                  </TableRow>
                ) : (
                  caps.allowed_domains.map((domain) => (
                    <TableRow key={domain}>
                      <TableCell className="text-xs font-mono text-gray-700">{domain}</TableCell>
                      <TableCell>
                        <button
                          onClick={() => removeDomain(domain)}
                          className="text-gray-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>

          {/* Filesystem Write Limits */}
          <Card className="border border-gray-200">
            <CardHeader className="px-4 pt-4 pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
                <HardDrive className="h-4 w-4 text-gray-400" /> Filesystem Write Limits
              </CardTitle>
              <span className="text-xs text-gray-400">{caps.filesystem_write_limits.length} paths</span>
            </CardHeader>
            <Separator />
            <div className="px-4 py-3">
              <div className="flex gap-2">
                <Input
                  placeholder="/data/agents"
                  className="h-8 text-xs flex-1"
                  value={newPath}
                  onChange={(e) => setNewPath(e.target.value)}
                />
                <Input
                  type="number"
                  placeholder="MB"
                  className="h-8 text-xs w-20"
                  value={newSizeMb}
                  onChange={(e) => setNewSizeMb(Number(e.target.value))}
                />
                <Button onClick={addFsLimit} size="sm" className="h-8 text-xs gap-1">
                  <Plus className="h-3.5 w-3.5" /> Add
                </Button>
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Path</TableHead>
                  <TableHead>Max Size</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 3 }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-16" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : caps.filesystem_write_limits.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-gray-400 py-6 text-xs">
                      No path limits configured
                    </TableCell>
                  </TableRow>
                ) : (
                  caps.filesystem_write_limits.map((limit) => (
                    <TableRow key={limit.path}>
                      <TableCell className="text-xs font-mono text-gray-700">{limit.path}</TableCell>
                      <TableCell className="text-xs text-gray-500 tabular-nums">{limit.max_size_mb} MB</TableCell>
                      <TableCell>
                        <button
                          onClick={() => removeFsLimit(limit.path)}
                          className="text-gray-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </div>

        {mutation.isError && (
          <p className="text-xs text-red-600">Failed to save changes. Please try again.</p>
        )}
      </div>
    </DashboardLayout>
  );
}
