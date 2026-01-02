'use client';

export const dynamic = 'force-dynamic';
import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatDate, formatCurrency, formatNumber } from '@/utils/helpers';
import { useTenant } from '@/hooks/useTenant';
import {
  Users,
  Plus,
  Loader2,
  Building2,
  Calendar,
  DollarSign,
  MoreVertical,
  CheckCircle,
  XCircle,
  Edit,
  Trash2,
  DollarSign as Budget,
  GitBranch,
  UserPlus,
} from 'lucide-react';

interface Tenant {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  status: 'active' | 'suspended' | 'disabled';
  monthly_spend: number;
  budget_limit?: number;
  request_count: number;
}

export default function TenantsPage() {
  const { data: tenant } = useTenant();
  const tier = tenant?.plan?.toLowerCase() || 'develop';

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showBudgetDialog, setShowBudgetDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [newTenantName, setNewTenantName] = useState('');
  const [newTenantDescription, setNewTenantDescription] = useState('');
  const [budgetAmount, setBudgetAmount] = useState('');
  const [tenantHardCap, setTenantHardCap] = useState(false);

  const [tenants, setTenants] = useState<Tenant[]>([]);

  const handleCreateTenant = async () => {
    if (!newTenantName.trim()) return;

    setIsCreating(true);

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));

    const newTenant: Tenant = {
      id: `tenant-${newTenantName.toLowerCase().replace(/\s+/g, '-')}`,
      name: newTenantName,
      description: newTenantDescription,
      created_at: new Date().toISOString(),
      status: 'active',
      monthly_spend: 0,
      request_count: 0,
    };

    setTenants([...tenants, newTenant]);
    setIsCreating(false);
    setShowCreateDialog(false);
    setNewTenantName('');
    setNewTenantDescription('');
  };

  const handleSetBudget = async () => {
    if (!selectedTenant || !budgetAmount) return;

    // API call would go here
    console.log('Set budget for:', selectedTenant.id, budgetAmount);

    setShowBudgetDialog(false);
    setSelectedTenant(null);
    setBudgetAmount('');
  };

  const handleDelete = async () => {
    if (!selectedTenant) return;

    // API call would go here
    console.log('Delete tenant:', selectedTenant.id);

    setTenants(tenants.filter(t => t.id !== selectedTenant.id));
    setShowDeleteDialog(false);
    setSelectedTenant(null);
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="pb-4 border-b border-border-light">
          <h1 className="text-base font-medium text-gray-900 font-inter">
            Clients & Tenants
          </h1>
          <p className="text-gray-600 mt-1 font-inter text-xs">
            Create isolated tenants for customers, environments, or teams
          </p>
        </div>

        {/* New Tenant Button */}
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-3 text-xs"
            onClick={() => setShowCreateDialog(true)}
          >
            <Plus className="h-3 w-3 mr-1" />
            New Tenant
          </Button>
        </div>

        {/* Tenants Table */}
        <div>
          <div className="pb-4 border-b border-border-light">
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-900 font-inter">
              <Building2 className="h-4 w-4 text-gray-900" />
              Tenants
            </div>
            <p className="text-xs text-gray-600 mt-1">
              Manage your isolated tenant environments
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-beige-secondary">
                <tr className="border-b border-border-light">
                  <th className="px-3 py-2 text-left font-medium text-gray-600">
                    Name
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">
                    Tenant ID
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">
                    Created
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">
                    Spend (30d)
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">
                    Requests
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tenants.map((tenantItem) => (
                  <tr key={tenantItem.id} className="hover:bg-beige-secondary transition-colors">
                    <td className="px-3 py-2">
                      <div>
                        <div className="font-medium text-gray-900 font-inter text-xs">
                          {tenantItem.name}
                        </div>
                        {tenantItem.description && (
                          <div className="text-xs text-gray-600 mt-0.5">
                            {tenantItem.description}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <code className="text-[0.65rem] bg-gray-100 px-2 py-1 rounded font-mono text-gray-700">
                        {tenantItem.id}
                      </code>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600">
                      {formatDate(tenantItem.created_at)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-gray-900">
                            {formatCurrency(tenantItem.monthly_spend)}
                          </span>
                          {tenantItem.budget_limit && tier === 'scale' && (
                            <span className="text-xs text-gray-600">
                              / {formatCurrency(tenantItem.budget_limit)}
                            </span>
                          )}
                        </div>
                        {tenantItem.budget_limit && tier === 'scale' && (
                          <>
                            <div className="w-24 bg-gray-200 rounded-full h-1 overflow-hidden">
                              <div
                                className={`h-full transition-all ${
                                  (tenantItem.monthly_spend / tenantItem.budget_limit) * 100 >= 90
                                    ? 'bg-red-600'
                                    : (tenantItem.monthly_spend / tenantItem.budget_limit) * 100 >= 70
                                    ? 'bg-yellow-500'
                                    : ''
                                }`}
                                style={{
                                  width: `${Math.min((tenantItem.monthly_spend / tenantItem.budget_limit) * 100, 100)}%`,
                                  backgroundColor: (tenantItem.monthly_spend / tenantItem.budget_limit) * 100 < 70 ? '#299a93' : undefined
                                }}
                              />
                            </div>
                            <span className="text-xs text-gray-600">
                              {((tenantItem.monthly_spend / tenantItem.budget_limit) * 100).toFixed(0)}% used
                            </span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-900">
                      {formatNumber(tenantItem.request_count)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6">
                            <MoreVertical className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40 text-xs">
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedTenant(tenantItem);
                              setNewTenantName(tenantItem.name);
                              setNewTenantDescription(tenantItem.description || '');
                              setShowEditDialog(true);
                            }}
                          >
                            <Edit className="mr-2 h-3 w-3" />
                            Edit
                          </DropdownMenuItem>
                          {tier === 'scale' && (
                            <>
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedTenant(tenantItem);
                                  setBudgetAmount(tenantItem.budget_limit?.toString() || '');
                                  setShowBudgetDialog(true);
                                }}
                              >
                                <Budget className="mr-2 h-3 w-3" />
                                Set Budget
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  console.log('Set routing policy for:', tenantItem.id);
                                }}
                              >
                                <GitBranch className="mr-2 h-3 w-3" />
                                Routing Policy
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  console.log('Invite admin for:', tenantItem.id);
                                }}
                              >
                                <UserPlus className="mr-2 h-3 w-3" />
                                Invite Tenant Admin
                              </DropdownMenuItem>
                            </>
                          )}
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => {
                              setSelectedTenant(tenantItem);
                              setShowDeleteDialog(true);
                            }}
                          >
                            <Trash2 className="mr-2 h-3 w-3" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {tenants.length === 0 && (
            <div className="text-center py-8">
              <Users className="h-6 w-6 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 font-inter mb-4 text-xs">
                No tenants yet
              </p>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-3 text-xs"
                onClick={() => setShowCreateDialog(true)}
              >
                <Plus className="h-3 w-3 mr-1" />
                Create Your First Tenant
              </Button>
            </div>
          )}
        </div>

        
      </div>

      {/* Create Tenant Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Tenant</DialogTitle>
            <DialogDescription>
              Add a new isolated tenant for a customer, environment, or team
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="tenantName">
                Tenant Name <span className="text-red-600">*</span>
              </Label>
              <Input
                id="tenantName"
                placeholder="e.g., Acme Corp, Production, Team Alpha"
                value={newTenantName}
                onChange={(e) => setNewTenantName(e.target.value)}
                disabled={isCreating}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tenantDescription">
                Description (optional)
              </Label>
              <Input
                id="tenantDescription"
                placeholder="e.g., Customer production environment"
                value={newTenantDescription}
                onChange={(e) => setNewTenantDescription(e.target.value)}
                disabled={isCreating}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-3 text-xs"
              onClick={() => setShowCreateDialog(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-7 px-3 text-xs"
              onClick={handleCreateTenant}
              disabled={!newTenantName.trim() || isCreating}
            >
              {isCreating ? (
                <>
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="mr-1 h-3 w-3" />
                  Create Tenant
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Tenant Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Tenant</DialogTitle>
            <DialogDescription>
              Update tenant information
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editTenantName">
                Tenant Name <span className="text-red-600">*</span>
              </Label>
              <Input
                id="editTenantName"
                value={newTenantName}
                onChange={(e) => setNewTenantName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editTenantDescription">
                Description (optional)
              </Label>
              <Input
                id="editTenantDescription"
                value={newTenantDescription}
                onChange={(e) => setNewTenantDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" className="h-7 px-3 text-xs" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button size="sm" className="h-7 px-3 text-xs" onClick={() => setShowEditDialog(false)}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Set Budget Dialog */}
      <Dialog open={showBudgetDialog} onOpenChange={setShowBudgetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Budget Limit</DialogTitle>
            <DialogDescription>
              Configure monthly spending limit for {selectedTenant?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="budgetAmount">
                Monthly Budget (USD) <span className="text-red-600">*</span>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600">$</span>
                <Input
                  id="budgetAmount"
                  type="number"
                  placeholder="1000"
                  value={budgetAmount}
                  onChange={(e) => setBudgetAmount(e.target.value)}
                  className="pl-7"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border border-border-light">
              <div className="space-y-0.5">
                <Label htmlFor="tenantHardCap" className="text-base font-medium">
                  Hard cap
                </Label>
                <p className="text-sm text-gray-600">
                  Block all requests when budget limit is reached
                </p>
              </div>
              <Switch
                id="tenantHardCap"
                checked={tenantHardCap}
                onCheckedChange={setTenantHardCap}
              />
            </div>

            <div className="p-3 rounded-lg bg-yellow-50 border border-yellow-200">
              <p className="text-xs text-yellow-900">
                When the limit is reached, all requests for this tenant will be blocked until the next billing cycle.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" className="h-7 px-3 text-xs" onClick={() => setShowBudgetDialog(false)}>
              Cancel
            </Button>
            <Button size="sm" className="h-7 px-3 text-xs" onClick={handleSetBudget} disabled={!budgetAmount}>
              Set Budget
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Tenant</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedTenant?.name}? This action cannot be undone and will delete all associated data.
            </DialogDescription>
          </DialogHeader>
          <div className="p-4 rounded-lg bg-red-50 border border-red-200">
            <p className="text-sm text-red-900 font-medium">
              This will permanently delete:
              <br />
              • All tenant API keys
              <br />
              • Usage history and traces
              <br />
              • Budget configurations
              <br />
              • All tenant data
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" className="h-7 px-3 text-xs" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" className="h-7 px-3 text-xs" onClick={handleDelete}>
              <Trash2 className="mr-1 h-3 w-3" />
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
