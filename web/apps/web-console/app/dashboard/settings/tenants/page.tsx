'use client';

export const dynamic = 'force-dynamic';
import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatDate, formatCurrency } from '@/utils/helpers';
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
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newTenantName, setNewTenantName] = useState('');
  const [newTenantDescription, setNewTenantDescription] = useState('');

  // Mock data - in production, fetch from API
  const [tenants, setTenants] = useState<Tenant[]>([
    {
      id: 'tenant-acme-corp',
      name: 'Acme Corp',
      description: 'Production environment',
      created_at: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'active',
      monthly_spend: 1247.53,
      budget_limit: 5000,
      request_count: 125430,
    },
    {
      id: 'tenant-techstart',
      name: 'TechStart Inc',
      description: 'Staging environment',
      created_at: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'active',
      monthly_spend: 342.18,
      budget_limit: 1000,
      request_count: 34210,
    },
    {
      id: 'tenant-global-sys',
      name: 'Global Systems',
      description: 'Development',
      created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'active',
      monthly_spend: 89.42,
      request_count: 8940,
    },
  ]);

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

  const getTotalSpend = () => tenants.reduce((sum, t) => sum + t.monthly_spend, 0);
  const getTotalRequests = () => tenants.reduce((sum, t) => sum + t.request_count, 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-medium text-gray-900 font-inter">
              Clients & Tenants
            </h1>
            <p className="text-gray-600 mt-1 font-inter">
              Create isolated tenants for customers, environments, or teams
            </p>
          </div>
          <Button
            variant="outline"
            className="shadow-md"
            onClick={() => setShowCreateDialog(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Tenant
          </Button>
        </div>

        {/* Tenants Table */}
        <Card className="border-border-light shadow-md">
          <CardHeader>
            <CardTitle>Tenants</CardTitle>
            <CardDescription>
              Manage your isolated tenant environments
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-beige-secondary border-b border-border-light">
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
                      Monthly Spend
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-beige-primary divide-y divide-border-light">
                  {tenants.map((tenant) => (
                    <tr key={tenant.id} className="hover:bg-beige-secondary transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-medium text-gray-900 font-inter">
                            {tenant.name}
                          </div>
                          {tenant.description && (
                            <div className="text-sm text-gray-600 mt-0.5">
                              {tenant.description}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono text-gray-700">
                          {tenant.id}
                        </code>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDate(tenant.created_at)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">
                          {formatCurrency(tenant.monthly_spend)}
                        </div>
                        {tenant.budget_limit && (
                          <div className="text-xs text-gray-600 mt-0.5">
                            of {formatCurrency(tenant.budget_limit)} limit
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {tenant.status === 'active' ? (
                          <Badge className="bg-green-50 text-green-700 border-green-200 inline-flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Active
                          </Badge>
                        ) : (
                          <Badge className="bg-red-50 text-red-700 border-red-200 inline-flex items-center gap-1">
                            <XCircle className="h-3 w-3" />
                            {tenant.status}
                          </Badge>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
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
                  className="shadow-md"
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
        <Card className="border-blue-200 bg-blue-50 shadow-md">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Building2 className="h-5 w-5 text-blue-700 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-blue-900 font-inter mb-1">
                  What are tenants?
                </h3>
                <p className="text-sm text-blue-800">
                  Tenants provide complete isolation for different customers, environments, or teams. Each tenant gets:
                  <br />
                  • Isolated API keys and credentials
                  <br />
                  • Separate usage tracking and billing
                  <br />
                  • Independent budget limits
                  <br />
                  • Dedicated observability data
                  <br />
                  • Physical data separation at database level
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
            <div className="p-4 rounded-lg bg-beige-secondary border border-border-light">
              <p className="text-xs text-gray-600">
                After creation, you'll receive:
                <br />
                • Unique tenant ID for API authentication
                <br />
                • Isolated data storage
                <br />
                • Separate usage tracking
                <br />
                • Independent budget configuration
              </p>
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
    </DashboardLayout>
  );
}
