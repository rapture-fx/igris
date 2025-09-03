'use client'

import { useState } from 'react'
import { ChevronRight, Zap, Database, BarChart3, Cloud, Globe, Code, Users, Megaphone, FileSpreadsheet, FileText, Braces, Terminal, Webhook, Shield, BookOpen, Package } from 'lucide-react'
import Link from 'next/link'

export default function Integrations() {
  const [activeCategory, setActiveCategory] = useState('all');

  const categories = {
    all: {
      title: 'All Capabilities',
      icon: Zap,
      integrations: [
        { icon: FileText, name: 'CSV Files', description: 'Import and export comma-separated value files.' },
        { icon: FileSpreadsheet, name: 'Excel/XLSX', description: 'Process Excel spreadsheets and workbooks.' },
        { icon: Braces, name: 'JSON Data', description: 'Handle structured JSON data formats.' },
        { icon: Globe, name: 'REST APIs', description: 'Standard HTTP APIs for programmatic access.' },
        { icon: Code, name: 'Python SDK', description: 'Full-featured Python library with async support and type hints.' },
        { icon: Package, name: 'JavaScript/TypeScript SDK', description: 'Official npm package with browser and Node.js support.' },
        { icon: Database, name: 'Go SDK', description: 'High-performance Go library for backend integrations.' },
        { icon: Terminal, name: 'CLI Tools', description: 'Command-line interface for batch processing and automation.' },
      ],
    },
    formats: {
      title: 'Data Formats',
      icon: BarChart3,
      integrations: [
        { icon: FileText, name: 'CSV Files', description: 'Import and export comma-separated value files.' },
        { icon: FileSpreadsheet, name: 'Excel/XLSX', description: 'Process Excel spreadsheets and workbooks.' },
        { icon: Braces, name: 'JSON Data', description: 'Handle structured JSON data formats.' },
        { icon: FileText, name: 'TSV Files', description: 'Tab-separated value file support.' },
      ],
    },
    apis: {
      title: 'API Access',
      icon: Code,
      integrations: [
        { icon: Globe, name: 'REST APIs', description: 'Standard HTTP APIs for programmatic access.' },
        { icon: Webhook, name: 'Webhooks', description: 'Real-time event notifications and triggers.' },
        { icon: Shield, name: 'API Authentication', description: 'Secure token-based API access.' },
        { icon: BookOpen, name: 'API Documentation', description: 'Comprehensive API reference and examples.' },
      ],
    },
    sdks: {
      title: 'SDKs & Libraries',
      icon: Users,
      integrations: [
        { icon: Code, name: 'Python SDK', description: 'Full-featured Python library with async support and type hints.' },
        { icon: Package, name: 'JavaScript/TypeScript SDK', description: 'Official npm package with browser and Node.js support.' },
        { icon: Database, name: 'Go SDK', description: 'High-performance Go library for backend integrations.' },
        { icon: Terminal, name: 'CLI Tools', description: 'Command-line interface for batch processing and automation.' },
      ],
    },
  };
  

  

  return (
    <section className="py-20 bg-gray-50 dark:bg-black">
      <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12">
        <div className="mb-16">
          <h2 className="text-3xl md:text-4xl font-semibold text-gray-900 dark:text-white mb-6 text-left">
            Built for Integration
          </h2>
          <p className="text-lg text-gray-700 dark:text-gray-300 max-w-3xl text-left">
            Schlep Engine is designed with standard APIs and common data formats to work seamlessly 
            with your existing tools and workflows.
          </p>
        </div>

        {/* Category Navigation */}
        <div className="mb-12">
          <div className="flex flex-wrap justify-center gap-4">
            {Object.entries(categories).map(([key, category]) => {
              const IconComponent = category.icon
              return (
                <button
                  key={key}
                  onClick={() => setActiveCategory(key)}
                  className={`flex items-center space-x-2 px-6 py-3 rounded-full font-medium transition-all duration-300 transform hover:scale-105 ${
                    activeCategory === key
                      ? 'bg-blue-600 text-white shadow-lg dark:bg-blue-500'
                      : 'bg-white text-gray-700 hover:bg-blue-50 shadow-md dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                  }`}
                >
                  <IconComponent className="w-5 h-5" />
                  <span>{category.title}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Capabilities Grid */}
        <div className="mb-20">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories[activeCategory as keyof typeof categories].integrations.map((integration, index) => {
              const IconComponent = integration.icon
              return (
                <div
                  key={index}
                  className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 group"
                >
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <IconComponent className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {integration.name}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                        {integration.description}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        

        

        {/* Integration Approach */}
        <div className="mt-20">
          <h3 className="text-2xl font-semibold text-gray-900 dark:text-white text-center mb-12">
            How It Works With Your Stack
          </h3>
          
          <div className="relative">
            {/* Desktop flow with connecting lines */}
            <div className="hidden lg:block">
              <div className="grid grid-cols-4 gap-8 relative">
                {/* Connecting arrows */}
                <div className="absolute top-12 left-1/4 right-1/4 flex justify-between items-center pointer-events-none">
                  <ChevronRight className="w-6 h-6 text-blue-400" />
                  <ChevronRight className="w-6 h-6 text-blue-400" />
                  <ChevronRight className="w-6 h-6 text-blue-400" />
                </div>
                
                <div className="bg-white rounded-xl p-6 dark:bg-gray-800 text-center border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-300 relative z-10">
                  <div className="flex justify-center mb-4">
                    <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                      <Database className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                    </div>
                  </div>
                  <div className="absolute -top-2 -left-2 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Upload</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                    Import your data via API, web interface, or direct file upload
                  </p>
                </div>

                <div className="bg-white rounded-xl p-6 dark:bg-gray-800 text-center border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-300 relative z-10">
                  <div className="flex justify-center mb-4">
                    <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                      <Zap className="w-8 h-8 text-green-600 dark:text-green-400" />
                    </div>
                  </div>
                  <div className="absolute -top-2 -left-2 w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Process</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                    AI-powered cleaning and transformation in the cloud
                  </p>
                </div>

                <div className="bg-white rounded-xl p-6 dark:bg-gray-800 text-center border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-300 relative z-10">
                  <div className="flex justify-center mb-4">
                    <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
                      <Code className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                    </div>
                  </div>
                  <div className="absolute -top-2 -left-2 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center text-sm font-bold">3</div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Export</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                    Download clean data in standard formats (CSV, JSON, Excel)
                  </p>
                </div>

                <div className="bg-white rounded-xl p-6 dark:bg-gray-800 text-center border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-300 relative z-10">
                  <div className="flex justify-center mb-4">
                    <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
                      <Globe className="w-8 h-8 text-orange-600 dark:text-orange-400" />
                    </div>
                  </div>
                  <div className="absolute -top-2 -left-2 w-8 h-8 bg-orange-600 text-white rounded-full flex items-center justify-center text-sm font-bold">4</div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Integrate</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                    Use standard formats to connect with any downstream tool
                  </p>
                </div>
              </div>
            </div>

            {/* Mobile/tablet layout */}
            <div className="lg:hidden grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl p-6 dark:bg-gray-800 text-center border border-gray-200 dark:border-gray-700">
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center relative">
                    <Database className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                    <div className="absolute -top-2 -left-2 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
                  </div>
                </div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Upload</h4>
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                  Import your data via API, web interface, or direct file upload
                </p>
              </div>

              <div className="bg-white rounded-xl p-6 dark:bg-gray-800 text-center border border-gray-200 dark:border-gray-700">
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center relative">
                    <Zap className="w-8 h-8 text-green-600 dark:text-green-400" />
                    <div className="absolute -top-2 -left-2 w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
                  </div>
                </div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Process</h4>
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                  AI-powered cleaning and transformation in the cloud
                </p>
              </div>

              <div className="bg-white rounded-xl p-6 dark:bg-gray-800 text-center border border-gray-200 dark:border-gray-700">
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center relative">
                    <Code className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                    <div className="absolute -top-2 -left-2 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center text-sm font-bold">3</div>
                  </div>
                </div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Export</h4>
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                  Download clean data in standard formats (CSV, JSON, Excel)
                </p>
              </div>

              <div className="bg-white rounded-xl p-6 dark:bg-gray-800 text-center border border-gray-200 dark:border-gray-700">
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center relative">
                    <Globe className="w-8 h-8 text-orange-600 dark:text-orange-400" />
                    <div className="absolute -top-2 -left-2 w-8 h-8 bg-orange-600 text-white rounded-full flex items-center justify-center text-sm font-bold">4</div>
                  </div>
                </div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Integrate</h4>
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                  Use standard formats to connect with any downstream tool
                </p>
              </div>
            </div>
          </div>

          <div className="mt-12 bg-blue-50 dark:bg-gray-800 rounded-2xl p-8 text-center">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Standard Formats, Universal Compatibility
            </h4>
            <p className="text-gray-700 dark:text-gray-300 max-w-3xl mx-auto">
              Rather than building specific integrations that become outdated, Schlep Engine focuses on 
              standard data formats and robust APIs. This means it works with any tool that can read CSV, JSON, 
              or connect to REST APIs - which is virtually everything.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}