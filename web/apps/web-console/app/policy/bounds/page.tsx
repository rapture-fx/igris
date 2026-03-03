'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/apiClient';
import { getRelativeTime } from '@/utils/helpers';
import { Sliders, Save, RefreshCw, History, CheckCircle } from 'lucide-react';

interface Bounds {
  cpu_percent: number;
  memory_mb: number;
  max_tick_duration_ms: number;
  quota: number;
}

interface BoundsChange {
  id: string;
  field: string;
  old_value: number;
  new_value: number;
  changed_at: string;
  changed_by: string;
}

const FIELDS: Array<{ key: keyof Bounds; label: string; unit: string; min: number; max: number; step: number }> = [
  { key: 'cpu_percent', label: 'CPU Limit', unit: '%', min: 1, max: 100, step: 1 },
  { key: 'memory_mb', label: 'Memory Limit', unit: 'MB', min: 64, max: 65536, step: 64 },
  { key: 'max_tick_duration_ms', label: 'Max Tick Duration', unit: 'ms', min: 100, max: 60000, step: 100 },
  { key: 'quota', label: 'Quota', unit: 'req/day', min: 0, max: 1000000, step: 100 },
];

export default function PolicyBoundsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState<Bounds>({
    cpu_percent: 80,
    memory_mb: 512,
    max_tick_duration_ms: 5000,
    quota: 10000,
  });
  const [saved, setSaved] = useState(false);

  const { data: bounds, isLoading } = useQuery<Bounds>({
    queryKey: ['policy-bounds'],
    queryFn: () => api.get('/v1/policy/bounds'),
    retry: false,
  });

  const { data: history = [] } = useQuery<BoundsChange[]>({
    queryKey: ['policy-bounds-history'],
    queryFn: () => api.get('/v1/policy/bounds/history'),
    retry: false,
  });

  useEffect(() => {
    if (bounds) setForm(bounds);
  }, [bounds]);

  const mutation = useMutation({
    mutationFn: (data: Bounds) => api.put('/v1/policy/bounds', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['policy-bounds'] });
      qc.invalidateQueries({ queryKey: ['policy-bounds-history'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const isDirty = bounds ? FIELDS.some((f) => form[f.key] !== bounds[f.key]) : false;

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Execution Bounds</h1>
          <p className="text-xs text-gray-500 mt-0.5">System-wide execution constraints.</p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* Bounds Editor */}
          <Card className="border border-gray-200">
            <CardHeader className="px-4 pt-4 pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
                <Sliders className="h-4 w-4 text-gray-400" /> Constraint Values
              </CardTitle>
              {isDirty && (
                <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded border border-yellow-200">
                  Unsaved changes
                </span>
              )}
            </CardHeader>
            <Separator />
            <CardContent className="px-4 py-5">
              {isLoading ? (
                <div className="space-y-5">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="space-y-1.5">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-9 w-full" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-5">
                  {FIELDS.map((field) => (
                    <div key={field.key} className="space-y-1.5">
                      <Label className="text-xs text-gray-700 font-medium flex items-center justify-between">
                        {field.label}
                        <span className="text-gray-400 font-normal">{field.unit}</span>
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={field.min}
                          max={field.max}
                          step={field.step}
                          value={form[field.key]}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              [field.key]: Number(e.target.value),
                            }))
                          }
                          className="h-9 text-sm font-mono"
                        />
                        <span className="text-xs text-gray-400 w-16 flex-shrink-0">{field.unit}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-gray-400">
                        <span>min: {field.min}</span>
                        <span>max: {field.max.toLocaleString()}</span>
                      </div>
                    </div>
                  ))}

                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      onClick={() => mutation.mutate(form)}
                      disabled={mutation.isPending || !isDirty}
                      size="sm"
                      className="h-8 text-xs gap-1.5"
                    >
                      {saved ? (
                        <><CheckCircle className="h-3.5 w-3.5" /> Saved</>
                      ) : mutation.isPending ? (
                        <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Saving...</>
                      ) : (
                        <><Save className="h-3.5 w-3.5" /> Save Changes</>
                      )}
                    </Button>
                    {bounds && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => setForm(bounds)}
                        disabled={!isDirty}
                      >
                        Revert
                      </Button>
                    )}
                  </div>

                  {mutation.isError && (
                    <p className="text-xs text-red-600 mt-2">Failed to save changes. Try again.</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Change History */}
          <Card className="border border-gray-200">
            <CardHeader className="px-4 pt-4 pb-3">
              <CardTitle className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
                <History className="h-4 w-4 text-gray-400" /> Change History
              </CardTitle>
            </CardHeader>
            <Separator />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Field</TableHead>
                  <TableHead>Old</TableHead>
                  <TableHead>New</TableHead>
                  <TableHead>Changed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-gray-400 py-8">No changes recorded</TableCell>
                  </TableRow>
                ) : (
                  history.map((change) => (
                    <TableRow key={change.id}>
                      <TableCell className="text-xs font-medium">{change.field}</TableCell>
                      <TableCell className="text-xs text-gray-500 tabular-nums">{change.old_value}</TableCell>
                      <TableCell className="text-xs font-medium tabular-nums">{change.new_value}</TableCell>
                      <TableCell className="text-xs text-gray-400">{getRelativeTime(change.changed_at)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
