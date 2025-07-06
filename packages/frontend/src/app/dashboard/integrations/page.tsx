'use client'

import { useState, useEffect } from 'react'
import {
  Network,
  Plus,
  Search,
  CheckCircle,
  Settings,
  MoreVertical,
  ExternalLink
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'

interface Integration {
  id: string;
  name: string;
  category: 'Storage' | 'Databases' | 'Analytics' | 'Webhooks';
  description: string;
  logo: string;
  isConnected: boolean;
  docsUrl: string;
}

const allIntegrations: Integration[] = [
    { id: 's3', name: 'Amazon S3', category: 'Storage', description: 'Connect to your Amazon S3 buckets for seamless data import and export.', logo: '/logos/aws-s3.svg', isConnected: true, docsUrl: '#' },
    { id: 'gcs', name: 'Google Cloud Storage', category: 'Storage', description: 'Integrate with GCS to manage your cloud storage files directly.', logo: '/logos/gcp-storage.svg', isConnected: false, docsUrl: '#' },
    { id: 'postgres', name: 'PostgreSQL', category: 'Databases', description: 'Directly query and sync data with your PostgreSQL databases.', logo: '/logos/postgresql.svg', isConnected: true, docsUrl: '#' },
    { id: 'snowflake', name: 'Snowflake', category: 'Databases', description: 'Leverage the Snowflake Data Cloud for powerful analytics.', logo: '/logos/snowflake.svg', isConnected: false, docsUrl: '#' },
    { id: 'segment', name: 'Segment', category: 'Analytics', description: 'Sync your data with Segment to unify customer event tracking.', logo: '/logos/segment.svg', isConnected: false, docsUrl: '#' },
    { id: 'datadog', name: 'Datadog', category: 'Analytics', description: 'Send logs and metrics to Datadog for unified observability.', logo: '/logos/datadog.svg', isConnected: true, docsUrl: '#' },
    { id: 'generic_webhook', name: 'Webhooks', category: 'Webhooks', description: 'Send automated data payloads to any custom API endpoint.', logo: '/logos/webhook.svg', isConnected: true, docsUrl: '#' },
];

export default function IntegrationsPage() {
    const [searchTerm, setSearchTerm] = useState('')
    const [activeCategory, setActiveCategory] = useState('All')

    const categories = ['All', ...Array.from(new Set(allIntegrations.map(i => i.category)))]

    const filteredIntegrations = allIntegrations.filter(integration => {
        const matchesCategory = activeCategory === 'All' || integration.category === activeCategory;
        const matchesSearch = integration.name.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesCategory && matchesSearch;
    });

  return (
        <div className="space-y-8">
            <PageHeader
                title="Integrations Hub"
                description="Connect your favorite tools and services to supercharge your data workflows."
            >
                <button className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 hover:bg-gray-100">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Integration Docs
                </button>
                <button className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium rounded-lg shadow-sm hover:shadow-lg transition-all transform hover:scale-105">
                    <Plus className="w-4 h-4 mr-2" />
                    New Integration
                </button>
            </PageHeader>

            <div className="bg-white rounded-2xl shadow-sm p-6">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center space-x-2 border border-gray-200 rounded-lg p-1">
                        {categories.map(category => (
                            <button 
                                key={category}
                                onClick={() => setActiveCategory(category)}
                                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${activeCategory === category ? 'bg-blue-600 text-white shadow' : 'text-gray-600 hover:bg-gray-100'}`}
                            >
                                {category}
                            </button>
                        ))}
                    </div>
                    <div className="relative w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search integrations..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm w-full focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredIntegrations.map(integration => (
                        <div key={integration.id} className="bg-white border border-gray-200/80 rounded-xl p-5 flex flex-col hover:shadow-md hover:border-blue-300 transition-all duration-200">
                            <div className="flex justify-between items-start mb-4">
                                <img src={integration.logo} alt={`${integration.name} logo`} className="h-10 w-10 object-contain"/>
                                {integration.isConnected ? (
                                    <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                        <CheckCircle className="w-3 h-3 mr-1.5"/>Connected
                                    </div>
                                ) : (
                                     <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                        Not Connected
                                    </div>
                                )}
                            </div>
                            <div className="flex-grow">
                                <h3 className="font-semibold text-lg text-gray-900">{integration.name}</h3>
                                <p className="text-sm text-gray-500 mt-1">{integration.description}</p>
                            </div>
                            <div className="flex items-center justify-between mt-6">
                                {integration.isConnected ? (
                                    <button className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 hover:bg-gray-50">
                                        <Settings className="w-4 h-4 mr-2"/> Manage
                                    </button>
                                ) : (
                                    <button className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700">
                                        Connect
                                    </button>
                                )}
                                <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-md">
                                    <MoreVertical className="w-4 h-4"/>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
                 {filteredIntegrations.length === 0 && (
                    <div className="text-center py-16">
                        <Network className="mx-auto h-12 w-12 text-gray-400" />
                        <h3 className="mt-2 text-sm font-medium text-gray-900">No matching integrations</h3>
                        <p className="mt-1 text-sm text-gray-500">Try adjusting your search or filter.</p>
                    </div>
                )}
            </div>
    </div>
  )
} 