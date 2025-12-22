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
import { formatDate, maskApiKey } from '@/utils/helpers';
import { Plus, Trash2, Key, Eye, EyeOff, Loader2 } from 'lucide-react';
import { PROVIDERS } from '@/utils/constants';

export default function VaultPage() {
  const { data: keys, isLoading } = useVaultKeys();
  const addKeyMutation = useAddVaultKey();
  const deleteKeyMutation = useDeleteVaultKey();

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [newKeyProvider, setNewKeyProvider] = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [showKeyValue, setShowKeyValue] = useState(false);

  const handleAddKey = async () => {
    if (!newKeyProvider || !newKeyValue) return;

    await addKeyMutation.mutateAsync({
      provider: newKeyProvider,
      api_key: newKeyValue,
    });

    setShowAddDialog(false);
    setNewKeyProvider('');
    setNewKeyValue('');
  };

  const handleDeleteKey = async () => {
    if (!selectedKey) return;

    await deleteKeyMutation.mutateAsync(selectedKey);
    setShowDeleteDialog(false);
    setSelectedKey(null);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-medium text-gray-900 font-inter">
              Vault Management
            </h1>
            <p className="text-gray-600 mt-1 font-inter">
              Securely manage your API keys
            </p>
          </div>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add API Key
          </Button>
        </div>

        {/* API Keys List */}
        <Card className="border-border-light shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-gray-900" />
              API Keys
            </CardTitle>
            <CardDescription>
              Your encrypted API keys for LLM providers
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-8 w-8 animate-spin text-gray-900" />
              </div>
            ) : keys && keys.length > 0 ? (
              <div className="space-y-3">
                {keys.map((key) => (
                  <div
                    key={key.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-border-light bg-beige-primary hover:bg-beige-primary transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gray-100 text-gray-900">
                        <Key className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900 font-inter">
                          {key.provider.charAt(0).toUpperCase() + key.provider.slice(1)}
                        </h3>
                        <p className="text-sm text-gray-600 font-mono">
                          {maskApiKey(key.masked_key)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Added {formatDate(key.created_at)}
                          {key.last_used && ` • Last used ${formatDate(key.last_used)}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          key.status === 'active'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {key.status}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedKey(key.id);
                          setShowDeleteDialog(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Key className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 font-inter mb-4">
                  No API keys added yet
                </p>
                <Button onClick={() => setShowAddDialog(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Your First Key
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Security Notice */}
        <Card className="border-border-light bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100">
                  <Key className="h-4 w-4 text-blue-600" />
                </div>
              </div>
              <div>
                <h3 className="font-medium text-blue-900 font-inter mb-1">
                  Your keys are encrypted
                </h3>
                <p className="text-sm text-blue-700 font-inter">
                  All API keys are encrypted at rest using AES-256 encryption and stored in our secure vault.
                  Keys are only decrypted in memory when making API calls.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add Key Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add API Key</DialogTitle>
            <DialogDescription>
              Add a new provider API key to your vault
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="provider">Provider</Label>
              <select
                id="provider"
                className="flex h-10 w-full rounded-lg border border-border-light bg-beige-primary px-3 py-2 text-sm font-inter focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
                value={newKeyProvider}
                onChange={(e) => setNewKeyProvider(e.target.value)}
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
              <Label htmlFor="apiKey">API Key</Label>
              <div className="relative">
                <Input
                  id="apiKey"
                  type={showKeyValue ? 'text' : 'password'}
                  placeholder="sk-..."
                  value={newKeyValue}
                  onChange={(e) => setNewKeyValue(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  onClick={() => setShowKeyValue(!showKeyValue)}
                >
                  {showKeyValue ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddKey}
              disabled={!newKeyProvider || !newKeyValue || addKeyMutation.isPending}
            >
              {addKeyMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Add Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete API Key</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this API key? This action cannot be undone.
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
              onClick={handleDeleteKey}
              disabled={deleteKeyMutation.isPending}
            >
              {deleteKeyMutation.isPending && (
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
