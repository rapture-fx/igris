'use client'

import { Plus, Link, Trash2, RefreshCw } from 'lucide-react'

const integrations = [
  { id: 1, name: 'AWS S3', description: 'Cloud object storage', category: 'Storage', status: 'Connected', logo: '/logos/aws-s3.svg' },
  { id: 2, name: 'PostgreSQL', description: 'Object-relational database', category: 'Database', status: 'Connected', logo: '/logos/postgresql.svg' },
  { id: 3, name: 'OpenAI', description: 'Language models and AI', category: 'AI Service', status: 'Connected', logo: '/logos/openai.svg' },
  { id: 4, name: 'Slack', description: 'Team communication', category: 'Communication', status: 'Disconnected', logo: '/logos/slack.svg' },
  { id: 5, name: 'Datadog', description: 'Monitoring & Analytics', category: 'Monitoring', status: 'Connected', logo: '/logos/datadog.svg' },
  { id: 6, name: 'Segment', description: 'Customer data platform', category: 'Analytics', status: 'Disconnected', logo: '/logos/segment.svg' },
]

export const IntegrationsTab = () => {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Connected Services</h3>
              <p className="mt-1 text-sm text-gray-600">Manage your third-party integrations.</p>
            </div>
            <button className="inline-flex items-center px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              Add Integration
            </button>
          </div>
        </div>
        
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {integrations.map(integration => (
              <div key={integration.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-4">
                  <img src={integration.logo} alt={integration.name} className="w-10 h-10" />
                  <div>
                    <h4 className="font-semibold text-gray-800">{integration.name}</h4>
                    <p className="text-sm text-gray-500">{integration.description}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    integration.status === 'Connected' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {integration.status}
                  </span>
                  {integration.status === 'Connected' ? (
                    <button className="p-2 text-gray-500 hover:text-red-600 hover:bg-gray-100 rounded-md">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  ) : (
                    <button className="p-2 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded-md">
                      <Link className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
} 