'use client'

import { useState } from 'react'
import { 
  Activity, 
  BarChart3, 
  Database, 
  Upload, 
  Download, 
  Settings, 
  User, 
  HelpCircle,
  Layers,
  LogOut,
  Home,
  Workflow,
  FileText,
  Terminal,
  Zap,
  CreditCard
} from 'lucide-react'

export default function UserDashboard() {
  const [activeSection, setActiveSection] = useState('overview')

  const sidebarSections = [
    {
      title: 'Overview',
      items: [
        { name: 'Dashboard', icon: Home, id: 'overview', active: activeSection === 'overview' },
        { name: 'Project', icon: Layers, id: 'project', active: activeSection === 'project' }
      ]
    },
    {
      title: 'Data & Processing', 
      items: [
        { name: 'Data Processing', icon: Database, id: 'data', active: activeSection === 'data' },
        { name: 'Pipeline Builder', icon: Workflow, id: 'pipelines', active: activeSection === 'pipelines' },
        { name: 'Data Explorer', icon: BarChart3, id: 'explorer', active: activeSection === 'explorer' },
        { name: 'Jobs & Monitoring', icon: Activity, id: 'jobs', active: activeSection === 'jobs' }
      ]
    },
    {
      title: 'Development',
      items: [
        { name: 'ML Models', icon: Zap, id: 'models', active: activeSection === 'models' },
        { name: 'API Playground', icon: Terminal, id: 'api', active: activeSection === 'api' },
        { name: 'SDK & CLI Tools', icon: FileText, id: 'tools', active: activeSection === 'tools' }
      ]
    },
    {
      title: 'Account',
      items: [
        { name: 'Billing & Usage', icon: CreditCard, id: 'billing', active: activeSection === 'billing' },
        { name: 'Settings', icon: Settings, id: 'settings', active: activeSection === 'settings' }
      ]
    }
  ]

  const renderContent = () => {
    switch (activeSection) {
      case 'data':
        return (
          <div className="text-center py-12">
            <Database className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Data Processing</h3>
            <p className="text-gray-400">Upload and process your datasets with AI-powered cleaning</p>
          </div>
        );
      case 'billing':
        return (
          <div className="text-center py-12">
            <CreditCard className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Billing & Usage</h3>
            <p className="text-gray-400">Manage your subscription and view usage metrics</p>
          </div>
        );
      case 'pipelines':
        return (
          <div className="text-center py-12">
            <Workflow className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Pipeline Builder</h3>
            <p className="text-gray-400">Create and manage your data processing workflows</p>
          </div>
        );
      case 'explorer':
        return (
          <div className="text-center py-12">
            <BarChart3 className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Data Explorer</h3>
            <p className="text-gray-400">Interactive data profiling and analysis</p>
          </div>
        );
      case 'jobs':
        return (
          <div className="text-center py-12">
            <Activity className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Jobs & Monitoring</h3>
            <p className="text-gray-400">Monitor and manage your data processing jobs</p>
          </div>
        );
      case 'api':
        return (
          <div className="text-center py-12">
            <Terminal className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">API Playground</h3>
            <p className="text-gray-400">Test and explore Schlep Engine APIs interactively</p>
          </div>
        );
      case 'models':
        return (
          <div className="text-center py-12">
            <Zap className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">ML Models</h3>
            <p className="text-gray-400">Manage and deploy your machine learning models</p>
          </div>
        );
      case 'tools':
        return (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">SDK & CLI Tools</h3>
            <p className="text-gray-400">Developer tools and integrations for Schlep Engine</p>
          </div>
        );
      case 'project':
        return (
          <div className="text-center py-12">
            <Layers className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Project Overview</h3>
            <p className="text-gray-400">Manage your project settings and details</p>
          </div>
        );
      case 'settings':
        return (
          <div className="text-center py-12">
            <Settings className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Settings</h3>
            <p className="text-gray-400">Manage your account settings</p>
          </div>
        );
      default:
        return (
          <div className="text-center py-12">
            <Home className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Dashboard Overview</h3>
            <p className="text-gray-400">Welcome to your Schlep Engine dashboard</p>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#111111] p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">Dashboard</h1>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-6">
              <h2 className="text-xl font-semibold text-white mb-6">Navigation</h2>
              {sidebarSections.map((section) => (
                <div key={section.title} className="mb-6">
                  <h3 className="text-sm font-medium text-gray-400 mb-3">{section.title}</h3>
                  <div className="space-y-1">
                    {section.items.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setActiveSection(item.id)}
                        className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                          item.active
                            ? 'bg-[#222222] text-white'
                            : 'text-gray-400 hover:text-white hover:bg-[#161616]'
                        }`}
                      >
                        <item.icon className="w-4 h-4" />
                        <span className="text-sm">{item.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Main Content */}
          <div className="lg:col-span-3">
            <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-6">
              {renderContent()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}