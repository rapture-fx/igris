'use client';

export const dynamic = 'force-dynamic';
import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useVaultKeys, useAddVaultKey, useDeleteVaultKey } from '@/hooks/useVault';
import { formatDate } from '@/utils/helpers';
import { Plus, Trash2, Key, Eye, EyeOff, Loader2 } from 'lucide-react';
import { PROVIDERS } from '@/utils/constants';

export default function ProvidersPage() {
  const { data: providers, isLoading } = useVaultKeys();
  const addProviderMutation = useAddVaultKey();
  const deleteProviderMutation = useDeleteVaultKey();

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [newProvider, setNewProvider] = useState('');
  const [newApiKey, setNewApiKey] = useState('');
  const [newName, setNewName] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);

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

  const handleDeleteProvider = async () => {
    if (!selectedProvider) return;

    await deleteProviderMutation.mutateAsync(selectedProvider);
    setShowDeleteDialog(false);
    setSelectedProvider(null);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 mt-0">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-inter" style={{ color: '#114dcd' }}>
              Providers & Keys
            </h1>
            <p className="text-gray-600 mt-1 font-inter">
              Add your API keys for any model. One URL change and you're done.
            </p>
          </div>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Provider
          </Button>
        </div>

        {/* Providers Table */}
        <Card className="border-border-light shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-schlep-blue" />
              Your Providers
            </CardTitle>
            <CardDescription>
              Manage API keys for all your LLM providers
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-8 w-8 animate-spin text-schlep-blue" />
              </div>
            ) : providers && providers.length > 0 ? (
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
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 font-inter">
                        Models Enabled
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
                    {providers.map((provider) => {
                      const providerInfo = PROVIDERS.find(p => p.id === provider.provider);
                      return (
                        <tr
                          key={provider.id}
                          className="border-b border-border-light hover:bg-beige-secondary transition-colors"
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-schlep-blue/10 text-schlep-blue font-bold">
                                {(providerInfo?.name || provider.provider)[0].toUpperCase()}
                              </div>
                              <div>
                                <p className="font-medium text-gray-900 font-inter">
                                  {providerInfo?.name || provider.provider.charAt(0).toUpperCase() + provider.provider.slice(1)}
                                </p>
                                <p className="text-xs text-gray-600 font-mono">
                                  {provider.masked_key}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-900">
                            {provider.key_id || '-'}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-900">
                            All
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600">
                            {provider.last_used ? formatDate(provider.last_used) : 'Never'}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
                                provider.status === 'active'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                provider.status === 'active' ? 'bg-green-600' : 'bg-gray-600'
                              }`} />
                              {provider.status === 'active' ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setSelectedProvider(provider.id);
                                setShowDeleteDialog(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <Key className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-900 font-inter font-medium mb-2">
                  No providers added yet
                </p>
                <p className="text-gray-600 font-inter mb-4 text-sm">
                  Add your first one to get started.
                </p>
                <Button onClick={() => setShowAddDialog(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Provider
                </Button>
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
                className="flex h-10 w-full rounded-lg border border-border-light bg-white px-3 py-2 text-sm font-inter focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-schlep-blue"
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
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button
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
