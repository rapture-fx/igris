
'use client'

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileUpload } from './FileUpload'; // Re-using the existing component
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Globe, UploadCloud, Database, GitBranch, Briefcase, Server } from 'lucide-react';

interface EnhancedDataUploadProps {
    onUploadComplete?: (investigationId: string) => void;
    onUploadStart?: () => void;
    className?: string;
    workspaceId?: string; // Accepted but not used in this component directly
}

const dataSourceTypes = [
  { value: 'postgres', label: 'PostgreSQL', icon: Database },
  { value: 'mysql', label: 'MySQL', icon: Database },
  { value: 's3', label: 'AWS S3', icon: Briefcase },
  { value: 'gcs', label: 'Google Cloud Storage', icon: Briefcase },
  { value: 'snowflake', label: 'Snowflake', icon: Server },
  { value: 'bigquery', label: 'Google BigQuery', icon: Server },
  { value: 'github', label: 'GitHub Repository', icon: GitBranch },
  { value: 'url', label: 'Public URL', icon: Globe },
];

function DataSourceConnector() {
  const [sourceType, setSourceType] = useState('postgres');
  
  const renderForm = () => {
    const commonFields = (
        <>
            <Input placeholder="Host" />
            <Input placeholder="Port" />
            <Input placeholder="Database Name" />
            <Input placeholder="Username" />
            <Input type="password" placeholder="Password" />
        </>
    );
    switch (sourceType) {
      case 'postgres':
      case 'mysql':
      case 'snowflake':
      case 'bigquery':
        return (
          <div className="space-y-4">
            {commonFields}
            <Input placeholder="Table Name or Query" />
          </div>
        );
      case 's3':
      case 'gcs':
        return (
            <div className="space-y-4">
                <Input placeholder="Bucket Name" />
                <Input placeholder="File Path / Prefix" />
                <Input placeholder="Access Key ID" />
                <Input type="password" placeholder="Secret Access Key" />
          </div>
        )
    case 'github':
        return (
            <div className="space-y-4">
                <Input placeholder="Repository URL (e.g. owner/repo)" />
                <Input placeholder="File path (e.g. data/my_data.csv)" />
                <Input placeholder="Branch (e.g. main)" />
                <Input type="password" placeholder="Personal Access Token (optional)" />
          </div>
        )
    case 'url':
        return (
            <div className="space-y-4">
                <Input placeholder="https://example.com/data.csv" />
          </div>
        )
      default:
        return <p>Select a data source type.</p>;
    }
  };

  const SelectedIcon = dataSourceTypes.find(d => d.value === sourceType)?.icon || Server;

  return (
    <div className="p-8 border border-gray-200 rounded-lg">
      <h3 className="text-lg font-semibold mb-4">Connect to Data Source</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-4">
           <Select value={sourceType} onValueChange={setSourceType}>
            <SelectTrigger>
                <SelectValue placeholder="Select data source" />
            </SelectTrigger>
            <SelectContent>
              {dataSourceTypes.map(({ value, label, icon: Icon }) => (
                <SelectItem key={value} value={value}>
                    <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4" />
                        <span>{label}</span>
                    </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="p-4 border rounded-lg flex flex-col items-center justify-center text-center bg-gray-50">
                <SelectedIcon className="w-12 h-12 text-gray-400 mb-2" />
                <p className="font-semibold">{dataSourceTypes.find(d => d.value === sourceType)?.label}</p>
                <p className="text-sm text-gray-500">Provide connection details to sync your data.</p>
            </div>
        </div>
        <div className="md:col-span-2">
            {renderForm()}
            <Button className="w-full mt-6">Test Connection & Proceed</Button>
        </div>
      </div>
    </div>
  );
}


export function EnhancedDataUpload({ 
    onUploadComplete, 
    onUploadStart, 
    className 
}: EnhancedDataUploadProps) {
  return (
    <div className={className}>
      <Tabs defaultValue="local" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="local">
            <UploadCloud className="w-4 h-4 mr-2" />
            Upload from Computer
          </TabsTrigger>
          <TabsTrigger value="datasource">
            <Globe className="w-4 h-4 mr-2" />
            Connect Data Source
          </TabsTrigger>
        </TabsList>
        <TabsContent value="local" className="pt-6">
          <FileUpload onUploadComplete={onUploadComplete} onUploadStart={onUploadStart} />
        </TabsContent>
        <TabsContent value="datasource" className="pt-6">
          <DataSourceConnector />
        </TabsContent>
      </Tabs>
    </div>
  );
} 