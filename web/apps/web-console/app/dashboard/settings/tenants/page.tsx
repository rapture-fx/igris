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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="pb-4 border-b border-border-light">
            <h1 className="text-base font-medium text-gray-900 font-inter">
              Clients & Tenants
            </h1>
            <p className="text-gray-600 mt-1 font-inter text-xs">
              Create isolated tenants for customers, environments, or teams
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => setShowCreateDialog(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Tenant
          </Button>
        </div>

        {/* Tenants Table */}
        <Card className="border-border-light shadow-sm">
          <CardHeader>
            <CardTitle>Tenants</CardTitle>
            <CardDescription>
              Manage your isolated tenant environments
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-beige-primary border-b border-border-light">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Tenant ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Spend (30d)
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Requests
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-beige-primary divide-y divide-border-light">
                  {tenants.map((tenantItem) => (
                    <tr key={tenantItem.id} className="hover:bg-beige-primary transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-medium text-gray-900 font-inter">
                            {tenantItem.name}
                          </div>
                          {tenantItem.description && (
                            <div className="text-sm text-gray-600 mt-0.5">
                              {tenantItem.description}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono text-gray-700">
                          {tenantItem.id}
                        </code>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {formatDate(tenantItem.created_at)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-sm">
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
                              <div className="w-32 bg-gray-200 rounded-full h-1.5 overflow-hidden">
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
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {formatNumber(tenantItem.request_count)}
                      </td>
                      <td className="px-6 py-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedTenant(tenantItem);
                                setNewTenantName(tenantItem.name);
                                setNewTenantDescription(tenantItem.description || '');
                                setShowEditDialog(true);
                              }}
                            >
                              <Edit className="mr-2 h-4 w-4" />
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
                                  <Budget className="mr-2 h-4 w-4" />
                                  Set Budget
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    console.log('Set routing policy for:', tenantItem.id);
                                  }}
                                >
                                  <GitBranch className="mr-2 h-4 w-4" />
                                  Routing Policy
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    console.log('Invite admin for:', tenantItem.id);
                                  }}
                                >
                                  <UserPlus className="mr-2 h-4 w-4" />
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
                              <Trash2 className="mr-2 h-4 w-4" />
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
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 font-inter mb-4">
                  No tenants yet
                </p>
                <Button
                  variant="outline"
                  onClick={() => setShowCreateDialog(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Tenant
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="border-blue-200 bg-blue-50 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Building2 className="h-5 w-5 text-blue-700 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-blue-900 font-inter mb-1">
                  Enterprise Multi-Tenancy
                </h3>
                <p className="text-sm text-blue-800">
                  {tier === 'scale' ? (
                    <>
                      You have full access to enterprise multi-tenancy features:
                      <br />
                      • Per-tenant API keys and credentials
                      <br />
                      • Independent budget limits and enforcement
                      <br />
                      • Custom routing policies per tenant
                      <br />
                      • Tenant admin role management
                      <br />
                      • 90-day trace retention per tenant
                    </>
                  ) : (
                    <>
                      Create isolated tenants for customers or environments. Each tenant gets:
                      <br />
                      • Isolated API keys and credentials
                      <br />
                      • Separate usage tracking and billing
                      <br />
                      • Independent data isolation
                      <br />
                      <br />
                      <span className="font-medium">Upgrade to Scale</span> for: Per-tenant budgets • Custom routing policies • Tenant admin roles
                    </>
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
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
              onClick={() => setShowCreateDialog(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateTenant}
              disabled={!newTenantName.trim() || isCreating}
            >
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
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
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => setShowEditDialog(false)}>
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
            <Button variant="outline" onClick={() => setShowBudgetDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSetBudget} disabled={!budgetAmount}>
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
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
