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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Select } from '@/components/ui/select';
import { useVaultKeys, useAddVaultKey, useDeleteVaultKey } from '@/hooks/useVault';
import { useTenant } from '@/hooks/useTenant';
import { formatDate } from '@/utils/helpers';
import { Plus, MoreVertical, Eye, EyeOff, Loader2, Edit, Trash2, TestTube, RotateCw, Copy, CheckCircle, XCircle, AlertCircle, Plug } from 'lucide-react';
import { PROVIDERS } from '@/utils/constants';

const mockTenants = [
  { id: 'all', name: 'All Tenants' },
  { id: 'tenant-1', name: 'Acme Corp' },
  { id: 'tenant-2', name: 'TechStart Inc' },
  { id: 'tenant-3', name: 'Global Enterprises' },
];

export default function ProvidersPage() {
  const { data: providers, isLoading } = useVaultKeys();

  const displayProviders = providers || [];
  const { data: tenant } = useTenant();
  const addProviderMutation = useAddVaultKey();
  const deleteProviderMutation = useDeleteVaultKey();

  const tier = tenant?.plan?.toLowerCase() || 'develop';

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRotateDialog, setShowRotateDialog] = useState(false);
  const [showTestDialog, setShowTestDialog] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<any>(null);
  const [newProvider, setNewProvider] = useState('');
  const [newApiKey, setNewApiKey] = useState('');
  const [newName, setNewName] = useState('');
  const [rotateApiKey, setRotateApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState('all');
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editingNameValue, setEditingNameValue] = useState('');
  const [providerTenants, setProviderTenants] = useState<{ [key: string]: string }>({});

  const baseUrl = 'https://api.schlepengine.com/v1';

  const handleTenantChange = (providerId: string, tenantId: string) => {
    setProviderTenants({ ...providerTenants, [providerId]: tenantId });
  };

  const handleAddProvider = async () => {
    if (!newProvider || !newApiKey) return;

    await addProviderMutation.mutateAsync({
      provider: newProvider,
      api_key: newApiKey,
    });

    setShowAddDialog(false);
    setNewProvider('');
    setNewApiKey('');
    setNewName('');
    setShowApiKey(false);
  };

  const handleEditProvider = async () => {
    if (!selectedProvider || !newApiKey) return;

    // API call would go here
    console.log('Edit provider:', selectedProvider.id, newApiKey);

    setShowEditDialog(false);
    setSelectedProvider(null);
    setNewApiKey('');
    setShowApiKey(false);
  };

  const handleDeleteProvider = async () => {
    if (!selectedProvider) return;

    await deleteProviderMutation.mutateAsync(selectedProvider.id);
    setShowDeleteDialog(false);
    setSelectedProvider(null);
  };

  const handleRotateKey = async () => {
    if (!selectedProvider || !rotateApiKey) return;

    // API call would go here
    console.log('Rotate key for:', selectedProvider.id, rotateApiKey);

    setShowRotateDialog(false);
    setSelectedProvider(null);
    setRotateApiKey('');
    setShowApiKey(false);
  };

  const handleTestConnection = async () => {
    if (!selectedProvider) return;

    setIsTesting(true);
    setTestResult(null);

    // Simulate API call to /v1/models
    setTimeout(() => {
      const success = Math.random() > 0.3;
      setTestResult({
        success,
        message: success
          ? `Successfully connected to ${selectedProvider.provider}. Found 12 models.`
          : `Failed to connect. Invalid API key or network error.`,
      });
      setIsTesting(false);
    }, 1500);
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(baseUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleNameEdit = (provider: any) => {
    setEditingNameId(provider.id);
    setEditingNameValue(provider.key_id || '');
  };

  const handleNameSave = async (providerId: string) => {
    // API call would go here
    console.log('Save name:', providerId, editingNameValue);
    setEditingNameId(null);
  };

  const getStatusBadge = (provider: any) => {
    // Mock logic for status
    const hasModels = true; // Would check if models are available
    const isValid = provider.status === 'active';

    if (isValid && hasModels) {
      return (
        <Badge className="bg-green-50 text-green-700 border-green-200 inline-flex items-center gap-1.5 px-2 py-1 text-xs">
          <CheckCircle className="h-3 w-3" />
          Active
        </Badge>
      );
    } else if (!hasModels) {
      return (
        <Badge className="bg-yellow-50 text-yellow-700 border-yellow-200 inline-flex items-center gap-1.5 px-2 py-1 text-xs">
          <AlertCircle className="h-3 w-3" />
          No models
        </Badge>
      );
    } else {
      return (
        <Badge className="bg-red-50 text-red-700 border-red-200 inline-flex items-center gap-1.5 px-2 py-1 text-xs">
          <XCircle className="h-3 w-3" />
          Invalid
        </Badge>
      );
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h1 className="text-xl font-medium text-gray-900 font-inter">
              Providers & Keys
            </h1>
            <p className="text-gray-600 mt-1 font-inter">
              Add your API keys for any model. One URL change and you're done.
            </p>
            <div className="flex items-center gap-2 mt-3">
              <code className="px-3 py-1.5 rounded-md bg-beige-primary border border-border-light text-sm font-mono text-gray-900">
                {baseUrl}
              </code>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyUrl}
                className="h-8"
              >
                {copiedUrl ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {tier === 'scale' && (
              <Select
                value={selectedTenant}
                onChange={(e) => setSelectedTenant(e.target.value)}
                className="w-48"
              >
                {mockTenants.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </Select>
            )}
            <Button variant="outline" className="shadow-sm" onClick={() => setShowAddDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Provider
            </Button>
          </div>
        </div>

        {/* Providers Table */}
        <Card className="border-border-light shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Your Providers
            </CardTitle>
            <CardDescription>
              Manage API keys for all your LLM providers
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-8 w-8 animate-spin text-gray-900" />
              </div>
            ) : displayProviders && displayProviders.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border-light">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 font-inter">
                        Provider
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 font-inter">
                        Name
                      </th>
                      {tier === 'scale' && (
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 font-inter">
                          Tenant
                        </th>
                      )}
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 font-inter">
                        Models
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 font-inter">
                        Last Used
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 font-inter">
                        Status
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 font-inter">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayProviders.map((provider) => {
                      const providerInfo = PROVIDERS.find(p => p.id === provider.provider);
                      return (
                        <tr
                          key={provider.id}
                          className="border-b border-border-light hover:bg-beige-primary transition-colors"
                        >
                          <td className="py-3 px-4">
                            <div>
                              <p className="font-medium text-gray-900 font-inter">
                                {providerInfo?.name || provider.provider.charAt(0).toUpperCase() + provider.provider.slice(1)}
                              </p>
                              <p className="text-xs text-gray-600 font-mono">
                                {provider.masked_key}
                              </p>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {editingNameId === provider.id ? (
                              <div className="flex items-center gap-2">
                                <Input
                                  value={editingNameValue}
                                  onChange={(e) => setEditingNameValue(e.target.value)}
                                  className="h-8 w-40"
                                  autoFocus
                                  onBlur={() => handleNameSave(provider.id)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleNameSave(provider.id);
                                    if (e.key === 'Escape') setEditingNameId(null);
                                  }}
                                />
                              </div>
                            ) : (
                              <div
                                className="flex items-center gap-2 cursor-pointer group"
                                onClick={() => handleNameEdit(provider)}
                              >
                                <span className="text-sm text-gray-900">
                                  {provider.key_id || 'Click to add name'}
                                </span>
                                <Edit className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100" />
                              </div>
                            )}
                          </td>
                          {tier === 'scale' && (
                            <td className="py-3 px-4">
                              <Select
                                value={providerTenants[provider.id] || 'all'}
                                onChange={(e) => handleTenantChange(provider.id, e.target.value)}
                                className="w-48 h-8 text-sm"
                              >
                                <option value="all">All tenants</option>
                                {mockTenants.slice(1).map((t) => (
                                  <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                              </Select>
                            </td>
                          )}
                          <td className="py-3 px-4 text-sm text-gray-900">
                            All
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600">
                            {provider.last_used ? formatDate(provider.last_used) : 'Never'}
                          </td>
                          <td className="py-3 px-4">
                            {getStatusBadge(provider)}
                          </td>
                          <td className="py-3 px-4">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedProvider(provider);
                                    setNewApiKey('');
                                    setShowEditDialog(true);
                                  }}
                                >
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedProvider(provider);
                                    setTestResult(null);
                                    setShowTestDialog(true);
                                  }}
                                >
                                  <Plug className="mr-2 h-4 w-4" />
                                  Test Connection
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedProvider(provider);
                                    setRotateApiKey('');
                                    setShowRotateDialog(true);
                                  }}
                                >
                                  <RotateCw className="mr-2 h-4 w-4" />
                                  Rotate Key
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-red-600"
                                  onClick={() => {
                                    setSelectedProvider(provider);
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
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-900 font-inter font-medium mb-2">
                  No providers added yet
                </p>
                <p className="text-gray-600 font-inter text-sm">
                  Add your first one to get started.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Provider Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Provider</DialogTitle>
            <DialogDescription>
              Add your API key for any LLM provider
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="provider">
                Provider <span className="text-red-600">*</span>
              </Label>
              <select
                id="provider"
                className="flex h-10 w-full rounded-lg border border-border-light bg-beige-primary px-3 py-2 text-sm font-inter focus-visible:outline-none"
                value={newProvider}
                onChange={(e) => setNewProvider(e.target.value)}
              >
                <option value="">Select a provider</option>
                {PROVIDERS.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="apiKey">
                API Key <span className="text-red-600">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="apiKey"
                  type={showApiKey ? 'text' : 'password'}
                  placeholder="sk-..."
                  value={newApiKey}
                  onChange={(e) => setNewApiKey(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Name (optional)</Label>
              <Input
                id="name"
                type="text"
                placeholder="My OpenAI Key"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="shadow-sm" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="outline"
              className="shadow-sm"
              onClick={handleAddProvider}
              disabled={!newProvider || !newApiKey || addProviderMutation.isPending}
            >
              {addProviderMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save Provider
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Provider Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Provider</DialogTitle>
            <DialogDescription>
              Update API key for {selectedProvider?.provider}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editApiKey">
                New API Key <span className="text-red-600">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="editApiKey"
                  type={showApiKey ? 'text' : 'password'}
                  placeholder="sk-..."
                  value={newApiKey}
                  onChange={(e) => setNewApiKey(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={handleEditProvider}
              disabled={!newApiKey}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rotate Key Dialog */}
      <Dialog open={showRotateDialog} onOpenChange={setShowRotateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rotate API Key</DialogTitle>
            <DialogDescription>
              Add a new API key for {selectedProvider?.provider}. The old key will remain valid for 24 hours.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
              <p className="text-xs text-blue-900">
                During the 24-hour transition period, both keys will work. This gives you time to update your applications.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rotateApiKey">
                New API Key <span className="text-red-600">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="rotateApiKey"
                  type={showApiKey ? 'text' : 'password'}
                  placeholder="sk-..."
                  value={rotateApiKey}
                  onChange={(e) => setRotateApiKey(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRotateDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={handleRotateKey}
              disabled={!rotateApiKey}
            >
              <RotateCw className="mr-2 h-4 w-4" />
              Rotate Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test Connection Dialog */}
      <Dialog open={showTestDialog} onOpenChange={setShowTestDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Test Connection</DialogTitle>
            <DialogDescription>
              Testing connection to {selectedProvider?.provider}
            </DialogDescription>
          </DialogHeader>
          <div className="py-6">
            {isTesting ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="h-12 w-12 animate-spin text-gray-900 mb-4" />
                <p className="text-sm text-gray-600">Testing connection...</p>
              </div>
            ) : testResult ? (
              <div className={`p-4 rounded-lg border ${
                testResult.success
                  ? 'bg-green-50 border-green-200'
                  : 'bg-red-50 border-red-200'
              }`}>
                <div className="flex items-start gap-3">
                  {testResult.success ? (
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                  )}
                  <div>
                    <p className={`font-medium ${
                      testResult.success ? 'text-green-900' : 'text-red-900'
                    }`}>
                      {testResult.success ? 'Connection Successful' : 'Connection Failed'}
                    </p>
                    <p className={`text-sm mt-1 ${
                      testResult.success ? 'text-green-700' : 'text-red-700'
                    }`}>
                      {testResult.message}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Plug className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-sm text-gray-600 mb-4">
                  Click the button below to test the connection
                </p>
                <Button
                  variant="outline"
                  onClick={handleTestConnection}
                >
                  <Plug className="mr-2 h-4 w-4" />
                  Test Connection
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTestDialog(false)}>
              Close
            </Button>
            {testResult && !testResult.success && (
              <Button
                variant="outline"
                onClick={handleTestConnection}
              >
                Try Again
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Provider</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this provider? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteProvider}
              disabled={deleteProviderMutation.isPending}
            >
              {deleteProviderMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
